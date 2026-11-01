export interface DiagHeartbeatSnapshot {
  wallTimeMs: number;
  elapsedSec: number;
  measure: number;
  beat: number;
  fps: number;
  maxFrameGapMs: number;
  rafCalls: number;
  avgProgressCallbackMs: number;
  maxProgressCallbackMs: number;
  schedulerTicks: number;
  avgSchedulerTickMs: number;
  maxSchedulerTickMs: number;
  maxSchedulerIntervalGapMs: number;
  activeVoices: number;
  voicesTriggered: number;
  syncBakeCount: number;
  syncBakeMs: number;
  totalSyncBakeCount: number;
  totalSyncBakeMs: number;
  deferredCount: number;
  deferredTriggeredCount: number;
  lateRecoveries: number;
  workerSize: number;
  workerActiveJobs: number;
  workerQueuedJobs: number;
  workerCompletedInWindow: number;
  workerCompletedTotal: number;
  workerAvgBakeMs: number;
  workerMaxBakeMs: number;
  workerTimeoutsTotal: number;
  workerErrorsTotal: number;
  ringSlotsUsed: number;
  ringSlotCapacity: number;
  ringMemoryMB: number;
  jsHeapMB: number | null;
}

export interface DiagWarningEvent {
  elapsedSec: number;
  kind:
    | 'sync_bake_fallback'
    | 'frame_stall'
    | 'scheduler_stall'
    | 'worker_timeout'
    | 'worker_error'
    | 'late_note';
  message: string;
  detail?: Record<string, unknown>;
}

/**
 * Real-time F12 DevTools Console Diagnostics & Telemetry for Tenuto StudioAudioEngine.
 * Outputs structured `[TenutoDiag]` logs every 1.0s during playback and immediate warnings
 * on main-thread synth fallbacks, worker pool stalls, or >40ms frame gaps.
 * Also attaches `window.__TENUTO_DIAG__` for interactive inspection in DevTools.
 */
export class PlaybackDiagnostics {
  public enabled: boolean = true;
  public history: DiagHeartbeatSnapshot[] = [];
  public warnings: DiagWarningEvent[] = [];

  private sessionStartWallMs: number = 0;
  private lastHeartbeatWallMs: number = 0;
  private lastRafWallMs: number = 0;
  private lastSchedulerWallMs: number = 0;

  // Rolling 1-second window accumulators
  private rafCalls = 0;
  private maxFrameGapMs = 0;
  private progressCalls = 0;
  private progressTotalMs = 0;
  private maxProgressMs = 0;

  private schedulerTicks = 0;
  private schedulerTotalMs = 0;
  private maxSchedulerMs = 0;
  private maxSchedulerGapMs = 0;

  private voicesTriggered = 0;
  private syncBakeCount = 0;
  private syncBakeMs = 0;
  private totalSyncBakeCount = 0;
  private totalSyncBakeMs = 0;

  private deferredCount = 0;
  private deferredTriggeredCount = 0;
  private lateRecoveries = 0;

  private workerCompletedInWindow = 0;
  private workerCompletedTotal = 0;
  private workerBakeTotalMs = 0;
  private workerMaxBakeMs = 0;
  private workerTimeoutsTotal = 0;
  private workerErrorsTotal = 0;

