export interface PresetScore {
  id: string;
  title: string;
  genre: string;
  code: string;
}

export const PRESET_SCORES: PresetScore[] = [
  {
    id: 'neon_horizon',
    title: 'Neon Horizon (Synthwave)',
    genre: '118 BPM',
    code: `tenuto "5.0" {
  %% Phase 1: Global Score Configuration
  meta @{ title: "Neon Horizon", tempo: 118, time: "4/4", sidechain: "drums" }

  %% Phase 2: Instrument Definitions
  def lead "Analog Brass Lead" style=synth patch="saw_lead"
  def pad "Juno Chorus Pad" style=synth patch="warm_pad"
  def bass "Rolling Arp Bass" style=synth patch="808_sub"
  def drums "Linn 808 Kit" style=grid patch="tenuto_808_kit"

  %% Phase 3: Musical Timeline (Strictly 4 Beats / 1 Whole Note per Measure)
  measure 1 {
    lead: r:4 a4:8.f c5:8 e5:8 a5:4. |
    pad: [a3 c4 e4 g4]:1.fx(reverb, @{mix: 0.5}) |
    bass: a1:8.stacc a2:8 a1:8 a2:8 a1:8 a2:8 a1:8 a2:8 |
    drums: <[ v1: k:4 r:4 k:4 r:4 | v2: r:4 s:4 r:4 s:4 | v3: h:8 h:8 h:8 h:8 h:8 h:8 h:8 oh:8 ]>
  }

  measure 2 {
    lead: g5:8 e5:4 d5:8 c5:8 d5:4. |
    pad: [f3 a3 c4 e4]:1 |
    bass: f1:8.stacc f2:8 f1:8 f2:8 f1:8 f2:8 g1:8 g2:8 |
    drums: <[ v1: k:4 r:8 k:8 r:4 r:4 | v2: r:4 s:4 r:4 s:4 | v3: h:8 h:8 h:8 h:8 h:8 h:8 h:8 oh:8 ]>
  }

  measure 3 {
    lead: e5:4. d5:8 c5:4 a4:4 |
    pad: [c3 e3 g3 b3]:1 |
    bass: c2:8.stacc c3:8 c2:8 c3:8 c2:8 c3:8 c2:8 c3:8 |
    drums: <[ v1: k:4 r:4 k:4 r:4 | v2: r:4 s:4 r:4 s:4 | v3: h:8 h:8 h:8 h:8 h:8 h:8 h:8 h:8 ]>
  }

  measure 4 {
    lead: g4:2. r:4 |
    pad: [g2 b2 d3 f#3]:1 |
    bass: g1:8.stacc g2:8 g1:8 g2:8 g1:8 g2:8 b1:8 b2:8 |
    drums: <[ v1: k:4 k:8 r:8 k:4 r:4 | v2: r:4 s:4 r:4 s:8 s:8 | v3: h:8 h:8 h:8 h:8 h:8 h:8 oh:4 ]>
  }
}`,
  },
  {
    id: 'lofi_rain',
    title: 'Midnight Patio (Lo-Fi Groove)',
    genre: '86 BPM',
    code: `tenuto "5.0" {
  meta @{ title: "Midnight Patio", tempo: 86, time: "4/4" }

  def pno "Felt Grand Piano" style=standard patch="salamander_grand"
  def bass "Warm Sub Bass" style=synth patch="808_sub"
  def drums "Dusty Kit" style=grid patch="tenuto_808_kit"

  measure 1 {
    pno: <[ v1: r:8 a4:8.mf c5:8 e5:8 g5:4 f5:8 e5:8 | v2: [d3 f3 a3 c4]:2.fx(reverb, @{mix: 0.4}) [g2 b2 d3 f3]:2 ]>
    bass: d2:4. r:8 g1:2 |
    drums: <[ v1: k:4 r:8 k:8 r:2 | v2: r:4 s:4.pull(12ms) r:4 s:4.pull(12ms) | v3: h:8 h:8 h:8 h:8 h:8 h:8 h:8 h:8 ]>
  }

  measure 2 {
    pno: <[ v1: d5:4. c5:8 a4:2 | v2: [c3 e3 g3 b3]:2 [a2 c#3 e3 g3]:2 ]>
    bass: c2:4. g1:8 a1:2 |
    drums: <[ v1: k:4 r:8 k:8 r:2 | v2: r:4 s:4.pull(12ms) r:4 s:4.pull(12ms) | v3: h:8 h:8 h:8 h:8 h:8 h:8 h:8 oh:8 ]>
  }
}`,
  },
  {
    id: 'glass_cathedral',
    title: 'Glass Cathedral (Chamber Arpeggios)',
    genre: '108 BPM',
    code: `tenuto "5.0" {
  meta @{ title: "Glass Cathedral", tempo: 108, time: "4/4" }

  def pno "Concert Grand" style=standard patch="salamander_grand"
  def strings "Chamber Strings" style=synth patch="warm_pad"

  measure 1 {
    pno: <[ v1: c4:16 g4 c5 d5 e5 d5 c5 g4 c4:16 g4 c5 d5 e5 d5 c5 g4 | v2: [c2 c3]:1 ]>
    strings: [c4 e4 g4]:1.p |
  }

  measure 2 {
    pno: <[ v1: a3:16 e4 a4 b4 c5 b4 a4 e4 f3:16 c4 f4 g4 a4 g4 f4 c4 | v2: [a1 a2]:2 [f1 f2]:2 ]>
    strings: [a3 c4 e4]:2.p [f3 a3 c4]:2 |
  }
}`,
  },
  {
    id: 'minimal_sketch',
    title: 'Minimal Piano Sketch (Default)',
    genre: '120 BPM',
    code: 'pno: c4:4',
  },
];
