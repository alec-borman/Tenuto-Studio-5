import { playbackDiag } from './PlaybackDiagnostics';

export interface BakedVoicePcm {
  left: Float32Array;
  right: Float32Array;
  peak: number;
  rms: number;
  nanCount: number;
  nonZeroFrames: number;
  bakeMs: number;
  queueWaitMs: number;
}

interface VoiceJobItemMeta {
  startSec?: number;
  durSec?: number;
  patch?: string;
  event?: { trackId?: string; measure?: number; beat?: number };
}

interface QueuedJob {
  jobId: number;
  item: VoiceJobItemMeta;
  sampleRate: number;
  tempoBpm: number;
  voiceSeed: number;
  urgent: boolean;
  enqueuedAtMs: number;
  resolve: (pcm: BakedVoicePcm) => void;
  reject: (err: Error) => void;
}

interface ActiveJob extends QueuedJob {
  worker: Worker;
  timer: ReturnType<typeof setTimeout>;
  dispatchedAtMs: number;
  cancelled: boolean;
}

/**
 * Dedicated multi-worker pool that renders synth voices off the main thread.
 *
 * Key guarantees:
 * - Earliest-`startSec`-first priority scheduling so the note closest to the playhead
 *   is ALWAYS rendered first.
 * - `cancelStaleJobs(playheadSec)` purges any queued job that the playhead has already
 *   passed, preventing queue backlog starvation during dense passages.
 * - `cancelQueuedBySeed(voiceSeed)` cancels a queued job if the main thread rendered
 *   it synchronously as an urgent fallback.
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
      const cores = Number((navigator as unknown as { hardwareConcurrency?: number })?.hardwareConcurrency) || 4;
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

  get activeCount(): number {
    return this.activeByJobId.size;
  }

  get queuedCount(): number {
    return this.queue.length;
  }

  get pendingCount(): number {
    return this.queue.length + this.activeByJobId.size;
  }

  bake(
    item: unknown,
    sampleRate: number,
    tempoBpm: number,
    voiceSeed: number,
    urgent: boolean = false
  ): Promise<BakedVoicePcm> {
    if (this.broken || this.workers.length === 0) {
      return Promise.reject(new Error('Voice bake pool unavailable'));
    }
    const jobId = this.nextJobId++;
    const enqueuedAtMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const typedItem = (item || {}) as VoiceJobItemMeta;

    return new Promise<BakedVoicePcm>((resolve, reject) => {
      const job: QueuedJob = {
        jobId,
        item: typedItem,
        sampleRate,
        tempoBpm,
        voiceSeed,
        urgent,
        enqueuedAtMs,
        resolve,
        reject,
      };
      this.queue.push(job);
      this.sortQueueByUrgencyAndStartSec();
      this.dispatchNext();
    });
  }

  private sortQueueByUrgencyAndStartSec(): void {
    if (this.queue.length <= 1) return;
    this.queue.sort((a, b) => {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      const aStart = a.item.startSec ?? 0;
      const bStart = b.item.startSec ?? 0;
      if (aStart !== bStart) return aStart - bStart;
      return a.jobId - b.jobId;
    });
  }

  /**
   * Purges any job still waiting in `this.queue` whose note window has already elapsed
   * (`startSec + durSec <= playheadSec + 0.03`), freeing workers for upcoming notes.
   */
  public cancelStaleJobs(playheadSec: number): number {
    if (this.queue.length === 0) return 0;
    let cancelledCount = 0;
    const keep: QueuedJob[] = [];
    for (let i = 0; i < this.queue.length; i++) {
      const q = this.queue[i];
      const startSec = q.item.startSec ?? 0;
      const durSec = q.item.durSec ?? 0.25;
      // Drop queued jobs whose entire duration (or >85% of duration) is already behind the playhead
      if (startSec + durSec * 0.85 <= playheadSec) {
        cancelledCount++;
        playbackDiag.recordWorkerEvent({
          jobId: q.jobId,
          event: 'cancel_stale',
          trackId: q.item.event?.trackId || 'synth',
          patch: q.item.patch || 'synth',
          noteStartSec: startSec,
          durSec,
          activeWorkers: this.activeByJobId.size,
          queuedJobs: this.queue.length - cancelledCount,
        });
        q.reject(new Error('Voice bake stale'));
      } else {
        keep.push(q);
      }
    }
    this.queue = keep;
    return cancelledCount;
  }

  /**
   * If the main thread decides to synchronously render an imminent voice because its
   * start time has arrived while it was still sitting in `this.queue`, remove it from
   * `this.queue` so a worker doesn't waste time re-rendering it.
   */
  public cancelQueuedBySeed(voiceSeed: number): boolean {
    const idx = this.queue.findIndex((q) => q.voiceSeed === voiceSeed);
    if (idx < 0) return false;
    const [removed] = this.queue.splice(idx, 1);
    removed.reject(new Error('Voice bake superseded by sync render'));
    return true;
  }

  /**
   * Checks whether a specific `voiceSeed` is already actively being rendered by a worker
   * (as opposed to sitting in the waiting queue).
   */
  public isActivelyRenderingSeed(voiceSeed: number): boolean {
    for (const active of this.activeByJobId.values()) {
      if (active.voiceSeed === voiceSeed && !active.cancelled) {
        return true;
      }
    }
    return false;
  }

  private dispatchNext(): void {
    if (this.broken || this.queue.length === 0) return;
    for (const w of this.workers) {
      if (this.queue.length === 0) break;
      if (this.activeByWorker.get(w)) continue;

      const next = this.queue.shift()!;
      const dispatchedAtMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const timer = setTimeout(() => {
        this.handleJobTimeout(next.jobId);
      }, 3500);

      const active: ActiveJob = {
        ...next,
        worker: w,
        timer,
        dispatchedAtMs,
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

    playbackDiag.recordWorkerTimeout(
      active.item.startSec ?? 0,
      active.item.event?.measure ?? 1,
      active.item.event?.beat ?? 1,
      jobId,
      active.item.event?.trackId
    );

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
    const {
      jobId,
      left,
      right,
      peak = 0,
      rms = 0,
      nanCount = 0,
      nonZeroFrames = 0,
      bakeMs: workerBakeMs,
      error,
    } = e.data || {};
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

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const roundTripMs = now - active.dispatchedAtMs;
    const queueWaitMs = Math.max(0, active.dispatchedAtMs - active.enqueuedAtMs);
    const bakeMs = typeof workerBakeMs === 'number' ? workerBakeMs : roundTripMs;

    playbackDiag.recordWorkerEvent({
      jobId,
      event: 'complete',
      trackId: active.item.event?.trackId || 'synth',
      patch: active.item.patch || 'synth',
      noteStartSec: active.item.startSec ?? 0,
      durSec: active.item.durSec ?? 0,
      urgent: active.urgent,
      queueWaitMs,
      bakeMs,
      frames: left ? left.length : 0,
      pcmPeak: peak,
      pcmRms: rms,
      pcmNanCount: nanCount,
      activeWorkers: this.activeByJobId.size,
      queuedJobs: this.queue.length,
    });

    if (!active.cancelled) {
      if (error || !left || !right) {
        active.reject(new Error(error || 'Empty voice bake result'));
      } else {
        active.resolve({
          left,
          right,
          peak,
          rms,
          nanCount,
          nonZeroFrames,
          bakeMs,
          queueWaitMs,
        });
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
