import { useState, useEffect } from 'react';

/**
 * Standard VESA / ProMotion / Gaming monitor refresh rates (in Hz).
 */
export const STANDARD_DISPLAY_REFRESH_RATES = [
  60, 72, 75, 90, 100, 120, 144, 165, 180, 200, 240, 300, 360, 480,
] as const;

export interface DisplayRefreshRateTelemetry {
  /** Raw measured frequency from trimmed VSync frame deltas (Hz) */
  measuredHz: number;
  /** Snapped standard display refresh rate (e.g. 60, 120, 144, 165, 240) */
  snappedHz: number;
  /** Duration of a single VSync frame in milliseconds (1000 / snappedHz) */
  frameBudgetMs: number;
  /** True when the active display is running above standard 60Hz (e.g. >= 90Hz) */
  isHighRefresh: boolean;
  /** Number of valid VSync frame deltas collected in the current calibration window */
  sampleCount: number;
  /** True once sufficient VSync samples have been collected to lock the estimate */
  isCalibrated: boolean;
}

/**
 * Snaps a raw measured frame rate (Hz) to the nearest standard hardware display refresh rate
 * if within an 8% relative tolerance, otherwise rounds to the nearest integer Hz.
 */
export function snapToStandardRefreshRate(rawHz: number): number {
  if (!Number.isFinite(rawHz) || rawHz <= 0) return 60;
  const clamped = Math.max(30, Math.min(500, rawHz));

  let bestRate = 60;
  let minDiff = Infinity;
  for (const rate of STANDARD_DISPLAY_REFRESH_RATES) {
    const diff = Math.abs(clamped - rate);
    if (diff < minDiff) {
      minDiff = diff;
      bestRate = rate;
    }
  }

  // Snap to standard tier if within 8% tolerance of that VESA/ProMotion frequency
  if (minDiff / bestRate <= 0.08) {
    return bestRate;
  }
  return Math.round(clamped);
}

/**
 * TestUFO-style statistical VSync frame-delta analyzer.
 * Filters out background-tab pauses and OS compositor hiccups, trims the top and bottom
 * 15% outliers (IQR/trimmed mean), and computes the hardware display's native refresh rate.
 */
export function estimateRefreshRateFromDeltas(
  deltasMs: readonly number[]
): DisplayRefreshRateTelemetry {
  // Valid VSync intervals lie between 1.8ms (~555Hz) and 50ms (20Hz)
  const valid = deltasMs.filter((d) => Number.isFinite(d) && d >= 1.8 && d <= 50);

  if (valid.length < 4) {
    return {
      measuredHz: 60,
      snappedHz: 60,
      frameBudgetMs: 1000 / 60,
      isHighRefresh: false,
      sampleCount: valid.length,
      isCalibrated: false,
    };
  }

  const sorted = [...valid].sort((a, b) => a - b);
  const trimCount = sorted.length >= 10 ? Math.floor(sorted.length * 0.15) : 0;
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount);

  let sum = 0;
  for (let i = 0; i < trimmed.length; i++) {
    sum += trimmed[i];
  }
  const meanDeltaMs = sum / Math.max(1, trimmed.length);
  const measuredHz = 1000 / meanDeltaMs;
  const snappedHz = snapToStandardRefreshRate(measuredHz);
  const frameBudgetMs = 1000 / snappedHz;

  return {
    measuredHz: Math.round(measuredHz * 10) / 10,
    snappedHz,
    frameBudgetMs,
    isHighRefresh: snappedHz >= 90,
    sampleCount: valid.length,
    isCalibrated: valid.length >= 12,
  };
}

function isHeadlessTestEnv(): boolean {
  try {
    if (
      typeof navigator !== 'undefined' &&
      /jsdom|happy-dom/i.test(navigator.userAgent || '')
    ) {
      return true;
    }
    if (
      typeof import.meta !== 'undefined' &&
      (import.meta as unknown as { env?: { MODE?: string } }).env?.MODE === 'test'
    ) {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * React hook that automatically measures and tracks the user's native monitor refresh rate
 * via `requestAnimationFrame` high-resolution timestamps, and re-calibrates whenever the
 * window is resized, moved between monitors, or regains foreground visibility.
 */
export function useDisplayRefreshRate(sampleWindowSize: number = 45): DisplayRefreshRateTelemetry {
  const [telemetry, setTelemetry] = useState<DisplayRefreshRateTelemetry>(() => ({
    measuredHz: 60,
    snappedHz: 60,
    frameBudgetMs: 1000 / 60,
    isHighRefresh: false,
    sampleCount: 0,
    isCalibrated: false,
  }));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') {
      return;
    }
    if (isHeadlessTestEnv()) {
      return;
    }

    let rafId: number | null = null;
    let cancelled = false;
    let deltas: number[] = [];
    let lastStamp = 0;

    const runCalibrationBurst = () => {
      if (cancelled) return;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      deltas = [];
      lastStamp = 0;

      const step = (now: DOMHighResTimeStamp) => {
        if (cancelled) return;
        if (lastStamp > 0) {
          const dt = now - lastStamp;
          if (dt >= 1.8 && dt <= 50) {
            deltas.push(dt);
          }
        }
        lastStamp = now;

        if (deltas.length === 15 || deltas.length >= sampleWindowSize) {
          const next = estimateRefreshRateFromDeltas(deltas);
          setTelemetry((prev) =>
            prev.snappedHz === next.snappedHz && prev.isCalibrated === next.isCalibrated
              ? prev
              : next
          );
        }

        if (deltas.length < sampleWindowSize) {
          rafId = requestAnimationFrame(step);
        } else {
          rafId = null;
        }
      };

      rafId = requestAnimationFrame(step);
    };

    runCalibrationBurst();

    const handleRecalibrate = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      runCalibrationBurst();
    };

    window.addEventListener('resize', handleRecalibrate, { passive: true });
    document.addEventListener('visibilitychange', handleRecalibrate);

    let mediaQuery: MediaQueryList | null = null;
    try {
      if (typeof window.matchMedia === 'function') {
        mediaQuery = window.matchMedia(
          `(resolution: ${window.devicePixelRatio || 1}dppx)`
        );
        mediaQuery.addEventListener?.('change', handleRecalibrate);
      }
    } catch {
      // ignore matchMedia errors on older engines
    }

    return () => {
      cancelled = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('resize', handleRecalibrate);
      document.removeEventListener('visibilitychange', handleRecalibrate);
      mediaQuery?.removeEventListener?.('change', handleRecalibrate);
    };
  }, [sampleWindowSize]);

  return telemetry;
}
