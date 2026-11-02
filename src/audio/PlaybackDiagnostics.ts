/**
 * Tenuto Studio Audio Engine — Ultra-Detailed Real-Time F12 Console Diagnostics
 *
 * Channels logged to F12 DevTools Console:
 *  - [TenutoDiag]          : 1-second heartbeat with full engine, signal, worker, memory & voice telemetry
 *  - [TenutoDiag:Signal]   : Real-time WebAudio AnalyserNode RMS / Peak / dBFS / Compressor reduction / Silence & NaN alerts
 *  - [TenutoDiag:Voice]    : Every scheduled voice trigger (track, patch, M:B, freq, amp, path, PCM peak/rms/NaN)
 *  - [TenutoDiag:Worker]   : Every worker job dispatch, queue wait, bake time, PCM peak/rms, stale cancellations
 *  - [TenutoDiag:Ring]     : Ring buffer stores, hits, misses, slot evictions, timeline window evictions
 *  - [TenutoDiag:AudioCtx] : AudioContext state transitions, clock drift (ctx.currentTime vs performance.now), voice stealing
 *  - [TenutoDiag:Parser]   : Score compilation coverage (measures, tracks, density gaps, token warnings)
 *
 * Also exposes `window.__TENUTO_DIAG__` in DevTools console:
 *   __TENUTO_DIAG__.summary()          -> prints full diagnostic table
 *   __TENUTO_DIAG__.voices(50)         -> prints last N voice events
 *   __TENUTO_DIAG__.workers(50)        -> prints last N worker bake events
 *   __TENUTO_DIAG__.signals(30)        -> prints last N signal analyser snapshots
 *   __TENUTO_DIAG__.timelineCoverage() -> prints measure-by-measure note count & gap analysis
 *   __TENUTO_DIAG__.setLevel('trace' | 'verbose' | 'normal' | 'quiet')
 */

export type DiagLogLevel = 'trace' | 'verbose' | 'normal' | 'quiet';

export type VoiceTriggerPath =
  | 'prebaked'
  | 'ring_hit'
  | 'sync_urgent'
  | 'sync_fallback'
  | 'deferred_await'
  | 'deferred_join'
  | 'deferred_drop'
  | 'drum_cached'
  | 'drum_synth'
  | 'wavetable'
  | 'ableton_synth'
  | 'soundfont'
  | 'osc_fallback';

export interface VoiceEventLog {
  wallMs: number;
  playheadSec: number;
  measure: number;
  beat: number;
  trackId: string;
  style: string;
  patch: string;
  startSec: number;
  durSec: number;
  offsetSec: number;
  freqHz: number;
  amp: number;
  chordVoices: number;
  path: VoiceTriggerPath;
  pcmPeak?: number;
  pcmRms?: number;
  pcmNanCount?: number;
  activeVoices: number;
  note?: string;
}

export interface WorkerEventLog {
  wallMs: number;
  jobId: number;
  event: 'enqueue' | 'start' | 'complete' | 'timeout' | 'cancel_stale' | 'cancel_sync';
  trackId?: string;
  patch?: string;
  noteStartSec?: number;
  durSec?: number;
  urgent?: boolean;
  queueWaitMs?: number;
  bakeMs?: number;
  frames?: number;
  pcmPeak?: number;
  pcmRms?: number;
  pcmNanCount?: number;
  activeWorkers: number;
  queuedJobs: number;
}

export interface SignalSampleLog {
  wallMs: number;
  playheadSec: number;
  measure: number;
  beat: number;
  masterPeak: number;
  masterRms: number;
  masterDb: number;
  dryPeak: number;
  dryRms: number;
  drumPeak: number;
  compReductionDb: number;
  nanSamples: number;
  activeVoices: number;
  audibleVoices: number;
}

export interface PlaybackTickSnapshot {
  wallTimeMs: number;
  playheadSec: number;
  measure: number;
  beat: number;
  audioCtxState: string;
  audioCtxCurrentTime: number;
  clockDriftMs: number;
  schedulerTickIntervalMs: number;
  schedulerMaxGapMs: number;
  schedulerCpuMs: number;
  visualFps: number;
  visualFrameMaxMs: number;
  activeVoices: number;
  totalTimelineEvents: number;
  timelineCursor: number;
  voicesTriggeredThisSec: number;
  voicesByPathThisSec: Record<string, number>;
  ringBufferHitsThisSec: number;
  ringBufferMissesThisSec: number;
  syncMainThreadBakesThisSec: number;
  syncMainThreadBakeMsThisSec: number;
  workerBakesCompletedThisSec: number;
  workerBakeMaxMsThisSec: number;
  workerQueueWaitMaxMsThisSec: number;
  workerCancelledStaleThisSec: number;
  workerTimeoutsThisSec: number;
  deferredVoicesAwaiting: number;
  deferredVoicesJoinedThisSec: number;
  deferredVoicesDroppedThisSec: number;
  pendingWorkerBakes: number;
  ringBufferSlotsUsed: number;
  ringBufferMaxSlots: number;
  ringBufferFramesUsed: number;
  ringBufferMaxFrames: number;
  ringBufferEvictions: number;
  timelineWindowEvictionsThisSec: number;
  masterPeak: number;
  masterRms: number;
  masterDb: number;
  dryPeak: number;
  drumPeak: number;
  compReductionDb: number;
  signalNanCount: number;
  jsHeapUsedMB: number | null;
  jsHeapTotalMB: number | null;
}

export interface PlaybackAnomaly {
  wallTimeMs: number;
  playheadSec: number;
  measure: number;
  beat: number;
  type:
    | 'MAIN_THREAD_STALL'
    | 'SYNC_BAKE_SPIKE'
    | 'WORKER_TIMEOUT'
    | 'VOICE_STARVATION'
    | 'DEFERRED_VOICE_DROP'
    | 'AUDIO_CTX_SUSPENDED'
    | 'CLOCK_DRIFT'
    | 'HIGH_VOICE_COUNT'
    | 'SILENCE_WITH_ACTIVE_VOICES'
    | 'PCM_NAN_DETECTED'
    | 'PARSER_TOKEN_ERROR'
    | 'TIMELINE_GAP';
  detail: string;
}

export interface MeasureCoverageInfo {
  measure: number;
  startSec: number;
  endSec: number;
  totalEvents: number;
  synthEvents: number;
  drumEvents: number;
  byTrack: Record<string, number>;
}

