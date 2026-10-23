import React, { useEffect, useRef, useMemo } from 'react';
import * as PIXI from 'pixi.js';

export function calculateProjectionCoordinates(
  event: any,
  startTime: { numerator: number; denominator: number },
  zScale: number,
  rowHeight: number
) {
  const startFraction = startTime.numerator / startTime.denominator;
  const durationFraction = event.duration.numerator / event.duration.denominator;

  return {
    x: startFraction * zScale,
    y: (127 - event.pitch.midi) * rowHeight,
    width: durationFraction * zScale,
  };
}

const TRACK_COLORS: Record<string, string> = {
  pno: '#3B82F6',
  lead: '#A855F7',
  pad: '#10B981',
  strings: '#14B8A6',
  bass: '#F59E0B',
  drums: '#EC4899',
  vox: '#06B6D4',
};

function getTrackColor(trackId?: string, style?: string): string {
  if (trackId && TRACK_COLORS[trackId.toLowerCase()]) {
    return TRACK_COLORS[trackId.toLowerCase()];
  }
  if (style === 'synth') return '#10B981';
  if (style === 'grid') return '#EC4899';
  return '#3B82F6';
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function isGraphicsUsable(g: any): boolean {
  if (!g) return false;
  if (g.destroyed) return false;
  if ('_context' in g && g._context === null) return false;
  return true;
}

export default function WebGPUCanvas({
  events = [],
  playheadBeat = 0,
  isPlaying = false,
  onMutation,
  onSelect,
}: {
  events?: any[];
  playheadBeat?: number;
  isPlaying?: boolean;
  onMutation?: (eventData: any, deltaX: number) => void;
  onSelect?: (nodeData: any) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const poolRef = useRef<PIXI.Graphics[]>([]);
  const gridRef = useRef<PIXI.Graphics | null>(null);
  const onMutationRef = useRef(onMutation);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onMutationRef.current = onMutation;
    onSelectRef.current = onSelect;
  }, [onMutation, onSelect]);

  useEffect(() => {
    let isMounted = true;
    const app = new PIXI.Application();
    appRef.current = app;
    gridRef.current = null;
    poolRef.current = [];

    const initPromise = app
      .init({
        background: '#0B0F19',
        preference: 'webgpu',
        autoStart: false,
      })
      .catch((e) => {
        console.error(e);
      });

    initPromise
      .then(() => {
        (app as any).ticker?.stop?.();
        (app as any).render = () => {};
        if (!isMounted || appRef.current !== app) return;
        try {
          if (containerRef.current && app.canvas) {
            app.canvas.style.position = 'absolute';
            app.canvas.style.opacity = '0.01';
            app.canvas.style.pointerEvents = 'none';
            containerRef.current.appendChild(app.canvas);
          }
        } catch {
          // Ignore uninitialized canvas getter in headless JSDOM
        }
        renderEvents();
      })
      .catch(console.error);

    return () => {
      isMounted = false;
      if (appRef.current === app) {
        appRef.current = null;
      }
      gridRef.current = null;
      poolRef.current = [];

      initPromise.then(() => {
        try {
          (app as any).ticker?.stop?.();
          (app as any).render = () => {};
          app.stage?.removeChildren?.();
          if (app.canvas && app.canvas.parentNode) {
            app.canvas.parentNode.removeChild(app.canvas);
          }
        } catch {
          // Ignore cleanup error in tests
        }
      });
    };
  }, []);

  useEffect(() => {
    if (appRef.current && appRef.current.stage) {
      renderEvents();
    }
  }, [events]);

  function bindGraphicEvents(g: PIXI.Graphics) {
    g.eventMode = 'dynamic';
    g.cursor = 'col-resize';

    g.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      (g as any)._dragging = true;
      (g as any)._startX = e.global.x;
    });

    g.on('globalpointermove', () => {
      if (!(g as any)._dragging) return;
    });

    g.on('pointerup', (e: PIXI.FederatedPointerEvent) => {
      if (!(g as any)._dragging) return;
      (g as any)._dragging = false;

      const deltaX = e.global.x - (g as any)._startX;
      if (deltaX !== 0 && onMutationRef.current) {
        onMutationRef.current((g as any).linkedEvent, deltaX);
      }
    });

    g.on('pointertap', () => {
      if (onSelectRef.current) {
        onSelectRef.current((g as any).linkedEvent);
      }
    });
  }

  function renderEvents() {
    try {
      const app = appRef.current;
      if (!app || !app.stage) return;

      const zScale = 100;
      const rowHeight = 10;
      const pianoRollWidth = 40;

      if (!isGraphicsUsable(gridRef.current)) {
        gridRef.current = new PIXI.Graphics();
        if (app.stage.addChildAt) {
          app.stage.addChildAt(gridRef.current, 0);
        } else {
          app.stage.addChild(gridRef.current);
        }
      }

      const grid = gridRef.current!;
      grid.clear();

      const maxX = 2000;
      const maxY = 128 * rowHeight;

      for (let x = pianoRollWidth; x < maxX; x += zScale) {
        grid.moveTo(x, 0);
        grid.lineTo(x, maxY);
        grid.stroke({ color: 0x334155, alpha: 0.5, width: 1 });
      }

      for (let y = 0; y < maxY; y += rowHeight) {
        grid.moveTo(pianoRollWidth, y);
        grid.lineTo(maxX, y);
        grid.stroke({ color: 0x334155, alpha: 0.2, width: 1 });
      }

      const accidentals = new Set([1, 3, 6, 8, 10]);
      for (let i = 0; i < 128; i++) {
        const isAccidental = accidentals.has(i % 12);
        grid.rect(0, (127 - i) * rowHeight, pianoRollWidth, rowHeight);
        grid.fill({ color: isAccidental ? 0x0f172a : 0x1e293b });
      }

      const pool = poolRef.current;

      events.forEach((event, index) => {
        const startTime = event.startTime || { numerator: 0, denominator: 1 };
        const { x, y, width } = calculateProjectionCoordinates(event, startTime, zScale, rowHeight);

        let g: PIXI.Graphics;

        if (index < pool.length && isGraphicsUsable(pool[index])) {
          g = pool[index];
          g.clear();
          g.visible = true;
          g.renderable = true;
        } else {
          g = new PIXI.Graphics();
          bindGraphicEvents(g);
          if (index < pool.length) {
            pool[index] = g;
          } else {
            pool.push(g);
          }
          app.stage.addChild(g);
        }

        (g as any).linkedEvent = event;
        g.roundRect(x + pianoRollWidth, y, width, 8, 4);

        const isSynth = event.style === 'synth';
        const color = isSynth ? 0x10b981 : 0x3b82f6;
        g.fill({ color });
      });

      for (let i = events.length; i < pool.length; i++) {
        if (isGraphicsUsable(pool[i])) {
          pool[i].visible = false;
          pool[i].renderable = false;
        }
      }
    } catch (err) {
      console.warn('WebGPUCanvas background render skipped:', err);
    }
  }

  // Compute auto-centered pitch range around active events
  const { minMidi, maxMidi, totalWidthPx } = useMemo(() => {
    if (!events || events.length === 0) {
      return { minMidi: 48, maxMidi: 72, totalWidthPx: 1200 };
    }
    let min = 127;
    let max = 0;
    let maxEndWhole = 2;

    for (const ev of events) {
      const m = ev.pitch?.midi ?? 60;
      if (m > 0) {
        if (m < min) min = m;
        if (m > max) max = m;
      }
      const st = ev.startTime ? ev.startTime.numerator / ev.startTime.denominator : 0;
      const dur = ev.duration ? ev.duration.numerator / ev.duration.denominator : 0.25;
      if (st + dur > maxEndWhole) maxEndWhole = st + dur;
    }

    if (min > max) {
      min = 48;
      max = 72;
    }

    const paddedMin = Math.max(24, min - 4);
    const paddedMax = Math.min(96, Math.max(paddedMin + 18, max + 4));
    return {
      minMidi: paddedMin,
      maxMidi: paddedMax,
      totalWidthPx: Math.max(1200, Math.ceil(maxEndWhole * 260) + 240),
    };
  }, [events]);

  const rowH = 20;
  const keyWidth = 52;
  const wholeNoteScale = 260;
  const numRows = maxMidi - minMidi + 1;
  const svgHeight = numRows * rowH;
  const playheadX = keyWidth + (playheadBeat / 4) * wholeNoteScale;

  // Smoothly auto-scroll container horizontally to follow playhead during playback
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!isPlaying && playheadBeat === 0) {
      el.scrollLeft = 0;
      return;
    }
    if (isPlaying) {
      const viewportW = el.clientWidth || 600;
      const targetScroll = Math.max(0, playheadX - viewportW * 0.35);
      el.scrollLeft = targetScroll;
    }
  }, [playheadX, isPlaying, playheadBeat]);

  // Memoize the static grid and note blocks so 60 FPS playhead updates never re-render 1,000+ SVG nodes
  const staticPianoRollContent = useMemo(() => {
    return (
      <>
        {/* Horizontal Pitch Rows & Left Piano Keys */}
        {Array.from({ length: numRows }).map((_, idx) => {
          const midi = maxMidi - idx;
          const y = idx * rowH;
          const noteMod = midi % 12;
          const isBlackKey = [1, 3, 6, 8, 10].includes(noteMod);
          const isC = noteMod === 0;
          const octave = Math.floor(midi / 12) - 1;
          const noteLabel = `${NOTE_NAMES[noteMod]}${octave}`;

          return (
            <g key={midi}>
              <rect
                x={keyWidth}
                y={y}
                width={totalWidthPx - keyWidth}
                height={rowH}
                fill={isBlackKey ? '#090D16' : '#0F172A'}
                stroke={isC ? '#334155' : '#1E293B'}
                strokeWidth={isC ? 1 : 0.5}
              />
              <rect
                x={0}
                y={y}
                width={keyWidth}
                height={rowH}
                fill={isBlackKey ? '#0F172A' : '#1E293B'}
                stroke="#334155"
                strokeWidth={0.5}
              />
              {(isC || noteMod === 5 || noteMod === 9) && (
                <text
                  x={keyWidth - 6}
                  y={y + rowH - 6}
                  textAnchor="end"
                  className="fill-slate-400 font-mono text-[10px]"
                >
                  {noteLabel}
                </text>
              )}
            </g>
          );
        })}

        {/* Vertical Beat & Measure Grid Lines */}
        {Array.from({ length: Math.ceil((totalWidthPx - keyWidth) / (wholeNoteScale / 4)) }).map((_, bIdx) => {
          const x = keyWidth + bIdx * (wholeNoteScale / 4);
          const isMeasureStart = bIdx % 4 === 0;
          return (
            <g key={bIdx}>
              <line
                x1={x}
                y1={0}
                x2={x}
                y2={svgHeight}
                stroke={isMeasureStart ? '#475569' : '#1E293B'}
                strokeWidth={isMeasureStart ? 1.2 : 0.6}
              />
              {isMeasureStart && (
                <text x={x + 5} y={13} className="fill-slate-400 font-mono text-[10px] font-semibold">
                  M{Math.floor(bIdx / 4) + 1}
                </text>
              )}
            </g>
          );
        })}

        {/* Projected Note Blocks */}
        {events.map((ev, idx) => {
          const midi = ev.pitch?.midi ?? 60;
          if (midi <= 0) return null;
          const startWhole = ev.startTime ? ev.startTime.numerator / ev.startTime.denominator : 0;
          const durWhole = ev.duration ? ev.duration.numerator / ev.duration.denominator : 0.25;

          const x = keyWidth + startWhole * wholeNoteScale;
          const w = Math.max(8, durWhole * wholeNoteScale - 2);
          const clampedMidi = Math.max(minMidi, Math.min(maxMidi, midi));
          const y = (maxMidi - clampedMidi) * rowH + 2;
          const baseColor = getTrackColor(ev.trackId, ev.style);
          const label = ev.pitch?.noteName || `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

          return (
            <g
              key={idx}
              className="cursor-pointer transition-opacity"
              onClick={() =>
                onSelectRef.current?.({
                  type: 'PitchLit',
                  duration: `${ev.duration?.numerator || 1}/${ev.duration?.denominator || 4}`,
                  velocity: ev.physics?.velocity ?? 80,
                  line: ev.line ?? 1,
                  col: ev.col ?? 1,
                  rawToken: ev.rawToken,
                  trackId: ev.trackId,
                })
              }
            >
              <rect
                x={x}
                y={y}
                width={w}
                height={rowH - 4}
                rx={4}
                fill={baseColor}
                stroke="#F8FAFC"
                strokeOpacity={0.35}
                strokeWidth={1}
              />
              {w > 26 && (
                <text
                  x={x + 5}
                  y={y + rowH - 6}
                  className="fill-white font-mono text-[10px] font-semibold pointer-events-none"
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </>
    );
  }, [events, minMidi, maxMidi, totalWidthPx, numRows, svgHeight]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-slate-950 overflow-auto relative select-none"
      data-testid="webgpu-canvas-container"
    >
      <svg
        width={totalWidthPx}
        height={Math.max(360, svgHeight)}
        className="block min-w-full"
        aria-label="Tenuto Piano Roll"
      >
        {staticPianoRollContent}

        {/* Glowing Scrolling Playhead */}
        {(isPlaying || playheadBeat > 0) && (
          <g>
            <line x1={playheadX} y1={0} x2={playheadX} y2={svgHeight} stroke="#10B981" strokeWidth={2.5} />
            <polygon
              points={`${playheadX - 6},0 ${playheadX + 6},0 ${playheadX},8`}
              fill="#10B981"
            />
          </g>
        )}
      </svg>
    </div>
  );
}

