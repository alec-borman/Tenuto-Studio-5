import { playbackDiag } from './PlaybackDiagnostics';

/**
 * Fixed-Capacity Circular Ring Buffer for Prebaked Stereo Voice PCM & Streaming Delay Lines.
 *
 * Prevents unbounded heap growth or buffer overruns on long/dense pieces (e.g. 30-measure
 * polyphonic stress studies) by overwriting the oldest ring slot in O(1) time once the
 * circular capacity (`maxSlots` or `maxTotalFrames`) is reached.
 */

export interface VoicePcmSlotEntry {
  key: string;
  left: Float32Array;
  right: Float32Array;
  frames: number;
  slotIndex: number;
  peak: number;
  rms: number;
  nanCount: number;
}

export class VoicePcmRingBuffer {
  private readonly maxSlots: number;
  private readonly maxTotalFrames: number;
  private readonly slots: Array<VoicePcmSlotEntry | null>;
  private readonly keyToSlot: Map<string, number> = new Map();
  private writeHead: number = 0;
  private evictionCursor: number = 0;
  private currentTotalFrames: number = 0;
  private totalEvictions: number = 0;

  constructor(maxSlots: number = 512, maxTotalFrames: number = 48000 * 600) {
    this.maxSlots = Math.max(4, maxSlots);
    this.maxTotalFrames = Math.max(256, maxTotalFrames);
    this.slots = new Array<VoicePcmSlotEntry | null>(this.maxSlots).fill(null);
  }

  public get(key: string): {
    left: Float32Array;
    right: Float32Array;
    peak: number;
    rms: number;
    nanCount: number;
  } | undefined {
    const slotIdx = this.keyToSlot.get(key);
    if (slotIdx === undefined) {
      playbackDiag.recordRingBufferMiss(key);
      return undefined;
    }
    const entry = this.slots[slotIdx];
    if (!entry || entry.key !== key) {
      this.keyToSlot.delete(key);
      playbackDiag.recordRingBufferMiss(key);
      return undefined;
    }
    playbackDiag.recordRingBufferHit(key, slotIdx, entry.frames);
    return {
      left: entry.left,
      right: entry.right,
      peak: entry.peak,
      rms: entry.rms,
      nanCount: entry.nanCount,
    };
  }

  public has(key: string): boolean {
    const slotIdx = this.keyToSlot.get(key);
    if (slotIdx === undefined) return false;
    const entry = this.slots[slotIdx];
    return Boolean(entry && entry.key === key);
  }

  public write(
    key: string,
    left: Float32Array,
    right: Float32Array,
    stats?: { peak?: number; rms?: number; nanCount?: number }
  ): void {
    const frames = Math.max(left.length, right.length);
    if (frames <= 0 || frames > this.maxTotalFrames) return;

    const peak = stats?.peak ?? 0;
    const rms = stats?.rms ?? 0;
    const nanCount = stats?.nanCount ?? 0;

    // Update in-place if key already occupies a ring slot
    const existingSlot = this.keyToSlot.get(key);
    if (existingSlot !== undefined) {
      const prev = this.slots[existingSlot];
      if (prev && prev.key === key) {
        this.currentTotalFrames = Math.max(0, this.currentTotalFrames - prev.frames) + frames;
        this.slots[existingSlot] = {
          key,
          left,
          right,
          frames,
          slotIndex: existingSlot,
          peak,
          rms,
          nanCount,
        };
        return;
      }
      this.keyToSlot.delete(key);
    }

    let evictedCountThisWrite = 0;

    // Evict oldest slots along the circular ring until frame budget fits the new voice
    let guard = 0;
    while (
      this.currentTotalFrames + frames > this.maxTotalFrames &&
      this.keyToSlot.size > 0 &&
      guard < this.maxSlots
    ) {
      if (this.evictSlot(this.evictionCursor)) {
        evictedCountThisWrite++;
      }
      this.evictionCursor = (this.evictionCursor + 1) % this.maxSlots;
      guard++;
    }

    // Overwrite the slot at writeHead (circular ring wrap-around)
    const targetSlot = this.writeHead;
    if (this.slots[targetSlot] !== null) {
      if (this.evictSlot(targetSlot)) {
        evictedCountThisWrite++;
      }
    }

    this.slots[targetSlot] = {
      key,
      left,
      right,
      frames,
      slotIndex: targetSlot,
      peak,
      rms,
      nanCount,
    };
    this.keyToSlot.set(key, targetSlot);
    this.currentTotalFrames += frames;
    this.writeHead = (this.writeHead + 1) % this.maxSlots;

    playbackDiag.recordRingBufferWrite(
      key,
      targetSlot,
      frames,
      this.keyToSlot.size,
      this.maxSlots,
      this.currentTotalFrames,
      this.maxTotalFrames,
      evictedCountThisWrite
    );
  }

