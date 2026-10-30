import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
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
  stringIndex: number; // 0 = High E (String 1, top tab line) .. 5 = Low E (String 6, bottom tab line)
  targetStringIndex: number;
  fret: number;
  targetFret: number;
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
  epno: '#818CF8',
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
  eh: '#5EEAD4',
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

// Standard 6-string guitar open MIDI pitches (Low E6 to High E1): E2(40), A2(45), D3(50), G3(55), B3(59), E4(64)
const STANDARD_GUITAR_OPEN_MIDI = [40, 45, 50, 55, 59, 64];

// Tab staff lines top-to-bottom (index 0 = String 1 High E4, index 5 = String 6 Low E2)
const TAB_STAFF_OPEN_MIDI_TOP_DOWN = [64, 59, 55, 50, 45, 40];
const TAB_STAFF_STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'];

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

/**
 * Allocates a set of simultaneous MIDI pitches on a single instrument track across the
 * 6 guitar tab strings (`stringIndex`: 0 = top High E string .. 5 = bottom Low E string)
 * so chord voices sit on distinct tab staff lines with accurate fret numbers.
 */
export function allocateNotesToTabStrings(
  midiNotes: number[]
): Map<number, { stringIndex: number; fret: number }> {
  const result = new Map<number, { stringIndex: number; fret: number }>();
  if (!midiNotes || midiNotes.length === 0) return result;

  const sortedLowToHigh = Array.from(new Set(midiNotes.map((m) => Math.round(m)))).sort(
    (a, b) => a - b
  );
  const usedStrings = new Set<number>();

  for (let i = 0; i < sortedLowToHigh.length; i++) {
    const midi = sortedLowToHigh[i];
    let bestStringIdx = 5; // Default Low E
    let bestFret = Math.max(0, midi - 40);
    let bestCost = Infinity;

    for (let sIdx = 0; sIdx < 6; sIdx++) {
      const openMidi = TAB_STAFF_OPEN_MIDI_TOP_DOWN[sIdx];
      let fret = midi - openMidi;
      // Fold extreme sub-bass or flute octaves into playable 0..24 fret range on the nearest outer string
      if (fret < 0) {
        if (sIdx === 5) fret = ((fret % 12) + 12) % 12;
        else continue;
      }
      if (fret > 24 && sIdx > 0) continue;
      const clampedFret = Math.max(0, Math.min(24, fret));
      const penalty = usedStrings.has(sIdx) ? 100 : 0;
      // Prefer fretting around frets 0..12 and matching low notes to lower strings
      const idealString = Math.max(0, Math.min(5, 5 - Math.floor((midi - 40) / 5.5)));
      const cost =
        penalty + Math.abs(sIdx - idealString) * 3.5 + (clampedFret > 12 ? (clampedFret - 12) * 1.5 : 0);

      if (cost < bestCost) {
        bestCost = cost;
        bestStringIdx = sIdx;
        bestFret = clampedFret;
      }
    }

    usedStrings.add(bestStringIdx);
    result.set(midi, { stringIndex: bestStringIdx, fret: bestFret });
  }

  return result;
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

export function extractCodeChordSlices(
  events: any[],
  preferFlats: boolean = false,
  selectedTrackId: string | null = null
): ChordFlowSlice[] {
  const filteredEvents = (events || []).filter((ev) => {
    if (!ev?.pitch || ev.pitch.isRest || ev.pitch.isSpacer || ev.pitch.midi <= 0) return false;
    if (selectedTrackId && (ev.trackId || 'pno') !== selectedTrackId) return false;
    if (!selectedTrackId && (ev.style === 'grid' || ev.pitch.gridKey)) return false;
    return true;
  });

  if (filteredEvents.length === 0) return [];

  const halfBarPointsSet = new Set<number>();
  let maxEndWhole = 0.5;

  for (const ev of filteredEvents) {
    const st = ev.startTime ? ev.startTime.numerator / Math.max(1, ev.startTime.denominator) : 0;
    const dur = ev.duration ? ev.duration.numerator / Math.max(1, ev.duration.denominator) : 0.25;
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
 * with 6-string guitar tab allocation (`stringIndex: 0..5` and `fret: 0..24`).
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

      const currStringMap = allocateNotesToTabStrings(sortedCurr.map((n) => Math.round(n.pitch.midi)));
      const nextStringMap =
        sortedNext.length > 0
          ? allocateNotesToTabStrings(sortedNext.map((n) => Math.round(n.pitch.midi)))
          : null;

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

        const currTab = currStringMap.get(startMidi) || { stringIndex: 3, fret: 0 };
        const nextTab =
          nextStringMap?.get(targetMidi) || {
            stringIndex: currTab.stringIndex,
            fret: Math.max(0, currTab.fret + (targetMidi - startMidi)),
          };

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
          stringIndex: currTab.stringIndex,
          targetStringIndex: targetMidi !== startMidi ? nextTab.stringIndex : currTab.stringIndex,
          fret: currTab.fret,
          targetFret: targetMidi !== startMidi ? nextTab.fret : currTab.fret,
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
 * Evaluates the exact MIDI pitch of a `TrackedVoiceEvent` at `wholeTime`.
 */
export function evaluateTrackedEventMidiAtWhole(
  item: TrackedVoiceEvent,
  wholeTime: number
): number {
  const u = Math.max(
    0,
    Math.min(1, (wholeTime - item.startWhole) / Math.max(1e-5, item.durationWhole))
  );

  if (item.mpeBend && item.mpeBend.length > 1) {
    const glideStartU = 0.76;
    if (
      item.mpeBend.length === 5 &&
      item.mpeBend[0] === 0 &&
      item.mpeBend[1] === 0 &&
      item.mpeBend[2] === 0 &&
      item.mpeBend[3] === 0
    ) {
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
  isPlaying = false,
  rootKey,
}: TabChordFlowViewProps) {
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const trackPillsRef = useRef<HTMLDivElement>(null);

  const preferFlats = useMemo(() => {
    const k = (rootKey || score?.meta?.key || '').trim();
    if (['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm'].includes(k)) {
      return true;
    }
    return (events || []).some((ev) => /[a-g]b\d/i.test(ev?.rawToken || ''));
  }, [rootKey, score?.meta?.key, events]);

  // Extract ALL instruments present in the score (including grid/drums)
  const availableTracks = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; style?: string; patch?: string; count: number; color: string }
    >();
    for (const def of score?.defs || []) {
      if (def.isReturn) continue;
      map.set(def.id, {
        id: def.id,
        name: def.name || def.id,
        style: def.style,
        patch: def.patch,
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
          id: id,
          name: id.toUpperCase(),
          style: ev.style,
          patch: ev.patch,
          count: 1,
          color: getInstrumentColor(id, map.size),
        });
      }
    }
    return Array.from(map.values());
  }, [score, events]);

  useEffect(() => {
    if (selectedTrackId && !availableTracks.some((t) => t.id === selectedTrackId)) {
      setSelectedTrackId(null);
    }
  }, [availableTracks, selectedTrackId]);

  // Native macOS trackpad pinch-to-zoom handler (wheel with ctrlKey / metaKey)
  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        setZoomLevel((prev) => Math.max(0.2, Math.min(3.0, Number((prev * factor).toFixed(2)))));
      }
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const visibleTracks = useMemo(() => {
    if (!selectedTrackId) return availableTracks;
    return availableTracks.filter((t) => t.id === selectedTrackId);
  }, [availableTracks, selectedTrackId]);

  const chordSlices = useMemo(
    () => extractCodeChordSlices(events, preferFlats, selectedTrackId),
    [events, preferFlats, selectedTrackId]
  );

  const allTrajectories = useMemo(
    () => buildTrueVoiceTrajectories(events, selectedTrackId),
    [events, selectedTrackId]
  );

  const trajectoriesByTrack = useMemo(() => {
    const map = new Map<string, TrackedVoiceEvent[]>();
    for (const item of allTrajectories) {
      let list = map.get(item.trackId);
      if (!list) {
        list = [];
        map.set(item.trackId, list);
      }
      list.push(item);
    }
    return map;
  }, [allTrajectories]);

  const maxEndWhole = useMemo(() => {
    let maxW = 4;
    for (const item of allTrajectories) {
      if (item.endWhole > maxW) maxW = item.endWhole;
    }
    return maxW;
  }, [allTrajectories]);

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

  // Dimensions scaled by zoomLevel (matching Piano Roll ergonomics)
  const headerWidthPx = 228;
  const wholeNoteScale = Math.max(56, Math.round(240 * zoomLevel));
  const isSingleTrackFocus = visibleTracks.length === 1;
  const staffHeightPx = isSingleTrackFocus
    ? Math.max(180, Math.round(230 * zoomLevel))
    : Math.max(82, Math.round(124 * zoomLevel));
  const timelineWidthPx = Math.max(720, Math.ceil(maxEndWhole * wholeNoteScale) + 160);
  const playheadX = (playheadBeat / 4) * wholeNoteScale;

  const handleFitAll = useCallback(() => {
    const viewport = scrollViewportRef.current;
    const availW = (viewport?.clientWidth || 760) - headerWidthPx - 36;
    const availH = (viewport?.clientHeight || 460) - 48;

    const idealHoriz = availW / Math.max(1, maxEndWhole * 240);
    const idealVert = availH / Math.max(1, visibleTracks.length * 124);
    const fitted = Math.max(0.2, Math.min(2.5, Math.min(idealHoriz, idealVert)));
    setZoomLevel(Number(fitted.toFixed(2)));
    if (viewport) {
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    }
  }, [maxEndWhole, visibleTracks.length]);

  // Smoothly auto-scroll container horizontally to follow playhead during playback
  useEffect(() => {
    const el = scrollViewportRef.current;
    if (!el) return;
    if (!isPlaying && playheadBeat === 0) {
      el.scrollLeft = 0;
      return;
    }
    if (isPlaying) {
      const viewportW = (el.clientWidth || 720) - headerWidthPx;
      const targetScroll = Math.max(0, playheadX - viewportW * 0.35);
      el.scrollLeft = targetScroll;
    }
  }, [playheadX, isPlaying, playheadBeat]);

  // Global active notes across visible tracks at the playhead
  const activeGlobalItems = useMemo(() => {
    const active = allTrajectories.filter(
      (item) => currentWhole >= item.startWhole - 1e-4 && currentWhole <= item.endWhole + 1e-4
    );
    return active.length > 0
      ? active
      : allTrajectories.filter((item) => item.startWhole < 0.25);
  }, [allTrajectories, currentWhole]);

  const livePlayheadMidis = useMemo(() => {
    const pitched = activeGlobalItems.filter((item) => item.trackId !== 'drums');
    const source = pitched.length > 0 ? pitched : activeGlobalItems;
    if (source.length > 0) {
      return Array.from(
        new Set(source.map((it) => Math.round(evaluateTrackedEventMidiAtWhole(it, currentWhole))))
      ).sort((a, b) => a - b);
    }
    return activeSlice?.midiNotes || [];
  }, [activeGlobalItems, currentWhole, activeSlice]);

  const liveSymbol = useMemo(
    () =>
      livePlayheadMidis.length > 0
        ? detectChordSymbol(livePlayheadMidis, preferFlats)
        : activeSlice?.symbol,
    [livePlayheadMidis, preferFlats, activeSlice]
  );

  const liveGuitar = useMemo(
    () =>
      livePlayheadMidis.length > 0
        ? computeGuitarVoicing(livePlayheadMidis, preferFlats)
        : activeSlice?.guitar,
    [livePlayheadMidis, preferFlats, activeSlice]
  );

  let globalOrbCounter = 0;

  return (
    <div
      data-testid="tab-chord-flow-view"
      style={{
        background:
          'radial-gradient(circle at 38% 36%, #C85A17 0%, #8F390A 48%, #4A1B04 100%)',
      }}
      className="w-full h-full flex flex-col justify-between text-amber-50 overflow-hidden relative select-none"
    >
      {/* Top Piano-Roll-Parity Control Bar: Track Filter, Scrollable Pills & Pinch-Zoom / Fit-All */}
      <div className="bg-black/35 border-b border-amber-300/20 px-3 py-1.5 flex items-center justify-between gap-2 shrink-0 z-20">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setSelectedTrackId(null)}
            className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold shrink-0 cursor-pointer border transition-colors ${
              selectedTrackId === null
                ? 'bg-white text-amber-950 border-white shadow-xs'
                : 'bg-black/40 text-amber-100/85 border-amber-300/25 hover:bg-black/60'
            }`}
          >
            All ({availableTracks.length})
          </button>

          <select
            aria-label="Chord Flow Track Filter"
            value={selectedTrackId || ''}
            onChange={(e) => {
              const val = e.target.value || null;
              setSelectedTrackId(val);
            }}
            className="bg-black/45 border border-amber-300/35 text-amber-100 text-[11px] font-mono rounded px-2 py-1 outline-none cursor-pointer shrink-0"
          >
            <option value="">All Instruments ({availableTracks.length})</option>
            {availableTracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.id} • {t.count}n)
              </option>
            ))}
          </select>

          {availableTracks.length > 3 && (
            <button
              type="button"
              aria-label="Scroll Tab Tracks Left"
              onClick={() =>
                trackPillsRef.current?.scrollBy({ left: -180, behavior: 'smooth' })
              }
              className="px-1.5 py-1 rounded bg-black/40 border border-amber-300/25 text-amber-100 hover:bg-black/60 text-[10px] font-mono cursor-pointer shrink-0"
              title="Scroll instrument list left"
            >
              ◀
            </button>
          )}

          <div
            ref={trackPillsRef}
            className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 min-w-0"
          >
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
                      ? 'bg-amber-100 text-amber-950 border-white font-bold shadow-xs'
                      : 'bg-black/35 text-amber-100/85 border-amber-300/20 hover:bg-black/55'
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

          {availableTracks.length > 3 && (
            <button
              type="button"
              aria-label="Scroll Tab Tracks Right"
              onClick={() =>
                trackPillsRef.current?.scrollBy({ left: 180, behavior: 'smooth' })
              }
              className="px-1.5 py-1 rounded bg-black/40 border border-amber-300/25 text-amber-100 hover:bg-black/60 text-[10px] font-mono cursor-pointer shrink-0"
              title="Scroll instrument list right"
            >
              ▶
            </button>
          )}
        </div>

        {/* Right: Zoom Controls & Fit All (Identical Ergonomics to Piano Roll) */}
        <div className="flex items-center gap-1 shrink-0 bg-black/45 border border-amber-300/30 rounded px-1.5 py-0.5 font-mono">
          <button
            type="button"
            aria-label="Tab Zoom Out"
            onClick={() => setZoomLevel((z) => Math.max(0.2, Number((z - 0.15).toFixed(2))))}
            className="text-amber-200 hover:text-white px-1.5 py-0.5 text-xs font-bold cursor-pointer"
            title="Zoom Out (or Pinch In on Trackpad)"
          >
            -
          </button>
          <button
            type="button"
            aria-label="Tab Reset Zoom"
            onClick={() => setZoomLevel(1.0)}
            className="text-amber-100 hover:text-white px-1.5 py-0.5 text-[11px] cursor-pointer min-w-[44px] text-center"
            title="Reset Zoom to 100%"
          >
            {Math.round(zoomLevel * 100)}%
          </button>
          <button
            type="button"
            aria-label="Tab Zoom In"
            onClick={() => setZoomLevel((z) => Math.min(3.0, Number((z + 0.15).toFixed(2))))}
            className="text-amber-200 hover:text-white px-1.5 py-0.5 text-xs font-bold cursor-pointer"
            title="Zoom In (or Pinch Out on Trackpad)"
          >
            +
          </button>
          <div className="w-px h-3.5 bg-amber-300/25 mx-0.5" />
          <button
            type="button"
            aria-label="Fit All Tab View"
            onClick={handleFitAll}
            className="text-emerald-300 hover:text-emerald-200 px-1.5 py-0.5 text-[11px] font-semibold cursor-pointer"
            title="Fit all instrument tab staves and measures into view"
          >
            Fit All
          </button>
        </div>
      </div>

      {/* Compact Harmonic Summary Banner: Global Active Chord Symbol + Reference Guitar Fretboard */}
      <div className="px-4 py-2 bg-black/20 border-b border-amber-200/15 flex items-center justify-between gap-4 shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div
            data-testid="active-chord-symbol"
            className="flex items-baseline tracking-tight drop-shadow-[0_2px_12px_rgba(255,255,255,0.3)] shrink-0"
          >
            <span className="text-3xl font-bold text-white font-sans">
              {liveSymbol ? liveSymbol.rootLetter : '—'}
            </span>
            {liveSymbol?.rootAccidental && (
              <span className="text-xl font-semibold text-amber-100 mr-0.5">
                {liveSymbol.rootAccidental}
              </span>
            )}
            <span className="text-2xl font-medium text-amber-100/95">
              {liveSymbol ? liveSymbol.quality : ''}
            </span>
          </div>

          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-mono text-amber-200 uppercase tracking-wider">
              {selectedTrackId
                ? `Isolated Instrument: ${selectedTrackId.toUpperCase()}`
                : `Multi-Instrument Tab Staves (${visibleTracks.length} Tracks)`}
            </span>
            <span className="text-[11px] font-mono text-amber-100/85 truncate">
              {livePlayheadMidis.length > 0
                ? `M${Math.floor(currentWhole) + 1} • Notes: ${livePlayheadMidis
                    .map((m) => formatMidiPitchDisplay(m, preferFlats))
                    .join(' – ')}`
                : 'No Active Notes at Playhead'}
            </span>
          </div>
        </div>

        {/* Compact Reference 6-String Guitar Fretboard Diagram */}
        <div
          data-testid="guitar-fretboard-diagram"
          className="flex items-center gap-2 bg-black/30 border border-amber-300/25 rounded px-2.5 py-1 shrink-0"
        >
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-sans font-bold tracking-[0.2em] text-amber-200 uppercase">
              GUITAR
            </span>
            {liveGuitar && liveGuitar.baseFret > 1 && (
              <span
                data-testid="guitar-base-fret"
                className="text-[10px] font-mono font-bold text-white"
              >
                {liveGuitar.baseFret}fr
              </span>
            )}
          </div>

          <svg
            width={116}
            height={54}
            viewBox="0 0 200 130"
            aria-label="6-String Guitar Chord Diagram"
          >
            {Array.from({ length: 5 }).map((_, fIdx) => {
              const y = 18 + fIdx * 20;
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
                    y1={18}
                    x2={x}
                    y2={98}
                    stroke="rgba(255, 247, 237, 0.85)"
                    strokeWidth={1.3}
                  />
                  {str.fret === 'x' && (
                    <text
                      x={x}
                      y={12}
                      textAnchor="middle"
                      className="fill-amber-100/90 font-sans text-[11px] font-bold"
                    >
                      ×
                    </text>
                  )}
                  {str.fret === 0 && (
                    <circle
                      cx={x}
                      cy={10}
                      r={3.5}
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth={1.5}
                    />
                  )}
                  {typeof str.fret === 'number' && str.fret > 0 && (
                    <circle
                      cx={x}
                      cy={18 + (str.fret - baseFret + 0.5) * 20}
                      r={6}
                      fill="#FFFFFF"
                    />
                  )}
                  {str.noteLabel && (
                    <text
                      x={x}
                      y={118}
                      textAnchor="middle"
                      className="fill-white font-sans text-[11px] font-semibold"
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

      {/* Main Scrollable & Pinch-Zoomable Multi-Instrument Tab Staff Viewport */}
      <div
        ref={scrollViewportRef}
        data-testid="tab-flow-scroll-viewport"
        className="flex-1 w-full overflow-auto relative"
      >
        <div
          className="relative min-w-full"
          style={{ width: `${headerWidthPx + timelineWidthPx}px` }}
        >
          {/* Sticky Top Measure & Chord Ruler */}
          <div className="flex sticky top-0 z-20 bg-[#3B1503]/95 border-b border-amber-200/25 h-7 items-center">
            <div
              style={{ width: `${headerWidthPx}px` }}
              className="sticky left-0 z-30 bg-[#3B1503] h-full px-3 border-r border-amber-200/25 flex items-center justify-between text-[10px] font-mono text-amber-200/90 uppercase tracking-wider shrink-0"
            >
              <span>Instrument / Fretboard</span>
              <span>6-Str Tab</span>
            </div>

            <div className="relative h-full" style={{ width: `${timelineWidthPx}px` }}>
              {Array.from({ length: Math.ceil(maxEndWhole) + 1 }).map((_, mIdx) => {
                const x = mIdx * wholeNoteScale;
                const sliceAtMeasure = chordSlices.find(
                  (s) => Math.abs(s.startWhole - mIdx) < 0.26
                );
                return (
                  <div
                    key={mIdx}
                    style={{ left: `${x}px` }}
                    className="absolute top-0 bottom-0 border-l border-amber-200/25 pl-1.5 flex items-center gap-2 pointer-events-none"
                  >
                    <span className="text-[10px] font-mono font-bold text-amber-200/90">
                      M{mIdx + 1}
                    </span>
                    {sliceAtMeasure && (
                      <span className="text-[10px] font-sans font-bold px-1.5 py-0.2 rounded bg-white/15 text-white">
                        {sliceAtMeasure.symbol.fullText}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dedicated Per-Instrument 6-String Tab Staff Rows */}
          {visibleTracks.map((track) => {
            const trackTrajectories = trajectoriesByTrack.get(track.id) || [];
            const activeTrackItems = trackTrajectories.filter(
              (item) =>
                currentWhole >= item.startWhole - 1e-4 &&
                currentWhole <= item.endWhole + 1e-4
            );
            const fallbackTrackItems =
              activeTrackItems.length > 0
                ? activeTrackItems
                : trackTrajectories.filter((item) => item.startWhole < 0.25);

            const trackActiveMidis = Array.from(
              new Set(
                fallbackTrackItems.map((it) =>
                  Math.round(evaluateTrackedEventMidiAtWhole(it, currentWhole))
                )
              )
            ).sort((a, b) => a - b);

            const trackChordSymbol =
              trackActiveMidis.length > 0
                ? detectChordSymbol(trackActiveMidis, preferFlats)
                : null;
            const trackGuitarVoicing = computeGuitarVoicing(
              trackActiveMidis,
              preferFlats
            );

            const topPad = 16;
            const bottomPad = 14;
            const usableH = Math.max(40, staffHeightPx - topPad - bottomPad);
            const stringSpacing = usableH / 5;
            const stringIndexToY = (sIdx: number) =>
              Number((topPad + Math.max(0, Math.min(5, sIdx)) * stringSpacing).toFixed(1));

            return (
              <div
                key={track.id}
                data-testid={`instrument-tab-staff-${track.id}`}
                style={{ height: `${staffHeightPx}px` }}
                className="flex border-b border-amber-100/20 relative bg-black/10 hover:bg-black/20 transition-colors"
              >
                {/* Sticky Left Per-Instrument Header + Mini 6-String Fretboard */}
                <div
                  style={{
                    width: `${headerWidthPx}px`,
                    borderLeft: `4px solid ${track.color}`,
                  }}
                  className="sticky left-0 z-10 bg-[#431904]/95 border-r border-amber-200/25 px-2.5 py-1.5 flex flex-col justify-between shrink-0"
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: track.color }}
                      />
                      <span className="font-mono font-bold text-xs text-white truncate">
                        {track.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedTrackId(selectedTrackId === track.id ? null : track.id)
                      }
                      className="px-1.5 py-0.2 rounded bg-black/40 hover:bg-white/20 text-[9px] font-mono text-amber-200 border border-amber-300/25 cursor-pointer shrink-0"
                      title="Isolate or restore this instrument tab staff"
                    >
                      {selectedTrackId === track.id ? 'All' : 'Focus'}
                    </button>
                  </div>

                  {/* Per-Instrument Active Chord & Mini 6-String Fretboard */}
                  <div className="flex items-center justify-between gap-2 my-auto">
                    <div className="min-w-0">
                      <div className="text-sm font-sans font-bold text-amber-100 truncate">
                        {trackChordSymbol ? trackChordSymbol.fullText : '—'}
                      </div>
                      <div className="text-[9px] font-mono text-amber-200/75 truncate">
                        {trackActiveMidis.length > 0
                          ? trackActiveMidis
                              .slice(0, 4)
                              .map((m) => formatMidiPitchDisplay(m, preferFlats))
                              .join(' ')
                          : `${track.id} (${track.count}n)`}
                      </div>
                    </div>

                    {/* Mini Per-Track Guitar Diagram */}
                    <svg
                      width={64}
                      height={36}
                      viewBox="0 0 130 76"
                      className="shrink-0 bg-black/25 rounded p-0.5 border border-amber-200/15"
                    >
                      {Array.from({ length: 4 }).map((_, fIdx) => (
                        <line
                          key={fIdx}
                          x1={15}
                          y1={12 + fIdx * 16}
                          x2={115}
                          y2={12 + fIdx * 16}
                          stroke="rgba(255,247,237,0.65)"
                          strokeWidth={fIdx === 0 ? 2 : 1}
                        />
                      ))}
                      {trackGuitarVoicing.strings.map((st, sIdx) => {
                        const x = 15 + sIdx * 20;
                        const bf = trackGuitarVoicing.baseFret || 1;
                        return (
                          <g key={sIdx}>
                            <line
                              x1={x}
                              y1={12}
                              x2={x}
                              y2={60}
                              stroke="rgba(255,247,237,0.65)"
                              strokeWidth={1}
                            />
                            {typeof st.fret === 'number' && st.fret > 0 && (
                              <circle
                                cx={x}
                                cy={12 + Math.min(3.5, Math.max(0.5, st.fret - bf + 0.5)) * 16}
                                r={4.2}
                                fill={track.color}
                              />
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  {/* String Tuning Legend */}
                  <div className="flex items-center justify-between text-[8px] font-mono text-amber-200/60">
                    <span>{track.id}</span>
                    <span>e B G D A E</span>
                  </div>
                </div>

                {/* Right Horizontal 6-String Tab Staff & Voice-Leading SVG */}
                <div className="relative" style={{ width: `${timelineWidthPx}px` }}>
                  <svg
                    width={timelineWidthPx}
                    height={staffHeightPx}
                    className="block"
                    aria-label={`Tab Staff for ${track.id}`}
                  >
                    {/* 6 Horizontal Guitar Tab String Lines (1=e high .. 6=E low) */}
                    {TAB_STAFF_STRING_LABELS.map((sLabel, sIdx) => {
                      const y = stringIndexToY(sIdx);
                      return (
                        <g key={sIdx}>
                          <line
                            x1={0}
                            y1={y}
                            x2={timelineWidthPx}
                            y2={y}
                            stroke="rgba(255, 237, 213, 0.24)"
                            strokeWidth={sIdx >= 4 ? 1.2 : 0.85}
                          />
                          <text
                            x={4}
                            y={y + 3}
                            className="fill-amber-200/60 font-mono text-[9px]"
                          >
                            {sLabel}
                          </text>
                        </g>
                      );
                    })}

                    {/* Vertical Measure & Beat Grid Lines */}
                    {Array.from({ length: Math.ceil(maxEndWhole * 4) }).map((_, bIdx) => {
                      const isBar = bIdx % 4 === 0;
                      if (!isBar && wholeNoteScale < 110) return null;
                      const x = (bIdx / 4) * wholeNoteScale;
                      return (
                        <line
                          key={bIdx}
                          x1={x}
                          y1={topPad - 4}
                          x2={x}
                          y2={staffHeightPx - bottomPad + 4}
                          stroke={
                            isBar
                              ? 'rgba(255, 237, 213, 0.32)'
                              : 'rgba(255, 237, 213, 0.09)'
                          }
                          strokeWidth={isBar ? 1.2 : 0.6}
                        />
                      );
                    })}

                    {/* Per-Instrument Voice-Leading Tab Trajectories & Fret Numbers */}
                    {trackTrajectories.map((item) => {
                      const xStart = item.startWhole * wholeNoteScale;
                      const xEnd = item.endWhole * wholeNoteScale;
                      const wPx = Math.max(8, xEnd - xStart);
                      const yStart = stringIndexToY(item.stringIndex);
                      const yEnd = stringIndexToY(item.targetStringIndex);

                      const glideW = item.hasGlide
                        ? Math.min(42, Math.max(10, wPx * 0.25))
                        : 0;
                      const xHold = xEnd - glideW;

                      const dPath = item.hasGlide
                        ? `M ${xStart.toFixed(1)} ${yStart} L ${xHold.toFixed(1)} ${yStart} C ${(
                            xHold +
                            glideW * 0.5
                          ).toFixed(1)} ${yStart}, ${(xEnd - glideW * 0.5).toFixed(
                            1
                          )} ${yEnd}, ${xEnd.toFixed(1)} ${yEnd}`
                        : `M ${xStart.toFixed(1)} ${yStart} L ${xEnd.toFixed(1)} ${yStart}`;

                      const pitchText = formatMidiPitchDisplay(
                        item.startMidi,
                        preferFlats
                      );

                      return (
                        <g key={item.id}>
                          <path
                            d={dPath}
                            fill="none"
                            stroke={track.color}
                            strokeOpacity={0.55}
                            strokeWidth={2.4}
                            strokeLinecap="round"
                          />
                          {/* Illuminated Played Portion (Left of Playhead) */}
                          {playheadX > xStart && (
                            <path
                              d={dPath}
                              fill="none"
                              stroke="#FFFFFF"
                              strokeWidth={3.2}
                              strokeLinecap="round"
                              style={{
                                clipPath: `inset(0px ${Math.max(
                                  0,
                                  timelineWidthPx - playheadX
                                )}px 0px 0px)`,
                              }}
                            />
                          )}

                          {/* Tab Fret Number Pill on the String Line */}
                          <rect
                            x={xStart + 2}
                            y={yStart - 7}
                            width={wPx > 46 ? 40 : 18}
                            height={14}
                            rx={3}
                            fill="#3B1503"
                            stroke={track.color}
                            strokeWidth={1}
                          />
                          <text
                            x={xStart + 6}
                            y={yStart + 3}
                            className="fill-white font-mono text-[9px] font-bold pointer-events-none"
                          >
                            {wPx > 46 ? `${item.fret} ${pitchText}` : `${item.fret}`}
                          </text>
                        </g>
                      );
                    })}

                    {/* Active Playhead Line & Locked Per-Instrument Orbs */}
                    <line
                      x1={playheadX}
                      y1={0}
                      x2={playheadX}
                      y2={staffHeightPx}
                      stroke="#FFFFFF"
                      strokeOpacity={0.75}
                      strokeWidth={1.8}
                    />

                    {fallbackTrackItems.map((item) => {
                      const u = Math.max(
                        0,
                        Math.min(
                          1,
                          (currentWhole - item.startWhole) /
                            Math.max(1e-5, item.durationWhole)
                        )
                      );
                      const glideU =
                        item.hasGlide && u > 0.76 ? (u - 0.76) / 0.24 : 0;
                      const smoothG = glideU * glideU * (3 - 2 * glideU);
                      const interpString =
                        item.stringIndex +
                        (item.targetStringIndex - item.stringIndex) * smoothG;
                      const orbY = stringIndexToY(interpString);
                      const exactMidi = evaluateTrackedEventMidiAtWhole(
                        item,
                        currentWhole
                      );
                      const orbLabel = formatMidiPitchDisplay(
                        Math.round(exactMidi),
                        preferFlats
                      );
                      const orbIdx = globalOrbCounter++;

                      return (
                        <g
                          key={`orb-${item.id}`}
                          data-testid={`voice-orb-${orbIdx}`}
                        >
                          <circle
                            cx={playheadX}
                            cy={orbY}
                            r={7.5}
                            fill={track.color}
                            fillOpacity={0.55}
                          />
                          <circle cx={playheadX} cy={orbY} r={4.2} fill="#FFFFFF" />
                          <text
                            x={playheadX + 10}
                            y={orbY + 3.5}
                            className="fill-white font-sans text-[10px] font-bold drop-shadow"
                          >
                            {orbLabel}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
