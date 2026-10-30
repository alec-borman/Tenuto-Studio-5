import React, { useMemo, useState } from 'react';
import { CompiledScore } from '../parser/DocumentParser';

export interface ChordSymbolInfo {
  rootLetter: string;
  rootAccidental: string;
  quality: string;
  slashBass?: string;
  fullText: string;
}

export interface GuitarStringState {
  stringNumber: number; // 6 (Low E) down to 1 (High E)
  fret: number | 'x';
  midi: number | null;
  noteLabel: string;
}

export interface GuitarVoicingDiagram {
  baseFret: number;
  strings: GuitarStringState[];
}

export interface ChordFlowSlice {
  index: number;
  measureNumber: number;
  startWhole: number;
  endWhole: number;
  durationWhole: number;
  midiNotes: number[];
  hasGlide: boolean;
  symbol: ChordSymbolInfo;
  guitar: GuitarVoicingDiagram;
}

export interface TrackedVoiceEvent {
  id: string;
  trackId: string;
  voiceId: string;
  color: string;
  startWhole: number;
  endWhole: number;
  durationWhole: number;
  startMidi: number;
  targetMidi: number;
  mpeBend?: number[];
  hasGlide: boolean;
  rawToken?: string;
}

export interface TabChordFlowViewProps {
  score: CompiledScore | null;
  events: any[];
  playheadBeat?: number;
  isPlaying?: boolean;
  rootKey?: string;
}

const FLAT_STEPS = [
  { letter: 'C', acc: '' },
  { letter: 'D', acc: '♭' },
  { letter: 'D', acc: '' },
  { letter: 'E', acc: '♭' },
  { letter: 'E', acc: '' },
  { letter: 'F', acc: '' },
  { letter: 'G', acc: '♭' },
  { letter: 'G', acc: '' },
  { letter: 'A', acc: '♭' },
  { letter: 'A', acc: '' },
  { letter: 'B', acc: '♭' },
  { letter: 'B', acc: '' },
];

const SHARP_STEPS = [
  { letter: 'C', acc: '' },
  { letter: 'C', acc: '♯' },
  { letter: 'D', acc: '' },
  { letter: 'D', acc: '♯' },
  { letter: 'E', acc: '' },
  { letter: 'F', acc: '' },
  { letter: 'F', acc: '♯' },
  { letter: 'G', acc: '' },
  { letter: 'G', acc: '♯' },
  { letter: 'A', acc: '' },
  { letter: 'A', acc: '♯' },
  { letter: 'B', acc: '' },
];

const TRACK_COLORS: Record<string, string> = {
  saws: '#FBBF24',
  fpad: '#F59E0B',
  pad: '#34D399',
  lead: '#38BDF8',
  reese: '#FB7185',
  bass: '#F97316',
  pno: '#60A5FA',
  harp: '#2DD4BF',
  vln1: '#A78BFA',
  vln2: '#818CF8',
  vla: '#2DD4BF',
  vc: '#FBBF24',
  cb: '#FB923C',
  hn: '#FACC15',
  tpt: '#F87171',
  tbn: '#FB923C',
  tba: '#F59E0B',
  fl: '#67E8F9',
  ob: '#5EEAD4',
  cl: '#93C5FD',
  choir: '#F472B6',
  timp: '#FCA5A5',
  drums: '#FDA4AF',
};

const FALLBACK_COLORS = [
  '#FFFFFF',
  '#FDE047',
  '#67E8F9',
  '#6EE7B7',
  '#F9A8D4',
  '#C4B5FD',
  '#FDBA74',
];

