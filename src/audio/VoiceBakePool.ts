export interface BakedVoicePcm {
  left: Float32Array;
  right: Float32Array;
}

interface QueuedJob {
  jobId: number;
  item: unknown;
  sampleRate: number;
  tempoBpm: number;
  voiceSeed: number;
  resolve: (pcm: BakedVoicePcm) => void;
  reject: (err: Error) => void;
}

interface ActiveJob extends QueuedJob {
  worker: Worker;
  timer: ReturnType<typeof setTimeout>;
  cancelled: boolean;
}

/**
 * Small pool of dedicated workers that render synth voices off the main thread.
 * Uses a main-thread FIFO queue and dispatches at most 1 job per idle worker at a time:
 * - Per-job timeout (2,500ms) starts ONLY when the job is actually sent to an idle worker,
 *   preventing false queue-wait timeouts when 20+ voices are requested at once.
 * - `cancelPending()` on Stop/Play clears the waiting queue immediately in 0ms so workers
 *   never waste time grinding through stale jobs from a stopped session.
 */
export class VoiceBakePool {
  private workers: Worker[] = [];
  private activeByWorker = new Map<Worker, ActiveJob | null>();
  private activeByJobId = new Map<number, ActiveJob>();
  private queue: QueuedJob[] = [];
  private nextJobId = 1;
  private consecutiveTimeouts = 0;
  public broken = false;

  static create(): VoiceBakePool | null {
    if (typeof Worker === 'undefined' || typeof window === 'undefined') return null;
    try {
      const pool = new VoiceBakePool();
      const cores = Number((navigator as any)?.hardwareConcurrency) || 4;
      const count = Math.max(2, Math.min(4, cores - 1));
      for (let i = 0; i < count; i++) {
        const w = pool.spawnWorker();
        if (w) {
          pool.workers.push(w);
          pool.activeByWorker.set(w, null);
        }
      }
      return pool.workers.length > 0 ? pool : null;
    } catch {
      return null;
    }
  }

  private spawnWorker(): Worker | null {
    try {
      const w = new Worker(new URL('./voiceBakeWorker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e) => this.handleMessage(w, e);
      w.onerror = (e) => {
        e.preventDefault?.();
        this.handleWorkerError(w, new Error(e.message || 'Voice bake worker failed'));
      };
      return w;
    } catch {
      return null;
    }
  }

  get size(): number {
    return this.workers.length;
  }

  get pendingCount(): number {
    return this.queue.length + this.activeByJobId.size;
  }

  bake(
    item: unknown,
    sampleRate: number,
    tempoBpm: number,
    voiceSeed: number
  ): Promise<BakedVoicePcm> {
    if (this.broken || this.workers.length === 0) {
      return Promise.reject(new Error('Voice bake pool unavailable'));
    }
    const jobId = this.nextJobId++;
    return new Promise<BakedVoicePcm>((resolve, reject) => {
      this.queue.push({
        jobId,
        item,
        sampleRate,
        tempoBpm,
        voiceSeed,
        resolve,
        reject,
      });
      this.dispatchNext();
    });
  }

  private dispatchNext(): void {
    if (this.broken || this.queue.length === 0) return;
    for (const w of this.workers) {
      if (this.queue.length === 0) break;
      if (this.activeByWorker.get(w)) continue;

      const next = this.queue.shift()!;
      const timer = setTimeout(() => {
        this.handleJobTimeout(next.jobId);
      }, 2500);

      const active: ActiveJob = {
        ...next,
        worker: w,
        timer,
        cancelled: false,
      };
      this.activeByWorker.set(w, active);
      this.activeByJobId.set(active.jobId, active);

      try {
        w.postMessage({
          jobId: active.jobId,
          item: active.item,
          sampleRate: active.sampleRate,
          tempoBpm: active.tempoBpm,
          voiceSeed: active.voiceSeed,
        });
      } catch (err) {
        clearTimeout(active.timer);
        this.activeByWorker.set(w, null);
        this.activeByJobId.delete(active.jobId);
        active.reject(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }

  /**
   * Cancels all queued jobs for the current playback session immediately (0ms) and marks
   * in-flight worker jobs as cancelled so pressing Stop -> Play starts with an empty queue.
   */
  cancelPending(): void {
    while (this.queue.length > 0) {
      const queued = this.queue.shift()!;
      queued.reject(new Error('Voice bake cancelled'));
    }
    for (const active of Array.from(this.activeByJobId.values())) {
      if (!active.cancelled) {
        active.cancelled = true;
        active.reject(new Error('Voice bake cancelled'));
      }
    }
  }

  private handleJobTimeout(jobId: number): void {
    const active = this.activeByJobId.get(jobId);
    if (!active) return;
    clearTimeout(active.timer);
    this.activeByJobId.delete(jobId);
    this.activeByWorker.set(active.worker, null);

    // Terminate and respawn the stalled worker so the pool stays healthy
    this.replaceWorker(active.worker);

    if (!active.cancelled) {
      this.consecutiveTimeouts++;
      if (this.consecutiveTimeouts >= 6 && this.workers.length === 0) {
        this.fail(new Error('Voice bake worker pool timed out repeatedly'));
        return;
      }
      active.reject(new Error('Voice bake worker job timed out'));
    }
    this.dispatchNext();
  }

  private replaceWorker(oldWorker: Worker): void {
    try {
      oldWorker.terminate();
    } catch {
      // Ignore
    }
    this.activeByWorker.delete(oldWorker);
    const idx = this.workers.indexOf(oldWorker);
    const replacement = this.spawnWorker();
    if (replacement) {
      if (idx >= 0) {
        this.workers[idx] = replacement;
      } else {
        this.workers.push(replacement);
      }
      this.activeByWorker.set(replacement, null);
    } else if (idx >= 0) {
      this.workers.splice(idx, 1);
    }
  }

  private handleWorkerError(w: Worker, err: Error): void {
    const active = this.activeByWorker.get(w);
    if (active) {
      clearTimeout(active.timer);
      this.activeByJobId.delete(active.jobId);
      if (!active.cancelled) {
        active.reject(err);
      }
    }
    this.replaceWorker(w);
    if (this.workers.length === 0) {
      this.fail(err);
    } else {
      this.dispatchNext();
    }
  }

  private handleMessage(w: Worker, e: MessageEvent): void {
    const { jobId, left, right, error } = e.data || {};
    const active = this.activeByJobId.get(jobId);
    if (!active) {
      this.activeByWorker.set(w, null);
      this.dispatchNext();
      return;
    }
    clearTimeout(active.timer);
    this.activeByJobId.delete(jobId);
    this.activeByWorker.set(w, null);
    this.consecutiveTimeouts = 0;

    if (!active.cancelled) {
      if (error || !left || !right) {
        active.reject(new Error(error || 'Empty voice bake result'));
      } else {
        active.resolve({ left, right });
      }
    }
    this.dispatchNext();
  }

  private fail(err: Error): void {
    this.broken = true;
    while (this.queue.length > 0) {
      const queued = this.queue.shift()!;
      queued.reject(err);
    }
    for (const active of Array.from(this.activeByJobId.values())) {
      clearTimeout(active.timer);
      if (!active.cancelled) {
        active.reject(err);
      }
    }
    this.activeByJobId.clear();
    this.dispose();
  }

  dispose(): void {
    for (const w of this.workers) {
      try {
        w.terminate();
      } catch {
        // Ignore
      }
    }
    this.workers = [];
    this.activeByWorker.clear();
  }
}
