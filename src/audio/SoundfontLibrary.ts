import { CompiledScore, TrackDefinition } from '../parser/DocumentParser';

/**
 * Maps Tenuto patch names, shorthand aliases, and all 128 General MIDI program names
 * to canonical MusyngKite / FluidR3_GM SoundFont bank identifiers.
 */
export const SOUNDFONT_PATCH_MAP: Record<string, string> = {
  // Pianos & Keyboards
  salamander_grand: 'acoustic_grand_piano',
  gm_piano: 'acoustic_grand_piano',
  piano: 'acoustic_grand_piano',
  grand_piano: 'acoustic_grand_piano',
  acoustic_grand_piano: 'acoustic_grand_piano',
  bright_piano: 'bright_acoustic_piano',
  bright_acoustic_piano: 'bright_acoustic_piano',
  electric_grand: 'electric_grand_piano',
  electric_grand_piano: 'electric_grand_piano',
  honky_tonk: 'honkytonk_piano',
  honkytonk_piano: 'honkytonk_piano',
  epiano: 'electric_piano_1',
  gm_epiano: 'electric_piano_1',
  vintage_epiano: 'electric_piano_1',
  rhodes: 'electric_piano_1',
  electric_piano_1: 'electric_piano_1',
  dx7: 'electric_piano_2',
  fm_epiano: 'electric_piano_2',
  electric_piano_2: 'electric_piano_2',
  harpsichord: 'harpsichord',
  hps: 'harpsichord',
  clavinet: 'clavinet',
  clav: 'clavinet',

  // Chromatic Percussion
  celesta: 'celesta',
  glockenspiel: 'glockenspiel',
  glock: 'glockenspiel',
  music_box: 'music_box',
  vibraphone: 'vibraphone',
  vibes: 'vibraphone',
  marimba: 'marimba',
  xylophone: 'xylophone',
  xylo: 'xylophone',
  tubular_bells: 'tubular_bells',
  chimes: 'tubular_bells',
  dulcimer: 'dulcimer',

  // Organs & Accordions
  drawbar_organ: 'drawbar_organ',
  tonewheel_organ: 'drawbar_organ',
  hammond: 'drawbar_organ',
  percussive_organ: 'percussive_organ',
  rock_organ: 'rock_organ',
  church_organ: 'church_organ',
  organ: 'church_organ',
  pipe_organ: 'church_organ',
  reed_organ: 'reed_organ',
  accordion: 'accordion',
  harmonica: 'harmonica',
  bandoneon: 'tango_accordion',
  tango_accordion: 'tango_accordion',

  // Guitars
  nylon_guitar: 'acoustic_guitar_nylon',
  acoustic_guitar_nylon: 'acoustic_guitar_nylon',
  classical_guitar: 'acoustic_guitar_nylon',
  steel_guitar: 'acoustic_guitar_steel',
  acoustic_guitar: 'acoustic_guitar_steel',
  acoustic_guitar_steel: 'acoustic_guitar_steel',
  jazz_guitar: 'electric_guitar_jazz',
  electric_guitar_jazz: 'electric_guitar_jazz',
  clean_guitar: 'electric_guitar_clean',
  electric_guitar_clean: 'electric_guitar_clean',
  muted_guitar: 'electric_guitar_muted',
  electric_guitar_muted: 'electric_guitar_muted',
  overdriven_guitar: 'overdriven_guitar',
  distortion_guitar: 'distortion_guitar',
  guitar_harmonics: 'guitar_harmonics',

  // Basses
  acoustic_bass: 'acoustic_bass',
  upright_bass: 'acoustic_bass',
  gm_bass: 'acoustic_bass',
  finger_bass: 'electric_bass_finger',
  electric_bass_finger: 'electric_bass_finger',
  picked_bass: 'electric_bass_pick',
  electric_bass_pick: 'electric_bass_pick',
  fretless_bass: 'fretless_bass',
  slap_bass: 'slap_bass_1',
  slap_bass_1: 'slap_bass_1',
  slap_bass_2: 'slap_bass_2',
  synth_bass_1: 'synth_bass_1',
  synth_bass_2: 'synth_bass_2',

  // Solo Strings & Orchestral Sections
  violin: 'violin',
  vln: 'violin',
  viola: 'viola',
  vla: 'viola',
  cello: 'cello',
  vc: 'cello',
  violoncello: 'cello',
  contrabass: 'contrabass',
  double_bass: 'contrabass',
  cb: 'contrabass',
  tremolo_strings: 'tremolo_strings',
  pizzicato_strings: 'pizzicato_strings',
  pizz_strings: 'pizzicato_strings',
  orchestral_harp: 'orchestral_harp',
  harp: 'orchestral_harp',
  timpani: 'timpani',
  string_ensemble_1: 'string_ensemble_1',
  string_ensemble_2: 'string_ensemble_2',
  strings: 'string_ensemble_1',
  gm_strings: 'string_ensemble_1',
  string_pad: 'string_ensemble_1',
  chamber_strings: 'string_ensemble_2',
  synth_strings_1: 'synth_strings_1',
  synth_strings_2: 'synth_strings_2',

  // Choir, Voice & Pads
  choir_aahs: 'choir_aahs',
  choir: 'choir_aahs',
  gm_vox: 'choir_aahs',
  voice_oohs: 'voice_oohs',
  vox: 'voice_oohs',
  soprano: 'choir_aahs',
  alto: 'voice_oohs',
  tenor: 'choir_aahs',
  synth_choir: 'synth_choir',
  warm_pad: 'pad_2_warm',
  pad_1_new_age: 'pad_1_new_age',
  pad_2_warm: 'pad_2_warm',
  pad_3_polysynth: 'pad_3_polysynth',
  pad_4_choir: 'pad_4_choir',
  pad_5_bowed: 'pad_5_bowed',
  pad_6_metallic: 'pad_6_metallic',
  pad_7_halo: 'pad_7_halo',
  halo_pad: 'pad_7_halo',
  pad_8_sweep: 'pad_8_sweep',
  sweep_pad: 'pad_8_sweep',

  // Brass
  trumpet: 'trumpet',
  tpt: 'trumpet',
  trombone: 'trombone',
  tbn: 'trombone',
  tuba: 'tuba',
  tba: 'tuba',
  muted_trumpet: 'muted_trumpet',
  french_horn: 'french_horn',
  horn: 'french_horn',
  hn: 'french_horn',
  brass_section: 'brass_section',
  brass: 'brass_section',
  synth_brass_1: 'synth_brass_1',
  synth_brass_2: 'synth_brass_2',

  // Reed & Pipe Woodwinds
  soprano_sax: 'soprano_sax',
  alto_sax: 'alto_sax',
  tenor_sax: 'tenor_sax',
  baritone_sax: 'baritone_sax',
  oboe: 'oboe',
  ob: 'oboe',
  english_horn: 'english_horn',
  cor_anglais: 'english_horn',
  bassoon: 'bassoon',
  bsn: 'bassoon',
  clarinet: 'clarinet',
  cl: 'clarinet',
  piccolo: 'piccolo',
  flute: 'flute',
  fl: 'flute',
  recorder: 'recorder',
  pan_flute: 'pan_flute',
  blown_bottle: 'blown_bottle',
  shakuhachi: 'shakuhachi',
  whistle: 'whistle',
  ocarina: 'ocarina',

  // Synth Leads
  lead_1_square: 'lead_1_square',
  square_lead: 'lead_1_square',
  lead_2_sawtooth: 'lead_2_sawtooth',
  lead_3_calliope: 'lead_3_calliope',
  lead_4_chiff: 'lead_4_chiff',
  lead_5_charang: 'lead_5_charang',
  lead_6_voice: 'lead_6_voice',
  lead_7_fifths: 'lead_7_fifths',
  lead_8_bass_lead: 'lead_8_bass_lead',

  // World & Ethnic
  sitar: 'sitar',
  banjo: 'banjo',
  shamisen: 'shamisen',
  koto: 'koto',
  kalimba: 'kalimba',
  bagpipe: 'bagpipe',
  fiddle: 'fiddle',
  shanai: 'shanai',
  steel_drums: 'steel_drums',
  taiko_drum: 'taiko_drum',
  melodic_tom: 'melodic_tom',
};