function getInstrumentColor(trackId: string, idx: number = 0): string {
  const clean = (trackId || 'pno').toLowerCase();
  return TRACK_COLORS[clean] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

// Standard 6-string guitar open MIDI pitches: E2(40), A2(45), D3(50), G3(55), B3(59), E4(64)
const STANDARD_GUITAR_OPEN_MIDI = [40, 45, 50, 55, 59, 64];

export function formatMidiPitchDisplay(midi: number, preferFlats: boolean = false): string {
  const clamped = Math.max(12, Math.min(108, Math.round(midi)));
  const octave = Math.floor(clamped / 12) - 1;
  const step = (preferFlats ? FLAT_STEPS : SHARP_STEPS)[clamped % 12];
  return `${step.letter}${step.acc}${octave}`;
}

export function formatPitchClassDisplay(
  pc: number,
  preferFlats: boolean = false
): {
  letter: string;
  acc: string;
  text: string;
} {
  const norm = ((Math.round(pc) % 12) + 12) % 12;
  const step = (preferFlats ? FLAT_STEPS : SHARP_STEPS)[norm];
  return { letter: step.letter, acc: step.acc, text: `${step.letter}${step.acc}` };
}

export function detectChordSymbol(
  midiNotes: number[],
  preferFlats: boolean = false
): ChordSymbolInfo {
  if (!midiNotes || midiNotes.length === 0) {
    return { rootLetter: '—', rootAccidental: '', quality: '', fullText: '—' };
  }

  const sorted = [...midiNotes].sort((a, b) => a - b);
  const bassPc = ((sorted[0] % 12) + 12) % 12;
  const uniquePcs = Array.from(new Set(sorted.map((m) => ((m % 12) + 12) % 12)));

  if (uniquePcs.length === 1) {
    const p = formatPitchClassDisplay(uniquePcs[0], preferFlats);
    return { rootLetter: p.letter, rootAccidental: p.acc, quality: '', fullText: p.text };
  }

  if (uniquePcs.length === 2) {
    const interval = (uniquePcs[1] - uniquePcs[0] + 12) % 12;
    const p0 = formatPitchClassDisplay(uniquePcs[0], preferFlats);
    const p1 = formatPitchClassDisplay(uniquePcs[1], preferFlats);
    if (interval === 7) return { rootLetter: p0.letter, rootAccidental: p0.acc, quality: '5', fullText: `${p0.text}5` };
    if (interval === 5) return { rootLetter: p1.letter, rootAccidental: p1.acc, quality: '5', fullText: `${p1.text}5` };
    if (interval === 3) return { rootLetter: p0.letter, rootAccidental: p0.acc, quality: 'm', fullText: `${p0.text}m` };
    if (interval === 4) return { rootLetter: p0.letter, rootAccidental: p0.acc, quality: '', fullText: p0.text };
  }

  const templates: Array<{
    intervals: number[];
    quality: string;
    scoreBonus: number;
  }> = [
    { intervals: [0, 4, 7, 11, 2], quality: 'maj9', scoreBonus: 1.42 },
    { intervals: [0, 3, 7, 10, 2], quality: 'm9', scoreBonus: 1.42 },
    { intervals: [0, 4, 7, 10, 2], quality: '9', scoreBonus: 1.4 },
    { intervals: [0, 4, 7, 11], quality: 'maj7', scoreBonus: 1.32 },
    { intervals: [0, 3, 7, 9], quality: 'm6', scoreBonus: 1.35 },
    { intervals: [0, 5, 7, 10], quality: '7sus', scoreBonus: 1.35 },
    { intervals: [0, 4, 7, 10], quality: '7', scoreBonus: 1.28 },
    { intervals: [0, 3, 7, 10], quality: 'm7', scoreBonus: 1.28 },
    { intervals: [0, 4, 7, 9], quality: '6', scoreBonus: 1.2 },
    { intervals: [0, 4, 7, 2], quality: 'add9', scoreBonus: 1.22 },
    { intervals: [0, 3, 7, 2], quality: 'm(add9)', scoreBonus: 1.22 },
    { intervals: [0, 3, 6, 10], quality: 'm7♭5', scoreBonus: 1.25 },
    { intervals: [0, 3, 6, 9], quality: 'dim7', scoreBonus: 1.25 },
    { intervals: [0, 4, 7], quality: '', scoreBonus: 1.15 },
    { intervals: [0, 3, 7], quality: 'm', scoreBonus: 1.15 },
    { intervals: [0, 5, 7], quality: 'sus4', scoreBonus: 1.1 },
    { intervals: [0, 2, 7], quality: 'sus2', scoreBonus: 1.1 },
    { intervals: [0, 3, 6], quality: 'dim', scoreBonus: 1.08 },
    { intervals: [0, 4, 8], quality: 'aug', scoreBonus: 1.08 },
  ];

  let bestRootPc = bassPc;
  let bestQuality = '';
  let bestScore = -Infinity;

  for (const candidateRoot of uniquePcs) {
    const relSet = new Set(uniquePcs.map((pc) => (pc - candidateRoot + 12) % 12));

    for (const tpl of templates) {
      let matched = 0;
      for (const req of tpl.intervals) {
        if (relSet.has(req)) matched++;
      }
      const coverage = matched / tpl.intervals.length;
      const unmatchedNotes = Math.max(0, uniquePcs.length - matched);
      const bassBonus = candidateRoot === bassPc ? 0.34 : 0;
      const totalScore = coverage * tpl.scoreBonus + bassBonus - unmatchedNotes * 0.16;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestRootPc = candidateRoot;
        bestQuality = tpl.quality;
      }
    }
  }

  const rootDisp = formatPitchClassDisplay(bestRootPc, preferFlats);
  const bassDisp = formatPitchClassDisplay(bassPc, preferFlats);

  const isSlashInversion = bestRootPc !== bassPc && uniquePcs.length >= 3;
  const slashBass = isSlashInversion ? bassDisp.text : undefined;
  const qualityWithSlash = slashBass ? `${bestQuality}/${slashBass}` : bestQuality;

  return {
    rootLetter: rootDisp.letter,
    rootAccidental: rootDisp.acc,
    quality: qualityWithSlash,
    slashBass,
    fullText: `${rootDisp.text}${qualityWithSlash}`,
  };
}

