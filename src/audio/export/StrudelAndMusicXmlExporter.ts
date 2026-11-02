import { CompiledScore } from '../../parser/DocumentParser';
import { AtomicEvent } from '../../parser/ASTSerializer';
import { DemarcationEngine } from '../../export/DemarcationEngine';

const XML_STEPS = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];
const XML_ALTERS = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function mapPatchToStrudelSound(patch: string, style: string): string {
  const norm = (patch || '').toLowerCase();
  if (style === 'grid' || norm.includes('808') || norm.includes('drum')) return 'RolandTR808';
  if (norm.includes('piano') || norm.includes('salamander')) return 'piano';
  if (norm.includes('supersaw') || norm.includes('saw') || norm.includes('jp8000')) return 'supersaw';
  if (norm.includes('303') || norm.includes('acid')) return 'sawtooth';
  if (norm.includes('reese') || norm.includes('sub') || norm.includes('bass')) return 'sawtooth';
  if (norm.includes('pad') || norm.includes('strings') || norm.includes('choir')) return 'triangle';
  if (norm.includes('bell') || norm.includes('vibraphone') || norm.includes('fm')) return 'sine';
  return 'sawtooth';
}

function midiToStrudelNote(midi: number): string {
  const names = ['c', 'cs', 'd', 'ds', 'e', 'f', 'fs', 'g', 'gs', 'a', 'as', 'b'];
  const rounded = Math.max(12, Math.min(108, Math.round(midi)));
  const octave = Math.floor(rounded / 12) - 1;
  const semitone = ((rounded % 12) + 12) % 12;
  return `${names[semitone]}${octave}`;
}

export class StrudelAndMusicXmlExporter {
  /**
   * Compiles a Tenuto CompiledScore into a runnable Strudel / TidalCycles
   * mini-notation live-coding script (.strudel) with stack(), note(), and sound() chains.
   */
  public static compileScoreToStrudel(score: CompiledScore): string {
    const title = score?.meta?.title || 'Tenuto Score';
    const tempo = Math.max(20, Math.min(300, Number(score?.meta?.tempo) || 120));
    const cpm = Number((tempo / 4).toFixed(3));
    const defs = score?.defs || [];
    const events = score?.events || [];

    const lines: string[] = [
      `// Strudel / TidalCycles Live-Coding Score Exported from Tenuto Studio 5`,
      `// Title: ${title} (${tempo} BPM)`,
      `setcpm(${cpm})`,
      ``,
      `stack(`,
    ];

    const activeDefs = defs.filter((d) => !d.isReturn);
    const trackPatterns: string[] = [];

    for (const def of activeDefs) {
      const trackEvents = events
        .filter((ev) => ev.trackId === def.id && ev.pitch?.midi !== -1 && (ev as any).type !== 'spacer')
        .sort((a, b) => {
          const mDiff = (a.measureNumber || 1) - (b.measureNumber || 1);
          if (mDiff !== 0) return mDiff;
          const aStart = (a.startTime?.numerator || 0) / Math.max(1, a.startTime?.denominator || 1);
          const bStart = (b.startTime?.numerator || 0) / Math.max(1, b.startTime?.denominator || 1);
          return aStart - bStart;
        });

      if (trackEvents.length === 0) continue;

      const byMeasure = new Map<number, AtomicEvent[]>();
      for (const ev of trackEvents) {
        const m = ev.measureNumber || 1;
        const arr = byMeasure.get(m) || [];
        arr.push(ev);
        byMeasure.set(m, arr);
      }

      const maxMeasure = Math.max(...Array.from(byMeasure.keys()), 1);
      const measureTokens: string[] = [];

      for (let m = 1; m <= maxMeasure; m++) {
        const mEvents = byMeasure.get(m) || [];
        if (mEvents.length === 0) {
          measureTokens.push('~');
          continue;
        }
        // Group simultaneous chord notes by startTime
        const byStart = new Map<string, AtomicEvent[]>();
        for (const ev of mEvents) {
          const key = `${ev.startTime?.numerator || 0}/${ev.startTime?.denominator || 1}`;
          const grp = byStart.get(key) || [];
          grp.push(ev);
          byStart.set(key, grp);
        }

        const stepStrs: string[] = [];
        for (const grp of byStart.values()) {
          if (def.style === 'grid') {
            const midi = grp[0].pitch?.midi ?? 36;
            const drumTok =
              midi === 36 ? 'bd' : midi === 38 ? 'sd' : midi === 39 ? 'cp' : midi === 46 ? 'oh' : 'hh';
            stepStrs.push(drumTok);
          } else if (grp.length === 1) {
            stepStrs.push(midiToStrudelNote(grp[0].pitch?.midi ?? 60));
          } else {
            const chordNotes = grp.map((g) => midiToStrudelNote(g.pitch?.midi ?? 60)).join(',');
            stepStrs.push(`[${chordNotes}]`);
          }
        }
        measureTokens.push(stepStrs.length === 1 ? stepStrs[0] : `[${stepStrs.join(' ')}]`);
      }

      const soundName = mapPatchToStrudelSound(def.patch, def.style);
      const gainVal = Number(((def.volume ?? 90) / 110).toFixed(2));
      const panVal = Number((((def.pan ?? 0) + 1) * 0.5).toFixed(2));
      const patternBody = measureTokens.join(' ');

      if (def.style === 'grid') {
        trackPatterns.push(
          `  // ${def.name || def.id}\n  s("<${patternBody}>").bank("${soundName}").gain(${gainVal})`
        );
      } else {
        const cutoff = Number(def.macros?.cutoff ? 200 + def.macros.cutoff * 60 : 3200);
        trackPatterns.push(
          `  // ${def.name || def.id} (${def.patch})\n  note("<${patternBody}>").s("${soundName}").lpf(${Math.round(cutoff)}).gain(${gainVal}).pan(${panVal})`
        );
      }
    }

    if (trackPatterns.length === 0) {
      trackPatterns.push(`  note("<c4 e4 g4 c5>").s("piano").gain(0.8)`);
    }

    lines.push(trackPatterns.join(',\n\n'));
    lines.push(`)`);
    return lines.join('\n');
  }

