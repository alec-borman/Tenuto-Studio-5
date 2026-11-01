export interface BakedVoicePcm {
  left: Float32Array;
  right: Float32Array;
}

interface PendingJob {
  resolve: (pcm: BakedVoicePcm) => void;
  reject: (err: Error) => void;
  worker: Worker;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Small pool of dedicated workers that render synth voices off the main thread.
 * `VoiceBakePool.create()` returns null where workers are unavailable (jsdom/vitest, locked-down
 * webviews); if a worker fails at runtime the pool marks itself broken and callers fall back to
 * main-thread rendering.
 */
export class VoiceBakePool {
  private workers: Worker[] = [];
  private inFlight = new Map<Worker, number>();
  private pending = new Map<number, PendingJob>();
  private nextJobId = 1;
  private consecutiveTimeouts = 0;
  public broken = false;

  static create(): VoiceBakePool | null {
    if (typeof Worker === 'undefined' || typeof window === 'undefined') return null;
    try {
      const pool = new VoiceBakePool();
      const cores = Number((navigator as any)?.hardwareConcurrency) || 2;
      const count = Math.max(1, Math.min(3, cores - 1));
      for (let i = 0; i < count; i++) {
        const w = new Worker(new URL('./voiceBakeWorker.ts', import.meta.url), { type: 'module' });
        w.onmessage = (e) => pool.handleMessage(w, e);
        w.onerror = (e) => {
          e.preventDefault?.();
          pool.fail(new Error(e.message || 'Voice bake worker failed'));
        };
        pool.workers.push(w);
        pool.inFlight.set(w, 0);
      }
      return pool;
    } catch {
      return null;
    }
  }

  get size(): number {
    return this.workers.length;
  }

  get pendingCount(): number {
    return this.pending.size;
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
    let target = this.workers[0];
    for (const w of this.workers) {
      if ((this.inFlight.get(w) || 0) < (this.inFlight.get(target) || 0)) target = w;
    }
    const jobId = this.nextJobId++;
    return new Promise<BakedVoicePcm>((resolve, reject) => {
      const timer = setTimeout(() => {
        const timedOutJob = this.settle(jobId);
        if (!timedOutJob) return;
        this.consecutiveTimeouts++;
        if (this.consecutiveTimeouts >= 4) {
          this.fail(new Error('Voice bake worker pool timed out repeatedly'));
        } else {
          timedOutJob.reject(new Error('Voice bake worker job timed out'));
        }
      }, 1200);
      this.pending.set(jobId, { resolve, reject, worker: target, timer });
      this.inFlight.set(target, (this.inFlight.get(target) || 0) + 1);
      try {
        target.postMessage({ jobId, item, sampleRate, tempoBpm, voiceSeed });
      } catch (err) {
        this.settle(jobId);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  /**
   * Cancels all queued/in-flight jobs for the current playback session so pressing Stop -> Play
   * immediately frees the worker queue for the new session.
   */
  cancelPending(): void {
    for (const [jobId, job] of Array.from(this.pending.entries())) {
      clearTimeout(job.timer);
      this.pending.delete(jobId);
      job.reject(new Error('Voice bake cancelled'));
    }
    for (const w of this.workers) {
      this.inFlight.set(w, 0);
    }
  }

  private settle(jobId: number): PendingJob | undefined {
    const job = this.pending.get(jobId);
    if (!job) return undefined;
    clearTimeout(job.timer);
    this.pending.delete(jobId);
    this.inFlight.set(job.worker, Math.max(0, (this.inFlight.get(job.worker) || 1) - 1));
    return job;
  }

  private handleMessage(_w: Worker, e: MessageEvent): void {
    const { jobId, left, right, error } = e.data || {};
    const job = this.settle(jobId);
    if (!job) return;
    this.consecutiveTimeouts = 0;
    if (error || !left || !right) {
      job.reject(new Error(error || 'Empty voice bake result'));
    } else {
      job.resolve({ left, right });
    }
  }

  private fail(err: Error): void {
    this.broken = true;
    for (const [jobId, job] of Array.from(this.pending.entries())) {
      clearTimeout(job.timer);
      this.pending.delete(jobId);
      job.reject(err);
    }
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
    this.inFlight.clear();
  }
}