export function computeGuitarVoicing(
  midiNotes: number[],
  preferFlats: boolean = false
): GuitarVoicingDiagram {
  if (!midiNotes || midiNotes.length === 0) {
    return {
      baseFret: 1,
      strings: STANDARD_GUITAR_OPEN_MIDI.map((_, idx) => ({
        stringNumber: 6 - idx,
        fret: 'x',
        midi: null,
        noteLabel: '',
      })),
    };
  }

  const sorted = [...midiNotes].sort((a, b) => a - b);
  const uniquePcs = Array.from(new Set(sorted.map((m) => ((m % 12) + 12) % 12)));
  const bassNote = sorted[0];

  const fretOn6 = bassNote - STANDARD_GUITAR_OPEN_MIDI[0];
  const fretOn5 = bassNote - STANDARD_GUITAR_OPEN_MIDI[1];
  let anchorFret = 1;
  if (fretOn6 >= 1 && fretOn6 <= 11) {
    anchorFret = fretOn6;
  } else if (fretOn5 >= 1 && fretOn5 <= 11) {
    anchorFret = fretOn5;
  } else {
    anchorFret = ((bassNote - 40) % 12 + 12) % 12 || 1;
  }

  const baseFret = anchorFret <= 2 ? 1 : Math.max(1, anchorFret - 1);

  const strings: GuitarStringState[] = [];
  for (let sIdx = 0; sIdx < 6; sIdx++) {
    const openMidi = STANDARD_GUITAR_OPEN_MIDI[sIdx];
    let bestFret: number | 'x' = 'x';
    let bestMidi: number | null = null;
    let minFretDist = Infinity;

    if (sorted.length === 1) {
      const exactFret = bassNote - openMidi;
      if (exactFret >= baseFret - 1 && exactFret <= baseFret + 4 && exactFret >= 0) {
        bestFret = exactFret;
        bestMidi = bassNote;
      }
    } else if (sIdx === 0) {
      const f = bassNote - openMidi;
      if (f >= 0 && f <= 15) {
        bestFret = f;
        bestMidi = bassNote;
      }
    } else if (sIdx === 1 && sorted.length >= 4 && sorted[1] - sorted[0] >= 6) {
      const f5 = sorted[1] - openMidi;
      if (f5 >= baseFret && f5 <= baseFret + 4) {
        bestFret = f5;
        bestMidi = sorted[1];
      } else {
        bestFret = 'x';
      }
    } else {
      const minFretSearch = baseFret === 1 ? 0 : baseFret;
      for (let f = minFretSearch; f <= baseFret + 4; f++) {
        const candidateMidi = openMidi + f;
        const pc = ((candidateMidi % 12) + 12) % 12;
        if (uniquePcs.includes(pc)) {
          const dist = Math.abs(f - (baseFret + 1.5));
          if (dist < minFretDist) {
            minFretDist = dist;
            bestFret = f;
            bestMidi = candidateMidi;
          }
        }
      }
    }

    const noteLabel =
      bestMidi !== null
        ? formatPitchClassDisplay(bestMidi % 12, preferFlats).text
        : '';

    strings.push({
      stringNumber: 6 - sIdx,
      fret: bestFret,
      midi: bestMidi,
      noteLabel,
    });
  }

  return {
    baseFret,
    strings,
  };
}

/**
 * Extracts clean harmonic chord slices on half-measure (`0.5` whole note = 2-beat) boundaries
 * so fast 8th/16th melody or harp notes never fragment the timeline into 70+ overlapping labels.
 */
export function extractCodeChordSlices(
  events: any[],
  preferFlats: boolean = false,
  selectedTrackId: string | null = null
): ChordFlowSlice[] {
  const filteredEvents = (events || []).filter((ev) => {
    if (!ev?.pitch || ev.pitch.isRest || ev.pitch.isSpacer || ev.pitch.midi <= 0) return false;
    if (selectedTrackId && (ev.trackId || 'pno') !== selectedTrackId) return false;
    // Exclude unpitched drum grid hits from harmonic chord symbol detection unless specifically isolating that drum track
    if (!selectedTrackId && (ev.style === 'grid' || ev.pitch.gridKey)) return false;
    return true;
  });

  if (filteredEvents.length === 0) return [];

  const halfBarPointsSet = new Set<number>();
  let maxEndWhole = 0.5;

  for (const ev of filteredEvents) {
    const st = ev.startTime ? ev.startTime.numerator / Math.max(1, ev.startTime.denominator) : 0;
    const dur = ev.duration ? ev.duration.numerator / Math.max(1, ev.duration.denominator) : 0.25;
    // Quantize harmonic chord detection boundaries to half-measures (0.5 whole notes = 2 beats)
    const qSt = Math.floor(st * 2) / 2;
    const qEnd = Math.ceil((st + dur) * 2) / 2;
    halfBarPointsSet.add(qSt);
    if (qEnd > maxEndWhole) maxEndWhole = qEnd;
  }

  const sortedStarts = Array.from(halfBarPointsSet).sort((a, b) => a - b);
  const rawSlices: Array<{
    startWhole: number;
    endWhole: number;
    measureNumber: number;
    midiNotes: number[];
    hasGlide: boolean;
  }> = [];

  for (let i = 0; i < sortedStarts.length; i++) {
    const sliceStart = sortedStarts[i];
    const sliceEnd =
      i + 1 < sortedStarts.length ? sortedStarts[i + 1] : Math.max(sliceStart + 0.5, maxEndWhole);
    if (sliceEnd - sliceStart < 1e-4) continue;

    const activeMidis = new Set<number>();
    let hasGlide = false;
    let measureNum = Math.floor(sliceStart) + 1;

    for (const ev of filteredEvents) {
      const st = ev.startTime ? ev.startTime.numerator / Math.max(1, ev.startTime.denominator) : 0;
      const dur = ev.duration ? ev.duration.numerator / Math.max(1, ev.duration.denominator) : 0.25;
      // Include notes active during this half-bar window
      if (st < sliceEnd - 1e-4 && st + dur > sliceStart + 1e-4) {
        activeMidis.add(Math.round(ev.pitch.midi));
        if (ev.measureNumber) measureNum = ev.measureNumber;
        if ((ev.physics?.glideMs ?? 0) > 0 || Boolean(ev.physics?.mpe?.bend)) {
          hasGlide = true;
        }
      }
    }

    if (activeMidis.size === 0) continue;
    const sortedMidis = Array.from(activeMidis).sort((a, b) => a - b);
    const sym = detectChordSymbol(sortedMidis, preferFlats);

    const prev = rawSlices[rawSlices.length - 1];
    const prevSym = prev ? detectChordSymbol(prev.midiNotes, preferFlats) : null;
    if (
      prev &&
      prev.measureNumber === measureNum &&
      Math.abs(prev.endWhole - sliceStart) < 1e-4 &&
      prevSym?.fullText === sym.fullText
    ) {
      prev.endWhole = sliceEnd;
      const combined = new Set([...prev.midiNotes, ...sortedMidis]);
      prev.midiNotes = Array.from(combined).sort((a, b) => a - b);
      if (hasGlide) prev.hasGlide = true;
    } else {
      rawSlices.push({
        startWhole: sliceStart,
        endWhole: sliceEnd,
        measureNumber: measureNum,
        midiNotes: sortedMidis,
        hasGlide,
      });
    }
  }

  return rawSlices.map((rs, idx) => ({
    index: idx,
    measureNumber: rs.measureNumber,
    startWhole: rs.startWhole,
    endWhole: rs.endWhole,
    durationWhole: Math.max(0.25, rs.endWhole - rs.startWhole),
    midiNotes: rs.midiNotes,
    hasGlide: rs.hasGlide,
    symbol: detectChordSymbol(rs.midiNotes, preferFlats),
    guitar: computeGuitarVoicing(rs.midiNotes, preferFlats),
  }));
}