const PITCH_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export function noteNameToMidi(noteName: string): number | null {
  const m = noteName.match(/^([A-G])(b|#)?(-?\d+)$/);
  if (!m) return null;
  const stepMap: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let offset = stepMap[m[1]];
  if (m[2] === 'b') offset -= 1;
  if (m[2] === '#') offset += 1;
  const octave = parseInt(m[3], 10);
  return (octave + 1) * 12 + offset;
}

export function midiToSoundfontKey(midi: number): string {
  const clamped = Math.max(21, Math.min(108, Math.round(midi)));
  const octave = Math.floor(clamped / 12) - 1;
  const step = PITCH_NAMES_FLAT[clamped % 12];
  return `${step}${octave}`;
}

/**
 * Resolves the best SoundFont instrument name for a given track definition and event.
 * Returns null ONLY for drum grid tracks or pure electronic 808/synthwave tracks when desired.
 */
export function resolveSoundfontInstrument(
  trackId?: string,
  trackName?: string,
  patch?: string,
  style?: string,
  isPizz?: boolean
): string | null {
  const id = (trackId || '').toLowerCase();
  const name = (trackName || '').toLowerCase();
  const cleanPatch = (patch || '').toLowerCase().replace(/^"|"$/g, '');
  const cleanStyle = (style || 'standard').toLowerCase();

  if (id === 'ham' || name.includes('hammer') || cleanPatch === 'taiko_drum') {
    return 'taiko_drum';
  }

  if (id === 'timp' || id.includes('timp') || name.includes('timpani') || cleanPatch === 'timpani') {
    return 'timpani';
  }

  if (
    cleanStyle === 'grid' ||
    cleanStyle === 'scsynth' ||
    cleanStyle === 'supercollider' ||
    cleanStyle === 'superdirt' ||
    cleanStyle === 'eurorack' ||
    cleanStyle === 'modular' ||
    cleanStyle === 'plaits' ||
    cleanStyle === 'daisy' ||
    cleanStyle === 'stk' ||
    cleanStyle === 'waveguide' ||
    cleanStyle === 'soundpipe' ||
    cleanStyle === 'sporth' ||
    cleanStyle === 'csound' ||
    cleanPatch.startsWith('sc:') ||
    cleanPatch.startsWith('sc_') ||
    cleanPatch.startsWith('sonic-pi-') ||
    cleanPatch.startsWith('mi:') ||
    cleanPatch.startsWith('mi_') ||
    cleanPatch.startsWith('daisy:') ||
    cleanPatch.startsWith('daisy_') ||
    cleanPatch.startsWith('stk:') ||
    cleanPatch.startsWith('stk_') ||
    cleanPatch.startsWith('sp:') ||
    cleanPatch.startsWith('sp_')
  ) {
    return null;
  }

  if (isPizz) return 'pizzicato_strings';

  const NATIVE_SYNTH_PATCHES = new Set([
    'wavetable',
    'supersaw',
    'reese',
    'reese_bass',
    'flutter_pad',
    'riser',
    'pluck_lead',
    'acid_lead',
    'operator',
    'meld',
    'drift',
    'analog',
    'collision',
    'tension',
    'electric',
    'granulator',
    'ribbon_cluster_8',
    'tape_nostalgia_pad',
    'cybernetic_eoc',
    'west_coast_200',
    'morph_analog_12',
    'vintage_ladder_8',
    'hybrid_motor_12',
    'binaural_hybrid_20',
    'state_variable_8',
    'vintage_poly_10',
    'stepped_wavetable_24',
    'spectral_hybrid_16',
    'granular_workstation_80',
    'swarmatron',
    'hauntology_pad',
    'buchla_krell',
    'buchla_200e',
    'polybrute_12',
    'moog_muse',
    'nina_motor',
    'super_gemini',
    'ob_x8',
    'prophet_10',
    'ppg_3rd_wave',
    'quantum_mk2',
    'gr_mega',
  ]);
  if (NATIVE_SYNTH_PATCHES.has(cleanPatch) || cleanPatch.startsWith('wavetable_')) {
    return null;
  }

  // Check if track ID or display name explicitly names an orchestral/acoustic instrument
  if (id.startsWith('vln1') || name.includes('first violin') || name.includes('solo violin')) return 'violin';
  if (id.startsWith('vln2') || name.includes('second violin')) return 'string_ensemble_1';
  if (id.startsWith('vln') || name.includes('violin')) return 'violin';
  if (id.startsWith('vla') || name.includes('viola')) return 'viola';
  if (id.startsWith('vc') || name.includes('cello') || name.includes('violoncello')) return 'cello';
  if (id.startsWith('cb') || name.includes('contrabass') || name.includes('double bass')) return 'contrabass';
  if (id === 'fl' || name.includes('flute')) return 'flute';
  if (id === 'picc' || name.includes('piccolo')) return 'piccolo';
  if (id === 'ob' || name.includes('oboe')) return 'oboe';
  if (id === 'eh' || name.includes('english horn')) return 'english_horn';
  if (id === 'cl' || name.includes('clarinet')) return 'clarinet';
  if (id === 'bsn' || name.includes('bassoon')) return 'bassoon';
  if (id === 'hn' || name.includes('french horn') || name.includes('horn')) return 'french_horn';
  if (id === 'tpt' || name.includes('trumpet')) return 'trumpet';
  if (id === 'tbn' || name.includes('trombone')) return 'trombone';
  if (id === 'tba' || name.includes('tuba')) return 'tuba';
  if (
    id.includes('harp') ||
    name.includes('harp') ||
    (cleanStyle !== 'synth' && (id === 'arp' || name.includes('pluck')))
  ) {
    return 'orchestral_harp';
  }
  if (id === 'soprano' || id === 'choir' || name.includes('choir') || name.includes('soprano')) return 'choir_aahs';
  if (id === 'alto' || id === 'vox' || name.includes('alto') || name.includes('celestial')) return 'voice_oohs';
  if (id === 'tenor' || name.includes('tenor') || name.includes('baritone')) return 'choir_aahs';
  if (id === 'brass' || name.includes('brass')) return 'brass_section';
  if (id === 'strings' || name.includes('string')) return 'string_ensemble_1';
  if (id === 'pno' || name.includes('piano') || name.includes('grand')) return 'acoustic_grand_piano';
  if (id === 'org' || name.includes('organ')) return 'church_organ';

  if (cleanStyle === 'synth' || cleanStyle === 'simpler' || cleanStyle === 'concrete') {
    return null;
  }

  // Direct patch lookup in our 128-instrument map
  if (cleanPatch && SOUNDFONT_PATCH_MAP[cleanPatch]) {
    return SOUNDFONT_PATCH_MAP[cleanPatch];
  }

  // Fallback mappings for synth patches
  if (cleanPatch === '808_sub') return 'acoustic_bass';
  if (cleanPatch === 'saw_lead') return 'lead_2_sawtooth';

  return 'acoustic_grand_piano';
}

/**
 * Returns true if the instrument sustains continuously via bow or breath
 * (meaning held notes should crossfade-loop their steady-state body rather than decaying like a piano).
 */
export function isSustainingOrchestralInstrument(sfInstrument?: string | null, patch?: string): boolean {
  const inst = (sfInstrument || patch || '').toLowerCase();
  return (
    inst.includes('violin') ||
    inst.includes('viola') ||
    inst.includes('cello') ||
    inst.includes('contrabass') ||
    inst.includes('string_ensemble') ||
    inst.includes('tremolo_strings') ||
    inst.includes('flute') ||
    inst.includes('piccolo') ||
    inst.includes('oboe') ||
    inst.includes('english_horn') ||
    inst.includes('clarinet') ||
    inst.includes('bassoon') ||
    inst.includes('sax') ||
    inst.includes('horn') ||
    inst.includes('trumpet') ||
    inst.includes('trombone') ||
    inst.includes('tuba') ||
    inst.includes('brass') ||
    inst.includes('choir') ||
    inst.includes('voice') ||
    inst.includes('organ') ||
    inst.includes('pad')
  );
}

/**
 * Returns true when a track represents a multi-player orchestral section
 * (e.g., 16 First Violins, 14 Second Violins, 12 Violas, 10 Cellos, 8 Contrabasses, 6 Horns, Trombones, Choir)
 * that should be rendered with multi-desk unison chorus dispersion.
 */
export function isEnsembleSectionTrack(trackId?: string, trackName?: string, sfInstrument?: string | null): boolean {
  const id = (trackId || '').toLowerCase();
  const name = (trackName || '').toLowerCase();
  const inst = (sfInstrument || '').toLowerCase();

  if (name.includes('solo') || name.includes('principal')) {
    return false;
  }

  return (
    id === 'vln1' ||
    id === 'vln2' ||
    id === 'vla' ||
    id === 'vc' ||
    id === 'cb' ||
    id === 'str' ||
    id === 'strings' ||
    id === 'hn' ||
    id === 'tbn' ||
    id === 'brass' ||
    id === 'choir' ||
    id === 'soprano' ||
    id === 'alto' ||
    id === 'tenor' ||
    id === 'vox' ||
    name.includes('section') ||
    name.includes('trumpets') ||
    inst === 'string_ensemble_1' ||
    inst === 'string_ensemble_2' ||
    inst === 'brass_section' ||
    inst === 'choir_aahs' ||
    inst === 'voice_oohs'
  );
}

const CDN_BASES = [
  'https://gleitz.github.io/midi-js-soundfonts/MusyngKite',
  'https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts@gh-pages/MusyngKite',
];

export class SoundfontBankLoader {
  private rawNoteDataCache: Map<string, Map<number, string>> = new Map();
  private decodedBufferCache: Map<string, Map<number, AudioBuffer>> = new Map();
  private pendingBankFetches: Map<string, Promise<Map<number, string> | null>> = new Map();

  public isTestEnvironment(): boolean {
    try {
      if (typeof process !== 'undefined' && (process as any).env?.VITEST) return true;
      if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '')) return true;
    } catch {
      // Ignore
    }
    return false;
  }

  public parseSoundfontJs(jsText: string): Map<number, string> {
    const notesMap = new Map<number, string>();
    const regex = /"([A-G]b?\d+)":\s*"data:audio\/[^;]+;base64,([^"]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(jsText)) !== null) {
      const midi = noteNameToMidi(match[1]);
      if (midi !== null) {
        notesMap.set(midi, match[2]);
      }
    }
    return notesMap;
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryStr = typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes.buffer;
  }

  public async fetchInstrumentBank(instrumentName: string): Promise<Map<number, string> | null> {
    if (this.rawNoteDataCache.has(instrumentName)) {
      return this.rawNoteDataCache.get(instrumentName)!;
    }
    if (this.pendingBankFetches.has(instrumentName)) {
      return this.pendingBankFetches.get(instrumentName)!;
    }

    const fetchPromise = (async (): Promise<Map<number, string> | null> => {
      for (const base of CDN_BASES) {
        const url = `${base}/${instrumentName}-mp3.js`;
        try {
          let jsText: string | null = null;

          if (typeof caches !== 'undefined') {
            try {
              const cache = await caches.open('tenuto-soundfont-vault-v1');
              const cachedResp = await cache.match(url);
              if (cachedResp && cachedResp.ok) {
                jsText = await cachedResp.text();
              }
            } catch {
              // CacheStorage unavailable in current context
            }
          }

          if (!jsText) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 25000);
            const resp = await fetch(url, { signal: controller.signal, mode: 'cors' });
            clearTimeout(timeoutId);

            if (!resp.ok) continue;
            jsText = await resp.text();

            if (typeof caches !== 'undefined' && jsText.length > 1000) {
              try {
                const cache = await caches.open('tenuto-soundfont-vault-v1');
                await cache.put(url, new Response(jsText, { headers: { 'Content-Type': 'application/javascript' } }));
              } catch {
                // Ignore quota errors
              }
            }
          }

          if (jsText) {
            const parsed = this.parseSoundfontJs(jsText);
            if (parsed.size > 0) {
              this.rawNoteDataCache.set(instrumentName, parsed);
              return parsed;
            }
          }
        } catch {
          // Try next CDN mirror
        }
      }
      return null;
    })();

    this.pendingBankFetches.set(instrumentName, fetchPromise);
    const res = await fetchPromise;
    this.pendingBankFetches.delete(instrumentName);
    return res;
  }

  private loopInfoCache = new WeakMap<
    AudioBuffer,
    { loopStart: number; loopEnd: number; activeEnd: number; normGain: number }
  >();

  public getCachedBankCount(): number {
    let count = 0;
    for (const map of this.decodedBufferCache.values()) {
      count += map.size;
    }
    return count;
  }

  /**
   * Computes and caches the true non-silent region `[0..activeEnd]` and high-energy sustain
   * loop window `[loopStart..loopEnd]` for any decoded AudioBuffer (preventing MP3 tail silence dropouts).
   */
  public getSustainedLoopInfo(
    srcBuf: AudioBuffer,
    isSustaining: boolean
  ): { loopStart: number; loopEnd: number; activeEnd: number; normGain: number } {
    const cached = this.loopInfoCache.get(srcBuf);
    if (cached) return cached;

    const sr = srcBuf.sampleRate || 44100;
    const refData = srcBuf.getChannelData(0);
    const totalSamples = refData.length;
    const winSize = Math.max(128, Math.floor(sr * 0.015));
    const numWins = Math.floor(totalSamples / winSize);

    let maxAbs = 0;
    for (let i = 0; i < totalSamples; i++) {
      const a = Math.abs(refData[i]);
      if (a > maxAbs) maxAbs = a;
    }
    const normGain = maxAbs > 0.005 ? Math.min(2.6, Math.max(0.75, 0.55 / maxAbs)) : 1.0;

    if (numWins < 6) {
      const fallback = {
        loopStart: Math.floor(totalSamples * 0.2),
        loopEnd: Math.max(Math.floor(totalSamples * 0.2) + 1, totalSamples - 2),
        activeEnd: Math.max(1, totalSamples - 2),
        normGain,
      };
      this.loopInfoCache.set(srcBuf, fallback);
      return fallback;
    }

    const winRms = new Float32Array(numWins);
    let peakRms = 0;
    let peakWinIdx = 1;
    const minAttackWins = Math.min(numWins - 3, Math.max(1, Math.floor(0.035 / 0.015)));

    for (let w = 0; w < numWins; w++) {
      let sum = 0;
      const offset = w * winSize;
      for (let i = 0; i < winSize; i++) {
        const s = refData[offset + i];
        sum += s * s;
      }
      const r = Math.sqrt(sum / winSize);
      winRms[w] = r;
      if (w >= minAttackWins && r > peakRms) {
        peakRms = r;
        peakWinIdx = w;
      }
    }

    // Find last window with audible energy above 2% of peakRms (strips MP3 trailing silence)
    let lastActiveWin = numWins - 1;
    while (lastActiveWin > peakWinIdx && winRms[lastActiveWin] < peakRms * 0.025) {
      lastActiveWin--;
    }
    const activeEnd = Math.min(totalSamples - 2, (lastActiveWin + 1) * winSize);

    let startWin = peakWinIdx;
    while (startWin > minAttackWins && winRms[startWin - 1] >= peakRms * 0.45) {
      startWin--;
    }
    let endWin = peakWinIdx;
    while (endWin + 1 <= lastActiveWin && winRms[endWin + 1] >= peakRms * 0.42) {
      endWin++;
    }

    // If plateau is narrow, widen slightly ONLY across windows that still have >= 25% of peakRms
    while (endWin - startWin < 10) {
      let expanded = false;
      if (endWin + 1 <= lastActiveWin && winRms[endWin + 1] >= peakRms * 0.25) {
        endWin++;
        expanded = true;
      }
      if (startWin > minAttackWins && winRms[startWin - 1] >= peakRms * 0.25) {
        startWin--;
        expanded = true;
      }
      if (!expanded) break;
    }

    let loopStart = startWin * winSize;
    let loopEnd = Math.min(activeEnd, (endWin + 1) * winSize);
    if (loopEnd - loopStart < 512) {
      loopStart = Math.max(0, Math.floor(activeEnd * 0.15));
      loopEnd = Math.max(loopStart + 512, Math.min(activeEnd, Math.floor(activeEnd * 0.75)));
    }

    const info = {
      loopStart,
      loopEnd: isSustaining ? loopEnd : activeEnd,
      activeEnd,
      normGain,
    };
    this.loopInfoCache.set(srcBuf, info);
    return info;
  }

  /**
   * Energy-Gated Plateau Looper:
   * Scans the decoded sample in 15ms RMS windows to find the true high-energy tonal plateau
   * BEFORE the sample decays into MP3 tail silence, then synthesizes a 6.5-second continuous
   * sustain buffer using 50%-overlap Hann-windowed crossfade grains.
   */
  private createSustainedOrchestralBuffer(
    ctx: BaseAudioContext,
    srcBuf: AudioBuffer,
    instrumentName: string
  ): AudioBuffer {
    if (!isSustainingOrchestralInstrument(instrumentName) || srcBuf.duration < 0.45) {
      return srcBuf;
    }

    const sr = srcBuf.sampleRate;
    const refData = srcBuf.getChannelData(0);
    const totalSamples = refData.length;

    // 1. Scan 15ms windows to locate the peak RMS and active sustain plateau (ignoring silent MP3 padding)
    const winSize = Math.max(256, Math.floor(sr * 0.015));
    const numWins = Math.floor(totalSamples / winSize);
    if (numWins < 8) return srcBuf;

    const winRms = new Float32Array(numWins);
    let peakRms = 0;
    let peakWinIdx = 2;
    const minAttackWins = Math.min(numWins - 4, Math.max(2, Math.floor(0.045 / 0.015)));

    for (let w = 0; w < numWins; w++) {
      let sum = 0;
      const offset = w * winSize;
      for (let i = 0; i < winSize; i++) {
        const s = refData[offset + i];
        sum += s * s;
      }
      const r = Math.sqrt(sum / winSize);
      winRms[w] = r;
      if (w >= minAttackWins && r > peakRms) {
        peakRms = r;
        peakWinIdx = w;
      }
    }

    if (peakRms < 0.0005) return srcBuf;

    // 2. Expand outward from peakWinIdx while window RMS stays >= 48% of peakRms (never into MP3 tail silence)
    let startWin = peakWinIdx;
    while (startWin > minAttackWins && winRms[startWin - 1] >= peakRms * 0.48) {
      startWin--;
    }
    let endWin = peakWinIdx;
    while (endWin + 1 < numWins - 1 && winRms[endWin + 1] >= peakRms * 0.45) {
      endWin++;
    }

    // Widen only across windows that actually contain >= 25% of peakRms (never into silent tail windows!)
    while (endWin - startWin < 12) {
      let expanded = false;
      if (endWin + 1 < numWins - 1 && winRms[endWin + 1] >= peakRms * 0.25) {
        endWin++;
        expanded = true;
      }
      if (startWin > minAttackWins && winRms[startWin - 1] >= peakRms * 0.25) {
        startWin--;
        expanded = true;
      }
      if (!expanded) break;
    }

    let loopStartIdx = startWin * winSize;
    let loopEndIdx = Math.min(totalSamples - 256, (endWin + 1) * winSize);

    // Snap loopStartIdx & loopEndIdx to rising zero-crossings
    for (let i = loopStartIdx; i < Math.min(totalSamples - 2, loopStartIdx + 1024); i++) {
      if (refData[i] <= 0 && refData[i + 1] > 0) {
        loopStartIdx = i;
        break;
      }
    }
    for (let i = loopEndIdx; i > Math.max(loopStartIdx + 2048, loopEndIdx - 1024); i--) {
      if (refData[i] <= 0 && refData[i + 1] > 0) {
        loopEndIdx = i;
        break;
      }
    }

    const grainLen = loopEndIdx - loopStartIdx;
    if (grainLen < 1024) return srcBuf;

    const targetDuration = 6.5;
    const targetLen = Math.floor(sr * targetDuration);
    const numCh = srcBuf.numberOfChannels;
    const outBuf = ctx.createBuffer(numCh, targetLen, sr);
    let halfGrain = Math.floor(grainLen / 2);
    for (let i = halfGrain; i < Math.min(grainLen - 2, halfGrain + 1024); i++) {
      if (refData[loopStartIdx + i] <= 0 && refData[loopStartIdx + i + 1] > 0) {
        halfGrain = i;
        break;
      }
    }

    for (let ch = 0; ch < numCh; ch++) {
      const inData = srcBuf.getChannelData(ch);
      const outData = outBuf.getChannelData(ch);

      // Build a normalized, RMS-leveled sustain grain from [loopStartIdx .. loopEndIdx]
      const grain = new Float32Array(grainLen);
      for (let i = 0; i < grainLen; i++) {
        const srcPos = loopStartIdx + i;
        const wIdx = Math.min(numWins - 1, Math.floor(srcPos / winSize));
        const localRms = Math.max(peakRms * 0.35, winRms[wIdx] || peakRms);
        const levelComp = Math.min(1.85, peakRms / localRms);
        grain[i] = inData[srcPos] * levelComp;
      }

      // 1. Copy natural attack up to loopStartIdx + halfGrain
      const attackCopyEnd = Math.min(targetLen, loopStartIdx + halfGrain);
      for (let i = 0; i < attackCopyEnd; i++) {
        if (i < loopStartIdx) {
          outData[i] = inData[i];
        } else {
          outData[i] = grain[i - loopStartIdx];
        }
      }

      // 2. Fill remaining buffer up to 6.5s using 50%-overlap Hann-windowed grains (constant power, zero silence)
      for (let i = loopStartIdx; i < targetLen; i++) {
        const rel = i - loopStartIdx;
        const posA = rel % grainLen;
        const posB = (rel + halfGrain) % grainLen;

        // Raised cosine (Hann) weights that sum strictly to 1.0 everywhere: sin^2(x) + cos^2(x) = 1
        const phaseA = (Math.PI * posA) / grainLen;
        const wA = Math.sin(phaseA) * Math.sin(phaseA);
        const wB = 1.0 - wA;

        const mixed = grain[posA] * wA + grain[posB] * wB;
        if (i < attackCopyEnd) {
          const blend = (i - loopStartIdx) / Math.max(1, halfGrain);
          outData[i] = outData[i] * (1 - blend) + mixed * blend;
        } else {
          outData[i] = mixed;
        }
      }
    }

    return outBuf;
  }

  public async decodeNoteBuffer(
    ctx: BaseAudioContext,
    instrumentName: string,
    midiNote: number
  ): Promise<AudioBuffer | null> {
    if (typeof ctx.decodeAudioData !== 'function') return null;

    let instBuffers = this.decodedBufferCache.get(instrumentName);
    if (!instBuffers) {
      instBuffers = new Map<number, AudioBuffer>();
      this.decodedBufferCache.set(instrumentName, instBuffers);
    }

    const clampedMidi = Math.max(21, Math.min(108, Math.round(midiNote)));
    if (instBuffers.has(clampedMidi)) {
      return instBuffers.get(clampedMidi)!;
    }

    const rawBank = await this.fetchInstrumentBank(instrumentName);
    if (!rawBank || rawBank.size === 0) return null;

    // Find exact MIDI note or closest available neighbor in the SoundFont bank
    let targetMidi = clampedMidi;
    if (!rawBank.has(targetMidi)) {
      let minDist = Infinity;
      for (const availableMidi of rawBank.keys()) {
        const dist = Math.abs(availableMidi - clampedMidi);
        if (dist < minDist) {
          minDist = dist;
          targetMidi = availableMidi;
        }
      }
    }

    if (instBuffers.has(targetMidi)) {
      return instBuffers.get(targetMidi)!;
    }

    const base64 = rawBank.get(targetMidi);
    if (!base64) return null;

    try {
      const arrayBuf = this.base64ToArrayBuffer(base64);
      const audioBuffer = await ctx.decodeAudioData(arrayBuf.slice(0));
      const sustainedBuffer = this.createSustainedOrchestralBuffer(ctx, audioBuffer, instrumentName);
      instBuffers.set(targetMidi, sustainedBuffer);
      return sustainedBuffer;
    } catch {
      return null;
    }
  }

  /**
   * Extracts all unique (SoundFont instrument, MIDI note) pairs required by `score`.
   */
  public extractRequiredScoreAssets(score: CompiledScore): Map<string, Set<number>> {
    const defsById = new Map<string, TrackDefinition>();
    for (const d of score.defs) {
      defsById.set(d.id, d);
    }

    const requiredNotesByInstrument = new Map<string, Set<number>>();

    for (const ev of score.events) {
      if (!ev.pitch || ev.pitch.isRest || ev.pitch.isSpacer) continue;
      const def = defsById.get(ev.trackId || 'pno');
      const sfInstrument = resolveSoundfontInstrument(
        ev.trackId,
        def?.name,
        ev.patch || def?.patch,
        ev.style || def?.style,
        ev.physics?.pizz
      );
      if (!sfInstrument) continue;

      if (!requiredNotesByInstrument.has(sfInstrument)) {
        requiredNotesByInstrument.set(sfInstrument, new Set());
      }
      const noteSet = requiredNotesByInstrument.get(sfInstrument)!;
      if (sfInstrument === 'timpani') {
        noteSet.add(45);
        noteSet.add(48);
        noteSet.add(52);
      }
      const clampedMidi = Math.max(21, Math.min(108, Math.round(ev.pitch.midi || 60)));
      noteSet.add(clampedMidi);
      if (isEnsembleSectionTrack(ev.trackId, def?.name, sfInstrument)) {
        noteSet.add(clampedMidi < 96 ? clampedMidi + 2 : clampedMidi - 2);
      }
    }

    return requiredNotesByInstrument;
  }

  /**
   * Explicitly downloads, caches in `CacheStorage`, and decodes all SoundFont banks and MIDI notes
   * required by `score` with concurrency throttling (2 banks at a time) for slow/unstable networks.
   */
  public async predownloadScoreAssets(
    ctx: BaseAudioContext | null,
    score: CompiledScore,
    onProgress?: (progress: {
      loadedBanks: number;
      totalBanks: number;
      decodedNotes: number;
      totalNotes: number;
      done: boolean;
    }) => void
  ): Promise<{ banksCached: number; notesDecoded: number }> {
    const requiredNotesByInstrument = this.extractRequiredScoreAssets(score);
    const instruments = Array.from(requiredNotesByInstrument.keys());
    let totalNotes = 0;
    for (const set of requiredNotesByInstrument.values()) {
      totalNotes += set.size;
    }

    let loadedBanks = 0;
    let decodedNotes = 0;
    onProgress?.({
      loadedBanks: 0,
      totalBanks: instruments.length,
      decodedNotes: 0,
      totalNotes,
      done: instruments.length === 0 && totalNotes === 0,
    });

    if (!this.isTestEnvironment()) {
      for (let i = 0; i < instruments.length; i += 2) {
        const batch = instruments.slice(i, i + 2);
        await Promise.all(
          batch.map(async (inst) => {
            await this.fetchInstrumentBank(inst);
            loadedBanks++;
            onProgress?.({
              loadedBanks,
              totalBanks: instruments.length,
              decodedNotes,
              totalNotes,
              done: false,
            });
          })
        );
      }
    } else {
      loadedBanks = instruments.length;
    }

    if (ctx && typeof ctx.decodeAudioData === 'function' && !this.isTestEnvironment()) {
      const decodeTasks: Array<() => Promise<void>> = [];
      for (const [inst, midiSet] of requiredNotesByInstrument.entries()) {
        for (const midi of midiSet) {
          decodeTasks.push(async () => {
            await this.decodeNoteBuffer(ctx, inst, midi);
            decodedNotes++;
            onProgress?.({
              loadedBanks,
              totalBanks: instruments.length,
              decodedNotes,
              totalNotes,
              done: false,
            });
          });
        }
      }
      for (let i = 0; i < decodeTasks.length; i += 6) {
        await Promise.all(decodeTasks.slice(i, i + 6).map((fn) => fn()));
      }
    } else {
      decodedNotes = totalNotes;
    }

    onProgress?.({
      loadedBanks,
      totalBanks: instruments.length,
      decodedNotes,
      totalNotes,
      done: true,
    });
    return { banksCached: loadedBanks, notesDecoded: decodedNotes };
  }

  /**
   * Preloads and decodes all unique (instrument, MIDI pitch) pairs required by the score
   * so playback starts with zero network stutter.
   */
  public async prewarmScoreSamples(ctx: BaseAudioContext, score: CompiledScore): Promise<void> {
    if (this.isTestEnvironment() || typeof ctx.decodeAudioData !== 'function') {
      return;
    }
    await this.predownloadScoreAssets(ctx, score);
  }

  /**
   * Synchronously retrieves a pre-decoded AudioBuffer (or nearest neighbor with playbackRate shift)
   * for real-time scheduling and WAV export.
   */
  public getCachedSampleForNote(
    instrumentName: string,
    midiNote: number
  ): { buffer: AudioBuffer; playbackRate: number } | null {
    const instBuffers = this.decodedBufferCache.get(instrumentName);
    if (!instBuffers || instBuffers.size === 0) return null;

    const clampedMidi = Math.max(21, Math.min(108, Math.round(midiNote)));
    if (instBuffers.has(clampedMidi)) {
      return { buffer: instBuffers.get(clampedMidi)!, playbackRate: 1.0 };
    }

    let closestMidi = clampedMidi;
    let minDist = Infinity;
    for (const k of instBuffers.keys()) {
      const dist = Math.abs(k - clampedMidi);
      if (dist < minDist) {
        minDist = dist;
        closestMidi = k;
      }
    }

    const buf = instBuffers.get(closestMidi);
    if (!buf) return null;
    const playbackRate = Math.pow(2, (clampedMidi - closestMidi) / 12);
    return { buffer: buf, playbackRate };
  }

  /**
   * Retrieves an independent neighbor-key AudioBuffer (±1..3 semitones) pitched to `midiNote`
   * for Desk 2 section unison so Desk 1 and Desk 2 never play the exact same waveform (zero comb-filtering).
   */
  public getIndependentDeskSampleForNote(
    instrumentName: string,
    midiNote: number
  ): { buffer: AudioBuffer; playbackRate: number } | null {
    const instBuffers = this.decodedBufferCache.get(instrumentName);
    if (!instBuffers || instBuffers.size < 2) return null;

    const clampedMidi = Math.max(21, Math.min(108, Math.round(midiNote)));
    let primaryMidi = clampedMidi;
    let minPrimaryDist = Infinity;
    for (const k of instBuffers.keys()) {
      const dist = Math.abs(k - clampedMidi);
      if (dist < minPrimaryDist) {
        minPrimaryDist = dist;
        primaryMidi = k;
      }
    }

    let neighborMidi: number | null = null;
    let minNeighborDist = Infinity;
    for (const k of instBuffers.keys()) {
      if (k === primaryMidi) continue;
      const dist = Math.abs(k - clampedMidi);
      if (dist >= 1 && dist <= 4 && dist < minNeighborDist) {
        minNeighborDist = dist;
        neighborMidi = k;
      }
    }

    if (neighborMidi === null) return null;
    const buf = instBuffers.get(neighborMidi);
    if (!buf) return null;
    const playbackRate = Math.pow(2, (clampedMidi - neighborMidi) / 12);
    return { buffer: buf, playbackRate };
  }
}