  /**
   * Compiles a Tenuto CompiledScore into a standard MusicXML 4.0 score-partwise document (.musicxml)
   * using DemarcationEngine to strip non-printable DSP physics prior to engraving serialization.
   */
  public static compileScoreToMusicXml(score: CompiledScore): string {
    const demarcation = new DemarcationEngine();
    const title = escapeXml(score?.meta?.title || 'Tenuto Score');
    const tempo = Math.max(20, Math.min(300, Number(score?.meta?.tempo) || 120));
    const timeSig = String(score?.meta?.time || '4/4');
    const [beatsStr, beatTypeStr] = timeSig.split('/');
    const beats = parseInt(beatsStr || '4', 10) || 4;
    const beatType = parseInt(beatTypeStr || '4', 10) || 4;
    const divisions = 24; // 24 divisions per quarter note (supports 16ths, 32nds, and triplets)

    const activeDefs = (score?.defs || []).filter((d) => !d.isReturn);
    const defsToExport =
      activeDefs.length > 0
        ? activeDefs
        : [{ id: 'pno', name: 'Piano', style: 'standard', patch: 'salamander_grand', volume: 90, pan: 0, fx: [] }];

    const xml: string[] = [
      `<?xml version="1.0" encoding="UTF-8" standalone="no"?>`,
      `<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">`,
      `<score-partwise version="4.0">`,
      `  <work>`,
      `    <work-title>${title}</work-title>`,
      `  </work>`,
      `  <part-list>`,
    ];

    defsToExport.forEach((def, idx) => {
      const partId = `P${idx + 1}`;
      xml.push(`    <score-part id="${partId}">`);
      xml.push(`      <part-name>${escapeXml(def.name || def.id)}</part-name>`);
      xml.push(`    </score-part>`);
    });
    xml.push(`  </part-list>`);

    const allEvents = score?.events || [];
    const maxMeasure = Math.max(
      1,
      ...allEvents.map((e) => e.measureNumber || 1)
    );

    defsToExport.forEach((def, idx) => {
      const partId = `P${idx + 1}`;
      xml.push(`  <part id="${partId}">`);

      const rawTrackEvents = allEvents.filter(
        (ev) => ev.trackId === def.id && (ev as any).type !== 'spacer'
      );
      const prunedEvents = demarcation.pruneForExport(rawTrackEvents, def.style, true);

      for (let m = 1; m <= maxMeasure; m++) {
        xml.push(`    <measure number="${m}">`);
        if (m === 1) {
          xml.push(`      <attributes>`);
          xml.push(`        <divisions>${divisions}</divisions>`);
          xml.push(`        <key><fifths>0</fifths></key>`);
          xml.push(`        <time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>`);
          xml.push(`        <clef><sign>G</sign><line>2</line></clef>`);
          xml.push(`      </attributes>`);
          xml.push(`      <direction placement="above">`);
          xml.push(`        <direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${tempo}</per-minute></metronome></direction-type>`);
          xml.push(`        <sound tempo="${tempo}"/>`);
          xml.push(`      </direction>`);
        }

        const mEvents = prunedEvents
          .filter((ev) => (ev.measureNumber || 1) === m)
          .sort((a, b) => {
            const aS = (a.startTime?.numerator || 0) / Math.max(1, a.startTime?.denominator || 1);
            const bS = (b.startTime?.numerator || 0) / Math.max(1, b.startTime?.denominator || 1);
            return aS - bS;
          });

        if (mEvents.length === 0) {
          xml.push(`      <note><rest/><duration>${divisions * beats}</duration><type>whole</type></note>`);
        } else {
          let prevStartKey = '';
          for (const ev of mEvents) {
            const startKey = `${ev.startTime?.numerator || 0}/${ev.startTime?.denominator || 1}`;
            const isChordSecondNote = startKey === prevStartKey && ev.pitch?.midi !== -1;
            prevStartKey = startKey;

            const wholeDur =
              (ev.duration?.numerator || 1) / Math.max(1, ev.duration?.denominator || 4);
            const durDivs = Math.max(1, Math.round(wholeDur * 4 * divisions));
            const noteType =
              wholeDur >= 1
                ? 'whole'
                : wholeDur >= 0.5
                ? 'half'
                : wholeDur >= 0.25
                ? 'quarter'
                : wholeDur >= 0.125
                ? 'eighth'
                : '16th';

            if (!ev.pitch || ev.pitch.midi === -1) {
              xml.push(`      <note><rest/><duration>${durDivs}</duration><type>${noteType}</type></note>`);
            } else {
              const midi = Math.max(12, Math.min(108, Math.round(ev.pitch.midi)));
              const octave = Math.floor(midi / 12) - 1;
              const semi = ((midi % 12) + 12) % 12;
              const step = XML_STEPS[semi];
              const alter = XML_ALTERS[semi];

              xml.push(`      <note>`);
              if (isChordSecondNote) {
                xml.push(`        <chord/>`);
              }
              xml.push(`        <pitch>`);
              xml.push(`          <step>${step}</step>`);
              if (alter !== 0) {
                xml.push(`          <alter>${alter}</alter>`);
              }
              xml.push(`          <octave>${octave}</octave>`);
              xml.push(`        </pitch>`);
              xml.push(`        <duration>${durDivs}</duration>`);
              xml.push(`        <type>${noteType}</type>`);
              const lyricText = ev.lyric || ev.physics?.lyric;
              if (lyricText) {
                xml.push(`        <lyric number="1"><text>${escapeXml(lyricText)}</text></lyric>`);
              }
              xml.push(`      </note>`);
            }
          }
        }
        xml.push(`    </measure>`);
      }

      xml.push(`  </part>`);
    });

    xml.push(`</score-partwise>`);
    return xml.join('\n');
  }