/**
 * Builds true per-instrument, per-voice note trajectory segments (`TrackedVoiceEvent[]`)
 * directly from `events`. Links each note/chord voice on `(trackId, voiceId)` to the
 * next contiguous note/chord voice on that SAME `(trackId, voiceId)` so lines always
 * represent the real notes being played.
 */
export function buildTrueVoiceTrajectories(
  events: any[],
  selectedTrackId: string | null = null
): TrackedVoiceEvent[] {
  const valid = (events || []).filter((ev) => {
    if (!ev?.pitch || ev.pitch.isRest || ev.pitch.isSpacer || ev.pitch.midi <= 0) return false;
    if (selectedTrackId && (ev.trackId || 'pno') !== selectedTrackId) return false;
    return true;
  });

  const trackIndexMap = new Map<string, number>();
  const stepsByTrackVoice = new Map<
    string,
    Array<{ startWhole: number; endWhole: number; notes: any[] }>
  >();

  for (const ev of valid) {
    const tId = ev.trackId || 'pno';
    if (!trackIndexMap.has(tId)) {
      trackIndexMap.set(tId, trackIndexMap.size);
    }
    const vId = ev.voiceId || 'v1';
    const key = `${tId}::${vId}`;

    let steps = stepsByTrackVoice.get(key);
    if (!steps) {
      steps = [];
      stepsByTrackVoice.set(key, steps);
    }

    const st = ev.startTime ? ev.startTime.numerator / Math.max(1, ev.startTime.denominator) : 0;
    const dur = ev.duration ? ev.duration.numerator / Math.max(1, ev.duration.denominator) : 0.25;
    const endW = st + Math.max(0.03125, dur);

    const last = steps[steps.length - 1];
    if (last && Math.abs(last.startWhole - st) < 1e-4) {
      last.notes.push(ev);
      if (endW > last.endWhole) last.endWhole = endW;
    } else {
      steps.push({ startWhole: st, endWhole: endW, notes: [ev] });
    }
  }

  const trajectories: TrackedVoiceEvent[] = [];
  let globalId = 0;

  for (const [key, steps] of stepsByTrackVoice.entries()) {
    steps.sort((a, b) => a.startWhole - b.startWhole);
    const [trackId, voiceId] = key.split('::');
    const color = getInstrumentColor(trackId, trackIndexMap.get(trackId) ?? 0);

    for (let i = 0; i < steps.length; i++) {
      const currStep = steps[i];
      const nextStep = i + 1 < steps.length ? steps[i + 1] : null;
      const isContiguousToNext =
        nextStep !== null && Math.abs(nextStep.startWhole - currStep.endWhole) <= 0.08;

      const sortedCurr = [...currStep.notes].sort((a, b) => a.pitch.midi - b.pitch.midi);
      const sortedNext =
        isContiguousToNext && nextStep
          ? [...nextStep.notes].sort((a, b) => a.pitch.midi - b.pitch.midi)
          : [];

      for (let vIdx = 0; vIdx < sortedCurr.length; vIdx++) {
        const ev = sortedCurr[vIdx];
        const st = ev.startTime ? ev.startTime.numerator / Math.max(1, ev.startTime.denominator) : 0;
        const dur = ev.duration ? ev.duration.numerator / Math.max(1, ev.duration.denominator) : 0.25;
        const endW = st + Math.max(0.03125, dur);
        const startMidi = Math.round(ev.pitch.midi);

        const bendArr = ev.physics?.mpe?.bend;
        const hasExplicitGlide =
          (ev.physics?.glideMs ?? 0) > 0 || (bendArr && bendArr.length > 1);

        let targetMidi = startMidi;
        if (bendArr && bendArr.length > 0) {
          targetMidi = startMidi + bendArr[bendArr.length - 1];
        } else if (sortedNext.length > 0) {
          const dstEv = sortedNext[Math.min(sortedNext.length - 1, vIdx)];
          if (dstEv && (hasExplicitGlide || ev.physics?.legato)) {
            targetMidi = Math.round(dstEv.pitch.midi);
          }
        }

        trajectories.push({
          id: `traj-${globalId++}`,
          trackId,
          voiceId,
          color,
          startWhole: st,
          endWhole: endW,
          durationWhole: Math.max(0.03125, endW - st),
          startMidi,
          targetMidi,
          mpeBend: bendArr,
          hasGlide: targetMidi !== startMidi || Boolean(hasExplicitGlide),
          rawToken: ev.rawToken,
        });
      }
    }
  }

  return trajectories;
}

