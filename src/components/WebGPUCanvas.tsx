import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { isMidiInScale, parseKeyRootSemitone } from '../parser/PitchEngine';
import AutomationLaneEditor from './AutomationLaneEditor';
import { AutomationLane, AutomationCurveType } from '../audio/AutomationEngine';
import { MidiTransformType, MidiGeneratorType } from '../mutator/MidiTransformAndGeneratorEngine';

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
  rootKey,
  scaleName,
  automationLanes = [],
  onMutation,
  onSelect,
  onCommitAutomation,
  onApplyMidiTransform,
  onGenerateMidiPattern,
}: {
  events?: any[];
  playheadBeat?: number;
  isPlaying?: boolean;
  rootKey?: string;
  scaleName?: string;
  automationLanes?: AutomationLane[];
  onMutation?: (
    eventData: any,
    deltaX: number,
    semitoneDelta?: number,
    zScale?: number
  ) => void;
  onSelect?: (nodeData: any) => void;
  onCommitAutomation?: (
    trackId: string,
    measureNumber: number,
    param: string,
    values: number[],
    curve: AutomationCurveType
  ) => void;
  onApplyMidiTransform?: (transform: MidiTransformType, trackId?: string | null) => void;
  onGenerateMidiPattern?: (generator: MidiGeneratorType, trackId?: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const trackPillsRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const poolRef = useRef<PIXI.Graphics[]>([]);
  const gridRef = useRef<PIXI.Graphics | null>(null);
  const onMutationRef = useRef(onMutation);
  const onSelectRef = useRef(onSelect);

  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [isClipEnvelopeOpen, setIsClipEnvelopeOpen] = useState<boolean>(false);
  const [isMidiToolsOpen, setIsMidiToolsOpen] = useState<boolean>(false);
  const [dragState, setDragState] = useState<{
    eventIndex: number;
    event: any;
    mode: 'move' | 'resize';
    isBeatWide?: boolean;
    beatStartWhole?: number;
    startClientX: number;
    startClientY: number;
    semitoneDelta: number;
    deltaWidthPx: number;
  } | null>(null);
  const [selectedBeatWhole, setSelectedBeatWhole] = useState<number | null>(null);
  const [selectedBeatAnchorMidi, setSelectedBeatAnchorMidi] = useState<number | null>(null);

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

  // Native macOS trackpad pinch-to-zoom AND mobile two-finger touch pinch-to-zoom handler
  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    let initialPinchDistance: number | null = null;
    let initialPinchZoom: number = 1.0;

    const getTouchDistance = (touches: TouchList): number => {
      if (touches.length < 2) return 0;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        setZoomLevel((prev) => Math.max(0.2, Math.min(3.0, Number((prev * zoomFactor).toFixed(2)))));
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches && e.touches.length === 2) {
        const dist = getTouchDistance(e.touches);
        if (dist > 8) {
          initialPinchDistance = dist;
          setZoomLevel((currentZoom) => {
            initialPinchZoom = currentZoom;
            return currentZoom;
          });
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches.length === 2 && initialPinchDistance !== null && initialPinchDistance > 8) {
        if (e.cancelable) e.preventDefault();
        const currentDist = getTouchDistance(e.touches);
        if (currentDist > 8) {
          const ratio = currentDist / initialPinchDistance;
          const nextZoom = Math.max(0.2, Math.min(3.0, Number((initialPinchZoom * ratio).toFixed(2))));
          setZoomLevel(nextZoom);
        }
      }
    };

    const handleTouchEnd = () => {
      initialPinchDistance = null;
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    viewport.addEventListener('touchstart', handleTouchStart, { passive: true });
    viewport.addEventListener('touchmove', handleTouchMove, { passive: false });
    viewport.addEventListener('touchend', handleTouchEnd);
    viewport.addEventListener('touchcancel', handleTouchEnd);
    return () => {
      viewport.removeEventListener('wheel', handleWheel);
      viewport.removeEventListener('touchstart', handleTouchStart);
      viewport.removeEventListener('touchmove', handleTouchMove);
      viewport.removeEventListener('touchend', handleTouchEnd);
      viewport.removeEventListener('touchcancel', handleTouchEnd);
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
      return { minMidi: 36, maxMidi: 84, maxEndWhole: 4 };
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

    const centerMidi = Math.round((min + max) / 2);
    const minSpan = selectedTrackId ? 28 : 36;
    const halfSpan = Math.max(Math.ceil((max - min) / 2) + 6, Math.floor(minSpan / 2));
    const paddedMin = Math.max(12, centerMidi - halfSpan);
    const paddedMax = Math.min(108, Math.max(paddedMin + minSpan, centerMidi + halfSpan));
    return {
      minMidi: paddedMin,
      maxMidi: paddedMax,
      maxEndWhole: Math.max(4, maxWhole),
    };
  }, [visibleEvents, selectedTrackId]);

  const keyWidth = 52;
  const rowH = Math.max(8, Math.round(20 * zoomLevel));
  const wholeNoteScale = Math.max(48, Math.round(260 * zoomLevel));
  const numRows = maxMidi - minMidi + 1;
  const svgHeight = numRows * rowH;
  const totalWidthPx = Math.max(760, Math.ceil(maxEndWhole * wholeNoteScale) + keyWidth + 24);
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

  useEffect(() => {
    if (!dragState) return;

    const stepPx = Math.max(4, wholeNoteScale / 16);

    const handleMouseMove = (e: MouseEvent) => {
      const rawDeltaX = e.clientX - dragState.startClientX;
      const rawDeltaY = e.clientY - dragState.startClientY;

      if (dragState.mode === 'resize') {
        const snappedDeltaX = Math.round(rawDeltaX / stepPx) * stepPx;
        setDragState((prev) =>
          prev ? { ...prev, deltaWidthPx: snappedDeltaX, semitoneDelta: 0 } : null
        );
      } else {
        const semiDelta = Math.round(-rawDeltaY / rowH);
        const snappedDeltaX =
          semiDelta === 0 && Math.abs(rawDeltaX) >= stepPx
            ? Math.round(rawDeltaX / stepPx) * stepPx
            : 0;
        setDragState((prev) =>
          prev
            ? { ...prev, semitoneDelta: semiDelta, deltaWidthPx: snappedDeltaX }
            : null
        );
      }
    };

    const handleMouseUp = () => {
      if (dragState.semitoneDelta !== 0 || dragState.deltaWidthPx !== 0) {
        const payload = dragState.isBeatWide
          ? {
              ...dragState.event,
              isBeatWideMutation: true,
              beatStartWhole: dragState.beatStartWhole ?? 0,
            }
          : dragState.event;
        onMutationRef.current?.(
          payload,
          dragState.deltaWidthPx,
          dragState.semitoneDelta,
          wholeNoteScale
        );
      }
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, rowH, wholeNoteScale]);

  const handleShiftRepitchBeatToMidi = useCallback(
    (targetMidi: number, clientX?: number, svgElement?: SVGSVGElement | null) => {
      const melodicEvents = visibleEvents.filter(
        (ev) =>
          ev?.pitch &&
          !ev.pitch.isRest &&
          !ev.pitch.isSpacer &&
          !ev.pitch.gridKey &&
          ev.style !== 'grid' &&
          ev.pitch.midi > 0
      );
      if (melodicEvents.length === 0) return;

      let beatWhole = selectedBeatWhole;
      let anchorMidi = selectedBeatAnchorMidi;

      // If a click X coordinate on the grid is provided, resolve the beat column under the cursor
      if (clientX !== undefined && clientX > 0) {
        const rect = svgElement?.getBoundingClientRect?.();
        const scrollLeft = scrollViewportRef.current?.scrollLeft || 0;
        const relX =
          rect && rect.width > 0 ? clientX - rect.left + scrollLeft : clientX;
        if (relX > keyWidth) {
          const clickedWhole = Math.max(0, (relX - keyWidth) / wholeNoteScale);
          // Find note covering clickedWhole, or nearest note onset
          let bestEv = melodicEvents[0];
          let minDist = Infinity;
          for (const ev of melodicEvents) {
            const st = ev.startTime
              ? ev.startTime.numerator / Math.max(1, ev.startTime.denominator)
              : 0;
            const dur = ev.duration
              ? ev.duration.numerator / Math.max(1, ev.duration.denominator)
              : 0.25;
            if (clickedWhole >= st - 1e-3 && clickedWhole <= st + dur + 1e-3) {
              bestEv = ev;
              minDist = 0;
              break;
            }
            const dist = Math.abs(clickedWhole - st);
            if (dist < minDist) {
              minDist = dist;
              bestEv = ev;
            }
          }
          beatWhole = bestEv.startTime
            ? bestEv.startTime.numerator / Math.max(1, bestEv.startTime.denominator)
            : 0;
          const beatNotes = melodicEvents.filter((ev) => {
            const st = ev.startTime
              ? ev.startTime.numerator / Math.max(1, ev.startTime.denominator)
              : 0;
            return Math.abs(st - beatWhole!) < 1e-4;
          });
          // Use the selected anchor note if on the same beat, otherwise use the first/root note on that beat
          if (
            selectedBeatWhole === null ||
            Math.abs(selectedBeatWhole - beatWhole) > 1e-4 ||
            anchorMidi === null
          ) {
            anchorMidi = beatNotes[0]?.pitch?.midi ?? bestEv.pitch.midi;
          }
        }
      }

      if (beatWhole === null) {
        const firstEv = melodicEvents[0];
        beatWhole = firstEv.startTime
          ? firstEv.startTime.numerator / Math.max(1, firstEv.startTime.denominator)
          : 0;
        anchorMidi = firstEv.pitch.midi;
      }

      const beatNotes = melodicEvents.filter((ev) => {
        const st = ev.startTime
          ? ev.startTime.numerator / Math.max(1, ev.startTime.denominator)
          : 0;
        return Math.abs(st - beatWhole!) < 1e-4;
      });
      if (beatNotes.length === 0) return;

      const refMidi = anchorMidi ?? beatNotes[0].pitch.midi;
      const semitoneDelta = Math.round(targetMidi - refMidi);
      if (semitoneDelta === 0) return;

      setSelectedBeatWhole(beatWhole);
      setSelectedBeatAnchorMidi(targetMidi);

      onMutationRef.current?.(
        {
          ...beatNotes[0],
          isBeatWideMutation: true,
          beatStartWhole: beatWhole,
        },
        0,
        semitoneDelta,
        wholeNoteScale
      );
    },
    [visibleEvents, selectedBeatWhole, selectedBeatAnchorMidi, wholeNoteScale]
  );

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

          const { rootSemitone } = parseKeyRootSemitone(rootKey || 'C');
          const isRootRow = Boolean(rootKey) && noteMod === rootSemitone;
          const inScale = isMidiInScale(midi, rootKey || 'C', scaleName || 'chromatic');
          const rowFill = isRootRow
            ? '#172554'
            : scaleName && scaleName !== 'chromatic' && !inScale
              ? '#060911'
              : isBlackKey
                ? '#090D16'
                : '#0F172A';

          return (
            <g key={midi}>
              <rect
                data-testid={`piano-roll-row-${midi}`}
                x={keyWidth}
                y={y}
                width={totalWidthPx - keyWidth}
                height={rowH}
                fill={rowFill}
                stroke={isC ? '#334155' : '#1E293B'}
                strokeWidth={isC ? 1 : 0.5}
                className="cursor-pointer"
                onClick={(e) => {
                  if (e.shiftKey || selectedBeatWhole !== null) {
                    handleShiftRepitchBeatToMidi(
                      midi,
                      e.clientX,
                      e.currentTarget.ownerSVGElement
                    );
                  }
                }}
              />
              <rect
                data-testid={`piano-key-${midi}`}
                x={0}
                y={y}
                width={keyWidth}
                height={rowH}
                fill={isBlackKey ? '#0F172A' : '#1E293B'}
                stroke="#334155"
                strokeWidth={0.5}
                className="cursor-pointer"
                onClick={(e) => {
                  if (e.shiftKey || selectedBeatWhole !== null) {
                    handleShiftRepitchBeatToMidi(midi);
                  }
                }}
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

        {/* Projected Note Blocks (Interactive Bi-Directional Dragging for Pitch & Duration) */}
        {visibleEvents.map((ev, idx) => {
          const baseMidi = ev.pitch?.midi ?? 60;
          if (baseMidi <= 0) return null;

          const startWhole = ev.startTime ? ev.startTime.numerator / ev.startTime.denominator : 0;
          const durWhole = ev.duration ? ev.duration.numerator / ev.duration.denominator : 0.25;
          const isSameBeatAsDrag =
            Boolean(dragState?.isBeatWide) &&
            dragState?.beatStartWhole !== undefined &&
            Math.abs(startWhole - dragState.beatStartWhole) < 1e-4 &&
            ev.style !== 'grid' &&
            !ev.pitch?.gridKey;
          const isBeingDragged = dragState?.eventIndex === idx || isSameBeatAsDrag;
          const isBeatLocked =
            selectedBeatWhole !== null &&
            Math.abs(startWhole - selectedBeatWhole) < 1e-4 &&
            ev.style !== 'grid' &&
            !ev.pitch?.gridKey;
          const effectiveMidi = Math.max(
            12,
            Math.min(108, baseMidi + (isBeingDragged && dragState ? dragState.semitoneDelta : 0))
          );

          const x = keyWidth + startWhole * wholeNoteScale;
          const baseW = Math.max(4, durWhole * wholeNoteScale - 1.5);
          const w = Math.max(
            6,
            baseW + (dragState?.eventIndex === idx ? dragState.deltaWidthPx : 0)
          );
          const clampedMidi = Math.max(minMidi, Math.min(maxMidi, effectiveMidi));
          const y = (maxMidi - clampedMidi) * rowH + 1.5;
          const tId = ev.trackId || 'pno';
          const baseColor = getTrackColor(tId, ev.style, trackIndexMap.get(tId) ?? 0);
          const swell = ev.physics?.swell;
          const noteH = Math.max(5, rowH - 3);
          const badge =
            ev.physics?.trill
              ? ' tr~'
              : ev.physics?.vibrato
                ? ' ~'
                : ev.physics?.pizz
                  ? ' pizz'
                  : ev.physics?.fermata
                    ? ' 𝄐'
                    : swell === 'crescendo'
                      ? ' <'
                      : swell === 'diminuendo'
                        ? ' >'
                        : '';
          const pitchName =
            isBeingDragged && dragState.semitoneDelta !== 0
              ? `${NOTE_NAMES[effectiveMidi % 12]}${Math.floor(effectiveMidi / 12) - 1}`
              : ev.pitch?.noteName ||
                `${NOTE_NAMES[baseMidi % 12]}${Math.floor(baseMidi / 12) - 1}`;
          const lyricText = ev.physics?.lyric ? `"${ev.physics.lyric}" ` : '';
          const label = `${lyricText}${pitchName}${badge}`;

          const selectPayload = {
            type: 'PitchLit',
            duration: `${ev.duration?.numerator || 1}/${ev.duration?.denominator || 4}`,
            velocity: ev.physics?.velocity ?? 80,
            articulation: ev.physics?.articulation || '',
            chance: ev.physics?.chance ?? 100,
            pan: ev.physics?.pan ?? 0,
            lyric: ev.physics?.lyric || '',
            line: ev.line ?? 1,
            col: ev.col ?? 1,
            rawToken: ev.rawToken,
            trackId: ev.trackId,
            sourceStartOffset: ev.sourceStartOffset,
            sourceEndOffset: ev.sourceEndOffset,
          };

          return (
            <g
              key={idx}
              data-testid={`piano-roll-note-${idx}`}
              className="cursor-grab active:cursor-grabbing transition-opacity"
              onClick={() => onSelectRef.current?.(selectPayload)}
              onMouseDown={(e) => {
                e.stopPropagation();
                onSelectRef.current?.(selectPayload);
                if (e.shiftKey) {
                  setSelectedBeatWhole(startWhole);
                  setSelectedBeatAnchorMidi(baseMidi);
                } else {
                  setSelectedBeatWhole(null);
                  setSelectedBeatAnchorMidi(null);
                }
                setDragState({
                  eventIndex: idx,
                  event: ev,
                  mode: 'move',
                  isBeatWide: Boolean(e.shiftKey),
                  beatStartWhole: startWhole,
                  startClientX: e.clientX,
                  startClientY: e.clientY,
                  semitoneDelta: 0,
                  deltaWidthPx: 0,
                });
              }}
            >
              <rect
                x={x}
                y={y}
                width={w}
                height={noteH}
                rx={Math.min(4, Math.max(2, rowH / 4))}
                fill={isBeingDragged ? '#38BDF8' : baseColor}
                fillOpacity={isBeingDragged ? 0.92 : swell ? 0.65 : 1}
                stroke={isBeingDragged ? '#FFFFFF' : isBeatLocked ? '#FBBF24' : '#F8FAFC'}
                strokeOpacity={isBeingDragged || isBeatLocked ? 1 : 0.35}
                strokeWidth={isBeingDragged || isBeatLocked ? 1.8 : 0.8}
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
              {ev.physics?.mpe && w > 12 && (
                <polyline
                  data-testid={`mpe-curve-${idx}`}
                  fill="none"
                  stroke="#22D3EE"
                  strokeWidth={1.8}
                  points={`${x + 2},${y + noteH * 0.7} ${x + w * 0.5},${y + noteH * 0.2} ${x + w - 2},${y + noteH * 0.65}`}
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
              {/* Right-Edge Duration Resize Handle */}
              <rect
                data-testid={`note-resize-handle-${idx}`}
                x={x + Math.max(2, w - 6)}
                y={y}
                width={6}
                height={noteH}
                fill="transparent"
                className="cursor-col-resize"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onSelectRef.current?.(selectPayload);
                  setDragState({
                    eventIndex: idx,
                    event: ev,
                    mode: 'resize',
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    semitoneDelta: 0,
                    deltaWidthPx: 0,
                  });
                }}
              />
            </g>
          );
        })}
      </>
    );
  }, [
    visibleEvents,
    minMidi,
    maxMidi,
    totalWidthPx,
    numRows,
    svgHeight,
    rowH,
    wholeNoteScale,
    trackIndexMap,
    rootKey,
    scaleName,
    dragState,
    selectedBeatWhole,
    handleShiftRepitchBeatToMidi,
  ]);

  const currentWholeTime = playheadBeat / 4;
  const activeNotesAtPlayhead = useMemo(() => {
    if (!isPlaying && playheadBeat <= 0) return [];
    return visibleEvents.filter((ev) => {
      const midi = ev.pitch?.midi ?? 60;
      if (midi <= 0) return false;
      const startWhole = ev.startTime ? ev.startTime.numerator / ev.startTime.denominator : 0;
      const durWhole = ev.duration ? ev.duration.numerator / ev.duration.denominator : 0.25;
      return currentWholeTime >= startWhole && currentWholeTime <= startWhole + durWhole;
    });
  }, [visibleEvents, isPlaying, playheadBeat, currentWholeTime]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-slate-950 flex flex-col overflow-hidden relative select-none"
      data-testid="webgpu-canvas-container"
    >
      {/* Top Instrument Filter & Zoom Control Bar */}
      <div className="bg-slate-900/95 border-b border-slate-800 px-3 py-1.5 flex items-center justify-between gap-2 shrink-0 z-10">
        {/* Instrument Track Navigator: Quick Dropdown + Scrollable Track Pills */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
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

          {availableTracks.length > 1 && (
            <select
              aria-label="Select Instrument Track"
              value={selectedTrackId || ''}
              onChange={(e) => {
                const val = e.target.value || null;
                setSelectedTrackId(val);
                if (val) setZoomLevel((z) => (z < 0.8 ? 1.0 : z));
              }}
              className="bg-slate-950 border border-slate-700 text-amber-300 text-[11px] font-mono rounded px-1.5 py-1 outline-none cursor-pointer shrink-0"
              title="Jump directly to any instrument track"
            >
              <option value="">Jump to Track ({availableTracks.length})...</option>
              {availableTracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id} ({t.count} notes)
                </option>
              ))}
            </select>
          )}

          {availableTracks.length > 3 && (
            <button
              type="button"
              aria-label="Scroll Tracks Left"
              onClick={() => {
                if (trackPillsRef.current) {
                  trackPillsRef.current.scrollBy({ left: -180, behavior: 'smooth' });
                }
              }}
              className="px-1.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-400 hover:text-white text-[10px] font-mono cursor-pointer shrink-0"
              title="Scroll instrument list left"
            >
              ◀
            </button>
          )}

          <div
            ref={trackPillsRef}
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 min-w-0"
          >
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

          {availableTracks.length > 3 && (
            <button
              type="button"
              aria-label="Scroll Tracks Right"
              onClick={() => {
                if (trackPillsRef.current) {
                  trackPillsRef.current.scrollBy({ left: 180, behavior: 'smooth' });
                }
              }}
              className="px-1.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-400 hover:text-white text-[10px] font-mono cursor-pointer shrink-0"
              title="Scroll instrument list right"
            >
              ▶
            </button>
          )}
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
          <div className="w-px h-3.5 bg-slate-800 mx-0.5" />
          <button
            type="button"
            aria-label="Toggle Clip Envelope Editor"
            onClick={() => setIsClipEnvelopeOpen((prev) => !prev)}
            className={`px-1.5 py-0.5 text-[11px] font-mono font-semibold rounded cursor-pointer ${
              isClipEnvelopeOpen
                ? 'bg-cyan-600 text-white'
                : 'text-cyan-400 hover:text-cyan-300'
            }`}
            title="Show/Hide Clip Automation Envelope Lane"
          >
            Clip Env
          </button>
          <div className="w-px h-3.5 bg-slate-800 mx-0.5" />
          <button
            type="button"
            aria-label="Toggle MIDI Tools"
            onClick={() => setIsMidiToolsOpen((prev) => !prev)}
            className={`px-1.5 py-0.5 text-[11px] font-mono font-semibold rounded cursor-pointer ${
              isMidiToolsOpen
                ? 'bg-purple-600 text-white'
                : 'text-purple-400 hover:text-purple-300'
            }`}
            title="Show/Hide Ableton Live 12 MIDI Transformations & Generators"
          >
            MIDI Tools
          </button>
        </div>
      </div>

      {isMidiToolsOpen && (
        <div
          data-testid="midi-tools-bar"
          className="bg-slate-900 border-b border-slate-800 px-3 py-1.5 flex items-center justify-between gap-2 flex-wrap text-[10px] font-mono shrink-0 z-10"
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-purple-300 font-bold uppercase tracking-wider mr-1">
              Transform:
            </span>
            {(
              [
                { id: 'arpeggiate', label: 'Arpeggiate' },
                { id: 'strum', label: 'Strum (.arp)' },
                { id: 'connect_legato', label: 'Connect (.legato)' },
                { id: 'ornament', label: 'Ornament (.vib)' },
                { id: 'humanize', label: 'Humanize Vel' },
              ] as const
            ).map((tr) => (
              <button
                key={tr.id}
                type="button"
                aria-label={`MIDI Transform ${tr.label}`}
                onClick={() => onApplyMidiTransform?.(tr.id, selectedTrackId)}
                className="px-2 py-0.5 rounded bg-slate-950 hover:bg-purple-600/30 border border-slate-800 hover:border-purple-500/50 text-slate-300 hover:text-white cursor-pointer transition-colors"
              >
                {tr.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-emerald-300 font-bold uppercase tracking-wider mr-1">
              Generate ({rootKey || 'C'} {scaleName || 'minor'}):
            </span>
            {(
              [
                { id: 'stacks', label: '+ Gen Stacks' },
                { id: 'seed_melody', label: '+ Gen Seed Melody' },
                { id: 'rhythm_groove', label: '+ Gen Rhythm' },
              ] as const
            ).map((gen) => (
              <button
                key={gen.id}
                type="button"
                aria-label={`MIDI Generator ${gen.label}`}
                onClick={() => onGenerateMidiPattern?.(gen.id, selectedTrackId)}
                className="px-2 py-0.5 rounded bg-emerald-950/60 hover:bg-emerald-600/35 border border-emerald-500/40 text-emerald-300 cursor-pointer font-semibold transition-colors"
              >
                {gen.label}
              </button>
            ))}
          </div>
        </div>
      )}

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

          {activeNotesAtPlayhead.length > 0 && (
            <g data-testid="active-notes-overlay" className="pointer-events-none">
              {activeNotesAtPlayhead.map((ev, idx) => {
                const midi = ev.pitch?.midi ?? 60;
                const startWhole = ev.startTime ? ev.startTime.numerator / ev.startTime.denominator : 0;
                const durWhole = ev.duration ? ev.duration.numerator / ev.duration.denominator : 0.25;
                const x = keyWidth + startWhole * wholeNoteScale;
                const w = Math.max(4, durWhole * wholeNoteScale - 1.5);
                const clampedMidi = Math.max(minMidi, Math.min(maxMidi, midi));
                const y = (maxMidi - clampedMidi) * rowH + 1.5;
                const noteH = Math.max(5, rowH - 3);
                return (
                  <rect
                    key={idx}
                    x={x}
                    y={y}
                    width={w}
                    height={noteH}
                    rx={Math.min(4, Math.max(2, rowH / 4))}
                    fill="#34D399"
                    fillOpacity={0.85}
                    stroke="#FFFFFF"
                    strokeWidth={1.5}
                  />
                );
              })}
            </g>
          )}

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

      {isClipEnvelopeOpen && (
        <AutomationLaneEditor
          trackId={selectedTrackId || availableTracks[0]?.id || 'pno'}
          measureNumber={1}
          lanes={automationLanes}
          onCommitAutomation={onCommitAutomation}
        />
      )}
    </div>
  );
}