const isTestEnv = (): boolean => {
  try {
    return (
      typeof process !== 'undefined' &&
      Boolean(
        process.env?.VITEST ||
          process.env?.NODE_ENV === 'test' ||
          (globalThis as unknown as { __vitest_worker__?: unknown }).__vitest_worker__
      )
    );
  } catch {
    return false;
  }
};

function ampToDb(amp: number): number {
  if (amp <= 0.000001) return -120;
  return Math.round(20 * Math.log10(amp) * 10) / 10;
}

export class PlaybackDiagnostics {
  public enabled: boolean = !isTestEnv();
  /**
   * Default to 'trace' in browser so F12 shows every voice, worker job, signal sample,
   * ring buffer event, and 1s summary immediately.
   */
  public logLevel: DiagLogLevel = isTestEnv() ? 'quiet' : 'trace';

  private sessionStartWallMs: number = 0;
  private sessionStartAudioCtxSec: number = 0;
  private lastSchedulerWallMs: number = 0;
  private lastVisualFrameWallMs: number = 0;
  private lastConsoleReportWallMs: number = 0;
  private lastSignalConsoleWallMs: number = 0;
  private lastMeasureLogged: number = -1;

  // Per-second accumulators
  private schedulerIntervals: number[] = [];
  private schedulerCpuTimes: number[] = [];
  private visualFrameIntervals: number[] = [];
  private voicesTriggeredSec: number = 0;
  private voicesByPathSec: Record<string, number> = {};
  private ringHitsSec: number = 0;
  private ringMissesSec: number = 0;
  private syncBakesSec: number = 0;
  private syncBakeMsSec: number = 0;
  private workerCompletedSec: number = 0;
  private workerBakeMaxMsSec: number = 0;
  private workerQueueWaitMaxMsSec: number = 0;
  private workerCancelledStaleSec: number = 0;
  private workerTimeoutsSec: number = 0;
  private deferredJoinedSec: number = 0;
  private deferredDroppedSec: number = 0;
  private timelineEvictionsSec: number = 0;

  // Signal accumulators
  private latestSignal: SignalSampleLog = {
    wallMs: 0,
    playheadSec: 0,
    measure: 1,
    beat: 1,
    masterPeak: 0,
    masterRms: 0,
    masterDb: -120,
    dryPeak: 0,
    dryRms: 0,
    drumPeak: 0,
    compReductionDb: 0,
    nanSamples: 0,
    activeVoices: 0,
    audibleVoices: 0,
  };
  private consecutiveSilentTicksWithAudibleVoices: number = 0;

  // Cumulative totals
  private totalVoicesTriggered: number = 0;
  private totalVoicesByPath: Record<string, number> = {};
  private totalRingHits: number = 0;
  private totalRingMisses: number = 0;
  private totalSyncBakes: number = 0;
  private totalSyncBakeMs: number = 0;
  private totalWorkerCompleted: number = 0;
  private totalWorkerCancelledStale: number = 0;
  private totalWorkerTimeouts: number = 0;
  private totalDeferredAwaits: number = 0;
  private totalDeferredJoined: number = 0;
  private totalDeferredDropped: number = 0;
  private totalVoicesStolen: number = 0;

  // History buffers
  private history: PlaybackTickSnapshot[] = [];
  private anomalies: PlaybackAnomaly[] = [];
  private voiceLogs: VoiceEventLog[] = [];
  private workerLogs: WorkerEventLog[] = [];
  private signalLogs: SignalSampleLog[] = [];
  private measureCoverage: MeasureCoverageInfo[] = [];
  private parserErrors: Array<{ measure: number; trackId: string; token: string; error: string }> = [];

  private static readonly MAX_HISTORY = 240;
  private static readonly MAX_ANOMALIES = 200;
  private static readonly MAX_VOICE_LOGS = 400;
  private static readonly MAX_WORKER_LOGS = 400;
  private static readonly MAX_SIGNAL_LOGS = 240;

  constructor() {
    if (typeof window !== 'undefined' && !isTestEnv()) {
      (window as unknown as Record<string, unknown>).__TENUTO_DIAG__ = {
        getSummary: () => this.getSummary(),
        summary: () => this.printFullSummaryToConsole(),
        voices: (n = 50) => {
          const slice = this.voiceLogs.slice(-n);
          console.table(slice);
          return slice;
        },
        workers: (n = 50) => {
          const slice = this.workerLogs.slice(-n);
          console.table(slice);
          return slice;
        },
        signals: (n = 30) => {
          const slice = this.signalLogs.slice(-n);
          console.table(slice);
          return slice;
        },
        anomalies: () => {
          console.table(this.anomalies);
          return this.anomalies;
        },
        timelineCoverage: () => {
          console.table(this.measureCoverage);
          return this.measureCoverage;
        },
        parserErrors: () => {
          console.table(this.parserErrors);
          return this.parserErrors;
        },
        setLevel: (lvl: DiagLogLevel) => {
          this.logLevel = lvl;
          console.info(`%c[TenutoDiag] Log level set to '${lvl}'`, 'color:#38bdf8;font-weight:bold');
        },
        instance: this,
      };
    }
  }

  private canLog(minLevel: DiagLogLevel): boolean {
    if (!this.enabled || this.logLevel === 'quiet') return false;
    const order: Record<DiagLogLevel, number> = { quiet: 0, normal: 1, verbose: 2, trace: 3 };
    return order[this.logLevel] >= order[minLevel];
  }

  public startSession(
    totalEvents: number,
    tempoBpm: number,
    scoreTitle?: string,
    audioCtxCurrentTime: number = 0
  ): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.sessionStartWallMs = now;
    this.sessionStartAudioCtxSec = audioCtxCurrentTime;
    this.lastSchedulerWallMs = now;
    this.lastVisualFrameWallMs = now;
    this.lastConsoleReportWallMs = now;
    this.lastSignalConsoleWallMs = now;
    this.lastMeasureLogged = -1;
    this.consecutiveSilentTicksWithAudibleVoices = 0;

