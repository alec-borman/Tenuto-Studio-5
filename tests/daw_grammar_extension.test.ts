import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentParser } from '../src/parser/DocumentParser';
import { ASTSerializer } from '../src/parser/ASTSerializer';
import { Lexer, TokenType } from '../src/parser/lexer';

describe('TDB-701: Tenuto 6.0 DAW Grammar Extension', () => {
  let parser: DocumentParser;
  let serializer: ASTSerializer;

  beforeEach(() => {
    parser = new DocumentParser();
    serializer = new ASTSerializer();
  });

  it('tokenizes new DAW keywords in Lexer without breaking existing identifiers', () => {
    const lexer = new Lexer('scene clip group return locator groove rack pno: c4:4');
    const tokens = lexer.tokenize();
    expect(tokens[0]).toEqual({ type: TokenType.KEYWORD, value: 'scene' });
    expect(tokens[1]).toEqual({ type: TokenType.KEYWORD, value: 'clip' });
    expect(tokens[2]).toEqual({ type: TokenType.KEYWORD, value: 'group' });
    expect(tokens[3]).toEqual({ type: TokenType.KEYWORD, value: 'return' });
    expect(tokens[4]).toEqual({ type: TokenType.KEYWORD, value: 'locator' });
    expect(tokens[5]).toEqual({ type: TokenType.KEYWORD, value: 'groove' });
    expect(tokens[6]).toEqual({ type: TokenType.KEYWORD, value: 'rack' });
    expect(tokens[7]).toEqual({ type: TokenType.IDENTIFIER, value: 'pno' });
  });

  it('parses per-note probability (.chance, .vel_range, .pick_one), warp, transpose, formant, MPE, and CC modifiers', () => {
    const note = serializer.parseToken(
      'c4:8.chance(65%).vel_range(70, 110).warp(complex_pro).transpose(-3st).formant(25%).mpe(@{bend: [0, 12], slide: [40, 100], pressure: [80, 120]})'
    );

    expect(note.physics?.chance).toBe(65);
    expect(note.physics?.velocityRange).toEqual([70, 110]);
    expect(note.physics?.velocity).toBe(90);
    expect(note.physics?.warpMode).toBe('complex_pro');
    expect(note.physics?.stretch).toBe(true);
    expect(note.physics?.pitchShiftSt).toBe(-3);
    expect(note.physics?.formant).toBe(25);
    expect(note.physics?.mpe).toEqual({
      bend: [0, 12],
      slide: [40, 100],
      pressure: [80, 120],
    });

    const spacer = serializer.parseToken('s:4.cc(7, [0, 64, 127], "exp")');
    expect(spacer.pitch.isSpacer).toBe(true);
    expect(spacer.physics?.cc).toEqual({
      controller: 7,
      values: [0, 64, 127],
      curve: 'exp',
    });
  });

  it('compiles Session View scenes, clips, Follow Actions, groups, return buses, grooves, and locators', () => {
    const dawScore = `
      tenuto "6.0" {
        meta @{
          title: "Ableton Session Matrix",
          tempo: 124,
          time: "4/4",
          key: "D",
          scale: "harmonic_minor",
          tuning: "12tet",
          quantize_launch: "1/1",
          crossfader: -0.25,
          sidechain: "drums"
        }

        groove mpc_swing "MPC 16th Swing" @{ base: "1/16", quantize: 80%, timing: 35%, random: 10%, velocity: 50% }

        return rev_bus "Concert Hall Return" .fx(hybrid_reverb, @{mix: 1.0, decay: 3.2})
        return dly_bus "Ping Pong Delay" .fx(echo, @{time: 0.375, feedback: 0.45})

        def lead "Wavetable Lead" style=synth patch="wavetable" group="synth_bus" groove="mpc_swing" crossfade="A" delay=-8ms sends=@{rev_bus: 0.45, dly_bus: 0.3} macros=@{cutoff: 72, unison: 40} .fx(eq_eight, @{low_cut: 110}).fx(roar, @{drive: 0.35})
        def drums "909 Kit" style=grid patch="tenuto_808_kit" crossfade="B"

        group synth_bus "Synth Bus" tracks=[lead] .fx(glue_compressor, @{ratio: 4, threshold: -12})

        locator "Intro" at measure 1
        locator "Main Drop" at measure 5

        clip arp_hook "Arp Hook" track=lead scene=1 bars=1 follow=@{bars: 4, actionA: "next", actionB: "play_again", chanceA: 75} {
          d4:8.chance(85%) f4:8 a4:8 d5:8 [f5 a5 d6]:2.pick_one
        }

        scene 2 "Peak Drop" @{ tempo: 128 } {
          lead: <[ v1: d5:4 f5:4 a5:2 | v2: s:4.cc(74, [20, 120], "exp") * 4 ]> @follow @{bars: 8, actionA: "any", chanceA: 90}
          drums: k:4 s:4 k:4 s:4 |
        }
      }
    `;

    const compiled = parser.compile(dawScore);

    // 1. Verify extended ScoreMeta
    expect(compiled.version).toBe('6.0');
    expect(compiled.meta.scale).toBe('harmonic_minor');
    expect(compiled.meta.tuning).toBe('12tet');
    expect(compiled.meta.quantizeLaunch).toBe('1/1');
    expect(compiled.meta.crossfader).toBe(-0.25);

    // 2. Verify Groove Pool definitions
    expect(compiled.grooves).toHaveLength(1);
    expect(compiled.grooves![0]).toMatchObject({
      id: 'mpc_swing',
      base: '1/16',
      quantizePercent: 80,
      timingPercent: 35,
      randomPercent: 10,
      velocityPercent: 50,
    });

    // 3. Verify Return tracks and Track DAW properties
    const returnTracks = compiled.defs.filter((d) => d.isReturn);
    expect(returnTracks).toHaveLength(2);
    expect(returnTracks[0].id).toBe('rev_bus');
    expect(returnTracks[0].fxChain?.[0]).toEqual({
      type: 'hybrid_reverb',
      params: { mix: 1.0, decay: 3.2 },
    });

    const leadTrack = compiled.defs.find((d) => d.id === 'lead')!;
    expect(leadTrack.groupId).toBe('synth_bus');
    expect(leadTrack.groove).toBe('mpc_swing');
    expect(leadTrack.crossfadeAssign).toBe('A');
    expect(leadTrack.trackDelayMs).toBe(-8);
    expect(leadTrack.sends).toEqual({ rev_bus: 0.45, dly_bus: 0.3 });
    expect(leadTrack.macros).toEqual({ cutoff: 72, unison: 40 });
    expect(leadTrack.fx).toEqual(['eq_eight', 'roar']);
    expect(leadTrack.fxChain).toHaveLength(2);

    // 4. Verify Group tracks
    expect(compiled.groups).toHaveLength(1);
    expect(compiled.groups![0].id).toBe('synth_bus');
    expect(compiled.groups![0].trackIds).toContain('lead');
    expect(compiled.groups![0].fx).toContain('glue_compressor');

    // 5. Verify Arrangement Locators
    expect(compiled.locators).toHaveLength(2);
    expect(compiled.locators![0]).toMatchObject({ name: 'Intro', measureNumber: 1, startWhole: 0 });
    expect(compiled.locators![1]).toMatchObject({ name: 'Main Drop', measureNumber: 5, startWhole: 4 });

    // 6. Verify Standalone Clips & Scene Clips + Follow Actions
    expect(compiled.clips).toHaveLength(3);
    const arpClip = compiled.clips!.find((c) => c.id === 'arp_hook')!;
    expect(arpClip.trackId).toBe('lead');
    expect(arpClip.sceneIndex).toBe(1);
    expect(arpClip.followAction).toEqual({
      bars: 4,
      actionA: 'next',
      actionB: 'play_again',
      chanceA: 75,
      chanceB: 25,
      linked: true,
    });
    expect(arpClip.events[0].physics?.chance).toBe(85);
    expect(arpClip.events.some((e) => e.physics?.pickOne)).toBe(true);

    // 7. Verify Scene 2 & preserved CC automation spacer
    const scene2 = compiled.scenes!.find((s) => s.index === 2)!;
    expect(scene2.name).toBe('Peak Drop');
    expect(scene2.tempo).toBe(128);
    expect(scene2.clipIds).toContain('scene_2_lead');
    expect(scene2.clipIds).toContain('scene_2_drums');

    const scene2LeadClip = compiled.clips!.find((c) => c.id === 'scene_2_lead')!;
    expect(scene2LeadClip.followAction?.bars).toBe(8);
    expect(scene2LeadClip.followAction?.actionA).toBe('any');
    const ccEvents = scene2LeadClip.events.filter((e) => e.physics?.cc?.controller === 74);
    expect(ccEvents).toHaveLength(4);
  });
});
