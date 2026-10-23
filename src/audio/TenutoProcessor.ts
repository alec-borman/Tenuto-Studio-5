// @ts-nocheck
export class TenutoProcessor extends AudioWorkletProcessor {
  public port: any;
  private sharedBuffer: SharedArrayBuffer | null = null;
  private floatView: Float32Array | null = null;
  private headerView: Uint32Array | null = null;
  private eventsView: Float64Array | null = null;
  private phase: number = 0.0;
  private readIndex: number = 0;
  private currentSample: number = 0;

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'INIT_BUFFER') {
        this.sharedBuffer = event.data.buffer;
        this.floatView = new Float32Array(this.sharedBuffer);
        this.headerView = new Uint32Array(this.sharedBuffer, 0, 1);
        if (this.sharedBuffer.byteLength >= 8) {
          const availableBytes = this.sharedBuffer.byteLength - 8;
          const float64Count = Math.floor(availableBytes / 8);
          this.eventsView = new Float64Array(this.sharedBuffer, 8, float64Count);
        } else {
          this.eventsView = null;
        }

        this.readIndex = 0;
        this.currentSample = 0;
        this.phase = 0.0;
      }
    };
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean {
    const output = outputs[0];
    if (!output || !output[0] || !this.headerView || !this.floatView) return true;

    const rate = typeof sampleRate !== 'undefined' ? sampleRate : 48000;
    const rawHeader =
      this.sharedBuffer instanceof SharedArrayBuffer
        ? Atomics.load(this.headerView, 0)
        : this.headerView[0];

    // Legacy / direct frequency buffer mode (e.g. TDB-533 where Float32Array[0] = 440.0)
    if (rawHeader > 255 || !this.eventsView) {
      const frequency = this.floatView[0] > 0 ? this.floatView[0] : 440.0;
      const phaseIncrement = (2 * Math.PI * frequency) / rate;

      for (let channel = 0; channel < output.length; channel++) {
        const channelArray = output[channel];
        let localPhase = this.phase;

        for (let i = 0; i < channelArray.length; i++) {
          channelArray[i] = Math.sin(localPhase);
          localPhase += phaseIncrement;
          if (localPhase >= 2 * Math.PI) {
            localPhase -= 2 * Math.PI;
          }
        }

        if (channel === 0) {
          this.phase = localPhase;
        }
      }
      return true;
    }

    const maxCapacity = Math.floor(this.eventsView.length / 4);
    const numEvents = Math.min(rawHeader, maxCapacity);

    for (let i = 0; i < output[0].length; i++) {
      let sampleVal = 0.0;
      let activeFreq = 0.0;

      if (this.readIndex > numEvents) {
        this.readIndex = numEvents;
      }

      for (let e = this.readIndex; e < numEvents; e++) {
        const baseIdx = e * 4;
        if (baseIdx + 3 >= this.eventsView.length) break;

        const startSample = this.eventsView[baseIdx];
        const durationSamples = this.eventsView[baseIdx + 1];
        const frequency = this.eventsView[baseIdx + 2];
        const velocity = this.eventsView[baseIdx + 3];

        const endSample = startSample + durationSamples;

        if (this.currentSample >= startSample && this.currentSample < endSample) {
          activeFreq = frequency;
          sampleVal += Math.sin(this.phase) * velocity;
        }

        if (e === this.readIndex && this.currentSample >= endSample) {
          this.readIndex++;
        }
      }

      if (activeFreq > 0) {
        this.phase += (2 * Math.PI * activeFreq) / rate;
        if (this.phase >= 2 * Math.PI) {
          this.phase -= 2 * Math.PI;
        }
      }

      for (let channel = 0; channel < output.length; channel++) {
        output[channel][i] = sampleVal;
      }

      this.currentSample++;
    }

    return true;
  }
}

registerProcessor('TenutoProcessor', TenutoProcessor);
