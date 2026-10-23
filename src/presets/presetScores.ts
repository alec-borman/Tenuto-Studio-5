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
    id: 'mahler_symphony_6_finale',
    title: 'Mahler Symphony No. 6 - Finale (The Three Hammer Blows)',
    genre: '72-136 BPM',
    code: `tenuto "5.0" {
  meta @{ title: "Mahler Symphony No. 6 - Finale (The Three Hammer Blows)", tempo: 72, time: "4/4" }

  %% =========================================================================
  %% 16-SECTION CONCERTGEBOUW ORCHESTRA + MAHLER WOODEN HAMMER
  %% =========================================================================
  def ham  "Mahler Wooden Box Hammer"  style=grid     patch="timpani"
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
    id: 'minimal_sketch',
    title: 'Minimal Piano Sketch (Default)',
    genre: '120 BPM',
    code: 'pno: c4:4',
  },
];