/**
 * Single source of truth for both the SVG voice line and the playhead orb Y coordinate:
 * evaluates the exact MIDI pitch of a `TrackedVoiceEvent` at `wholeTime`.
 */
export function evaluateTrackedEventMidiAtWhole(
  item: TrackedVoiceEvent,
  wholeTime: number
): number {
  const u = Math.max(
    0,
    Math.min(1, (wholeTime - item.startWhole) / Math.max(1e-5, item.durationWhole))
  );

  // If the note has an explicit MPE bend array (with non-zero midpoints), interpolate it directly
  if (item.mpeBend && item.mpeBend.length > 1) {
    const glideStartU = 0.76;
    if (
      item.mpeBend.length === 5 &&
      item.mpeBend[0] === 0 &&
      item.mpeBend[1] === 0 &&
      item.mpeBend[2] === 0 &&
      item.mpeBend[3] === 0
    ) {
      // Standard end-of-note polyphonic chord glide
      if (u <= glideStartU) return item.startMidi;
      const gU = (u - glideStartU) / (1 - glideStartU);
      const smooth = gU * gU * (3 - 2 * gU);
      return item.startMidi + item.mpeBend[4] * smooth;
    }

    const scaled = u * (item.mpeBend.length - 1);
    const i0 = Math.floor(scaled);
    const i1 = Math.min(item.mpeBend.length - 1, i0 + 1);
    const frac = scaled - i0;
    const smooth = frac * frac * (3 - 2 * frac);
    const bendSt = item.mpeBend[i0] + (item.mpeBend[i1] - item.mpeBend[i0]) * smooth;
    return item.startMidi + bendSt;
  }

  if (item.targetMidi !== item.startMidi) {
    const glideStartU = 0.76;
    if (u <= glideStartU) return item.startMidi;
    const gU = (u - glideStartU) / (1 - glideStartU);
    const smooth = gU * gU * (3 - 2 * gU);
    return item.startMidi + (item.targetMidi - item.startMidi) * smooth;
  }

  return item.startMidi;
}

