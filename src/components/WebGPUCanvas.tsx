import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
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
  harp: '#38BDF8',
  arp: '#06B6D4',
  fl: '#2DD4BF',
  lead: '#A855F7',
  vln1: '#8B5CF6',
  vln2: '#6366F1',
  vla: '#14B8A6',
  vc: '#F59E0B',
  cb: '#D97706',
  bass: '#F97316',
  pad: '#10B981',
  strings: '#10B981',
  hn: '#EAB308',
  brass: '#F59E0B',
  choir: '#EC4899',
  vox: '#F472B6',
  drums: '#EF4444',
  perc: '#FB7185',
  timp: '#E11D48',
};

const FALLBACK_PALETTE = [
  '#3B82F6',
  '#A855F7',
  '#10B981',
  '#F59E0B',
  '#EC4899',
  '#06B6D4',
  '#8B5CF6',
  '#EAB308',
  '#14B8A6',
  '#F97316',
];

function getTrackColor(trackId?: string, style?: string, trackIndex: number = 0): string {
  if (trackId) {
    const key = trackId.toLowerCase();
    if (TRACK_COLORS[key]) return TRACK_COLORS[key];
  }
  if (style === 'grid') return '#EF4444';
  if (style === 'synth') return FALLBACK_PALETTE[(trackIndex + 1) % FALLBACK_PALETTE.length];
  return FALLBACK_PALETTE[trackIndex % FALLBACK_PALETTE.length];
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
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const poolRef = useRef<PIXI.Graphics[]>([]);
  const gridRef = useRef<PIXI.Graphics | null>(null);
  const onMutationRef = useRef(onMutation);
  const onSelectRef = useRef(onSelect);

  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  useEffect(() => {
    onMutationRef.current = onMutation;
    onSelectRef.current = onSelect;
  }, [onMutation, onSelect]);

  // Extract distinct instrument tracks present in the compiled events
  const availableTracks = useMemo(() => {
    const map = new Map<string, { id: string; count: number; style?: string; color: string }>();
    events.forEach((ev) => {
      const id = ev.trackId || 'pno';
      const existing = map.get(id);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(id, {
          id,
          count: 1,
          style: ev.style,
          color: getTrackColor(id, ev.style, map.size),
        });
      }
    });
    return Array.from(map.values());
  }, [events]);

  // Reset selectedTrackId if the score changes and no longer contains that track
  useEffect(() => {
    if (selectedTrackId && !availableTracks.some((t) => t.id === selectedTrackId)) {
      setSelectedTrackId(null);
    }
  }, [availableTracks, selectedTrackId]);

  // Filter events by selected instrument track (or show all if null)
  const visibleEvents = useMemo(() => {
    if (!selectedTrackId) return events;
    return events.filter((ev) => (ev.trackId || 'pno') === selectedTrackId);
  }, [events, selectedTrackId]);

  // Native macOS trackpad pinch-to-zoom handler (wheel with ctrlKey / metaKey)
  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        setZoomLevel((prev) => Math.max(0.2, Math.min(3.0, Number((prev * zoomFactor).toFixed(2)))));
      }
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener('wheel', handleWheel);
    };
  }, []);

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

  // Compute auto-centered pitch range and measure span around visible events
  const { minMidi, maxMidi, maxEndWhole } = useMemo(() => {
    if (!visibleEvents || visibleEvents.length === 0) {
      return { minMidi: 48, maxMidi: 72, maxEndWhole: 2 };
    }
    let min = 127;
    let max = 0;
    let maxWhole = 1;

    for (const ev of visibleEvents) {
      const m = ev.pitch?.midi ?? 60;
      if (m > 0) {
        if (m < min) min = m;
        if (m > max) max = m;
      }
      const st = ev.startTime ? ev.startTime.numerator / ev.startTime.denominator : 0;
      const dur = ev.duration ? ev.duration.numerator / ev.duration.denominator : 0.25;
      if (st + dur > maxWhole) maxWhole = st + dur;
    }

    if (min > max) {
      min = 48;
      max = 72;
    }

    const pad = selectedTrackId ? 3 : 4;
    const minSpan = selectedTrackId ? 12 : 18;
    const paddedMin = Math.max(12, min - pad);
    const paddedMax = Math.min(108, Math.max(paddedMin + minSpan, max + pad));
    return {
      minMidi: paddedMin,
      maxMidi: paddedMax,
      maxEndWhole: maxWhole,
    };
  }, [visibleEvents, selectedTrackId]);

  const keyWidth = 52;
  const rowH = Math.max(8, Math.round(20 * zoomLevel));
  const wholeNoteScale = Math.max(48, Math.round(260 * zoomLevel));
  const numRows = maxMidi - minMidi + 1;
  const svgHeight = numRows * rowH;
  const totalWidthPx = Math.max(800, Math.ceil(maxEndWhole * wholeNoteScale) + 180);
  const playheadX = keyWidth + (playheadBeat / 4) * wholeNoteScale;

  const handleFitAll = useCallback(() => {
    const viewport = scrollViewportRef.current;
    const availW = (viewport?.clientWidth || 720) - keyWidth - 40;
    const availH = (viewport?.clientHeight || 500) - 20;

    const idealHorizontalZoom = availW / Math.max(1, maxEndWhole * 260);
    const idealVerticalZoom = availH / Math.max(1, numRows * 20);
    const fitted = Math.max(0.2, Math.min(2.5, Math.min(idealHorizontalZoom, idealVerticalZoom)));
    setZoomLevel(Number(fitted.toFixed(2)));
    if (viewport) {
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    }
  }, [maxEndWhole, numRows]);

  // Smoothly auto-scroll container horizontally to follow playhead during playback
  useEffect(() => {
    const el = scrollViewportRef.current;
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

  const trackIndexMap = useMemo(() => {
    const m = new Map<string, number>();
    availableTracks.forEach((t, i) => m.set(t.id, i));
    return m;
  }, [availableTracks]);

  // Memoize static grid and note blocks so 60 FPS playhead updates never re-render 1,000+ SVG nodes
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
              {(isC || (rowH >= 14 && (noteMod === 5 || noteMod === 9))) && (
                <text
                  x={keyWidth - 6}
                  y={y + Math.max(9, rowH - 5)}
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
          if (!isMeasureStart && wholeNoteScale < 90) return null;
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
                <text x={x + 4} y={12} className="fill-slate-400 font-mono text-[10px] font-semibold">
                  M{Math.floor(bIdx / 4) + 1}
                </text>
              )}
            </g>
          );
        })}

        {/* Projected Note Blocks */}
        {visibleEvents.map((ev, idx) => {
          const midi = ev.pitch?.midi ?? 60;
          if (midi <= 0) return null;
          const startWhole = ev.startTime ? ev.startTime.numerator / ev.startTime.denominator : 0;
          const durWhole = ev.duration ? ev.duration.numerator / ev.duration.denominator : 0.25;

          const x = keyWidth + startWhole * wholeNoteScale;
          const w = Math.max(4, durWhole * wholeNoteScale - 1.5);
          const clampedMidi = Math.max(minMidi, Math.min(maxMidi, midi));
          const y = (maxMidi - clampedMidi) * rowH + 1.5;
          const tId = ev.trackId || 'pno';
          const baseColor = getTrackColor(tId, ev.style, trackIndexMap.get(tId) ?? 0);
          const swell = ev.physics?.swell;
          const noteH = Math.max(5, rowH - 3);
          const label =
            (ev.pitch?.noteName || `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`) +
            (swell === 'crescendo' ? ' <' : swell === 'diminuendo' ? ' >' : '');

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
                height={noteH}
                rx={Math.min(4, Math.max(2, rowH / 4))}
                fill={baseColor}
                fillOpacity={swell ? 0.65 : 1}
                stroke="#F8FAFC"
                strokeOpacity={0.35}
                strokeWidth={0.8}
              />
              {swell === 'crescendo' && w > 12 && (
                <polygon
                  points={`${x + 2},${y + noteH / 2} ${x + w - 2},${y + 1.5} ${x + w - 2},${y + noteH - 1.5}`}
                  fill="#F8FAFC"
                  fillOpacity={0.32}
                  className="pointer-events-none"
                />
              )}
              {swell === 'diminuendo' && w > 12 && (
                <polygon
                  points={`${x + 2},${y + 1.5} ${x + 2},${y + noteH - 1.5} ${x + w - 2},${y + noteH / 2}`}
                  fill="#F8FAFC"
                  fillOpacity={0.32}
                  className="pointer-events-none"
                />
              )}
              {w > 26 && rowH >= 14 && (
                <text
                  x={x + 5}
                  y={y + rowH - 5}
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
  }, [visibleEvents, minMidi, maxMidi, totalWidthPx, numRows, svgHeight, rowH, wholeNoteScale, trackIndexMap]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-slate-950 flex flex-col overflow-hidden relative select-none"
      data-testid="webgpu-canvas-container"
    >
      {/* Top Instrument Filter & Zoom Control Bar */}
      <div className="bg-slate-900/95 border-b border-slate-800 px-3 py-1.5 flex items-center justify-between gap-2 shrink-0 z-10">
        {/* Instrument Track Pills (All Instruments vs. Isolate Single Track) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            aria-label="Show All Instruments"
            onClick={() => setSelectedTrackId(null)}
            className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-colors cursor-pointer shrink-0 border ${
              selectedTrackId === null
                ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            All Instruments ({availableTracks.length || 1})
          </button>

          {availableTracks.map((track) => {
            const isSelected = selectedTrackId === track.id;
            return (
              <button
                key={track.id}
                type="button"
                aria-label={`Isolate track ${track.id}`}
                onClick={() => {
                  if (isSelected) {
                    setSelectedTrackId(null);
                  } else {
                    setSelectedTrackId(track.id);
                    setZoomLevel((z) => (z < 0.8 ? 1.0 : z));
                  }
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer shrink-0 border ${
                  isSelected
                    ? 'bg-slate-800 text-white border-slate-500 font-bold shadow-sm'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: track.color }}
                />
                <span>{track.id}</span>
                <span className="text-[10px] text-slate-500">({track.count})</span>
              </button>
            );
          })}
        </div>

        {/* Pinch-to-Zoom & Fit-All Controls */}
        <div className="flex items-center gap-1 shrink-0 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5">
          <button
            type="button"
            aria-label="Zoom Out"
            onClick={() => setZoomLevel((z) => Math.max(0.2, Number((z - 0.15).toFixed(2))))}
            className="text-slate-400 hover:text-white px-1.5 py-0.5 text-xs font-mono font-bold cursor-pointer"
            title="Zoom Out (or Pinch In on Trackpad)"
          >
            -
          </button>
          <button
            type="button"
            aria-label="Reset Zoom"
            onClick={() => setZoomLevel(1.0)}
            className="text-slate-300 hover:text-white px-1.5 py-0.5 text-[11px] font-mono cursor-pointer min-w-[44px] text-center"
            title="Reset Zoom to 100%"
          >
            {Math.round(zoomLevel * 100)}%
          </button>
          <button
            type="button"
            aria-label="Zoom In"
            onClick={() => setZoomLevel((z) => Math.min(3.0, Number((z + 0.15).toFixed(2))))}
            className="text-slate-400 hover:text-white px-1.5 py-0.5 text-xs font-mono font-bold cursor-pointer"
            title="Zoom In (or Pinch Out on Trackpad)"
          >
            +
          </button>
          <div className="w-px h-3.5 bg-slate-800 mx-0.5" />
          <button
            type="button"
            aria-label="Fit All"
            onClick={handleFitAll}
            className="text-emerald-400 hover:text-emerald-300 px-1.5 py-0.5 text-[11px] font-mono font-semibold cursor-pointer"
            title="Fit entire score into view"
          >
            Fit All
          </button>
        </div>
      </div>

      {/* Scrollable & Pinch-Zoomable Piano Roll Viewport */}
      <div
        ref={scrollViewportRef}
        data-testid="piano-roll-scroll-viewport"
        className="flex-1 w-full overflow-auto relative"
      >
        <svg
          width={totalWidthPx}
          height={Math.max(320, svgHeight)}
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
    </div>
  );
}
