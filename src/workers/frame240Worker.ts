import { DocumentParser, CompiledScore } from '../parser/DocumentParser';
import { AtomicEvent } from '../parser/ASTSerializer';

export type ScoreEvent = AtomicEvent;

export interface Frame240WorkerRequest {
  id: number;
  type: 'COMPILE_SCORE' | 'COMPUTE_FRAME_TIMING';
  code?: string;
  tempo?: number;
  anchorBeat?: number;
  anchorTimestampMs?: number;
  nowTimestampMs?: number;
  isPlaying?: boolean;
}

export interface Frame240WorkerResponse {
  id: number;
  type: 'COMPILE_SCORE_RESULT' | 'FRAME_TIMING_RESULT';
  score?: CompiledScore;
  events?: ScoreEvent[];
  interpolatedBeat?: number;
  targetFps: number;
  frameBudgetMs: number;
  workerComputeMs: number;
  error?: string;
}

export const TARGET_UI_FPS = 240;
export const FRAME_BUDGET_240FPS_MS = 1000 / TARGET_UI_FPS; // 4.1666667ms

/**
 * Pure worker message handler exported for both dedicated Web Worker execution
 * and deterministic unit testing in Vitest / JSDOM environments.
 */
export function handleFrame240WorkerMessage(
  req: Frame240WorkerRequest
): Frame240WorkerResponse {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  if (req.type === 'COMPILE_SCORE') {
    try {
      const rawCode = req.code ?? '';
      const tempoDirectiveMatch = rawCode.match(/@tempo\s+(\d+(?:\.\d+)?)/i);
      const cleanedCode = rawCode.replace(/@tempo\s+\d+(?:\.\d+)?\s*/gi, '').trim();
      const parser = new DocumentParser();
      const score = parser.compile(cleanedCode || rawCode);
      if (tempoDirectiveMatch && score.meta) {
        score.meta.tempo = Number(tempoDirectiveMatch[1]) || score.meta.tempo;
      }
      const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      return {
        id: req.id,
        type: 'COMPILE_SCORE_RESULT',
        score,
        events: score.events,
        targetFps: TARGET_UI_FPS,
        frameBudgetMs: FRAME_BUDGET_240FPS_MS,
        workerComputeMs: Math.max(0, t1 - t0),
      };
    } catch (err: any) {
      const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      return {
        id: req.id,
        type: 'COMPILE_SCORE_RESULT',
        targetFps: TARGET_UI_FPS,
        frameBudgetMs: FRAME_BUDGET_240FPS_MS,
        workerComputeMs: Math.max(0, t1 - t0),
        error: err?.message || 'Worker compilation failed',
      };
    }
  }

  // COMPUTE_FRAME_TIMING: High-precision 240Hz sub-beat interpolation
  const tempo = Math.max(1, req.tempo ?? 120);
  const anchorBeat = Math.max(0, req.anchorBeat ?? 0);
  const anchorTimestampMs = req.anchorTimestampMs ?? t0;
  const nowTimestampMs = req.nowTimestampMs ?? t0;

  let interpolatedBeat = anchorBeat;
  if (req.isPlaying && nowTimestampMs > anchorTimestampMs) {
    const elapsedSeconds = (nowTimestampMs - anchorTimestampMs) / 1000;
    const beatsPerSecond = tempo / 60;
    interpolatedBeat = Math.max(0, anchorBeat + elapsedSeconds * beatsPerSecond);
  }

  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    id: req.id,
    type: 'FRAME_TIMING_RESULT',
    interpolatedBeat,
    targetFps: TARGET_UI_FPS,
    frameBudgetMs: FRAME_BUDGET_240FPS_MS,
    workerComputeMs: Math.max(0, t1 - t0),
  };
}

// Attach Web Worker message listener when running inside a Worker global scope
if (
  typeof self !== 'undefined' &&
  typeof (self as any).postMessage === 'function' &&
  typeof window === 'undefined'
) {
  self.addEventListener('message', (event: MessageEvent<Frame240WorkerRequest>) => {
    const response = handleFrame240WorkerMessage(event.data);
    (self as any).postMessage(response);
  });
}