export default function TabChordFlowView({
  score,
  events = [],
  playheadBeat = 0,
  rootKey,
}: TabChordFlowViewProps) {
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  const preferFlats = useMemo(() => {
    const k = (rootKey || score?.meta?.key || '').trim();
    if (['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm'].includes(k)) {
      return true;
    }
    return (events || []).some((ev) => /[a-g]b\d/i.test(ev?.rawToken || ''));
  }, [rootKey, score?.meta?.key, events]);

  // Extract ALL instruments present in the score (including grid/drums so 100% of tracks are selectable)
  const availableTracks = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number; color: string }>();
    for (const def of score?.defs || []) {
      if (def.isReturn) continue;
      map.set(def.id, {
        id: def.id,
        name: def.name || def.id,
        count: 0,
        color: getInstrumentColor(def.id, map.size),
      });
    }
    for (const ev of events || []) {
      if (!ev?.pitch || ev.pitch.isRest || ev.pitch.isSpacer) continue;
      const id = ev.trackId || 'pno';
      const existing = map.get(id);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(id, {
          id,
          name: id.toUpperCase(),
          count: 1,
          color: getInstrumentColor(id, map.size),
        });
      }
    }
    return Array.from(map.values());
  }, [score, events]);

  const chordSlices = useMemo(
    () => extractCodeChordSlices(events, preferFlats, selectedTrackId),
    [events, preferFlats, selectedTrackId]
  );

  const voiceTrajectories = useMemo(
    () => buildTrueVoiceTrajectories(events, selectedTrackId),
    [events, selectedTrackId]
  );

  const currentWhole = Math.max(0, playheadBeat / 4);

  const activeSliceIndex = useMemo(() => {
    if (chordSlices.length === 0) return 0;
    for (let i = 0; i < chordSlices.length; i++) {
      const s = chordSlices[i];
      if (currentWhole >= s.startWhole && currentWhole < s.endWhole) {
        return i;
      }
    }
    if (currentWhole >= chordSlices[chordSlices.length - 1].endWhole) {
      return chordSlices.length - 1;
    }
    return 0;
  }, [chordSlices, currentWhole]);

  const activeSlice = chordSlices[activeSliceIndex];

  const { minMidi, maxMidi } = useMemo(() => {
    if (voiceTrajectories.length === 0) return { minMidi: 48, maxMidi: 72 };
    let min = 127;
    let max = 0;
    for (const item of voiceTrajectories) {
      if (item.startMidi < min) min = item.startMidi;
      if (item.startMidi > max) max = item.startMidi;
      if (item.targetMidi < min) min = item.targetMidi;
      if (item.targetMidi > max) max = item.targetMidi;
    }
    if (min > max) return { minMidi: 48, maxMidi: 72 };
    const center = Math.round((min + max) / 2);
    const halfSpan = Math.max(10, Math.ceil((max - min) / 2) + 4);
    return {
      minMidi: Math.max(12, center - halfSpan),
      maxMidi: Math.min(108, center + halfSpan),
    };
  }, [voiceTrajectories]);

  const svgWidth = 860;
  const svgHeight = 250;
  const playheadScreenX = 275;
  const pxPerWholeNote = 260;

  const midiToY = (midi: number): number => {
    const span = Math.max(12, maxMidi - minMidi);
    const norm = (midi - minMidi) / span;
    return Number(((1 - norm) * (svgHeight - 54) + 32).toFixed(1));
  };

  // Compute active playhead orbs directly from the active `voiceTrajectories` at `currentWhole`
  // so 100% of orbs sit on their exact trajectory line!
  const activeVoiceOrbs = useMemo(() => {
    const activeItems = voiceTrajectories.filter(
      (item) => currentWhole >= item.startWhole - 1e-4 && currentWhole <= item.endWhole + 1e-4
    );

    // If playhead is at 0 before pressing Play, show orbs for the very first chord/notes at startWhole === 0
    const targetItems =
      activeItems.length > 0
        ? activeItems
        : voiceTrajectories.filter((item) => item.startWhole < 0.25);

    // Deduplicate overlapping identical MIDI pitches at the playhead while preserving track color & label
    const byMidi = new Map<
      number,
      { midi: number; y: number; label: string; color: string; tracks: string[] }
    >();

    for (const item of targetItems) {
      const exactMidi = evaluateTrackedEventMidiAtWhole(item, currentWhole);
      const roundedKey = Math.round(exactMidi * 10);
      const y = midiToY(exactMidi);
      const pitchStr = formatMidiPitchDisplay(Math.round(exactMidi), preferFlats);
      const existing = byMidi.get(roundedKey);
      if (existing) {
        if (!existing.tracks.includes(item.trackId)) {
          existing.tracks.push(item.trackId);
        }
      } else {
        byMidi.set(roundedKey, {
          midi: exactMidi,
          y,
          label: pitchStr,
          color: selectedTrackId ? '#FFFFFF' : item.color,
          tracks: [item.trackId],
        });
      }
    }

    return Array.from(byMidi.values())
      .sort((a, b) => a.midi - b.midi)
      .map((orb, idx) => ({
        ...orb,
        voiceIndex: idx,
      }));
  }, [voiceTrajectories, currentWhole, preferFlats, selectedTrackId, minMidi, maxMidi]);

  // Live chord symbol and guitar fretboard computed from the exact notes sounding at the playhead
  const livePlayheadMidis = useMemo(() => {
    if (activeVoiceOrbs.length > 0) {
      return activeVoiceOrbs.map((o) => Math.round(o.midi));
    }
    return activeSlice?.midiNotes || [];
  }, [activeVoiceOrbs, activeSlice]);

  const liveSymbol = useMemo(
    () => (livePlayheadMidis.length > 0 ? detectChordSymbol(livePlayheadMidis, preferFlats) : activeSlice?.symbol),
    [livePlayheadMidis, preferFlats, activeSlice]
  );

  const liveGuitar = useMemo(
    () => (livePlayheadMidis.length > 0 ? computeGuitarVoicing(livePlayheadMidis, preferFlats) : activeSlice?.guitar),
    [livePlayheadMidis, preferFlats, activeSlice]
  );

  // Filter visible trajectories to the current scrolling viewport window [-1.5 .. +3.0 whole notes around playhead]
  const visibleTrajectories = useMemo(() => {
    return voiceTrajectories.filter(
      (item) => item.endWhole >= currentWhole - 1.5 && item.startWhole <= currentWhole + 3.0
    );
  }, [voiceTrajectories, currentWhole]);

  return (
    <div
      data-testid="tab-chord-flow-view"
      style={{
        background:
          'radial-gradient(circle at 38% 36%, #C85A17 0%, #8F390A 48%, #4A1B04 100%)',
      }}
      className="w-full h-full flex flex-col justify-between text-amber-50 overflow-y-auto relative select-none p-4"
    >
      {/* Top Bar: All Instruments Pill Strip & Dropdown */}
      <div className="flex flex-col gap-1.5 z-10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-black/30 text-amber-200 border border-amber-400/30">
              Live Code Chord &amp; Guitar Flow
            </span>
            <select
              aria-label="Chord Flow Track Filter"
              value={selectedTrackId || ''}
              onChange={(e) => setSelectedTrackId(e.target.value || null)}
              className="bg-black/35 border border-amber-300/30 text-amber-100 text-[11px] font-mono rounded px-2 py-0.5 outline-none cursor-pointer"
            >
              <option value="">All Instruments ({availableTracks.length})</option>
              {availableTracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.id} • {t.count}n)
                </option>
              ))}
            </select>
          </div>

          <span className="text-[11px] font-mono text-amber-200/80">
            {activeVoiceOrbs.length} Active Notes • {availableTracks.length} Instruments
          </span>
        </div>

        {/* Clickable Color-Coded Instrument Pills (Shows All Instruments) */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setSelectedTrackId(null)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold shrink-0 cursor-pointer border transition-colors ${
              selectedTrackId === null
                ? 'bg-white text-amber-950 border-white'
                : 'bg-black/30 text-amber-100/80 border-amber-300/25 hover:bg-black/45'
            }`}
          >
            All ({availableTracks.length})
          </button>
          {availableTracks.map((trk) => {
            const isSel = selectedTrackId === trk.id;
            return (
              <button
                key={trk.id}
                type="button"
                aria-label={`Filter chord flow by ${trk.id}`}
                onClick={() => setSelectedTrackId(isSel ? null : trk.id)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono shrink-0 cursor-pointer border transition-colors ${
                  isSel
                    ? 'bg-amber-100 text-amber-950 border-white font-bold'
                    : 'bg-black/30 text-amber-100/85 border-amber-300/20 hover:bg-black/45'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: trk.color }}
                />
                <span>{trk.id}</span>
                <span className="opacity-65">({trk.count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Top Giant Centered Active Chord Symbol Readout */}
      <div className="flex flex-col items-center justify-center my-1 z-10">
        <div
          data-testid="active-chord-symbol"
          className="flex items-baseline justify-center tracking-tight drop-shadow-[0_4px_20px_rgba(255,255,255,0.35)]"
        >
          <span className="text-6xl font-bold text-white font-sans">
            {liveSymbol ? liveSymbol.rootLetter : '—'}
          </span>
          {liveSymbol?.rootAccidental && (
            <span className="text-3xl font-semibold text-amber-100 -ml-1 mr-1 self-start mt-1">
              {liveSymbol.rootAccidental}
            </span>
          )}
          <span className="text-4xl font-medium text-amber-100/95 ml-0.5">
            {liveSymbol ? liveSymbol.quality : ''}
          </span>
        </div>
        <span className="text-[11px] font-mono text-amber-200/85 tracking-wider uppercase mt-0.5 text-center max-w-2xl truncate">
          {livePlayheadMidis.length > 0
            ? `M${Math.floor(currentWhole) + 1} • Notes: ${livePlayheadMidis
                .map((m) => formatMidiPitchDisplay(m, preferFlats))
                .join(' – ')}`
            : 'No Active Notes at Playhead'}
        </span>
      </div>

      {/* Middle Section: Horizontally Scrolling True Event Trajectories & Locked Playhead Orbs */}
      <div className="w-full flex items-center justify-center my-1 overflow-hidden">
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full max-w-4xl h-60 block overflow-visible"
          aria-label="Voice Leading Chord Flow Canvas"
        >
          <defs>
            <filter id="ultraviolet-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Subtle Horizontal Chromatic Pitch Grid Lines */}
          {Array.from({ length: maxMidi - minMidi + 1 }).map((_, idx) => {
            const m = minMidi + idx;
            const y = midiToY(m);
            return (
              <line
                key={m}
                x1={0}
                y1={y}
                x2={svgWidth}
                y2={y}
                stroke="rgba(255, 237, 213, 0.14)"
                strokeWidth={m % 12 === 0 ? 1.1 : 0.6}
              />
            );
          })}

          {/* De-Cluttered Measure & Half-Bar Chord Headers */}
          {chordSlices.map((slice, idx) => {
            const colX =
              playheadScreenX + (slice.startWhole - currentWhole) * pxPerWholeNote;
            if (colX < -200 || colX > svgWidth + 200) return null;

            // Prevent label overlap if two slices are closer than 68px
            const prevSlice = idx > 0 ? chordSlices[idx - 1] : null;
            const prevX = prevSlice
              ? playheadScreenX + (prevSlice.startWhole - currentWhole) * pxPerWholeNote
              : -999;
            const showLabel = colX - prevX >= 68;

            return (
              <g key={`col-${slice.index}`}>
                <line
                  x1={colX}
                  y1={8}
                  x2={colX}
                  y2={svgHeight - 8}
                  stroke="rgba(255, 237, 213, 0.25)"
                  strokeWidth={1.2}
                />
                {showLabel && (
                  <text
                    x={colX + 6}
                    y={20}
                    className="fill-amber-100/90 font-sans text-xs font-semibold"
                  >
                    {slice.symbol.fullText}
                  </text>
                )}
              </g>
            );
          })}

          {/* True Per-Event Voice Trajectories (Exact 1-to-1 Match with Playhead Orbs) */}
          {visibleTrajectories.map((item) => {
            const xStart =
              playheadScreenX + (item.startWhole - currentWhole) * pxPerWholeNote;
            const xEnd =
              playheadScreenX + (item.endWhole - currentWhole) * pxPerWholeNote;
            const widthPx = Math.max(6, xEnd - xStart);

            // Sample the exact same `evaluateTrackedEventMidiAtWhole` function used by the orbs
            let dPath = '';
            const numSteps = item.hasGlide ? 12 : 2;
            for (let s = 0; s <= numSteps; s++) {
              const u = s / numSteps;
              const wTime = item.startWhole + u * item.durationWhole;
              const x = xStart + u * widthPx;
              const y = midiToY(evaluateTrackedEventMidiAtWhole(item, wTime));
              dPath += `${s === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)} `;
            }

            const strokeColor = selectedTrackId ? '#FFFFFF' : item.color;

            return (
              <g key={item.id}>
                {/* Future Unplayed Segment (Right of Playhead) */}
                <path
                  d={dPath}
                  fill="none"
                  stroke={strokeColor}
                  strokeOpacity={0.38}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                />
                {/* Illuminated Active/Past Segment (Left of Playhead) */}
                <path
                  d={dPath}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth={3.2}
                  strokeLinecap="round"
                  filter="url(#ultraviolet-glow)"
                  style={{
                    clipPath: `inset(0px ${svgWidth - playheadScreenX}px 0px 0px)`,
                  }}
                />
              </g>
            );
          })}

          {/* Fixed Vertical Playhead Line */}
          <line
            x1={playheadScreenX}
            y1={8}
            x2={playheadScreenX}
            y2={svgHeight - 8}
            stroke="rgba(255, 255, 255, 0.55)"
            strokeWidth={1.5}
          />

          {/* Glowing Intersection Orbs & Live Pitch Labels Locked Directly onto Their Lines */}
          {activeVoiceOrbs.map((orb) => (
            <g
              key={`orb-${orb.voiceIndex}`}
              data-testid={`voice-orb-${orb.voiceIndex}`}
            >
              <circle
                cx={playheadScreenX}
                cy={orb.y}
                r={8}
                fill={orb.color}
                fillOpacity={0.5}
                filter="url(#ultraviolet-glow)"
              />
              <circle cx={playheadScreenX} cy={orb.y} r={4.5} fill="#FFFFFF" />
              <text
                x={playheadScreenX + 12}
                y={orb.y + 4}
                className="fill-white font-sans text-[11px] font-bold drop-shadow"
              >
                {orb.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Bottom Section: Live 6-String GUITAR Fretboard Diagram */}
      <div
        data-testid="guitar-fretboard-diagram"
        className="flex flex-col items-center justify-center mt-1 mb-1 z-10"
      >
        <span className="text-xs font-sans font-semibold tracking-[0.25em] text-amber-100/90 uppercase mb-2">
          GUITAR
        </span>

        <div className="relative flex items-center justify-center">
          {liveGuitar && liveGuitar.baseFret > 1 && (
            <span
              data-testid="guitar-base-fret"
              className="text-xs font-sans font-semibold text-amber-100 mr-2 -mt-12"
            >
              {liveGuitar.baseFret}fr
            </span>
          )}

          <svg
            width={200}
            height={145}
            viewBox="0 0 200 145"
            aria-label="6-String Guitar Chord Diagram"
          >
            {Array.from({ length: 5 }).map((_, fIdx) => {
              const y = 22 + fIdx * 24;
              return (
                <line
                  key={`fret-${fIdx}`}
                  x1={25}
                  y1={y}
                  x2={175}
                  y2={y}
                  stroke="rgba(255, 247, 237, 0.85)"
                  strokeWidth={
                    fIdx === 0 && (!liveGuitar || liveGuitar.baseFret === 1) ? 3 : 1.3
                  }
                />
              );
            })}

            {(liveGuitar?.strings || []).map((str, sIdx) => {
              const x = 25 + sIdx * 30;
              const baseFret = liveGuitar?.baseFret || 1;

              return (
                <g key={`str-${str.stringNumber}`}>
                  <line
                    x1={x}
                    y1={22}
                    x2={x}
                    y2={118}
                    stroke="rgba(255, 247, 237, 0.85)"
                    strokeWidth={1.3}
                  />

                  {str.fret === 'x' && (
                    <text
                      x={x}
                      y={14}
                      textAnchor="middle"
                      className="fill-amber-100/90 font-sans text-xs font-bold"
                    >
                      ×
                    </text>
                  )}

                  {str.fret === 0 && (
                    <circle
                      cx={x}
                      cy={12}
                      r={4}
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth={1.5}
                    />
                  )}

                  {typeof str.fret === 'number' && str.fret > 0 && (
                    <circle
                      cx={x}
                      cy={22 + (str.fret - baseFret + 0.5) * 24}
                      r={6.5}
                      fill="#FFFFFF"
                    />
                  )}

                  {str.noteLabel && (
                    <text
                      x={x}
                      y={138}
                      textAnchor="middle"
                      className="fill-white font-sans text-xs font-semibold"
                    >
                      {str.noteLabel}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