    this.resetSecCounters();
    this.totalVoicesTriggered = 0;
    this.totalVoicesByPath = {};
    this.totalRingHits = 0;
    this.totalRingMisses = 0;
    this.totalSyncBakes = 0;
    this.totalSyncBakeMs = 0;
    this.totalWorkerCompleted = 0;
    this.totalWorkerCancelledStale = 0;
    this.totalWorkerTimeouts = 0;
    this.totalDeferredAwaits = 0;
    this.totalDeferredJoined = 0;
    this.totalDeferredDropped = 0;
    this.totalVoicesStolen = 0;
    this.history = [];
    this.anomalies = [];
    this.voiceLogs = [];
    this.workerLogs = [];
    this.signalLogs = [];

    if (this.canLog('normal')) {
      console.info(
        `%c[TenutoDiag] ▶ PLAYBACK SESSION START %c| Title: "${scoreTitle || 'Untitled'}" | Tempo: ${tempoBpm} BPM | Total Scheduled Events: ${totalEvents} | LogLevel: ${this.logLevel} (Use __TENUTO_DIAG__.summary() / .voices() / .workers() / .signals() / .timelineCoverage())`,
        'background:#0284c7;color:#fff;font-weight:bold;padding:2px 6px;border-radius:3px',
        'color:#38bdf8;font-weight:bold'
      );
    }
  }

  public stopSession(reason: string = 'stopped'): void {
    if (!this.canLog('normal')) return;
    const elapsedWallSec =
      this.sessionStartWallMs > 0
        ? (((typeof performance !== 'undefined' ? performance.now() : Date.now()) -
            this.sessionStartWallMs) /
            1000).toFixed(2)
        : '0.00';
    console.info(
      `%c[TenutoDiag] ■ PLAYBACK SESSION END (${reason}) %c| Wall=${elapsedWallSec}s | TotalVoices=${this.totalVoicesTriggered} | Paths=${JSON.stringify(this.totalVoicesByPath)} | RingHits=${this.totalRingHits} | RingMisses=${this.totalRingMisses} | SyncBakes=${this.totalSyncBakes} (${this.totalSyncBakeMs.toFixed(1)}ms) | WorkerDone=${this.totalWorkerCompleted} | WorkerCancelledStale=${this.totalWorkerCancelledStale} | WorkerTimeouts=${this.totalWorkerTimeouts} | DeferredAwait=${this.totalDeferredAwaits} (Joined=${this.totalDeferredJoined}, Dropped=${this.totalDeferredDropped}) | Stolen=${this.totalVoicesStolen} | Anomalies=${this.anomalies.length}`,
      'background:#475569;color:#fff;font-weight:bold;padding:2px 6px;border-radius:3px',
      'color:#94a3b8;font-weight:bold'
    );
    if (this.anomalies.length > 0) {
      console.warn(`[TenutoDiag] Session recorded ${this.anomalies.length} anomalies:`, this.anomalies);
    }
  }

  /**
   * Logs full timeline & measure-by-measure coverage right after compile/buildTimeline
   * so we can immediately see if any measures have 0 notes or unexpected gaps.
   */
  public recordTimelineCompilation(
    timeline: Array<{
      startSec: number;
      durSec: number;
      track: { id: string; style: string; patch?: string };
      event: { measureNumber?: number; measure?: number; beat?: number; type?: string };
    }>,
    tempoBpm: number,
    beatsPerBar: number = 4
  ): void {
    this.measureCoverage = [];
    if (!timeline || timeline.length === 0) {
      if (this.canLog('normal')) {
        console.warn('%c[TenutoDiag:Parser] ⚠ Compiled timeline has 0 events!', 'color:#ef4444;font-weight:bold');
      }
      return;
    }

    const secPerBar = (60 / Math.max(20, tempoBpm)) * beatsPerBar;
    let maxMeasure = 1;
    for (const item of timeline) {
      const m = Math.max(1, item.event.measureNumber || item.event.measure || 1);
      if (m > maxMeasure) maxMeasure = m;
    }

    const byMeasure = new Map<number, MeasureCoverageInfo>();
    for (let m = 1; m <= maxMeasure; m++) {
      byMeasure.set(m, {
        measure: m,
        startSec: Number(((m - 1) * secPerBar).toFixed(2)),
        endSec: Number((m * secPerBar).toFixed(2)),
        totalEvents: 0,
        synthEvents: 0,
        drumEvents: 0,
        byTrack: {},
      });
    }

    const trackTotals: Record<string, { style: string; patch: string; count: number; minSec: number; maxSec: number }> = {};

    for (const item of timeline) {
      const m = Math.max(1, item.event.measureNumber || item.event.measure || 1);
      let info = byMeasure.get(m);
      if (!info) {
        info = {
          measure: m,
          startSec: Number(((m - 1) * secPerBar).toFixed(2)),
          endSec: Number((m * secPerBar).toFixed(2)),
          totalEvents: 0,
          synthEvents: 0,
          drumEvents: 0,
          byTrack: {},
        };
        byMeasure.set(m, info);
      }
      info.totalEvents++;
      if (item.track.style === 'drums') {
        info.drumEvents++;
      } else {
        info.synthEvents++;
      }
      info.byTrack[item.track.id] = (info.byTrack[item.track.id] || 0) + 1;

      const tStat = trackTotals[item.track.id] || {
        style: item.track.style,
        patch: item.track.patch || 'default',
        count: 0,
        minSec: item.startSec,
        maxSec: item.startSec + item.durSec,
      };
      tStat.count++;
      if (item.startSec < tStat.minSec) tStat.minSec = item.startSec;
      if (item.startSec + item.durSec > tStat.maxSec) tStat.maxSec = item.startSec + item.durSec;
      trackTotals[item.track.id] = tStat;
    }

    this.measureCoverage = Array.from(byMeasure.values()).sort((a, b) => a.measure - b.measure);

    // Check for empty measures
    const emptyMeasures = this.measureCoverage.filter((mc) => mc.totalEvents === 0).map((mc) => mc.measure);

    if (this.canLog('normal')) {
      const maxEndSec = timeline.reduce((acc, it) => Math.max(acc, it.startSec + it.durSec), 0);
      console.info(
        `%c[TenutoDiag:Parser] 📋 TIMELINE COMPILED: ${timeline.length} events across ${maxMeasure} measures (0.00s -> ${maxEndSec.toFixed(2)}s @ ${tempoBpm} BPM)`,
        'color:#a78bfa;font-weight:bold',
        {
          tracks: trackTotals,
          emptyMeasures: emptyMeasures.length > 0 ? emptyMeasures : 'none',
          parserTokenErrors: this.parserErrors.length,
        }
      );
      if (emptyMeasures.length > 0) {
        this.recordAnomaly(
          (emptyMeasures[0] - 1) * secPerBar,
          emptyMeasures[0],
          1,
          'TIMELINE_GAP',
          `Measures with 0 scheduled events: [${emptyMeasures.join(', ')}]`
        );
      }
    }
  }

  public recordParserTokenError(measure: number, trackId: string, token: string, error: string): void {
    this.parserErrors.push({ measure, trackId, token, error });
    if (this.canLog('normal')) {
      console.warn(
        `%c[TenutoDiag:Parser] ⚠ Token parse error in Measure ${measure} Track "${trackId}" token="${token}": ${error}`,
        'color:#f97316;font-weight:bold'
      );
    }
  }

  public recordVisualFrame(): void {
    if (!this.enabled) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (this.lastVisualFrameWallMs > 0) {
      this.visualFrameIntervals.push(now - this.lastVisualFrameWallMs);
    }
    this.lastVisualFrameWallMs = now;
  }

  /**
   * Logs every single voice trigger with full details (track, patch, measure:beat,
   * startSec, durSec, freq, amp, path, PCM Peak/RMS/NaN).
   */
  public recordVoiceEvent(ev: Omit<VoiceEventLog, 'wallMs'>): void {
    if (!this.enabled) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const fullEv: VoiceEventLog = { wallMs: now, ...ev };

    if (ev.path !== 'deferred_await' && ev.path !== 'deferred_drop') {
      this.voicesTriggeredSec++;
      this.totalVoicesTriggered++;
    }
    this.voicesByPathSec[ev.path] = (this.voicesByPathSec[ev.path] || 0) + 1;
    this.totalVoicesByPath[ev.path] = (this.totalVoicesByPath[ev.path] || 0) + 1;

    this.voiceLogs.push(fullEv);
    if (this.voiceLogs.length > PlaybackDiagnostics.MAX_VOICE_LOGS) {
      this.voiceLogs.shift();
    }

    if (ev.pcmNanCount && ev.pcmNanCount > 0) {
      this.recordAnomaly(
        ev.playheadSec,
        ev.measure,
        ev.beat,
        'PCM_NAN_DETECTED',
        `Voice ${ev.trackId}(${ev.patch}) had ${ev.pcmNanCount} NaN/Inf PCM frames (sanitized)`
      );
    }

    if (ev.path === 'deferred_drop') {
      this.deferredDroppedSec++;
      this.totalDeferredDropped++;
      this.recordAnomaly(
        ev.playheadSec,
        ev.measure,
        ev.beat,
        'DEFERRED_VOICE_DROP',
        `Dropped deferred voice ${ev.trackId}(${ev.patch}) at M${ev.measure}:B${ev.beat.toFixed(2)} (noteStart=${ev.startSec.toFixed(2)}s dur=${ev.durSec.toFixed(2)}s playhead=${ev.playheadSec.toFixed(2)}s)`
      );
    } else if (ev.path === 'deferred_join') {
      this.deferredJoinedSec++;
      this.totalDeferredJoined++;
    } else if (ev.path === 'deferred_await') {
      this.totalDeferredAwaits++;
    }

    if (this.canLog('trace')) {
      const pathColor =
        ev.path === 'prebaked' || ev.path === 'ring_hit' || ev.path === 'drum_cached'
          ? 'color:#4ade80'
          : ev.path === 'sync_urgent' || ev.path === 'sync_fallback' || ev.path === 'deferred_join'
          ? 'color:#facc15'
          : ev.path === 'deferred_drop'
          ? 'color:#ef4444;font-weight:bold'
          : 'color:#38bdf8';

      const pcmStr =
        ev.pcmPeak !== undefined
          ? ` | pcmPeak=${ev.pcmPeak.toFixed(3)} (${ampToDb(ev.pcmPeak)}dB) rms=${(ev.pcmRms ?? 0).toFixed(3)}${
              ev.pcmNanCount ? ` NaN=${ev.pcmNanCount}` : ''
            }`
          : '';

      console.log(
        `%c[TenutoDiag:Voice] [${ev.path}] M${ev.measure}:B${ev.beat.toFixed(2)} (t=${ev.playheadSec.toFixed(2)}s) | track="${ev.trackId}" patch="${ev.patch}" style=${ev.style} | start=${ev.startSec.toFixed(2)}s dur=${ev.durSec.toFixed(2)}s off=${ev.offsetSec.toFixed(3)}s | freq=${ev.freqHz.toFixed(1)}Hz (${ev.chordVoices}v) amp=${ev.amp.toFixed(2)}${pcmStr} | active=${ev.activeVoices}${ev.note ? ` | ${ev.note}` : ''}`,
        pathColor
      );
    }
  }

  public recordVoiceTriggered(): void {
    this.voicesTriggeredSec++;
    this.totalVoicesTriggered++;
  }

  public recordRingBufferHit(key?: string, slotIdx?: number, frames?: number): void {
    this.ringHitsSec++;
    this.totalRingHits++;
    if (this.canLog('trace') && key && (this.totalRingHits <= 20 || this.totalRingHits % 25 === 0)) {
      console.log(
        `%c[TenutoDiag:Ring] HIT slot=${slotIdx ?? '?'} frames=${frames ?? '?'} totalHits=${this.totalRingHits} key="${key.slice(0, 64)}"`,
        'color:#2dd4bf'
      );
    }
  }

  public recordRingBufferMiss(key?: string): void {
    this.ringMissesSec++;
    this.totalRingMisses++;
    if (this.canLog('trace') && key && (this.totalRingMisses <= 20 || this.totalRingMisses % 25 === 0)) {
      console.log(
        `%c[TenutoDiag:Ring] MISS totalMisses=${this.totalRingMisses} key="${key.slice(0, 64)}"`,
        'color:#fb923c'
      );
    }
  }

  public recordRingBufferWrite(
    key: string,
    slotIdx: number,
    frames: number,
    slotsUsed: number,
    maxSlots: number,
    framesUsed: number,
    maxFrames: number,
    evictedCount: number
  ): void {
    if (this.canLog('trace') && (evictedCount > 0 || slotsUsed % 20 === 0)) {
      const mbUsed = ((framesUsed * 2 * 4) / (1024 * 1024)).toFixed(1);
      console.log(
        `%c[TenutoDiag:Ring] WRITE slot=${slotIdx} frames=${frames} | slots=${slotsUsed}/${maxSlots} (${mbUsed}MB)${
          evictedCount > 0 ? ` | EVICTED=${evictedCount} old slots` : ''
        } | key="${key.slice(0, 56)}"`,
        evictedCount > 0 ? 'color:#f59e0b' : 'color:#94a3b8'
      );
    }
  }

  public recordTimelineWindowEviction(evictedCount: number, playheadSec: number): void {
    this.timelineEvictionsSec += evictedCount;
    if (evictedCount > 0 && this.canLog('trace')) {
      console.log(
        `%c[TenutoDiag:Ring] Evicted ${evictedCount} finished AudioBuffer refs behind playhead=${playheadSec.toFixed(2)}s`,
        'color:#64748b'
      );
    }
  }

  public recordSyncBake(
    durationMs: number,
    playheadSec: number,
    measure: number,
    beat: number,
    trackId: string,
    patch?: string,
    durSec?: number,
    pcmPeak?: number
  ): void {
    this.syncBakesSec++;
    this.syncBakeMsSec += durationMs;
    this.totalSyncBakes++;
    this.totalSyncBakeMs += durationMs;

    if (this.canLog('verbose')) {
      console.info(
        `%c[TenutoDiag:Voice] ⚡ SYNC_BAKE on main thread: ${durationMs.toFixed(1)}ms | M${measure}:B${beat.toFixed(2)} (t=${playheadSec.toFixed(2)}s) | track="${trackId}" patch="${patch || 'default'}" dur=${(durSec ?? 0).toFixed(2)}s peak=${(pcmPeak ?? 0).toFixed(3)}`,
        durationMs > 18 ? 'color:#f97316;font-weight:bold' : 'color:#eab308'
      );
    }

    if (durationMs > 28) {
      this.recordAnomaly(
        playheadSec,
        measure,
        beat,
        'SYNC_BAKE_SPIKE',
        `Main-thread sync bake on track "${trackId}" (${patch || ''}) took ${durationMs.toFixed(1)}ms`
      );
    }
  }

  public recordWorkerEvent(ev: Omit<WorkerEventLog, 'wallMs'>): void {
    if (!this.enabled) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const full: WorkerEventLog = { wallMs: now, ...ev };
    this.workerLogs.push(full);
    if (this.workerLogs.length > PlaybackDiagnostics.MAX_WORKER_LOGS) {
      this.workerLogs.shift();
    }

    if (ev.event === 'complete') {
      this.workerCompletedSec++;
      this.totalWorkerCompleted++;
      if ((ev.bakeMs ?? 0) > this.workerBakeMaxMsSec) {
        this.workerBakeMaxMsSec = ev.bakeMs ?? 0;
      }
      if ((ev.queueWaitMs ?? 0) > this.workerQueueWaitMaxMsSec) {
        this.workerQueueWaitMaxMsSec = ev.queueWaitMs ?? 0;
      }
      if (this.canLog('trace')) {
        console.log(
          `%c[TenutoDiag:Worker] ✓ Job #${ev.jobId} DONE | track="${ev.trackId || '?'}" patch="${ev.patch || '?'}" noteStart=${(ev.noteStartSec ?? 0).toFixed(2)}s dur=${(ev.durSec ?? 0).toFixed(2)}s | wait=${(ev.queueWaitMs ?? 0).toFixed(0)}ms bake=${(ev.bakeMs ?? 0).toFixed(1)}ms | peak=${(ev.pcmPeak ?? 0).toFixed(3)} rms=${(ev.pcmRms ?? 0).toFixed(3)} | active=${ev.activeWorkers} queued=${ev.queuedJobs}`,
          'color:#a3e635'
        );
      }
    } else if (ev.event === 'cancel_stale') {
      this.workerCancelledStaleSec++;
      this.totalWorkerCancelledStale++;
      if (this.canLog('verbose')) {
        console.log(
          `%c[TenutoDiag:Worker] ✂ Cancelled stale queued Job #${ev.jobId} (track="${ev.trackId}" noteStart=${(ev.noteStartSec ?? 0).toFixed(2)}s already passed playhead)`,
          'color:#fb923c'
        );
      }
    } else if (ev.event === 'timeout') {
      this.workerTimeoutsSec++;
      this.totalWorkerTimeouts++;
    }
  }

  public recordWorkerBakeCompleted(durationMs: number = 0, queueWaitMs: number = 0): void {
    this.workerCompletedSec++;
    this.totalWorkerCompleted++;
    if (durationMs > this.workerBakeMaxMsSec) this.workerBakeMaxMsSec = durationMs;
    if (queueWaitMs > this.workerQueueWaitMaxMsSec) this.workerQueueWaitMaxMsSec = queueWaitMs;
  }

  public recordWorkerTimeout(playheadSec: number, measure: number, beat: number, jobId: number, trackId?: string): void {
    this.workerTimeoutsSec++;
    this.totalWorkerTimeouts++;
    this.recordAnomaly(
      playheadSec,
      measure,
      beat,
      'WORKER_TIMEOUT',
      `Worker bake job #${jobId} (${trackId || 'unknown'}) timed out after 8000ms`
    );
  }

  public recordDeferredAwait(): void {
    this.totalDeferredAwaits++;
  }

  public recordVoiceStolen(trackId?: string, playheadSec?: number): void {
    this.totalVoicesStolen++;
    if (this.canLog('verbose')) {
      console.log(
        `%c[TenutoDiag:AudioCtx] Voice stolen (polyphony cap) on track="${trackId || '?'}" at t=${(playheadSec ?? 0).toFixed(2)}s (totalStolen=${this.totalVoicesStolen})`,
        'color:#f472b6'
      );
    }
  }

  /**
   * Records real-time WebAudio AnalyserNode measurements on masterOut, dryBus, drumBus,
   * and compressor reduction so F12 shows whether actual audio signal is flowing to speakers!
   */
  public recordSignalSample(sample: Omit<SignalSampleLog, 'wallMs'>): void {
    if (!this.enabled) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const full: SignalSampleLog = { wallMs: now, ...sample };
    this.latestSignal = full;
    this.signalLogs.push(full);
    if (this.signalLogs.length > PlaybackDiagnostics.MAX_SIGNAL_LOGS) {
      this.signalLogs.shift();
    }

    if (sample.nanSamples > 0) {
      this.recordAnomaly(
        sample.playheadSec,
        sample.measure,
        sample.beat,
        'PCM_NAN_DETECTED',
        `Master output AnalyserNode detected ${sample.nanSamples} NaN/Infinity samples at M${sample.measure}:B${sample.beat.toFixed(2)}!`
      );
    }

    // Check for unexpected silence when audible voices are supposed to be playing
    if (sample.audibleVoices > 0 && sample.masterPeak < 0.00015) {
      this.consecutiveSilentTicksWithAudibleVoices++;
      if (this.consecutiveSilentTicksWithAudibleVoices === 8) {
        // ~400ms of dead silence while voices are active
        this.recordAnomaly(
          sample.playheadSec,
          sample.measure,
          sample.beat,
          'SILENCE_WITH_ACTIVE_VOICES',
          `Master output is SILENT (peak=${sample.masterPeak.toFixed(6)}, dryPeak=${sample.dryPeak.toFixed(6)}, drumPeak=${sample.drumPeak.toFixed(6)}, compRed=${sample.compReductionDb.toFixed(1)}dB) despite ${sample.audibleVoices} active scheduled voices!`
        );
      }
    } else {
      this.consecutiveSilentTicksWithAudibleVoices = 0;
    }

    // Periodic 500ms signal trace in F12
    if (this.canLog('trace') && now - this.lastSignalConsoleWallMs >= 500) {
      this.lastSignalConsoleWallMs = now;
      const meterBars = Math.min(20, Math.max(0, Math.round((sample.masterDb + 60) / 3)));
      const barVisual = '█'.repeat(meterBars) + '░'.repeat(20 - meterBars);
      const sigColor =
        sample.masterPeak > 0.001
          ? 'color:#22c55e'
          : sample.audibleVoices > 0
          ? 'color:#ef4444;font-weight:bold'
          : 'color:#64748b';

      console.log(
        `%c[TenutoDiag:Signal] M${sample.measure}:B${sample.beat.toFixed(2)} (t=${sample.playheadSec.toFixed(2)}s) [${barVisual}] master=${sample.masterDb.toFixed(1)}dB (peak=${sample.masterPeak.toFixed(4)} rms=${sample.masterRms.toFixed(4)}) | dryPeak=${sample.dryPeak.toFixed(4)} drumPeak=${sample.drumPeak.toFixed(4)} compRed=${sample.compReductionDb.toFixed(1)}dB | activeVoices=${sample.activeVoices} (audibleNow=${sample.audibleVoices})`,
        sigColor
      );
    }
  }

  public recordSchedulerTick(params: {
    playheadSec: number;
    measure: number;
    beat: number;
    audioCtxState: string;
    audioCtxCurrentTime: number;
    schedulerCpuMs: number;
    activeVoices: number;
    totalTimelineEvents: number;
    timelineCursor: number;
    deferredVoicesAwaiting: number;
    pendingWorkerBakes: number;
    ringBufferStats: {
      slotsUsed: number;
      maxSlots: number;
      framesUsed: number;
      maxFrames: number;
      evictions: number;
    };
  }): void {
    if (!this.enabled) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const tickGapMs = this.lastSchedulerWallMs > 0 ? now - this.lastSchedulerWallMs : 0;
    this.lastSchedulerWallMs = now;

    if (tickGapMs > 0) {
      this.schedulerIntervals.push(tickGapMs);
    }
    this.schedulerCpuTimes.push(params.schedulerCpuMs);

    // Log measure transitions clearly in F12
    if (params.measure !== this.lastMeasureLogged) {
      this.lastMeasureLogged = params.measure;
      const mInfo = this.measureCoverage.find((m) => m.measure === params.measure);
      if (this.canLog('normal')) {
        console.info(
          `%c[TenutoDiag] 🎼 Entering Measure ${params.measure} (t=${params.playheadSec.toFixed(2)}s) | Scheduled in M${params.measure}: ${
            mInfo ? `${mInfo.totalEvents} events (synth=${mInfo.synthEvents}, drums=${mInfo.drumEvents}) ${JSON.stringify(mInfo.byTrack)}` : 'n/a'
          } | cursor=${params.timelineCursor}/${params.totalTimelineEvents}`,
          'color:#60a5fa;font-weight:bold'
        );
      }
    }

    // Detect main-thread stall (> 160ms between 50ms scheduler ticks)
    if (tickGapMs > 160) {
      this.recordAnomaly(
        params.playheadSec,
        params.measure,
        params.beat,
        'MAIN_THREAD_STALL',
        `Scheduler timer delayed by ${tickGapMs.toFixed(1)}ms (expected ~50ms)`
      );
    }

    if (params.audioCtxState !== 'running') {
      this.recordAnomaly(
        params.playheadSec,
        params.measure,
        params.beat,
        'AUDIO_CTX_SUSPENDED',
        `AudioContext state is "${params.audioCtxState}" during active playback`
      );
    }

    if (params.activeVoices > 85) {
      this.recordAnomaly(
        params.playheadSec,
        params.measure,
        params.beat,
        'HIGH_VOICE_COUNT',
        `Active WebAudio voice count reached ${params.activeVoices}`
      );
    }

    // Emit 1-second summary snapshot
    if (now - this.lastConsoleReportWallMs >= 1000) {
      this.emitOneSecondSnapshot(now, params);
      this.lastConsoleReportWallMs = now;
    }
  }

  private emitOneSecondSnapshot(
    nowWallMs: number,
    params: {
      playheadSec: number;
      measure: number;
      beat: number;
      audioCtxState: string;
      audioCtxCurrentTime: number;
      schedulerCpuMs: number;
      activeVoices: number;
      totalTimelineEvents: number;
      timelineCursor: number;
      deferredVoicesAwaiting: number;
      pendingWorkerBakes: number;
      ringBufferStats: {
        slotsUsed: number;
        maxSlots: number;
        framesUsed: number;
        maxFrames: number;
        evictions: number;
      };
    }
  ): void {
    const avgSchedMs =
      this.schedulerIntervals.length > 0
        ? this.schedulerIntervals.reduce((a, b) => a + b, 0) / this.schedulerIntervals.length
        : 0;
    const maxSchedGapMs =
      this.schedulerIntervals.length > 0 ? Math.max(...this.schedulerIntervals) : 0;
    const totalSchedCpuMs = this.schedulerCpuTimes.reduce((a, b) => a + b, 0);

    const visualFps =
      this.visualFrameIntervals.length > 0
        ? 1000 /
          (this.visualFrameIntervals.reduce((a, b) => a + b, 0) /
            this.visualFrameIntervals.length)
        : 0;
    const maxVisualFrameMs =
      this.visualFrameIntervals.length > 0 ? Math.max(...this.visualFrameIntervals) : 0;

    // Clock drift between wall clock and AudioContext hardware clock
    const wallElapsedSec = (nowWallMs - this.sessionStartWallMs) / 1000;
    const ctxElapsedSec = params.audioCtxCurrentTime - this.sessionStartAudioCtxSec;
    const clockDriftMs = (wallElapsedSec - ctxElapsedSec) * 1000;

    let jsHeapUsedMB: number | null = null;
    let jsHeapTotalMB: number | null = null;
    const perfMem = (
      performance as unknown as {
        memory?: { usedJSHeapSize: number; totalJSHeapSize: number };
      }
    )?.memory;
    if (perfMem) {
      jsHeapUsedMB = Math.round((perfMem.usedJSHeapSize / (1024 * 1024)) * 10) / 10;
      jsHeapTotalMB = Math.round((perfMem.totalJSHeapSize / (1024 * 1024)) * 10) / 10;
    }

    const snap: PlaybackTickSnapshot = {
      wallTimeMs: Math.round(nowWallMs - this.sessionStartWallMs),
      playheadSec: Number(params.playheadSec.toFixed(2)),
      measure: params.measure,
      beat: Number(params.beat.toFixed(2)),
      audioCtxState: params.audioCtxState,
      audioCtxCurrentTime: Number(params.audioCtxCurrentTime.toFixed(2)),
      clockDriftMs: Number(clockDriftMs.toFixed(1)),
      schedulerTickIntervalMs: Number(avgSchedMs.toFixed(1)),
      schedulerMaxGapMs: Number(maxSchedGapMs.toFixed(1)),
      schedulerCpuMs: Number(totalSchedCpuMs.toFixed(1)),
      visualFps: Number(visualFps.toFixed(1)),
      visualFrameMaxMs: Number(maxVisualFrameMs.toFixed(1)),
      activeVoices: params.activeVoices,
      totalTimelineEvents: params.totalTimelineEvents,
      timelineCursor: params.timelineCursor,
      voicesTriggeredThisSec: this.voicesTriggeredSec,
      voicesByPathThisSec: { ...this.voicesByPathSec },
      ringBufferHitsThisSec: this.ringHitsSec,
      ringBufferMissesThisSec: this.ringMissesSec,
      syncMainThreadBakesThisSec: this.syncBakesSec,
      syncMainThreadBakeMsThisSec: Number(this.syncBakeMsSec.toFixed(1)),
      workerBakesCompletedThisSec: this.workerCompletedSec,
      workerBakeMaxMsThisSec: Number(this.workerBakeMaxMsSec.toFixed(1)),
      workerQueueWaitMaxMsThisSec: Number(this.workerQueueWaitMaxMsSec.toFixed(1)),
      workerCancelledStaleThisSec: this.workerCancelledStaleSec,
      workerTimeoutsThisSec: this.workerTimeoutsSec,
      deferredVoicesAwaiting: params.deferredVoicesAwaiting,
      deferredVoicesJoinedThisSec: this.deferredJoinedSec,
      deferredVoicesDroppedThisSec: this.deferredDroppedSec,
      pendingWorkerBakes: params.pendingWorkerBakes,
      ringBufferSlotsUsed: params.ringBufferStats.slotsUsed,
      ringBufferMaxSlots: params.ringBufferStats.maxSlots,
      ringBufferFramesUsed: params.ringBufferStats.framesUsed,
      ringBufferMaxFrames: params.ringBufferStats.maxFrames,
      ringBufferEvictions: params.ringBufferStats.evictions,
      timelineWindowEvictionsThisSec: this.timelineEvictionsSec,
      masterPeak: Number(this.latestSignal.masterPeak.toFixed(4)),
      masterRms: Number(this.latestSignal.masterRms.toFixed(4)),
      masterDb: this.latestSignal.masterDb,
      dryPeak: Number(this.latestSignal.dryPeak.toFixed(4)),
      drumPeak: Number(this.latestSignal.drumPeak.toFixed(4)),
      compReductionDb: Number(this.latestSignal.compReductionDb.toFixed(1)),
      signalNanCount: this.latestSignal.nanSamples,
      jsHeapUsedMB,
      jsHeapTotalMB,
    };

    this.history.push(snap);
    if (this.history.length > PlaybackDiagnostics.MAX_HISTORY) {
      this.history.shift();
    }

    if (this.canLog('normal')) {
      const ringMB = (
        (snap.ringBufferFramesUsed * 2 * 4) /
        (1024 * 1024)
      ).toFixed(1);
      const heapStr =
        snap.jsHeapUsedMB !== null
          ? ` | heap=${snap.jsHeapUsedMB}/${snap.jsHeapTotalMB}MB`
          : '';
      const warnFlags: string[] = [];
      if (snap.schedulerMaxGapMs > 120) warnFlags.push(`SCHED_GAP=${snap.schedulerMaxGapMs}ms`);
      if (snap.syncMainThreadBakeMsThisSec > 25)
        warnFlags.push(`SYNC_BAKE=${snap.syncMainThreadBakeMsThisSec}ms`);
      if (snap.deferredVoicesDroppedThisSec > 0)
        warnFlags.push(`DROPPED_DEFERRED=${snap.deferredVoicesDroppedThisSec}`);
      if (snap.deferredVoicesAwaiting > 0)
        warnFlags.push(`DEFERRED_AWAIT=${snap.deferredVoicesAwaiting}`);
      if (snap.workerTimeoutsThisSec > 0)
        warnFlags.push(`WORKER_TIMEOUTS=${snap.workerTimeoutsThisSec}`);
      if (snap.activeVoices > 0 && snap.masterPeak < 0.0002)
        warnFlags.push(`MASTER_NEAR_SILENT(peak=${snap.masterPeak})`);

      const statusBanner =
        warnFlags.length > 0 ? ` ⚠ [${warnFlags.join(', ')}]` : ' ✓ OK';

      const pathsStr = Object.entries(snap.voicesByPathThisSec)
        .map(([k, v]) => `${k}:${v}`)
        .join(',');

      console.log(
        `%c[TenutoDiag t=${snap.playheadSec.toFixed(2)}s | M${snap.measure}:B${snap.beat.toFixed(1)}]${statusBanner}%c ` +
          `out=${snap.masterDb}dB (pk=${snap.masterPeak} rms=${snap.masterRms} comp=${snap.compReductionDb}dB) | ` +
          `voices=${snap.activeVoices} (trig=${snap.voicesTriggeredThisSec}/s [${pathsStr || 'none'}], cursor=${snap.timelineCursor}/${snap.totalTimelineEvents}) | ` +
          `ring=${snap.ringBufferSlotsUsed}/${snap.ringBufferMaxSlots} (${ringMB}MB, hit=${snap.ringBufferHitsThisSec} miss=${snap.ringBufferMissesThisSec} evict=${snap.ringBufferEvictions}) | ` +
          `workers(pend=${snap.pendingWorkerBakes}, done=${snap.workerBakesCompletedThisSec}/s, maxBake=${snap.workerBakeMaxMsThisSec}ms, maxWait=${snap.workerQueueWaitMaxMsThisSec}ms, staleCut=${snap.workerCancelledStaleThisSec}, sync=${snap.syncMainThreadBakesThisSec}/${snap.syncMainThreadBakeMsThisSec}ms) | ` +
          `sched(avg=${snap.schedulerTickIntervalMs}ms, maxGap=${snap.schedulerMaxGapMs}ms, cpu=${snap.schedulerCpuMs}ms/s, drift=${snap.clockDriftMs}ms) | ` +
          `fps=${snap.visualFps}${heapStr}`,
        warnFlags.length > 0
          ? 'background:#7c2d12;color:#fed7aa;font-weight:bold;padding:1px 4px;border-radius:2px'
          : 'background:#064e3b;color:#a7f3d0;font-weight:bold;padding:1px 4px;border-radius:2px',
        'color:#e2e8f0'
      );
    }

    this.resetSecCounters();
  }

  public recordAnomaly(
    playheadSec: number,
    measure: number,
    beat: number,
    type: PlaybackAnomaly['type'],
    detail: string
  ): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const anomaly: PlaybackAnomaly = {
      wallTimeMs: Math.round(now - this.sessionStartWallMs),
      playheadSec: Number(playheadSec.toFixed(2)),
      measure,
      beat: Number(beat.toFixed(2)),
      type,
      detail,
    };
    this.anomalies.push(anomaly);
    if (this.anomalies.length > PlaybackDiagnostics.MAX_ANOMALIES) {
      this.anomalies.shift();
    }
    if (this.canLog('normal')) {
      console.warn(
        `%c[TenutoDiag ⚠ ${type}] at t=${anomaly.playheadSec}s (M${anomaly.measure}:B${anomaly.beat}): ${detail}`,
        'background:#991b1b;color:#fecaca;font-weight:bold;padding:2px 6px;border-radius:3px'
      );
    }
  }

  private resetSecCounters(): void {
    this.schedulerIntervals = [];
    this.schedulerCpuTimes = [];
    this.visualFrameIntervals = [];
    this.voicesTriggeredSec = 0;
    this.voicesByPathSec = {};
    this.ringHitsSec = 0;
    this.ringMissesSec = 0;
    this.syncBakesSec = 0;
    this.syncBakeMsSec = 0;
    this.workerCompletedSec = 0;
    this.workerBakeMaxMsSec = 0;
    this.workerQueueWaitMaxMsSec = 0;
    this.workerCancelledStaleSec = 0;
    this.workerTimeoutsSec = 0;
    this.deferredJoinedSec = 0;
    this.deferredDroppedSec = 0;
    this.timelineEvictionsSec = 0;
  }

  public getSummary(): {
    totals: {
      voicesTriggered: number;
      voicesByPath: Record<string, number>;
      ringHits: number;
      ringMisses: number;
      syncBakes: number;
      syncBakeMs: number;
      workerCompleted: number;
      workerCancelledStale: number;
      workerTimeouts: number;
      deferredAwaits: number;
      deferredJoined: number;
      deferredDropped: number;
      voicesStolen: number;
    };
    latestSignal: SignalSampleLog;
    recentSnapshots: PlaybackTickSnapshot[];
    anomalies: PlaybackAnomaly[];
    measureCoverage: MeasureCoverageInfo[];
    parserErrors: Array<{ measure: number; trackId: string; token: string; error: string }>;
  } {
    return {
      totals: {
        voicesTriggered: this.totalVoicesTriggered,
        voicesByPath: { ...this.totalVoicesByPath },
        ringHits: this.totalRingHits,
        ringMisses: this.totalRingMisses,
        syncBakes: this.totalSyncBakes,
        syncBakeMs: Number(this.totalSyncBakeMs.toFixed(1)),
        workerCompleted: this.totalWorkerCompleted,
        workerCancelledStale: this.totalWorkerCancelledStale,
        workerTimeouts: this.totalWorkerTimeouts,
        deferredAwaits: this.totalDeferredAwaits,
        deferredJoined: this.totalDeferredJoined,
        deferredDropped: this.totalDeferredDropped,
        voicesStolen: this.totalVoicesStolen,
      },
      latestSignal: this.latestSignal,
      recentSnapshots: [...this.history],
      anomalies: [...this.anomalies],
      measureCoverage: [...this.measureCoverage],
      parserErrors: [...this.parserErrors],
    };
  }

  public printFullSummaryToConsole(): unknown {
    const s = this.getSummary();
    console.group('%c[TenutoDiag] Full Playback Diagnostic Summary', 'color:#38bdf8;font-weight:bold;font-size:13px');
    console.log('Cumulative Totals:', s.totals);
    console.log('Latest Master Signal:', s.latestSignal);
    if (s.anomalies.length > 0) {
      console.warn('Recorded Anomalies:', s.anomalies);
    } else {
      console.log('Recorded Anomalies: 0');
    }
    if (s.recentSnapshots.length > 0) {
      console.log('Last 20 Second-by-Second Telemetry Snapshots:');
      console.table(s.recentSnapshots.slice(-20));
    }
    if (this.voiceLogs.length > 0) {
      console.log('Last 30 Triggered Voices:');
      console.table(this.voiceLogs.slice(-30));
    }
    console.groupEnd();
    return s;
  }
}

export const playbackDiag = new PlaybackDiagnostics();