  /**
   * Compiles a Tenuto score's primary synthesizer signal chain into a standalone
   * Faust functional DSP specification (.dsp).
   */
  public static compileScoreToFaustDsp(score: CompiledScore): string {
    const title = score?.meta?.title || 'Tenuto Synth';
    const firstTrack = (score?.defs || []).find((d) => !d.isReturn) || {
      id: 'lead',
      name: 'Lead Synth',
      patch: 'supersaw',
      volume: 90,
    };
    return [
      `declare name "${title.replace(/"/g, '')} - ${firstTrack.name || firstTrack.id}";`,
      `declare author "Tenuto Studio 5";`,
      `declare license "MIT";`,
      `import("stdfaust.lib");`,
      ``,
      `freq = hslider("freq [unit:Hz]", 440, 20, 8000, 0.1);`,
      `gain = hslider("gain", 0.8, 0, 1, 0.01);`,
      `gate = button("gate");`,
      `cutoff = hslider("cutoff [unit:Hz]", 3200, 80, 16000, 1);`,
      ``,
      `env = en.adsr(0.02, 0.25, 0.8, 0.35, gate) * gain;`,
      `voice = (os.sawtooth(freq * 0.994) + os.sawtooth(freq) * 1.28 + os.sawtooth(freq * 1.006)) * 0.33;`,
      `filtered = voice : fi.resonlp(cutoff, 1.4, env);`,
      `process = filtered <: _, _;`,
    ].join('\n');
  }
}
