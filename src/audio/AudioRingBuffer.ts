/**
 * Bounded-Memory Circular Audio Ring Buffer Architecture:
 * 1. `VoicePcmRingBuffer`: Fixed-capacity circular ring buffer of stereo Float32 voice PCM slots
 *    with a strict frame/byte ceiling. As new synth voices are baked ahead of the playhead,
 *    the ring write cursor wraps around in O(1) time and overwrites the oldest slots so RAM
 *    never grows with score length (even across 30-60+ measure stress studies).
 * 2. `evictTimelineWindow`: Maintains a sliding circular active window of WebAudio `AudioBuffer`
 *    handles on the timeline (`[playheadSec - retainBehindSec, playheadSec + retainAheadSec]`),
 *    releasing buffers outside the active window.
 * 3. `StereoDelayRingBuffer`: Power-of-two circular delay line for reverb/echo/delay DSP effects
 *    so FX processors use tiny fixed ring buffers instead of allocating full-note arrays.
 */

export interface VoicePcmSlot {
  key: string;
  left: Float32Array;
  right: Float32Array;
  frames: number;
  slotIndex: number;
}

export interface TimelineRingItem {
  startSec: number;
  durSec: number;
  prebakedBuffer?: AudioBuffer;
}

export class VoicePcmRingBuffer {
  private readonly maxSlots: number;
  private readonly maxTotalFrames: number;
  private readonly slots: Array<VoicePcmSlot | null>;
  private readonly keyToSlot = new Map<string, VoicePcmSlot>();
  private writeCursor = 0;
  private evictCursor = 0;
  private totalFrames = 0;

  constructor(maxSlots: number = 96, maxTotalFrames: number = 44100 * 96) {
    this.maxSlots = Math.max(2, maxSlots | 0);
    this.maxTotalFrames = Math.max(256, maxTotalFrames | 0);
    this.slots = new Array<VoicePcmSlot | null>(this.maxSlots).fill(null);
  }

  public get size(): number {
    return this.keyToSlot.size;
  }

  public get capacity(): number {
    return this.maxSlots;
  }

  public get currentFrames(): number {
    return this.totalFrames;
  }

  public get maxFrames(): number {
    return this.maxTotalFrames;
  }

  public get writeIndex(): number {
    return this.writeCursor;
  }

  public has(key: string): boolean {
    return this.keyToSlot.has(key);
  }

  public get(key: string): { left: Float32Array; right: Float32Array } | undefined {
    const slot = this.keyToSlot.get(key);
    if (!slot) return undefined;
    return { left: slot.left, right: slot.right };
  }

  /**
   * Writes a stereo PCM buffer into the next slot of the circular ring buffer,
   * automatically overwriting the slot at `writeCursor` and evicting oldest ring
   * slots if `totalFrames` exceeds `maxTotalFrames`.
   */
  public write(key: string, left: Float32Array, right: Float32Array): void {
    const frames = left.length;
    const existing = this.keyToSlot.get(key);
    if (existing) {
      this.totalFrames += frames - existing.frames;
      existing.left = left;
      existing.right = right;
      existing.frames = frames;
      this.enforceFrameBudget(existing.slotIndex);
      return;
    }

    // Evict whatever currently occupies writeCursor in the circular ring
    const targetIdx = this.writeCursor;
    this.writeCursor = (this.writeCursor + 1) % this.maxSlots;
    this.evictSlotAt(targetIdx);

    const slot: VoicePcmSlot = {
      key,
      left,
      right,
      frames,
      slotIndex: targetIdx,
    };
    this.slots[targetIdx] = slot;
    this.keyToSlot.set(key, slot);
    this.totalFrames += frames;

    this.enforceFrameBudget(targetIdx);
  }

  private evictSlotAt(idx: number): void {
    const prev = this.slots[idx];
    if (!prev) return;
    this.slots[idx] = null;
    this.keyToSlot.delete(prev.key);
    this.totalFrames = Math.max(0, this.totalFrames - prev.frames);
  }

  private enforceFrameBudget(protectedSlotIdx: number): void {
    let safety = 0;
    while (this.totalFrames > this.maxTotalFrames && safety < this.maxSlots) {
      const idx = this.evictCursor;
      this.evictCursor = (this.evictCursor + 1) % this.maxSlots;
      safety++;
      if (idx === protectedSlotIdx) continue;
      if (this.slots[idx]) {
        this.evictSlotAt(idx);
      }
    }
  }

  /**
   * Rolling Ring Window Eviction on the scheduled timeline:
   * Releases `prebakedBuffer` on events that have already finished behind `playheadSec - retainBehindSec`
   * (or lie far beyond `playheadSec + retainAheadSec`) so WebAudio AudioBuffer memory stays bounded.
   */
  public evictTimelineWindow(
    timeline: TimelineRingItem[],
    playheadSec: number,
    retainBehindSec: number = 0.5,
    retainAheadSec: number = 14.0,
    isLooping: boolean = false
  ): number {
    if (isLooping) return 0;
    let evicted = 0;
    const minEndSec = playheadSec - retainBehindSec;
    const maxStartSec = playheadSec + retainAheadSec;
    for (let i = 0; i < timeline.length; i++) {
      const item = timeline[i];
      if (!item.prebakedBuffer) continue;
      if (item.startSec + item.durSec < minEndSec || item.startSec > maxStartSec) {
        item.prebakedBuffer = undefined;
        evicted++;
      }
    }
    return evicted;
  }

  public clear(): void {
    this.slots.fill(null);
    this.keyToSlot.clear();
    this.writeCursor = 0;
    this.evictCursor = 0;
    this.totalFrames = 0;
  }
}

/**
 * Power-of-two circular stereo delay ring buffer for zero-allocation feedback delay / reverb DSP.
 */
export class StereoDelayRingBuffer {
  public readonly capacity: number;
  public readonly mask: number;
  public readonly left: Float32Array;
  public readonly right: Float32Array;
  public writePos = 0;

  constructor(minFrames: number) {
    let cap = 64;
    const target = Math.max(64, (minFrames | 0) + 4);
    while (cap < target) {
      cap <<= 1;
    }
    this.capacity = cap;
    this.mask = cap - 1;
    this.left = new Float32Array(cap);
    this.right = new Float32Array(cap);
  }

  public writeAndAdvance(sampleL: number, sampleR: number): void {
    const idx = this.writePos & this.mask;
    this.left[idx] = sampleL;
    this.right[idx] = sampleR;
    this.writePos = (idx + 1) & this.mask;
  }

  public readLeft(delayFrames: number): number {
    return this.left[(this.writePos - 1 - delayFrames) & this.mask];
  }

  public readRight(delayFrames: number): number {
    return this.right[(this.writePos - 1 - delayFrames) & this.mask];
  }
}
