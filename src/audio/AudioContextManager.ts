export class AudioContextManager {
  private context: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;

  public async initialize(): Promise<void> {
    this.context = new AudioContext();
    try {
      await this.context.audioWorklet.addModule('/src/audio/TenutoProcessor.ts');
      this.workletNode = new AudioWorkletNode(this.context, 'TenutoProcessor');
    } catch (err) {
      try {
        await this.context.close?.();
      } catch {
        // Ignore close errors
      }
      this.context = null;
      throw err;
    }
  }

  public get sampleRate(): number {
    return this.context?.sampleRate || 48000;
  }

  public allocateSharedMemory(numEventsOrBytes: number): SharedArrayBuffer {
    const totalBytes = numEventsOrBytes > 255 ? numEventsOrBytes : 8 + numEventsOrBytes * 32;
    const sharedBuffer = new SharedArrayBuffer(totalBytes);
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'INIT_BUFFER',
        buffer: sharedBuffer,
      });
    }
    return sharedBuffer;
  }
}