  private isTestEnv(): boolean {
    if (typeof process !== 'undefined' && (process as any).env?.VITEST) return true;
    if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '')) return true;
    return false;
  }

  public startSession(info: {
    title: string;
    tempoBpm: number;
    totalEvents: number;
    timelineLen: number;
    synthEventsCount: number;
    totalDurationSec: number;
    sampleRate: number;
    ctxState: string;
    workerCount: number;
  }): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.sessionStartWallMs = now;
    this.lastHeartbeatWallMs = now;
    this.lastRafWallMs = now;
    this.lastSchedulerWallMs = now;
    this.history = [];
    this.warnings = [];

    this.resetWindowCounters();
    this.totalSyncBakeCount = 0;
    this.totalSyncBakeMs = 0;
    this.workerCompletedTotal = 0;
    this.workerTimeoutsTotal = 0;
    this.workerErrorsTotal = 0;

    if (typeof window !== 'undefined') {
      (window as any).__TENUTO_DIAG__ = {
        history: this.history,
        warnings: this.warnings,
        getSummary: () => this.getSummary(),
        summary: () => {
          console.table(this.history);
          if (this.warnings.length > 0) {
            console.table(this.warnings);
          }
          return this.getSummary();
        },
      };
    }

    if (!this.enabled || this.isTestEnv()) return;
    console.info(
      `%c[TenutoDiag] ▶ PLAYBACK START | "${info.title}" | ${info.tempoBpm} BPM | ${info.timelineLen} scheduled items (${info.synthEventsCount} continuous synth) | dur=${info.totalDurationSec.toFixed(1)}s | sr=${info.sampleRate}Hz (${info.ctxState}) | workers=${info.workerCount}`,
      'color: #34d399; font-weight: bold;'
    );
  }

  public recordInitialPrebake(info: {
    syncBakedCount: number;
    syncBakeMs: number;
    workerQueuedCount: number;
    poolPendingCount: number;
  }): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    // Reset frame/scheduler gap baselines after initial prebake so startup prebake isn't flagged as a runtime frame gap
    this.lastRafWallMs = now;
    this.lastSchedulerWallMs = now;
    this.lastHeartbeatWallMs = now;

    if (!this.enabled || this.isTestEnv()) return;
    console.info(
      `[TenutoDiag] ⚡ INITIAL PREBAKE | syncBaked=${info.syncBakedCount} (${info.syncBakeMs.toFixed(1)}ms) | workerQueued=${info.workerQueuedCount} (poolPending=${info.poolPendingCount})`
    );
  }

  public recordRafTick(progressCallbackMs: number): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const gap = now - this.lastRafWallMs;
    this.lastRafWallMs = now;
    this.rafCalls++;
    if (gap > this.maxFrameGapMs) {
      this.maxFrameGapMs = gap;
    }
    if (progressCallbackMs > 0) {
      this.progressCalls++;
      this.progressTotalMs += progressCallbackMs;
      if (progressCallbackMs > this.maxProgressMs) {
        this.maxProgressMs = progressCallbackMs;
      }
    }
    if (gap > 85 && now - this.sessionStartWallMs > 300) {
      this.logWarning(
        (now - this.sessionStartWallMs) / 1000,
        'frame_stall',
        `RAF frame gap of ${gap.toFixed(1)}ms (React progress cb took ${progressCallbackMs.toFixed(1)}ms)`,
        { gapMs: Number(gap.toFixed(1)), progressCallbackMs: Number(progressCallbackMs.toFixed(1)) }
      );
    }
  }

  public recordSchedulerTick(
    elapsedSec: number,
    tickDurationMs: number,
    state: {
      currentQuarterBeat: number;
      activeVoices: number;
      nextScheduleIndex: number;
      timelineLen: number;
      workerSize: number;
      workerActiveJobs: number;
      workerQueuedJobs: number;
      ringSlotsUsed: number;
      ringSlotCapacity: number;
      ringFramesUsed: number;
    }
  ): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const gap = now - this.lastSchedulerWallMs;
    this.lastSchedulerWallMs = now;

    this.schedulerTicks++;
    this.schedulerTotalMs += tickDurationMs;
    if (tickDurationMs > this.maxSchedulerMs) {
      this.maxSchedulerMs = tickDurationMs;
    }
    if (gap > this.maxSchedulerGapMs) {
      this.maxSchedulerGapMs = gap;
    }

    if (tickDurationMs > 22) {
      this.logWarning(
        elapsedSec,
        'scheduler_stall',
        `scheduleLookaheadSlice took ${tickDurationMs.toFixed(1)}ms at t=${elapsedSec.toFixed(2)}s (scheduler gap=${gap.toFixed(1)}ms)`,
        { tickDurationMs: Number(tickDurationMs.toFixed(1)), gapMs: Number(gap.toFixed(1)) }
      );
    }

    if (now - this.lastHeartbeatWallMs >= 1000) {
      const windowSec = Math.max(0.1, (now - this.lastHeartbeatWallMs) / 1000);
      const fps = Math.round(this.rafCalls / windowSec);
      const measure = Math.floor(state.currentQuarterBeat / 4) + 1;
      const beat = Number(((state.currentQuarterBeat % 4) + 1).toFixed(2));
      const ringMemoryMB = Number(((state.ringFramesUsed * 2 * 4) / (1024 * 1024)).toFixed(2));
      const jsHeapMB =
        typeof performance !== 'undefined' && (performance as any).memory?.usedJSHeapSize
          ? Number(((performance as any).memory.usedJSHeapSize / (1024 * 1024)).toFixed(1))
          : null;

      const snap: DiagHeartbeatSnapshot = {
        wallTimeMs: Math.round(now - this.sessionStartWallMs),
        elapsedSec: Number(elapsedSec.toFixed(2)),
        measure,
        beat,
        fps,
        maxFrameGapMs: Number(this.maxFrameGapMs.toFixed(1)),
        rafCalls: this.rafCalls,
        avgProgressCallbackMs:
          this.progressCalls > 0
            ? Number((this.progressTotalMs / this.progressCalls).toFixed(2))
            : 0,
        maxProgressCallbackMs: Number(this.maxProgressMs.toFixed(2)),
        schedulerTicks: this.schedulerTicks,
        avgSchedulerTickMs:
          this.schedulerTicks > 0
            ? Number((this.schedulerTotalMs / this.schedulerTicks).toFixed(2))
            : 0,
        maxSchedulerTickMs: Number(this.maxSchedulerMs.toFixed(2)),
        maxSchedulerIntervalGapMs: Number(this.maxSchedulerGapMs.toFixed(1)),
        activeVoices: state.activeVoices,
        voicesTriggered: this.voicesTriggered,
        syncBakeCount: this.syncBakeCount,
        syncBakeMs: Number(this.syncBakeMs.toFixed(1)),
        totalSyncBakeCount: this.totalSyncBakeCount,
        totalSyncBakeMs: Number(this.totalSyncBakeMs.toFixed(1)),
        deferredCount: this.deferredCount,
        deferredTriggeredCount: this.deferredTriggeredCount,
        lateRecoveries: this.lateRecoveries,
        workerSize: state.workerSize,
        workerActiveJobs: state.workerActiveJobs,
        workerQueuedJobs: state.workerQueuedJobs,
        workerCompletedInWindow: this.workerCompletedInWindow,
        workerCompletedTotal: this.workerCompletedTotal,
        workerAvgBakeMs:
          this.workerCompletedInWindow > 0
            ? Number((this.workerBakeTotalMs / this.workerCompletedInWindow).toFixed(1))
            : 0,
        workerMaxBakeMs: Number(this.workerMaxBakeMs.toFixed(1)),
        workerTimeoutsTotal: this.workerTimeoutsTotal,
        workerErrorsTotal: this.workerErrorsTotal,
        ringSlotsUsed: state.ringSlotsUsed,
        ringSlotCapacity: state.ringSlotCapacity,
        ringMemoryMB,
        jsHeapMB,
      };

      this.history.push(snap);
      if (this.history.length > 180) {
        this.history.shift();
      }

      if (this.enabled && !this.isTestEnv()) {
        const isLagging =
          snap.syncBakeCount > 0 ||
          snap.maxFrameGapMs > 55 ||
          snap.maxSchedulerTickMs > 20 ||
          snap.fps < 20;
        const prefix = `[TenutoDiag t=${snap.elapsedSec.toFixed(2)}s | M${snap.measure}:B${snap.beat}]`;
        const msg =
          `${prefix} fps=${snap.fps} (maxGap=${snap.maxFrameGapMs}ms, uiCb=${snap.avgProgressCallbackMs}/${snap.maxProgressCallbackMs}ms) | ` +
          `sched=${snap.schedulerTicks}ticks (max=${snap.maxSchedulerTickMs}ms, gap=${snap.maxSchedulerIntervalGapMs}ms, idx=${state.nextScheduleIndex}/${state.timelineLen}) | ` +
          `voices=${snap.activeVoices} (trig=${snap.voicesTriggered}, defer=${snap.deferredCount}->${snap.deferredTriggeredCount}, late=${snap.lateRecoveries}) | ` +
          `syncFallbacks=${snap.syncBakeCount} (${snap.syncBakeMs}ms, total=${snap.totalSyncBakeCount}/${snap.totalSyncBakeMs}ms) | ` +
          `workers=${snap.workerActiveJobs}act+${snap.workerQueuedJobs}q (done=${snap.workerCompletedInWindow}/s, avg=${snap.workerAvgBakeMs}ms, max=${snap.workerMaxBakeMs}ms, err=${snap.workerErrorsTotal}, to=${snap.workerTimeoutsTotal}) | ` +
          `ring=${snap.ringSlotsUsed}/${snap.ringSlotCapacity} (${snap.ringMemoryMB}MB)` +
          (snap.jsHeapMB !== null ? ` | heap=${snap.jsHeapMB}MB` : '');

        if (isLagging) {
          console.warn(msg);
        } else {
          console.log(msg);
        }
      }

      this.lastHeartbeatWallMs = now;
      this.resetWindowCounters();
    }
  }

  public recordVoiceTriggered(): void {
    this.voicesTriggered++;
  }

  public recordDeferredAwait(): void {
    this.deferredCount++;
  }

  public recordDeferredTriggered(): void {
    this.deferredTriggeredCount++;
  }

  public recordLateRecovery(elapsedSec: number, trackId: string, latenessSec: number): void {
    this.lateRecoveries++;
    if (latenessSec > 0.12) {
      this.logWarning(
        elapsedSec,
        'late_note',
        `Late note recovery on track "${trackId}" by ${(latenessSec * 1000).toFixed(0)}ms at t=${elapsedSec.toFixed(2)}s`,
        { trackId, latenessMs: Math.round(latenessSec * 1000) }
      );
    }
  }

  public recordSyncBakeFallback(info: {
    elapsedSec: number;
    trackId: string;
    patch: string;
    noteStartSec: number;
    noteDurSec: number;
    chordVoices: number;
    bakeMs: number;
    reason: string;
    poolPending: number;
    pendingBakesSize: number;
  }): void {
    this.syncBakeCount++;
    this.syncBakeMs += info.bakeMs;
    this.totalSyncBakeCount++;
    this.totalSyncBakeMs += info.bakeMs;

    this.logWarning(
      info.elapsedSec,
      'sync_bake_fallback',
      `MAIN-THREAD SYNC BAKE (${info.bakeMs.toFixed(1)}ms) at t=${info.elapsedSec.toFixed(2)}s | track="${info.trackId}" patch="${info.patch}" note=${info.noteStartSec.toFixed(2)}s (${info.noteDurSec.toFixed(2)}s, ${info.chordVoices}v) | reason=${info.reason} | poolPending=${info.poolPending}, pendingBakes=${info.pendingBakesSize}`,
      info
    );
  }

  public recordWorkerJobCompleted(bakeDurationMs: number): void {
    this.workerCompletedInWindow++;
    this.workerCompletedTotal++;
    this.workerBakeTotalMs += bakeDurationMs;
    if (bakeDurationMs > this.workerMaxBakeMs) {
      this.workerMaxBakeMs = bakeDurationMs;
    }
  }

  public recordWorkerTimeout(jobId: number, elapsedMs: number): void {
    this.workerTimeoutsTotal++;
    const elapsedSec = ( (typeof performance !== 'undefined' ? performance.now() : Date.now()) - this.sessionStartWallMs ) / 1000;
    this.logWarning(
      elapsedSec,
      'worker_timeout',
      `Worker job #${jobId} timed out after ${elapsedMs.toFixed(0)}ms`,
      { jobId, elapsedMs }
    );
  }

  public recordWorkerError(message: string): void {
    this.workerErrorsTotal++;
    const elapsedSec = ( (typeof performance !== 'undefined' ? performance.now() : Date.now()) - this.sessionStartWallMs ) / 1000;
    this.logWarning(elapsedSec, 'worker_error', `Worker error: ${message}`, { message });
  }

  public recordStop(elapsedSec: number): void {
    if (!this.enabled || this.isTestEnv()) return;
    console.info(
      `%c[TenutoDiag] ■ PLAYBACK STOP at t=${elapsedSec.toFixed(2)}s | totalSyncFallbacks=${this.totalSyncBakeCount} (${this.totalSyncBakeMs.toFixed(1)}ms) | workerCompleted=${this.workerCompletedTotal} | warnings=${this.warnings.length}`,
      'color: #f87171; font-weight: bold;'
    );
  }

  public getSummary() {
    return {
      totalSyncBakeCount: this.totalSyncBakeCount,
      totalSyncBakeMs: Number(this.totalSyncBakeMs.toFixed(1)),
      workerCompletedTotal: this.workerCompletedTotal,
      workerTimeoutsTotal: this.workerTimeoutsTotal,
      workerErrorsTotal: this.workerErrorsTotal,
      warningsCount: this.warnings.length,
      recentWarnings: this.warnings.slice(-15),
      recentHeartbeats: this.history.slice(-15),
    };
  }

  private logWarning(
    elapsedSec: number,
    kind: DiagWarningEvent['kind'],
    message: string,
    detail?: Record<string, unknown>
  ): void {
    const evt: DiagWarningEvent = {
      elapsedSec: Number(elapsedSec.toFixed(2)),
      kind,
      message,
      detail,
    };
    this.warnings.push(evt);
    if (this.warnings.length > 250) {
      this.warnings.shift();
    }
    if (this.enabled && !this.isTestEnv()) {
      console.warn(`[TenutoDiag ⚠ ${kind}] ${message}`, detail || '');
    }
  }

  private resetWindowCounters(): void {
    this.rafCalls = 0;
    this.maxFrameGapMs = 0;
    this.progressCalls = 0;
    this.progressTotalMs = 0;
    this.maxProgressMs = 0;
    this.schedulerTicks = 0;
    this.schedulerTotalMs = 0;
    this.maxSchedulerMs = 0;
    this.maxSchedulerGapMs = 0;
    this.voicesTriggered = 0;
    this.syncBakeCount = 0;
    this.syncBakeMs = 0;
    this.deferredCount = 0;
    this.deferredTriggeredCount = 0;
    this.lateRecoveries = 0;
    this.workerCompletedInWindow = 0;
    this.workerBakeTotalMs = 0;
    this.workerMaxBakeMs = 0;
  }
}

export const playbackDiag = new PlaybackDiagnostics();
