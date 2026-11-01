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
  def pad "Vintage Chorus Pad" style=synth patch="warm_pad"
  def bass "Rolling Arp Bass" style=synth patch="808_sub"
  def drums "Vintage Electronic Kit" style=grid patch="tenuto_808_kit"

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
    id: 'mahler_symphony_6_finale',
    title: 'Mahler Symphony No. 6 - Finale (The Three Hammer Blows)',
    genre: '72-136 BPM',
    code: `tenuto "5.0" {
  meta @{ title: "Mahler Symphony No. 6 - Finale (The Three Hammer Blows)", tempo: 72, time: "4/4" }

  %% =========================================================================
  %% 16-SECTION SYMPHONIC ORCHESTRA + WOODEN BOX HAMMER
  %% =========================================================================
  def ham  "Symphonic Wooden Box Hammer" style=grid     patch="timpani"
  def timp "2 Orchestral Timpanists"   style=grid     patch="timpani"
  def tpt  "6 Orchestral Trumpets"     style=standard patch="trumpet"
  def hn   "8 French Horns Section"    style=standard patch="french_horn"
  def tbn  "4 Trombones Section"       style=standard patch="trombone"
  def tba  "Contrabass Tuba"           style=standard patch="tuba"
  def fl   "Piccolo & Flutes"          style=standard patch="flute"
  def ob   "Oboes & English Horn"      style=standard patch="oboe"
  def cl   "Clarinets & Bass Clarinet" style=standard patch="clarinet"
  def harp "2 Concert Harps"           style=standard patch="orchestral_harp"
  def pno  "Celesta & Deep Chimes"     style=standard patch="acoustic_grand_piano"
  def vln1 "16 First Violins"          style=standard patch="violin"
  def vln2 "14 Second Violins"         style=standard patch="string_ensemble_1"
  def vla  "12 Violas Section"         style=standard patch="viola"
  def vc   "10 Violoncellos Section"   style=standard patch="cello"
  def cb   "8 Contrabasses Section"    style=standard patch="contrabass"

  %% =========================================================================
  %% SECTION I (Measures 1-12): Sostenuto -> The Fate Motto & March Onset
  %% =========================================================================

  %% M1-M4: Ghostly Sostenuto Awakening & Sweeping String Cadenza (72 BPM)
  measure 1 {
    meta @{ tempo: 72 }
    cb: c1:1.pp.cresc(25, 75)~ |
    vc: c2:2.pp.trem g2:2.mp.trem |
    harp: c2:8.p.ped g2:8 c3:8 eb3:8 g3:8 c4:8 eb4:8 g4:8 |
    vln1: r:2 g5:4.pp.cresc(30, 95) ab5:8.legato g5:8.legato |
    vln2: [eb4 g4]:1.pp.trem |
  }

  measure 2 {
    cb: c1:1.mp |
    vc: ab2:2.mp.legato g2:2.p.legato |
    hn: [c3 g3 eb4]:2.p.cresc(35, 95) [b2 g3 d4]:2.mf.dim(95, 40) |
    vln1: f5:4.mf.vib eb5:4.legato d5:4.legato c5:4.dim |
    fl: r:2 c6:4.p.vib b5:4.p.legato |
  }

  measure 3 {
    cb: a1:2.p.pizz e1:2.p.pizz |
    vc: a2:2.p.legato e2:2.p.legato |
    tba: a1:1.pp.cresc(25, 85) |
    tbn: [a2 c3 e3]:1.pp.cresc(25, 85) |
    vla: a3:4.p.legato b3:4.legato c4:4.mp.legato d4:4.legato |
  }

  measure 4 {
    cb: a1:1.f.trem |
    vc: a2:1.f.trem |
    timp: k:1.mp.roll(8).cresc(45, 115) |
    hn: [a3 c#4 e4]:2.ff.fp [a3 c4 e4]:2.p.cresc(40, 115) |
    tpt: [a4 c#5 e5]:2.ff.fp [a4 c5 e5]:2.p.cresc(40, 115) |
    vln1: e5:2.f.trem a5:2.ff.trem |
  }

  %% M5-M12: Allegro Energico — Fate Motto & Relentless Tragic March (124 BPM)
  measure 5 {
    meta @{ tempo: 124 }
    timp: k:4.ff k:8.ff k:8.ff (k:8.ff k:8 k:8):3/2 k:4.ff |
    tpt: [a4 c#5 e5]:2.ff [a4 c5 e5]:2.f |
    hn: [a3 c#4 e4]:2.ff [a3 c4 e4]:2.f |
    tbn: [a2 e3 a3]:2.ff [a2 e3 a3]:2.f |
    cb: a1:4.ff.marc a1:4.marc a1:4.marc a1:4.marc |
    vc: a2:4.ff.marc a2:4.marc a2:4.marc a2:4.marc |
    vln1: a5:4.ff.marc e5:8.f.stacc a5:8.stacc c6:4.ff.marc b5:8.f.legato a5:8.legato |
  }

  measure 6 {
    timp: k:4.ff k:8.ff k:8.ff (k:8.ff k:8 k:8):3/2 k:4.ff |
    cb: g1:4.f.marc f1:4.marc e1:4.marc a1:4.marc |
    vc: g2:4.f.marc f2:4.marc e2:4.marc a2:4.marc |
    vln1: g5:4.f.marc f5:4.marc e5:4.marc a4:4.f.vib |
    vln2: [b3 d4]:4.f.marc [a3 c4]:4.marc [g#3 b3]:4.marc [a3 c4]:4.marc |
    ob: g5:4.f.marc f5:4.marc e5:4.marc a4:4 |
  }

  measure 7 {
    cb: d1:4.f.marc e1:4.marc f1:4.marc g1:4.marc |
    vc: d2:4.f.marc e2:4.marc f2:4.marc g2:4.marc |
    hn: d4:4.f.marc e4:4.marc f4:4.ff.marc g4:4.marc |
    vln1: d5:8.f.legato e5:8.legato f5:4.ff.marc e5:8.f.legato f5:8.legato g5:4.ff.marc |
    vla: d4:4.f.marc c4:4.marc b3:4.marc bb3:4.marc |
  }

  measure 8 {
    cb: a1:4.ff.marc e1:4.marc a1:2.ff |
    vc: a2:4.ff.marc e2:4.marc a2:2.ff |
    tpt: a4:4.ff.marc b4:4.marc c5:2.ff.vib |
    tbn: [a2 e3 a3]:2.ff.marc [e2 b2 g#3]:2.ff |
    vln1: a5:4.ff.marc g#5:4.marc a5:2.ff.vib |
    timp: k:4.ff k:4.ff k:2.ff.roll(8) |
  }

  measure 9 {
    cb: c2:4.f.stacc g1:4.stacc c2:4.stacc d2:4.stacc |
    vc: c3:4.f.stacc g2:4.stacc c3:4.stacc d3:4.stacc |
    vln1: e5:4.f.marc d5:8.legato c5:8.legato g5:4.ff.marc f5:8.legato e5:8.legato |
    fl: e6:4.f.marc d6:8.legato c6:8.legato g6:4.ff.marc f6:8.legato e6:8.legato |
    cl: c5:4.mf.stacc g4:4.stacc c5:4.stacc b4:4.stacc |
  }

  measure 10 {
    cb: e2:4.f.stacc b1:4.stacc c2:4.stacc a1:4.stacc |
    vc: e3:4.f.stacc b2:4.stacc c3:4.stacc a2:4.stacc |
    vln1: a5:4.ff.marc g5:8.legato f5:8.legato e5:4.f.marc d5:4.marc |
    hn: [c4 g4]:2.f.marc [b3 g4]:2.f.marc |
  }

  measure 11 {
    cb: f1:2.ff.trem d1:2.ff.trem |
    vc: f2:2.ff.trem d2:2.ff.trem |
    tbn: [f2 c3 a3]:2.ff [d2 a2 f3]:2.ff |
    tba: f1:2.ff d1:2.ff |
    vln1: c6:2.ff.vib b5:4.ff.legato a5:4.legato |
    tpt: c5:2.ff.marc d5:2.ff.marc |
  }

  measure 12 {
    cb: e1:2.ff.trem e1:2.ff.marc |
    vc: e2:2.ff.trem e2:2.ff.marc |
    timp: k:2.ff.roll(8) k:4.ff.marc r:4 |
    hn: [e3 b3 g#4]:1.ff.cresc(90, 125) |
    tpt: e5:2.ff.vib e5:4.ff.marc r:4 |
    vln1: g#5:2.ff.trem e5:4.ff.marc r:4 |
  }

  %% =========================================================================
  %% SECTION II (Measures 13-20): The Alma Theme & First Hammer Blow (M19)
  %% =========================================================================

  measure 13 {
    cb: f1:1.f.legato |
    vc: f2:2.f.legato c3:2.f.legato |
    harp: f2:8.mf.ped c3:8 f3:8 a3:8 c4:8 f4:8 a4:8 c5:8 |
    vln1: a5:4.ff.vib c6:4.legato f6:4.ff.vib e6:8.legato d6:8.legato |
    vln2: a4:4.f.legato c5:4.legato f5:4.f.vib e5:8.legato d5:8.legato |
    hn: f4:2.f.vib a4:2.f.legato |
  }

  measure 14 {
    cb: c1:1.f.legato |
    vc: g2:2.f.legato c3:2.f.legato |
    harp: c2:8.mf.ped g2:8 c3:8 e3:8 g3:8 c4:8 e4:8 g4:8 |
    vln1: c6:2.ff.vib g5:4.f.legato a5:4.legato |
    fl: c6:2.f.vib g5:4.f.legato a5:4.legato |
    hn: g4:2.f.vib e4:2.f.legato |
  }

  measure 15 {
    cb: d1:2.f.legato bb0:2.f.legato |
    vc: d2:2.f.legato bb1:2.f.legato |
    vln1: bb5:4.ff.vib a5:8.legato g5:8.legato f5:4.f.vib g5:4.legato |
    ob: bb5:4.f.vib a5:8.legato g5:8.legato f5:4.f.vib g5:4.legato |
    vla: [f3 d4]:2.f [f3 d4]:2.f |
  }

  measure 16 {
    cb: c1:1.ff.cresc(85, 120) |
    vc: c2:2.f.legato e2:2.ff.legato |
    hn: [c4 g4 c5]:1.ff.cresc(85, 122) |
    tpt: g4:2.f.cresc(80, 120) c5:2.ff.vib |
    vln1: a5:2.ff.vib g5:2.ff.cresc(90, 124) |
  }

  measure 17 {
    cb: f1:2.ff.trem d1:2.ff.trem |
    vc: f2:2.ff.trem d2:2.ff.trem |
    timp: k:2.ff.roll(8) k:2.ff.roll(8) |
    tpt: [f4 a4 c5]:2.ff [f#4 a4 d5]:2.ff |
    tbn: [f2 c3 a3]:2.ff [f#2 d3 a3]:2.ff |
    vln1: f6:2.ff.trem d6:2.ff.trem |
  }

  measure 18 {
    cb: g1:2.ff.trem g#1:2.ff.trem |
    vc: g2:2.ff.trem g#2:2.ff.trem |
    timp: k:1.ff.roll(16).cresc(95, 127) |
    hn: [g3 d4 g4]:2.ff [g#3 d4 f4]:2.ff.cresc(100, 127) |
    tpt: d5:2.ff.marc e5:2.ff.cresc(105, 127) |
    vln1: g6:2.ff.trem g#6:2.ff.trem |
  }

  %% M19: THE FIRST HAMMER BLOW
  measure 19 {
    ham: k:2.ff.marc r:2 |
    timp: k:2.ff.marc k:2.ff.roll(8) |
    cb: a1:2.ff.marc a1:2.ff.trem |
    vc: a2:2.ff.marc a2:2.ff.trem |
    tba: a0:2.ff.marc a1:2.ff |
    tbn: [a1 e2 a2 c3]:2.ff.marc [a2 c3 e3]:2.ff |
    hn: [a3 c4 e4 a4]:1.ff |
    tpt: [a4 c5 e5 a5]:2.ff.marc [a4 c5 e5]:2.f |
    vln1: a6:2.ff.marc c6:2.ff.trem |
    vln2: [a4 e5]:2.ff.marc [a4 e5]:2.ff.trem |
  }

  measure 20 {
    timp: k:4.ff k:8.ff k:8.ff (k:8.ff k:8 k:8):3/2 k:4.ff |
    tpt: [a4 c#5 e5]:2.ff.fp [a4 c5 e5]:2.dim(95, 35) |
    hn: [a3 c#4 e4]:2.ff.fp [a3 c4 e4]:2.dim(95, 35) |
    cb: a1:1.f.dim(95, 30) |
    vc: a2:1.f.dim(95, 30) |
  }

  %% =========================================================================
  %% SECTION III (Measures 21-28): Alpine Grazing Episode & Polyphonic Storm
  %% =========================================================================

  measure 21 {
    meta @{ tempo: 64 }
    pno: [c5 g5]:4.p.ped [d5 a5]:4.p.ped [e5 b5]:2.pp.ped |
    harp: f3:8.p.ped c4:8 f4:8 a4:8 c5:8 a4:8 f4:8 c4:8 |
    fl: a5:2.p.vib g5:4.p.legato f5:4.legato |
    ob: r:2 c5:4.p.vib d5:4.p.legato |
    vln1: [f4 a4]:1.pp |
  }

  measure 22 {
    pno: [f5 c6]:4.pp.ped r:4 [e5 g5]:2.pp.ped |
    harp: c3:8.p.ped g3:8 c4:8 e4:8 g4:8 e4:8 c4:8 g3:8 |
    ob: e5:2.p.vib d5:4.p.legato c5:4.legato |
    cl: g4:2.p.legato a4:2.p.legato |
    vc: f2:2.pp.legato c2:2.pp.legato |
  }

  measure 23 {
    pno: [d5 a5]:4.p.ped [g4 d5]:4.pp.ped r:2 |
    hn: c4:2.p.vib d4:4.p.legato e4:4.legato |
    vln1: f5:4.p.vib e5:8.legato d5:8.legato c5:2.p.vib |
    vla: a3:2.p.legato g3:2.p.legato |
  }

  measure 24 {
    hn: f4:2.mp.vib e4:2.p.dim(65, 25) |
    vln1: d5:2.p.legato c5:2.pp.dim(55, 25) |
    vc: bb1:2.p.legato c2:2.pp |
    cb: c1:1.pp |
  }

  measure 25 {
    cb: d1:4.mp.marc f1:4.marc a1:4.f.marc d2:4.marc |
    vc: d2:4.mp.marc f2:4.marc a2:4.f.marc d3:4.marc |
    vla: d3:4.mp.marc f3:4.marc a3:4.f.marc d4:4.marc |
    vln2: r:2 d4:4.f.marc f4:4.marc |
  }

  measure 26 {
    cb: c#1:4.f.marc e1:4.marc g1:4.marc bb1:4.marc |
    vc: c#2:4.f.marc e2:4.marc g2:4.marc bb2:4.marc |
    vla: e4:4.f.marc a3:4.legato bb3:2.f.legato |
    vln1: a4:4.f.marc c#5:4.marc e5:4.ff.marc g5:4.marc |
    ob: a4:2.f.legato bb4:2.f.legato |
  }

  measure 27 {
    cb: d1:4.ff.marc f1:4.marc a1:4.marc d2:4.marc |
    vc: d2:4.ff.marc f2:4.marc a2:4.marc d3:4.marc |
    hn: [d3 a3 d4]:2.ff.marc [e3 b3 e4]:2.ff.marc |
    vln1: f5:8.ff.legato g5:8.legato a5:4.ff.marcbb5:8.legato a5:8.legato g5:4.ff.marc |
  }

  measure 28 {
    cb: a1:2.ff.trem e1:2.ff.trem |
    vc: a2:2.ff.trem e2:2.ff.trem |
    timp: k:1.ff.roll(8) |
    tpt: [a4 c#5 e5]:2.ff [b4 d5 g#5]:2.ff |
    vln1: a5:2.ff.trem b5:2.ff.trem |
  }

  %% =========================================================================
  %% SECTION IV (Measures 29-40): Scherzando Storm & Second Hammer Blow (M37)
  %% =========================================================================

  measure 29 {
    meta @{ tempo: 128 }
    cb: a1:4.ff.marc r:4 e1:4.ff.marc r:4 |
    vc: a2:8.ff.stacc b2:8.stacc c3:8.stacc d3:8.stacc e3:4.ff.marc a2:4.marc |
    vln1: c6:4.ff.marc b5:8.stacc a5:8.stacc e6:4.ff.marc c6:4.marc |
    fl: c6:4.ff.marc b5:8.stacc a5:8.stacc e6:4.ff.marc c6:4.marc |
    hn: [a3 e4]:4.ff.marc r:4 [a3 e4]:4.ff.marc r:4 |
  }

  measure 30 {
    cb: f1:4.ff.marc r:4 c1:4.ff.marc r:4 |
    vc: f2:8.ff.stacc g2:8.stacc a2:8.stacc b2:8.stacc c3:4.ff.marc f2:4.marc |
    vln1: d6:4.ff.marc c6:8.stacc b5:8.stacc a5:4.ff.marc f5:4.marc |
    ob: d6:4.ff.marc c6:8.stacc b5:8.stacc a5:4.ff.marc f5:4.marc |
  }

  measure 31 {
    cb: d1:4.ff.marc e1:4.marc f1:4.marc g1:4.marc |
    vc: d2:4.ff.marc e2:4.marc f2:4.marc g2:4.marc |
    tbn: [d2 a2 d3]:2.ff [g2 d3 g3]:2.ff |
    tpt: d5:4.ff.marc e5:4.marc f5:4.ff.marc g5:4.marc |
    vln1: (d5:8.ff e5:8 f5:8):3/2 (g5:8.ff a5:8 b5:8):3/2 c6:4.ff.marc d6:4.ff.marc |
  }

  measure 32 {
    cb: c1:2.ff.marc g1:2.ff.marc |
    vc: c2:2.ff.marc g2:2.ff.marc |
    tpt: e5:2.ff.vib d5:2.ff.marc |
    hn: [c4 g4 c5]:2.ff [b3 g4 d5]:2.ff |
    vln1: e6:2.ff.vib d6:2.ff.marc |
  }

  measure 33 {
    cb: eb1:2.ff.trem bb0:2.ff.trem |
    vc: eb2:2.ff.trem bb1:2.ff.trem |
    timp: k:2.ff.marc k:2.ff.roll(8) |
    tbn: [eb2 bb2 g3]:2.ff [bb1 f2 d3]:2.ff |
    vln1: eb6:4.ff.marc d6:8.legato c6:8.legato bb5:2.ff.vib |
  }

  measure 34 {
    cb: ab1:2.ff.trem eb1:2.ff.trem |
    vc: ab2:2.ff.trem eb2:2.ff.trem |
    hn: [ab3 eb4 ab4]:2.ff [g3 eb4 bb4]:2.ff |
    vln1: c6:4.ff.marc bb5:8.legato ab5:8.legato g5:2.ff.vib |
    fl: c6:4.ff.marc bb5:8.legato ab5:8.legato g5:2.ff.vib |
  }

  measure 35 {
    cb: f1:2.ff.trem f#1:2.ff.trem |
    vc: f2:2.ff.trem f#2:2.ff.trem |
    tba: f1:2.ff f#1:2.ff |
    tbn: [f2 c3 ab3]:2.ff [f#2 c3 a3]:2.ff |
    vln1: ab5:2.ff.trem a5:2.ff.trem |
    tpt: f5:2.ff.marc f#5:2.ff.marc |
  }

  measure 36 {
    cb: g1:2.ff.trem g#1:2.ff.trem |
    vc: g2:2.ff.trem g#2:2.ff.trem |
    timp: k:1.ff.roll(16).cresc(100, 127) |
    hn: [g3 d4 b4]:2.ff [g#3 e4 b4]:2.ff.cresc(105, 127) |
    tpt: g5:2.ff.marc g#5:2.ff.cresc(105, 127) |
    vln1: b5:2.ff.trem e6:2.ff.trem |
  }

  %% M37: THE SECOND HAMMER BLOW
  measure 37 {
    ham: k:2.ff.marc r:2 |
    timp: k:2.ff.marc k:2.ff.roll(8) |
    cb: d1:2.ff.marc d1:2.ff.trem |
    vc: d2:2.ff.marc d2:2.ff.trem |
    tba: d1:2.ff.marc d1:2.ff |
    tbn: [d2 a2 d3 f3]:2.ff.marc [d2 a2 d3]:2.ff |
    hn: [d3 a3 d4 f4]:1.ff |
    tpt: [d4 a4 d5 f5]:2.ff.marc [d4 a4 d5]:2.f |
    vln1: d6:2.ff.marc a5:2.ff.trem |
    vln2: [d4 a4]:2.ff.marc [d4 a4]:2.ff.trem |
  }

  measure 38 {
    timp: k:4.ff k:8.ff k:8.ff (k:8.ff k:8 k:8):3/2 k:4.ff |
    tpt: [d4 f#4 a4]:2.ff.fp [d4 f4 a4]:2.f |
    hn: [d3 f#3 a3]:2.ff.fp [d3 f3 a3]:2.f |
    cb: d1:1.f.trem |
    vc: d2:1.f.trem |
  }

  measure 39 {
    cb: bb0:2.f.legato a0:2.f.legato |
    vc: bb1:2.f.legato a1:2.f.legato |
    tbn: [bb1 f2 d3]:2.f [a1 e2 c#3]:2.f |
    vla: bb3:2.f.legato a3:2.f.legato |
  }

  measure 40 {
    cb: d1:1.mp.dim(75, 30) |
    vc: d2:1.mp.dim(75, 30) |
    hn: [d3 a3]:1.mp.dim(75, 30) |
    cl: f4:2.p.legato e4:2.pp.legato |
  }

  %% =========================================================================
  %% SECTION V (Measures 41-52): Transfigured Chorale & Third Hammer Blow (M49)
  %% =========================================================================

  measure 41 {
    meta @{ tempo: 66 }
    hn: [a3 c#4 e4]:2.p.legato [b3 d4 f#4]:2.mp.legato |
    tbn: [a2 e3]:2.p [d2 a2]:2.mp |
    cl: a4:2.p.legato b4:2.mp.legato |
    vc: a1:2.p.legato d2:2.mp.legato |
  }

  measure 42 {
    hn: [c#4 e4 a4]:2.mf.legato [b3 e4 g#4]:2.f.legato |
    tpt: c#5:2.mp.vib b4:2.mf.legato |
    vln1: a5:2.mp.vib g#5:2.mf.legato |
    harp: a2:8.p.ped e3:8 a3:8 c#4:8 e4:8 a4:8 c#5:8 e5:8 |
  }

  measure 43 {
    hn: [a3 c#4 e4 a4]:1.f.cresc(80, 115) |
    tpt: a4:2.f.vib c#5:2.ff.vib |
    vln1: a5:4.f.vib b5:4.legato c#6:2.ff.vib |
    vc: a2:2.f.legato f#2:2.f.legato |
    cb: a1:2.f f#1:2.f |
  }

  measure 44 {
    cb: d1:2.ff e1:2.ff |
    vc: d2:2.ff e2:2.ff |
    tbn: [d2 a2 f#3]:2.ff [e2 b2 g#3]:2.ff |
    vln1: d6:2.ff.vib e6:2.ff.cresc(95, 125) |
    timp: k:2.f k:2.ff.roll(8) |
  }

  %% M45-M48: Final Desperate Surge (136 BPM)
  measure 45 {
    meta @{ tempo: 136 }
    cb: a1:4.ff.marc b1:4.marc c2:4.marc d2:4.marc |
    vc: a2:4.ff.marc b2:4.marc c3:4.marc d3:4.marc |
    vln1: a5:8.ff.legato b5:8.legato c6:8.legato d6:8.legato e6:4.ff.marc a6:4.ff.marc |
    tpt: a4:4.ff.marc b4:4.marc c5:4.ff.marc d5:4.marc |
    hn: [a3 e4]:2.ff [a3 f4]:2.ff |
  }

  measure 46 {
    cb: e2:4.ff.marc c2:4.marc a1:4.marc e1:4.marc |
    vc: e3:4.ff.marc c3:4.marc a2:4.marc e2:4.marc |
    vln1: g#6:4.ff.marc e6:4.marc c6:4.ff.marc a5:4.marc |
    fl: g#6:4.ff.marc e6:4.marc c6:4.ff.marc a5:4.marc |
    tbn: [e2 b2 g#3]:2.ff [a2 e3 c4]:2.ff |
  }

  measure 47 {
    cb: f1:2.ff.trem d1:2.ff.trem |
    vc: f2:2.ff.trem d2:2.ff.trem |
    timp: k:2.ff.roll(8) k:2.ff.roll(8) |
    tpt: [f4 c5 f5]:2.ff [d4 a4 f5]:2.ff |
    vln1: f6:2.ff.trem d6:2.ff.trem |
  }

  measure 48 {
    cb: e1:1.ff.trem.cresc(105, 127) |
    vc: e2:1.ff.trem.cresc(105, 127) |
    timp: k:1.ff.roll(16).cresc(105, 127) |
    hn: [e3 b3 g#4]:1.ff.cresc(105, 127) |
    tpt: [e4 b4 e5 g#5]:1.ff.cresc(105, 127) |
    vln1: g#6:1.ff.trem.cresc(105, 127) |
  }

  %% M49: THE THIRD HAMMER BLOW (Catastrophic Collapse)
  measure 49 {
    ham: k:2.ff.marc r:2 |
    timp: k:2.ff.marc k:2.ff.roll(8) |
    cb: a0:2.ff.marc a1:2.ff.trem |
    vc: a1:2.ff.marc a2:2.ff.trem |
    tba: a0:2.ff.marc a1:2.ff |
    tbn: [a1 e2 a2 c3]:2.ff.marc [a1 e2 a2 c3]:2.ff |
    hn: [a3 c4 e4 a4]:1.ff |
    tpt: [a4 c5 e5 a5]:2.ff.marc [a4 c5 e5]:2.ff |
    vln1: a6:2.ff.marc e6:2.ff.trem |
    vln2: [a4 c5 e5]:2.ff.marc [a4 c5 e5]:2.ff.trem |
  }

  measure 50 {
    timp: k:4.ff k:8.ff k:8.ff (k:8.ff k:8 k:8):3/2 k:4.ff |
    tpt: [a4 c5 e5]:1.ff.dim(115, 65) |
    hn: [a3 c4 e4]:1.ff.dim(115, 65) |
    tbn: [a2 c3 e3]:1.ff.dim(115, 65) |
    cb: a1:1.ff.trem |
    vc: a2:1.ff.trem |
  }

  measure 51 {
    cb: f1:2.f.legato e1:2.f.legato |
    vc: f2:2.f.legato e2:2.f.legato |
    tbn: [f2 a2 d3]:2.f [e2 g#2 b2]:2.f |
    vln1: f5:2.f.legato e5:2.f.legato |
    vla: d4:2.f.legato b3:2.f.legato |
  }

  measure 52 {
    cb: a0:1.f.dim(80, 30) |
    vc: a1:1.f.dim(80, 30) |
    tba: a0:1.f.dim(80, 30) |
    timp: k:4.mf k:8.mp k:8.p r:2 |
  }

  %% =========================================================================
  %% SECTION VI (Measures 53-60): Morendo Trombone Dirge & Final Strike (M60)
  %% =========================================================================

  measure 53 {
    meta @{ tempo: 58 }
    tbn: a2:2.p.legato c3:4.p.legato b2:4.legato |
    tba: a1:2.p.legato e1:2.p.legato |
    cb: a0:1.pp |
    vc: a1:2.pp.legato e2:2.pp.legato |
  }

  measure 54 {
    tbn: a2:2.p.legato g2:4.pp.legato f2:4.legato |
    tba: f1:2.pp.legato d1:2.pp.legato |
    hn: [a3 c4]:2.pp [f3 a3]:2.pp |
    vc: f2:2.pp.legato d2:2.pp.legato |
  }

  measure 55 {
    tbn: e2:2.pp.legato a2:2.pp.dim(45, 22) |
    tba: e1:2.pp a0:2.pp |
    cb: e1:2.pp a0:2.pp |
    vc: e2:2.pp a1:2.pp |
  }

  measure 56 {
    cl: c4:2.pp.legato b3:2.pp.legato |
    ob: e4:2.pp.legato d4:2.pp.legato |
    vc: a1:1.pp |
    cb: a0:1.pp |
  }

  measure 57 {
    hn: [a2 e3 a3]:1.pp.dim(40, 20) |
    vla: [a3 c4]:1.pp |
    vc: [a1 e2]:1.pp |
    cb: a0:1.pp |
  }

  measure 58 {
    timp: k:4.pp r:8 k:8.pp r:2 |
    vc: a1:4.pp.pizz r:4 r:2 |
    cb: a0:4.pp.pizz r:4 r:2 |
  }

  measure 59 {
    vc: a1:2.pp.dim(35, 15) r:2 |
    cb: a0:2.pp.dim(35, 15) r:2 |
    pno: a1:2.pp.ped r:2 |
  }

  %% M60: FINAL SHATTERING A-MINOR COFFIN-LID STRIKE
  measure 60 {
    ham: k:4.ff.marc r:4 r:2 |
    timp: k:4.ff.marc r:4 r:2 |
    tpt: [a4 c5 e5 a5]:4.ff.stacc r:4 r:2 |
    hn: [a3 c4 e4 a4]:4.ff.stacc r:4 r:2 |
    tbn: [a2 c3 e3 a3]:4.ff.stacc r:4 r:2 |
    tba: a0:4.ff.stacc r:4 r:2 |
    pno: a0:1.ff.ped |
    vln1: [a4 e5 a5]:4.ff.pizz r:4 r:2 |
    vln2: [a3 e4 a4]:4.ff.pizz r:4 r:2 |
    vla: [a3 c4 e4]:4.ff.pizz r:4 r:2 |
    vc: [a1 e2 a2]:4.ff.pizz r:4 r:2 |
    cb: a0:4.ff.pizz r:4 r:2 |
  }
}`,
  },
  {
    id: 'voltage_and_gesture',
    title: 'Architecture of Voltage & Gesture (Synth Research Suite)',
    genre: '118 BPM',
    code: `tenuto "6.0" {
  meta @{
    title: "Architecture of Voltage & Gesture",
    tempo: 118,
    time: "4/4",
    key: "C",
    scale: "minor",
    temperament: "12tet",
    master_tune: -18,
    sidechain: "drums"
  }

  def seq   "Analog Step Sequencer"     style=synth patch="pluck_lead" cutoff=3400
  def plan  "Parallel Chord Planing"    style=synth patch="flutter_pad" cutoff=2800
  def haunt "Tape Nostalgia Pad"        style=synth patch="tape_nostalgia_pad" .fx(tape_degrade, @{ wow_hz: 0.42, flutter_hz: 9.5, high_cut: 5200, drive: 0.3 })
  def swarm "8-Oscillator Ribbon Drone" style=synth patch="ribbon_cluster_8"
  def krell "West Coast Wavefolder"     style=synth patch="cybernetic_eoc"
  def drums "Gated Drum Kit"            style=grid  patch="tenuto_808_kit" .fx(gated_reverb, @{ decay: 3.2, gate_ms: 160, mix: 0.55 })

  %% M1: Step Ratcheting + Minor 9th Rootless Planing over Static C Bass
  measure 1 {
    seq:   c2:8 c3:8 c2:8 c3:8.ratchet(2, "flat") c2:8 c3:8 c2:8 c3:8.ratchet(3, "up") |
    plan:  b3:2.plane("m9").rootless d4:2.plane("m9").rootless |
    haunt: [c4 eb4 g4 bb4]:1.p.vowel("oh", "ooh", 0.2).wow_flutter(5, 0.42, 2.5, 9.5) |
    drums: <[ v1: k:4 r:4 k:4 r:4 | v2: r:4 s:4 r:4 s:4 | v3: h:8 h:8 h:8.ratchet(2, "up") h:8 h:8 h:8 h:8.ratchet(4, "up") oh:8 ]>
  }

  %% M2: 8-Oscillator Ribbon Cluster + Autonomous EOC Envelope + 3D MPE Pressure Squeeze
  measure 2 {
    seq:   c2:8 c3:8 c2:8 c3:8 c2:8 c3:8 c2:8 c3:8.ratchet(4, "down") |
    plan:  e4:2.plane("quartal") f#4:2.plane("m9").rootless.neg_harm |
    haunt: [c4 g4 bb4 d5]:1.mp.squeeze(90%).bend_voice(1, 50c, 0.2..0.8) |
    swarm: c2:1.p.swarm([0.2, 3.2, 0.4]) |
    krell: g4:1.mp.eoc_cycle(5).fold(75%) |
    drums: <[ v1: k:4 r:4 k:4 r:4 | v2: r:4 s:4 r:4 s:4 ]>
  }
}`,
  },
  {
    id: 'voltage_and_gesture_study',
    title: 'Architecture of Voltage and Gesture (4-Voice Synth Study)',
    genre: '72 BPM',
    code: `tenuto "6.0" {
  meta @{
    title: "Architecture of Voltage and Gesture (4-Voice Synth Study)",
    tempo: 72,
    time: "4/4",
    key: "E",
    scale: "major",
    scale_lock: false,
    quantize_launch: "1/1"
  }

  return hall_bus "Macro-Time Shimmer Space"
    .fx(hybrid_reverb, @{mode: "parallel", algorithm: "shimmer", decay: 5.8, predelay: 32, mix: 1.0})
    .fx(glue_compressor, @{threshold: -15, ratio: 2.0, mix: 0.85})

  return bbd_bus "Analog Bucket-Brigade Delay"
    .fx(echo, @{time: 0.375, feedback: 0.48, stereo_mode: "ping_pong", mix: 1.0})
    .fx(chorus, @{rate: 0.36, amount: 0.38, mix: 0.48})

  %% VOICE 1: MPE Soloist & Formant Lead (3D Pressure & Ribbon Gesture)
  def lead "MPE Soloist Lead" style=synth patch="saw_lead"
    group="four_voice_bus" vol=88 detune=62 cutoff=3400 resonance=1.2 sub=20 air=38 width=130 slop=28
    env=@{attack: 0.14, decay: 1.3, sustain: 0.90, release: 1.6}
    sends=@{hall_bus: 0.68, bbd_bus: 0.52}
    .fx(chorus, @{rate: 0.42, amount: 0.36, mix: 0.44})
    .fx(glue_compressor, @{threshold: -15, ratio: 2.5, mix: 0.85})

  %% VOICE 2: Open-Voiced Planing & Tape Nostalgia Pad (Spectral Inverse Proportionality)
  def pad "Open-Voiced Planing Pad" style=synth patch="flutter_pad"
    group="four_voice_bus" vol=84 detune=64 cutoff=2800 resonance=1.05 sub=20 air=32 width=152 slop=34
    env=@{attack: 0.28, decay: 1.5, sustain: 0.92, release: 1.8}
    sends=@{hall_bus: 0.72, bbd_bus: 0.38}
    .fx(phaser, @{rate: 0.18, depth: 0.42, mix: 0.35})

  %% VOICE 3: West Coast Wavefolder Ostinato (Wavefolder + Ratchet Engine)
  def buchla "West Coast Wavefolder Arp" style=synth patch="pluck_lead"
    group="four_voice_bus" vol=80 detune=48 cutoff=3200 resonance=1.18 sub=15 air=36 width=138 slop=20
    env=@{attack: 0.015, decay: 0.65, sustain: 0.55, release: 0.95}
    sends=@{hall_bus: 0.52, bbd_bus: 0.66}
    .fx(chorus, @{rate: 0.35, amount: 0.34, mix: 0.38})

  %% VOICE 4: Ladder & Reese Sub-Bass Foundation (Fundamental Anchor & Harmonic Gravity)
  def bass "Reese Sub Anchor" style=synth patch="reese_bass"
    group="four_voice_bus" vol=90 detune=54 cutoff=980 resonance=1.22 sub=92 air=14 width=112 slop=16
    env=@{attack: 0.04, decay: 0.95, sustain: 0.88, release: 1.2}
    sends=@{hall_bus: 0.24, bbd_bus: 0.18}
    .fx(saturator, @{drive: 7.5, curve: "warm_tube", mix: 0.78})

  group four_voice_bus "Four-Voice Synth Ensemble" tracks=[lead, pad, buchla, bass]
    .fx(glue_compressor, @{threshold: -14, ratio: 2.0, mix: 0.80})

  %% =========================================================================
  %% SECTION I (Measures 1-8): E Aeolian Hauntology -> E Major Sunrise
  %% =========================================================================

  locator "I. Hauntological Dusk to Sunrise" at measure 1

  measure 1 {
    lead: e4:2.mp.legato.pre_swell.wow_flutter(24, 14).filter(900, 2600) g4:4.mp.legato f#4:4.mp.glide(160ms) |
    pad: [e3 g3 b3 d4]:1.p.legato.open_voice.wow_flutter(26, 16).filter(650, 1850) |
    buchla: e3:8.p.fold([1.0, 2.2]) b3:8 g4:8 e4:8.ratchet(2) b3:8 g4:8 f#4:8 b3:8 |
    bass: e1:1.mp.legato.filter(220, 620).drive([0.15, 0.45]) |
  }

  measure 2 {
    lead: b4:2.mp.legato.vib.filter(1200, 2900) a4:4.mp.legato g4:4.mp.glide(180ms) |
    pad: [c3 g3 b3 e4]:1.p.legato.open_voice.wow_flutter(24, 14).filter(700, 1950) |
    buchla: c3:8.p.fold([1.1, 2.4]) g3:8 e4:8 c4:8.ratchet(3) g3:8 e4:8 d4:8 g3:8 |
    bass: c1:2.mp.legato.filter(240, 660) d1:2.mp.legato.glide(160ms) |
  }

  measure 3 {
    lead: f#4:2.mp.legato.cresc(64, 92).filter(1100, 3200) a4:4.mf.legato b4:4.mf.glide(190ms) |
    pad: [a2 e3 g3 b3]:2.mp.legato.open_voice [b2 f#3 a3 d4]:2.mp.legato.open_voice.cresc(62, 90) |
    buchla: a2:8.mp.fold([1.2, 2.8]) e3:8 b3:8 g3:8 b2:8 f#3:8 d4:8.ratchet(2) a3:8 |
    bass: a0:2.mp.legato.filter(250, 720) b0:2.mf.legato.glide(170ms) |
  }

  measure 4 {
    lead: g#4:2.f.legato.vib.detune([20, 78, 32]).filter(1600, 4400) b4:2.f.legato.vib |
    pad: [e3 g#3 b3 f#4]:1.mf.legato.open_voice.bend_voice(1, -1, 1).filter(950, 3100) |
    buchla: e3:8.mf.fold([1.4, 3.2]) b3:8 g#4:8 e4:8.ratchet(3) b3:8 g#4:8 f#4:8 b3:8 |
    bass: e1:1.f.legato.filter(320, 920).drive([0.25, 0.62]) |
  }

  measure 5 {
    lead: e5:2.mf.legato.wow_flutter(18, 12).vowel(["a", "o", "u"]) d5:4.mf.legato b4:4.mf.glide(170ms) |
    pad: [e3 g3 b3 d4]:1.mp.legato.open_voice.filter(800, 2200) |
    buchla: e3:8.mp.fold([1.2, 2.5]) b3:8 g4:8 d4:8.ratchet(2) b3:8 g4:8 e4:8 b3:8 |
    bass: e1:2.mp.legato.filter(260, 680) d1:2.mp.legato |
  }

  measure 6 {
    lead: c5:2.mf.legato.vib.filter(1300, 3100) b4:4.mf.legato a4:4.mf.glide(175ms) |
    pad: [c3 g3 b3 e4]:2.mp.legato.open_voice [a2 e3 g3 c4]:2.mp.legato.open_voice |
    buchla: c3:8.mp.fold([1.1, 2.6]) g3:8 e4:8 b3:8 a2:8 e3:8 c4:8.ratchet(3) g3:8 |
    bass: c1:2.mp.legato a0:2.mp.legato.glide(160ms) |
  }

  measure 7 {
    lead: f#4:2.mf.legato.cresc(70, 102).filter(1400, 3800) b4:4.f.legato d#5:4.f.glide(200ms) |
    pad: [f#3 a3 c#4 e4]:2.mf.legato.open_voice [b2 f#3 a3 d#4]:2.f.legato.open_voice.cresc(72, 102) |
    buchla: f#3:8.mf.fold([1.5, 3.4]) c#4:8 a4:8 e4:8 b2:8 f#3:8 d#4:8.ratchet(4) a3:8 |
    bass: f#1:2.mf.legato.filter(280, 780) b0:2.f.legato.glide(180ms) |
  }

  measure 8 {
    lead: e5:1.f.legato.vib.detune([25, 84, 30]).filter(1800, 4800) |
    pad: [e3 g#3 b3 d#4]:1.f.legato.open_voice.bend_voice(1, -1, 1).filter(1100, 3400) |
    buchla: e3:8.mf.fold([1.3, 3.0]) b3:8 g#4:8 d#4:8.ratchet(2) b3:8 g#4:8 e4:8 b3:8 |
    bass: e1:1.f.legato.filter(350, 960).drive([0.28, 0.68]) |
  }

  %% =========================================================================
  %% SECTION II (Measures 9-16): C# Dorian Chromatic Planing -> C# Major Lift
  %% =========================================================================

  locator "II. Chromatic Planing & Formant Gesture" at measure 9

  measure 9 {
    lead: c#5:2.mf.legato.vowel(["i", "e", "a"]).filter(1400, 3400) e5:4.mf.legato b4:4.mf.glide(165ms) |
    pad: [c#3 e3 g#3 b3]:2.mp.legato.open_voice [d#3 f#3 a#3 c#4]:2.mp.legato.open_voice |
    buchla: c#3:8.mp.warp_wave("bend", [0.2, 0.72]) g#3:8 e4:8 b3:8.ratchet(2) d#3:8 a#3:8 f#4:8 c#4:8 |
    bass: c#1:2.mf.legato.sub_harm(2, 3, 0.45) d#1:2.mf.legato |
  }

  measure 10 {
    lead: a4:2.mf.legato.vib.filter(1300, 3200) g#4:4.mf.legato f#4:4.mf.glide(170ms) |
    pad: [a2 c#3 e3 g#3]:2.mp.legato.open_voice [f#2 a2 c#3 e3]:2.mp.legato.open_voice |
    buchla: a2:8.mp.warp_wave("mirror", [0.18, 0.65]) e3:8 c#4:8 g#3:8 f#2:8 c#3:8 a3:8.ratchet(3) e3:8 |
    bass: a0:2.mf.legato.filter(240, 680) f#1:2.mf.legato.glide(160ms) |
  }

  measure 11 {
    lead: g#4:2.mf.legato.cresc(68, 98).filter(1400, 3900) b4:4.f.legato c#5:4.f.glide(185ms) |
    pad: [f#3 a3 c#4 e4]:2.mf.legato.rootless [g#3 c4 d#4 f#4]:2.f.legato.open_voice.cresc(72, 100) |
    buchla: f#3:8.mf.fold([1.4, 3.3]) c#4:8 a4:8 e4:8 g#3:8 d#4:8 c5:8.ratchet(3) f#4:8 |
    bass: f#1:2.mf.legato.filter(280, 760) g#1:2.f.legato.glide(175ms) |
  }

  measure 12 {
    lead: f5:2.f.legato.vib.detune([22, 82, 28]).filter(1750, 4600) c#5:2.f.legato.vib |
    pad: [c#3 f3 g#3 d#4]:1.f.legato.open_voice.bend_voice(1, -1, 1).filter(1050, 3300) |
    buchla: c#3:8.mf.fold([1.5, 3.5]) g#3:8 f4:8 c#4:8.ratchet(2) g#3:8 f4:8 d#4:8 g#3:8 |
    bass: c#1:1.f.legato.filter(340, 940).drive([0.26, 0.65]) |
  }

  measure 13 {
    lead: g#5:2.mf.legato.vowel(["o", "a", "e"]).filter(1600, 3800) f#5:4.mf.legato e5:4.mf.glide(170ms) |
    pad: [c#3 e3 g#3 b3]:2.mp.legato.open_voice [b2 d#3 f#3 a3]:2.mp.legato.open_voice |
    buchla: c#3:8.mp.squeeze([0.2, 0.7]) g#3:8 e4:8 b3:8 b2:8 f#3:8 d#4:8.ratchet(2) a3:8 |
    bass: c#1:2.mf.legato b0:2.mf.legato.glide(160ms) |
  }

  measure 14 {
    lead: d#5:2.mf.legato.vib.filter(1450, 3500) c#5:4.mf.legato b4:4.mf.glide(175ms) |
    pad: [a2 c#3 e3 g#3]:2.mp.legato.open_voice [g#2 b2 d#3 f#3]:2.mp.legato.open_voice |
    buchla: a2:8.mp.fold([1.2, 2.7]) e3:8 c#4:8 g#3:8.ratchet(3) g#2:8 d#3:8 b3:8 f#3:8 |
    bass: a0:2.mf.legato g#0:2.mf.legato |
  }

  measure 15 {
    lead: a#4:2.mf.legato.cresc(72, 104).filter(1500, 4100) c#5:4.f.legato f5:4.f.glide(195ms) |
    pad: [f#3 a#3 c#4 e4]:2.mf.legato.open_voice [g#3 c4 d#4 f#4]:2.f.legato.open_voice.cresc(74, 104) |
    buchla: f#3:8.mf.fold([1.6, 3.6]) c#4:8 a#4:8 e4:8 g#3:8 d#4:8 c5:8.ratchet(4) f#4:8 |
    bass: f#1:2.mf.legato.filter(300, 820) g#1:2.f.legato.glide(180ms) |
  }

  measure 16 {
    lead: f5:2.f.legato.vib.detune([26, 86, 32]).filter(1850, 4900) g#5:2.f.legato.vib |
    pad: [c#3 f3 g#3 c4]:1.f.legato.open_voice.bend_voice(1, -1, 1).filter(1150, 3500) |
    buchla: c#3:8.mf.fold([1.4, 3.2]) g#3:8 f4:8 c4:8.ratchet(2) g#3:8 f4:8 c#4:8 g#3:8 |
    bass: c#1:1.f.legato.filter(360, 980).drive([0.30, 0.70]) |
  }

  %% =========================================================================
  %% SECTION III (Measures 17-24): A Lydian-Minor -> A Major Horizon
  %% =========================================================================

  locator "III. Negative Harmony & Golden Ratio Horizon" at measure 17

  measure 17 {
    lead: a4:2.mp.legato.pre_swell.filter(1050, 2900) c5:4.mp.legato e5:4.mp.glide(170ms) |
    pad: [a2 c3 e3 g3]:1.p.legato.open_voice.wow_flutter(22, 14).filter(720, 2100) |
    buchla: a2:8.p.ring_mod(220, [0.1, 0.45]) e3:8 c4:8 g3:8.ratchet(2) e3:8 c4:8 b3:8 e3:8 |
    bass: a0:1.mp.legato.filter(230, 650).sub_harm(2, 3, 0.40) |
  }

  measure 18 {
    lead: d5:2.mp.legato.vib.filter(1250, 3100) c5:4.mp.legato b4:4.mp.glide(175ms) |
    pad: [f2 c3 e3 a3]:2.p.legato.open_voice [g2 d3 f3 b3]:2.mp.legato.open_voice |
    buchla: f2:8.p.fold([1.1, 2.5]) c3:8 a3:8 e3:8 g2:8 d3:8 b3:8.ratchet(3) f3:8 |
    bass: f1:2.mp.legato g1:2.mp.legato.glide(165ms) |
  }

  measure 19 {
    lead: c5:2.mf.legato.cresc(68, 98).filter(1350, 3700) d5:4.f.legato e5:4.f.glide(190ms) |
    pad: [d3 f3 a3 c4]:2.mp.legato.open_voice [e3 g#3 b3 d4]:2.f.legato.open_voice.cresc(70, 100) |
    buchla: d3:8.mp.fold([1.3, 3.0]) a3:8 f4:8 c4:8 e3:8 b3:8 g#4:8.ratchet(3) d4:8 |
    bass: d1:2.mf.legato.filter(260, 740) e1:2.f.legato.glide(175ms) |
  }

  measure 20 {
    lead: c#5:2.f.legato.vib.detune([24, 82, 30]).filter(1700, 4600) e5:2.f.legato.vib |
    pad: [a2 e3 a3 c#4]:1.f.legato.open_voice.bend_voice(1, -1, 1).filter(1050, 3400) |
    buchla: a2:8.mf.fold([1.4, 3.3]) e3:8 c#4:8 a3:8.ratchet(2) e3:8 c#4:8 b3:8 e3:8 |
    bass: a0:1.f.legato.filter(340, 940).drive([0.26, 0.66]) |
  }

  measure 21 {
    lead: a5:2.mf.legato.vowel(["a", "e", "i"]).filter(1650, 4000) g5:4.mf.legato e5:4.mf.glide(170ms) |
    pad: [a2 c3 e3 g3]:2.mp.legato.open_voice.neg_harm("E") [g2 b2 d3 f#3]:2.mp.legato.open_voice |
    buchla: a2:8.mp.warp_wave("bend", [0.22, 0.74]) e3:8 c4:8 g3:8 g2:8 d3:8 b3:8.ratchet(2) f#3:8 |
    bass: a0:2.mf.legato g0:2.mf.legato.glide(160ms) |
  }

  measure 22 {
    lead: f5:2.mf.legato.vib.filter(1500, 3600) e5:4.mf.legato d5:4.mf.glide(175ms) |
    pad: [f2 a2 c3 e3]:2.mp.legato.open_voice [d3 f3 a3 c4]:2.mp.legato.open_voice |
    buchla: f2:8.mp.fold([1.2, 2.8]) c3:8 a3:8 e3:8.ratchet(3) d3:8 a3:8 f4:8 c4:8 |
    bass: f1:2.mf.legato d1:2.mf.legato |
  }

  measure 23 {
    lead: b4:2.mf.legato.cresc(74, 106).filter(1550, 4300) e5:4.f.legato g#5:4.f.glide(200ms) |
    pad: [b2 d3 f#3 a3]:2.mf.legato.open_voice [e3 g#3 b3 d4]:2.f.legato.open_voice.cresc(76, 106) |
    buchla: b2:8.mf.fold([1.6, 3.7]) f#3:8 d4:8 a3:8 e3:8 b3:8 g#4:8.ratchet(4) d4:8 |
    bass: b0:2.mf.legato.filter(300, 840) e1:2.f.legato.glide(185ms) |
  }

  measure 24 {
    lead: a5:1.f.legato.vib.detune([28, 88, 34]).filter(1950, 5100) |
    pad: [a2 e3 b3 c#4]:1.f.legato.open_voice.bend_voice(1, -1, 1).filter(1200, 3650) |
    buchla: a2:8.mf.fold([1.5, 3.4]) e3:8 c#4:8 b3:8.ratchet(2) e3:8 c#4:8 a3:8 e3:8 |
    bass: a0:1.f.legato.filter(380, 1020).drive([0.32, 0.72]) |
  }

  %% =========================================================================
  %% SECTION IV (Measures 25-32): F# Minor-Ninth -> E Major / B Major Apotheosis
  %% =========================================================================

  locator "IV. Four-Voice Apotheosis & Radiant Bloom" at measure 25

  measure 25 {
    lead: f#5:2.mf.legato.vowel(["u", "o", "a"]).filter(1500, 3800) a5:4.f.legato e5:4.f.glide(175ms) |
    pad: [f#3 a3 c#4 e4]:2.mp.legato.open_voice [d3 f#3 a3 c#4]:2.mp.legato.open_voice |
    buchla: f#3:8.mp.fold([1.3, 3.0]) c#4:8 a4:8 e4:8.ratchet(2) d3:8 a3:8 f#4:8 c#4:8 |
    bass: f#1:2.mf.legato.filter(280, 760) d1:2.mf.legato.glide(165ms) |
  }

  measure 26 {
    lead: d#5:2.f.legato.vib.filter(1650, 4200) f#5:4.f.legato b5:4.f.glide(190ms) |
    pad: [b2 d3 f#3 a3]:2.mf.legato.open_voice [b2 d#3 f#3 a3]:2.f.legato.open_voice.cresc(74, 104) |
    buchla: b2:8.mf.fold([1.5, 3.4]) f#3:8 d4:8 a3:8 b2:8 f#3:8 d#4:8.ratchet(3) a3:8 |
    bass: b0:1.f.legato.filter(320, 880).drive([0.28, 0.66]) |
  }

  measure 27 {
    lead: g#5:2.f.legato.vib.detune([26, 86, 32]).filter(1850, 4800) e5:4.f.legato b4:4.f.glide(180ms) |
    pad: [e3 g#3 b3 d#4]:2.f.legato.open_voice [c#3 e3 g#3 b3]:2.mf.legato.open_voice |
    buchla: e3:8.mf.fold([1.4, 3.2]) b3:8 g#4:8 d#4:8.ratchet(2) c#3:8 g#3:8 e4:8 b3:8 |
    bass: e1:2.f.legato c#1:2.mf.legato.glide(170ms) |
  }

  measure 28 {
    lead: c#5:2.mf.legato.cresc(76, 110).filter(1600, 4500) f#5:4.f.legato a#5:4.ff.glide(210ms) |
    pad: [f#3 a3 c#4 e4]:2.mf.legato.open_voice [f#3 a#3 c#4 e4]:2.f.legato.open_voice.cresc(78, 110) |
    buchla: f#3:8.mf.fold([1.6, 3.8]) c#4:8 a4:8 e4:8 f#3:8 c#4:8 a#4:8.ratchet(4) e4:8 |
    bass: f#1:1.f.legato.filter(350, 980).drive([0.32, 0.74]) |
  }

  measure 29 {
    lead: b5:2.ff.legato.vib.detune([30, 92, 36]).filter(2100, 5400) g#5:4.f.legato e5:4.f.glide(190ms) |
    pad: [b2 d#3 f#3 b3]:2.f.legato.open_voice [e3 g#3 b3 d#4]:2.f.legato.open_voice |
    buchla: b2:8.f.fold([1.7, 3.9]) f#3:8 d#4:8 b3:8.ratchet(3) e3:8 b3:8 g#4:8 d#4:8 |
    bass: b0:2.f.legato.filter(380, 1040) e1:2.f.legato.glide(175ms) |
  }

  measure 30 {
    lead: f#5:2.f.legato.vib.filter(1800, 4400) d#5:4.mf.legato b4:4.mf.glide(180ms) |
    pad: [a2 c#3 e3 g#3]:2.mf.legato.open_voice [b2 d#3 f#3 a3]:2.mf.legato.open_voice |
    buchla: a2:8.mf.fold([1.4, 3.1]) e3:8 c#4:8 g#3:8 b2:8 f#3:8 d#4:8.ratchet(2) a3:8 |
    bass: a0:2.mf.legato b0:2.mf.legato.glide(170ms) |
  }

  measure 31 {
    lead: g#5:2.f.legato.vib.detune([24, 78, 26]).filter(1750, 4200) f#5:4.mf.legato e5:4.mp.glide(200ms) |
    pad: [e3 g#3 b3 d#4]:1.mf.legato.open_voice.bend_voice(1, -1, 1).filter(1100, 2900) |
    buchla: e3:8.mp.fold([1.3, 2.6]) b3:8 g#4:8 d#4:8 b3:8 g#4:8 f#4:8 b3:8 |
    bass: e1:1.mf.legato.filter(320, 780) |
  }

  measure 32 {
    lead: e5:1.mp.legato.vib.dim(84, 36).filter(2200, 950).fermata |
    pad: [e3 g#3 b3 f#4]:1.mp.legato.open_voice.dim(82, 34).filter(1800, 750).fermata |
    buchla: e3:4.mp.fold([1.2, 1.8]) b3:4 g#4:4 e5:4.p.fermata |
    bass: e1:1.mp.legato.dim(86, 36).filter(620, 220).fermata |
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