  private evictSlot(slotIndex: number): boolean {
    const existing = this.slots[slotIndex];
    if (!existing) return false;
    if (this.keyToSlot.get(existing.key) === slotIndex) {
      this.keyToSlot.delete(existing.key);
    }
    this.currentTotalFrames = Math.max(0, this.currentTotalFrames - existing.frames);
    this.slots[slotIndex] = null;
    this.totalEvictions++;
    return true;
  }

  public clear(): void {
    this.slots.fill(null);
    this.keyToSlot.clear();
    this.writeHead = 0;
    this.evictionCursor = 0;
    this.currentTotalFrames = 0;
  }

  public get size(): number {
    return this.keyToSlot.size;
  }

  public get capacity(): number {
    return this.maxSlots;
  }

  public get currentFrames(): number {
    return this.currentTotalFrames;
  }

  public get totalFrames(): number {
    return this.currentTotalFrames;
  }

  public get maxFrames(): number {
    return this.maxTotalFrames;
  }

  public get stats(): {
    slotsUsed: number;
    maxSlots: number;
    framesUsed: number;
    maxFrames: number;
    evictions: number;
  } {
    return {
      slotsUsed: this.keyToSlot.size,
      maxSlots: this.maxSlots,
      framesUsed: this.currentTotalFrames,
      maxFrames: this.maxTotalFrames,
      evictions: this.totalEvictions,
    };
  }

  /**
   * Releases `prebakedBuffer` AudioBuffer references on timeline items outside the active
   * `[playheadSec - retainBehindSec, playheadSec + retainAheadSec]` window, and resets
   * `item.isBaked = false` so re-entering the window re-attaches or re-bakes cleanly.
   */
  public evictTimelineWindow<
    T extends { startSec: number; durSec: number; prebakedBuffer?: unknown; isBaked?: boolean }
  >(
    timeline: T[],
    playheadSec: number,
    retainBehindSec: number = 1.5,
    retainAheadSec: number = 60.0,
    isLooping: boolean = false
  ): number {
    if (isLooping) return 0;
    const minKeepSec = playheadSec - retainBehindSec;
    const maxKeepSec = playheadSec + retainAheadSec;

    let evicted = 0;
    for (let i = 0; i < timeline.length; i++) {
      const item = timeline[i];
      if (
        item.prebakedBuffer &&
        (item.startSec + item.durSec < minKeepSec || item.startSec > maxKeepSec)
      ) {
        item.prebakedBuffer = undefined;
        item.isBaked = false;
        evicted++;
      }
    }
    if (evicted > 0) {
      playbackDiag.recordTimelineWindowEviction(evicted, playheadSec);
    }
    return evicted;
  }
}

/**
 * Power-of-2 Circular Stereo Audio Ring Buffer for Delay/Echo/Comb DSP lines.
 */
export class StereoDelayRingBuffer {
  public readonly capacity: number;
  public readonly mask: number;
  public readonly left: Float32Array;
  public readonly right: Float32Array;
  public writeIndex: number = 0;

  constructor(minSamples: number) {
    let cap = 64;
    const target = Math.max(64, Math.ceil(minSamples));
    while (cap < target) cap <<= 1;
    this.capacity = cap;
    this.mask = cap - 1;
    this.left = new Float32Array(cap);
    this.right = new Float32Array(cap);
  }

  public writeAndAdvance(l: number, r: number): void {
    this.left[this.writeIndex] = Number.isFinite(l) ? l : 0;
    this.right[this.writeIndex] = Number.isFinite(r) ? r : 0;
    this.writeIndex = (this.writeIndex + 1) & this.mask;
  }

  public readLeft(delaySamples: number): number {
    const idx = (this.writeIndex - 1 - (delaySamples | 0)) & this.mask;
    return this.left[idx];
  }

  public readRight(delaySamples: number): number {
    const idx = (this.writeIndex - 1 - (delaySamples | 0)) & this.mask;
    return this.right[idx];
  }

  public readDelayedL(delaySamples: number): number {
    const idx = (this.writeIndex - (delaySamples | 0)) & this.mask;
    return this.left[idx];
  }

  public readDelayedR(delaySamples: number): number {
    const idx = (this.writeIndex - (delaySamples | 0)) & this.mask;
    return this.right[idx];
  }
}
