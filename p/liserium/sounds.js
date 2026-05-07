// LISERIUM — sound design
// =========================
// All timbres live here. Edit the values, save, reload the page, hear changes.
// Direction: processed strings + dub + dark electronics (DJ Rum, Burial, Andy Stott).
//
// Each builder receives the FX bus and returns a Tone.js synth object with the
// regular Tone API (triggerAttack, triggerRelease, etc.). Filters/effects live
// in private closures so you don't have to wire them in index.html.

window.LiseriumSounds = (function() {

  // ===========================================================================
  // VOICES — the four pad modes (LEAD / PAD / DEEP / ARP)
  // ===========================================================================

  // LEAD — processed string, emotive but electronic.
  // Reference: DJ Rum solos, Burial leads, a string with subtle vibrato.
  function buildLead(fxBus) {
    const verb = new Tone.Reverb({ decay: 4.5, wet: 0.35, preDelay: 0.05 });
    const chorus = new Tone.Chorus({ frequency: 0.7, depth: 0.7, wet: 0.45 }).start();
    const filter = new Tone.Filter({ frequency: 3200, type: 'lowpass', Q: 0.8 });
    filter.chain(chorus, verb, fxBus);

    // Big polysynth, fat sawtooth = body of a string section
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 22 },
      envelope: {
        attack: 0.28,    // bow-like — bigger = more legato, smaller = more pluck
        decay: 0.5,
        sustain: 0.75,
        release: 1.6     // long tail = the emotional payoff
      }
    });
    synth.connect(filter);
    synth.volume.value = -10;
    return synth;
  }

  // PAD — slow ambient drone with dub feedback.
  // Reference: Burial pads, Andy Stott textures.
  function buildPad(fxBus) {
    const verb = new Tone.Reverb({ decay: 9.0, wet: 0.55, preDelay: 0.08 });
    const dubDelay = new Tone.FeedbackDelay({ delayTime: 0.55, feedback: 0.5, wet: 0.4 });
    const autoFilter = new Tone.AutoFilter({
      frequency: 0.12,        // very slow LFO
      depth: 0.5,
      baseFrequency: 700,
      octaves: 2.5
    }).start();
    autoFilter.chain(dubDelay, verb, fxBus);

    const synth = new Tone.PolySynth(Tone.AMSynth, {
      harmonicity: 1.5,
      oscillator: { type: 'sine' },
      modulation: { type: 'triangle' },
      envelope: {
        attack: 1.0,        // slow breathing
        decay: 0.5,
        sustain: 0.85,
        release: 3.5        // very long release — pad hangs after release
      },
      modulationEnvelope: {
        attack: 1.5, decay: 0.2, sustain: 0.6, release: 2.0
      }
    });
    synth.connect(autoFilter);
    synth.volume.value = -12;
    return synth;
  }

  // DEEP — sub bass with tape-style saturation.
  // Mantains the existing DEEP role: low, weighty, but cleaner.
  function buildDeep(fxBus) {
    const verb = new Tone.Reverb({ decay: 2.2, wet: 0.18 });
    const sat = new Tone.Distortion({ distortion: 0.16, oversample: '2x', wet: 0.55 });
    const filter = new Tone.Filter({ frequency: 700, type: 'lowpass', Q: 1.5 });
    filter.chain(sat, verb, fxBus);

    // DuoSynth has its own vibrato, useful since the existing code calls .vibratoAmount
    const synth = new Tone.DuoSynth({
      vibratoAmount: 0.25,
      vibratoRate: 1.5,
      harmonicity: 0.5,
      voice0: {
        volume: -10,
        oscillator: { type: 'sawtooth4' },
        filterEnvelope: { baseFrequency: 90, attack: 0.08, decay: 0.7, sustain: 0.25, release: 1.0, octaves: 3 },
        envelope: { attack: 0.05, decay: 0.7, sustain: 0.3, release: 1.0 }
      },
      voice1: {
        volume: -10,
        oscillator: { type: 'sine' },
        filterEnvelope: { baseFrequency: 70, attack: 0.08, decay: 0.9, sustain: 0.3, release: 1.3, octaves: 2 },
        envelope: { attack: 0.05, decay: 0.9, sustain: 0.3, release: 1.3 }
      }
    });
    synth.connect(filter);
    return synth;
  }

  // ARP — plucked koto / celesta with rhythmic delay.
  // Reference: electronic music box, a short note that floats.
  function buildArp(fxBus) {
    const verb = new Tone.Reverb({ decay: 3.5, wet: 0.5 });
    const delay = new Tone.PingPongDelay({ delayTime: '8n.', feedback: 0.45, wet: 0.55 });
    const filter = new Tone.Filter({ frequency: 4500, type: 'lowpass', Q: 0.9 });
    filter.chain(delay, verb, fxBus);

    // PluckSynth = Karplus-Strong = string physics, perfect for koto/celesta
    const synth = new Tone.PluckSynth({
      attackNoise: 0.7,    // 0-1, more = more "fingernail" click
      dampening: 3500,     // brightness — higher = brighter
      resonance: 0.88      // sustain — higher = string vibrates longer
    });
    synth.connect(filter);
    synth.volume.value = -2;
    return synth;
  }

  // ===========================================================================
  // DRUMS — 4 voices on the sequencer
  // ===========================================================================

  // Returns an object compatible with the existing drum API in index.html
  function buildDrums(drumBus) {
    // KICK — body + saturation chain. The variant logic still lives in index.html.
    const kickFilter = new Tone.Filter(180, 'lowpass');
    const kickDist = new Tone.Distortion(0.12);
    const kick = new Tone.MembraneSynth();
    kick.chain(kickFilter, kickDist, drumBus);

    // SNARE — rim/clap-leaning, with reverb tail (Burial-esque fragmented)
    const snareVerb = new Tone.Reverb({ decay: 1.5, wet: 0.4 }).connect(drumBus);
    const snareNoise = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.001, decay: 0.14, sustain: 0.02, release: 0.18 },
      volume: -6
    });
    snareNoise.chain(
      new Tone.Filter(2200, 'bandpass'),
      new Tone.Filter(7500, 'highpass'),
      snareVerb
    );
    const snareBody = new Tone.MembraneSynth({
      pitchDecay: 0.015,
      octaves: 3,
      envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.1 },
      volume: -10
    });
    snareBody.connect(snareVerb);
    const snare = {
      trigger(dur, time) {
        snareNoise.triggerAttackRelease(dur, time);
        snareBody.triggerAttackRelease('A3', dur, time);
      },
      // expose for index.html parameter knobs
      _noise: snareNoise
    };

    // BASS — saturated 808
    const bassSat = new Tone.Distortion(0.08);
    const bass = new Tone.FMSynth({
      harmonicity: 0.5, modulationIndex: 8,
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.15, release: 0.4 },
      modulationEnvelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.2 },
      volume: -2
    });
    bass.chain(new Tone.Filter(380, 'lowpass'), bassSat, drumBus);

    // HATS — metallic with subtle bitcrush
    const bitCrush = new Tone.BitCrusher(8);
    const hats = new Tone.MetalSynth({
      frequency: 280,
      envelope: { attack: 0.001, decay: 0.07, release: 0.04 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4500,
      volume: -10
    });
    hats.chain(new Tone.Filter(8500, 'highpass'), bitCrush, drumBus);

    return {
      kick, kickFilter, kickDist,    // exposed so index.html's applyKickVariant works
      snare, snareNoise, snareBody,  // snare keeps its existing API
      bass,
      hats
    };
  }

  // ===========================================================================
  // DUB PADS — 4 one-shot trigger pads at the sides of the touchpad
  //   Index 0: STAB  (left top)    — short string stab
  //   Index 1: CHORD (left bottom) — sustained minor chord
  //   Index 2: BELL  (right top)   — metallic bell hit
  //   Index 3: VOX   (right bottom)— ethereal vocal pad
  // ===========================================================================

  function buildDubPads(fxBus) {
    // Shared dub effects — long reverb + dotted delay define the dub feel
    const dubVerb = new Tone.Reverb({ decay: 6.0, wet: 0.65, preDelay: 0.04 });
    const dubDelay = new Tone.FeedbackDelay({ delayTime: '4n.', feedback: 0.48, wet: 0.5 });
    dubDelay.chain(dubVerb, fxBus);

    // STAB — short fat saw stab
    const stab = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 2, spread: 30 },
      envelope: { attack: 0.005, decay: 0.3, sustain: 0, release: 0.7 }
    });
    stab.chain(new Tone.Filter(1800, 'lowpass'), dubDelay);
    stab.volume.value = -6;

    // CHORD — sustained AM chord, dub-style
    const chord = new Tone.PolySynth(Tone.AMSynth, {
      harmonicity: 1.5,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.04, decay: 0.4, sustain: 0.5, release: 1.8 }
    });
    chord.chain(new Tone.Filter(2000, 'lowpass'), dubDelay);
    chord.volume.value = -10;

    // BELL — metallic bell with long reverb (own reverb, longer)
    const bellVerb = new Tone.Reverb({ decay: 7, wet: 0.7 }).connect(fxBus);
    const bell = new Tone.MetalSynth({
      frequency: 220,
      envelope: { attack: 0.001, decay: 1.6, release: 0.3 },
      harmonicity: 3.1,
      modulationIndex: 18,
      resonance: 700,
      octaves: 0.5
    });
    bell.chain(new Tone.Filter(3200, 'lowpass'), bellVerb);
    bell.volume.value = -22;

    // VOX — ethereal FM pad voice
    const voxVerb = new Tone.Reverb({ decay: 8, wet: 0.7 }).connect(fxBus);
    const vox = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2,
      modulationIndex: 4,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.4, decay: 0.4, sustain: 0.3, release: 2.5 },
      modulationEnvelope: { attack: 0.5, decay: 0.3, sustain: 0.5, release: 1.2 }
    });
    vox.chain(new Tone.Filter(3500, 'lowpass'), voxVerb);
    vox.volume.value = -12;

    return [
      {
        label: 'STAB',
        trigger() { stab.triggerAttackRelease('C3', '16n'); }
      },
      {
        label: 'CHORD',
        trigger() { chord.triggerAttackRelease(['A2', 'C3', 'E3'], '2n'); }
      },
      {
        label: 'BELL',
        trigger() { bell.triggerAttackRelease('A4', '4n'); }
      },
      {
        label: 'VOX',
        trigger() { vox.triggerAttackRelease(['E3', 'G3', 'B3'], '2n'); }
      }
    ];
  }

  return { buildLead, buildPad, buildDeep, buildArp, buildDrums, buildDubPads };
})();
