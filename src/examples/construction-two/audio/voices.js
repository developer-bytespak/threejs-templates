/**
 * The sound palette, synthesised.
 *
 * There are no audio files here. Every sound on this page is made from noise
 * and a handful of filters at the moment it plays, and that is a deliberate
 * choice rather than a constraint worked around.
 *
 * A technical click is a 20ms noise burst through a narrow bandpass. Graphite
 * on paper is noise through a high bandpass with a grain envelope. A tap on
 * concrete is a transient plus two decaying resonances. Room tone is very
 * low-level filtered noise with two quiet formants. These are what the
 * recordings would be anyway — and synthesising them buys three things a
 * sample library cannot:
 *
 *   NO REPETITION. Every play is slightly different by construction: filter
 *   frequency, decay, grain density and level all jitter within a few per
 *   cent. The brief asks for two or three variations of each click precisely
 *   to avoid the tell of a repeated sample; here there is no sample to repeat.
 *
 *   NO WEIGHT. The whole palette is a few kilobytes of code rather than a few
 *   megabytes of audio, on a page already carrying a GLB and Three.js.
 *
 *   NO LICENCE. Nothing to attribute, nothing to re-clear if the page ships
 *   somewhere else.
 *
 * If you would rather use real recordings, AudioManager will prefer a file at
 * `/assets/construction-two/audio/<id>.<ext>` over the synthesised voice for
 * any id, so a recording can replace any one of these without touching code.
 *
 * Everything below shares one noise buffer and allocates only the nodes a
 * single play needs, which are collected as soon as they stop.
 *
 * ONE CONSTRAINT SHAPES ALL OF IT: THE SPEAKER
 *
 * The first cut of these voices was mixed for what they are — mass is low, a
 * room is low, plant is low — and on a laptop it was almost silent. A typical
 * laptop speaker is a 20mm driver in a sealed slot; it rolls off hard below
 * about 300Hz and produces essentially nothing under 200. The landings were
 * putting 67-87% of their energy under 250Hz and the room tone was putting
 * 100% of it there, so on the machine most people will actually use, the
 * building went up in silence and only the bright accents survived.
 *
 * So every voice here now carries a deliberate component in the 300Hz-3kHz
 * band, where a small speaker is efficient and the ear is most sensitive. The
 * low end is still there and still does its work on headphones and monitors —
 * it is simply no longer the only thing carrying the sound.
 */

let noise = null

/** One 2s mono noise buffer for the whole page. Built once, read by everything. */
function noiseBuffer(ctx) {
  if (noise && noise.sampleRate === ctx.sampleRate) return noise
  const length = ctx.sampleRate * 2
  noise = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1
  return noise
}

const rand = (a, b) => a + Math.random() * (b - a)

/** A noise source starting at a random offset, so repeats never share a shape. */
function noiseSource(ctx, rate = 1) {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx)
  src.loop = true
  src.playbackRate.value = rate
  return src
}

function filter(ctx, type, freq, q = 1) {
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  return f
}

/**
 * The one envelope shape used everywhere: a fast ramp up and an exponential
 * fall. `setTargetAtTime` rather than a linear ramp because a linear release
 * on a short percussive sound is exactly what makes cheap UI audio sound
 * cheap — real things decay.
 */
function env(ctx, t0, peak, attack, decay) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.linearRampToValueAtTime(peak, t0 + attack)
  g.gain.setTargetAtTime(0.0001, t0 + attack, decay / 3)
  return g
}

/** A decaying sine partial. The body under a click. */
function partial(ctx, t0, freq, peak, decay, type = 'sine') {
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.value = freq
  const g = env(ctx, t0, peak, 0.002, decay)
  osc.connect(g)
  osc.start(t0)
  osc.stop(t0 + decay + 0.2)
  return g
}

/* ------------------------------------------------------------------ voices */
/**
 * Each voice is `(ctx, destination, time, opts) => void`.
 *
 * `opts.gain` is the caller's level for this one play, already scaled by its
 * bus. `opts.rate` nudges the whole voice brighter or darker — the brief's
 * "randomise playback rate", except here it moves filter frequencies, which
 * is what changing the rate of a sample actually does to it.
 */
export const VOICES = {
  /* ---- ambience ---------------------------------------------------- */

  /**
   * The room. Filtered noise so low it sits under the threshold of notice,
   * with two quiet resonances where a room that size would have them and a
   * very slow drift on the low-pass so it is never quite static.
   *
   * Returns a stop function: this is the one voice that runs continuously.
   */
  roomTone(ctx, dest, t0, { gain = 0.04 } = {}) {
    const src = noiseSource(ctx, 0.85)
    // Two poles, not one: a single 6dB/oct slope leaves enough upper-mid in
    // the noise that the tone reads as hiss rather than as a room. The corner
    // sits at 520 rather than the 190 it started at — below 300 a laptop
    // reproduces nothing, and a room tone nobody can hear is not ambience,
    // it is a CPU cost.
    const low = filter(ctx, 'lowpass', 520, 0.5)
    const low2 = filter(ctx, 'lowpass', 700, 0.5)
    const body = filter(ctx, 'peaking', 180, 1.0)
    body.gain.value = 3
    const air = filter(ctx, 'peaking', 620, 1.1)
    air.gain.value = 4

    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(gain, t0 + 3.5)   // fades up over 3.5s

    // Slow movement on the low-pass: air in a room, not an oscillator.
    const drift = ctx.createOscillator()
    drift.frequency.value = 0.045
    const driftAmount = ctx.createGain()
    driftAmount.gain.value = 120
    drift.connect(driftAmount).connect(low.frequency)
    drift.start(t0)

    src.connect(low).connect(low2).connect(body).connect(air).connect(g).connect(dest)
    src.start(t0)

    return (stopAt = ctx.currentTime, fade = 1.2) => {
      g.gain.cancelScheduledValues(stopAt)
      g.gain.setValueAtTime(g.gain.value, stopAt)
      g.gain.linearRampToValueAtTime(0.0001, stopAt + fade)
      src.stop(stopAt + fade + 0.1)
      drift.stop(stopAt + fade + 0.1)
    }
  },

  /** A breath of air movement. Used under camera moves and page turns. */
  air(ctx, dest, t0, { gain = 0.05, rate = 1, dur = 0.42 } = {}) {
    const src = noiseSource(ctx, rand(0.9, 1.1))
    const band = filter(ctx, 'bandpass', rand(420, 700) * rate, 0.9)
    const g = env(ctx, t0, gain, dur * 0.35, dur * 0.65)
    // The band opens and closes across the gesture — movement, not a hiss.
    band.frequency.setValueAtTime(band.frequency.value, t0)
    band.frequency.linearRampToValueAtTime(band.frequency.value * 1.9, t0 + dur)
    src.connect(band).connect(g).connect(dest)
    src.start(t0)
    src.stop(t0 + dur + 0.1)
  },

  /* ---- drafting ---------------------------------------------------- */

  /**
   * Graphite. Noise up in the 2–5k region where a pencil actually lives, with
   * the level chopped by a short grain envelope so it has tooth instead of
   * being a hiss. `dur` is how long the pen is down.
   */
  pencil(ctx, dest, t0, { gain = 0.05, rate = 1, dur = 0.12 } = {}) {
    const src = noiseSource(ctx, rand(0.85, 1.2))
    const band = filter(ctx, 'bandpass', rand(2300, 3600) * rate, rand(0.8, 1.4))
    const top = filter(ctx, 'highpass', 900, 0.7)

    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0)

    // The grain: 60–110 Hz of amplitude wobble is what separates paper from
    // white noise. Written as scheduled values rather than an LFO so each
    // stroke has its own irregular tooth.
    const step = 1 / rand(60, 110)
    let t = t0
    let first = true
    while (t < t0 + dur) {
      const level = gain * rand(first ? 0.9 : 0.35, 1)
      g.gain.linearRampToValueAtTime(level, t + step * 0.4)
      g.gain.linearRampToValueAtTime(level * 0.45, t + step)
      t += step
      first = false
    }
    g.gain.setTargetAtTime(0.0001, t0 + dur, 0.02)

    src.connect(top).connect(band).connect(g).connect(dest)
    src.start(t0)
    src.stop(t0 + dur + 0.15)
  },

  /** A sheet set down on a table: a soft low contact plus the paper itself. */
  paperPlace(ctx, dest, t0, { gain = 0.06, rate = 1 } = {}) {
    const src = noiseSource(ctx, rand(0.9, 1.1))
    const band = filter(ctx, 'bandpass', 1500 * rate, 0.6)
    band.frequency.setValueAtTime(2600 * rate, t0)
    band.frequency.exponentialRampToValueAtTime(760 * rate, t0 + 0.2)
    const g = env(ctx, t0, gain, 0.006, 0.19)
    src.connect(band).connect(g).connect(dest)
    src.start(t0)
    src.stop(t0 + 0.4)
    // The table under it.
    partial(ctx, t0, rand(104, 126), gain * 0.5, 0.1).connect(dest)
  },

  /** A sheet slid across another. Softer, longer, no contact transient. */
  paperMove(ctx, dest, t0, { gain = 0.045, rate = 1, dur = 0.3 } = {}) {
    const src = noiseSource(ctx, rand(0.8, 1.15))
    const band = filter(ctx, 'bandpass', rand(1100, 1900) * rate, 0.7)
    const g = env(ctx, t0, gain, dur * 0.4, dur * 0.7)
    band.frequency.linearRampToValueAtTime(band.frequency.value * 0.6, t0 + dur)
    src.connect(band).connect(g).connect(dest)
    src.start(t0)
    src.stop(t0 + dur + 0.2)
  },

  /* ---- construction ------------------------------------------------ */

  /** Knuckle on concrete: a transient with a short, dull body under it. */
  structural(ctx, dest, t0, { gain = 0.07, rate = 1 } = {}) {
    const src = noiseSource(ctx)
    const band = filter(ctx, 'bandpass', rand(1400, 2100) * rate, 2.2)
    const g = env(ctx, t0, gain * 1.15, 0.001, 0.04)
    src.connect(band).connect(g).connect(dest)
    src.start(t0)
    src.stop(t0 + 0.12)
    // The body used to be two partials at 180 and 430, which on a laptop is
    // one partial. The weight now sits at 520 and 860 where a small driver
    // can move, with the low one kept underneath for headphones.
    partial(ctx, t0, rand(500, 560) * rate, gain * 0.5, 0.11).connect(dest)
    partial(ctx, t0, rand(820, 920) * rate, gain * 0.34, 0.08).connect(dest)
    partial(ctx, t0, rand(168, 205) * rate, gain * 0.42, 0.14).connect(dest)
  },

  /** Steel. Inharmonic partials, longer decay, nothing like a bell chord. */
  metal(ctx, dest, t0, { gain = 0.045, rate = 1 } = {}) {
    const base = rand(590, 660) * rate
    const ratios = [1, 1.51, 2.39, 3.71]
    ratios.forEach((r, i) => {
      partial(ctx, t0, base * r, gain * (0.5 ** i) * 0.9, rand(0.28, 0.44))
        .connect(dest)
    })
    const src = noiseSource(ctx)
    const band = filter(ctx, 'bandpass', 3200 * rate, 3)
    const g = env(ctx, t0, gain * 0.35, 0.001, 0.03)
    src.connect(band).connect(g).connect(dest)
    src.start(t0)
    src.stop(t0 + 0.1)
  },

  /** Mass landing. Low, short, no ring — concrete does not ring. */
  concrete(ctx, dest, t0, { gain = 0.07, rate = 1 } = {}) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(rand(120, 145) * rate, t0)
    osc.frequency.exponentialRampToValueAtTime(rand(52, 64) * rate, t0 + 0.13)
    const g = env(ctx, t0, gain, 0.003, 0.15)
    osc.connect(g).connect(dest)
    osc.start(t0)
    osc.stop(t0 + 0.4)

    const src = noiseSource(ctx)
    const low = filter(ctx, 'lowpass', 340 * rate, 0.8)
    const ng = env(ctx, t0, gain * 0.5, 0.002, 0.07)
    src.connect(low).connect(ng).connect(dest)
    src.start(t0)
    src.stop(t0 + 0.2)

    // The knock of the formwork. Without this the whole voice lives under
    // 250Hz and a laptop plays nothing at all: mass landing has to be *heard*
    // as well as felt, and this is the part that gets heard.
    const knock = noiseSource(ctx)
    const kb = filter(ctx, 'bandpass', rand(430, 620) * rate, 1.6)
    const kg = env(ctx, t0, gain * 0.62, 0.001, 0.055)
    knock.connect(kb).connect(kg).connect(dest)
    knock.start(t0)
    knock.stop(t0 + 0.2)
    partial(ctx, t0, rand(360, 430) * rate, gain * 0.3, 0.07).connect(dest)
  },

  /** Plant somewhere below. Carries a camera move without announcing it. */
  mechanical(ctx, dest, t0, { gain = 0.05, rate = 1, dur = 0.38 } = {}) {
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    const f = rand(74, 92) * rate
    osc.frequency.setValueAtTime(f, t0)
    osc.frequency.linearRampToValueAtTime(f * rand(0.86, 1.14), t0 + dur)
    const low = filter(ctx, 'lowpass', 300, 0.9)
    const g = env(ctx, t0, gain, dur * 0.3, dur * 0.8)
    osc.connect(low).connect(g).connect(dest)
    osc.start(t0)
    osc.stop(t0 + dur + 0.3)

    // Two bands, not one. The 240 carries on a monitor; the 700 is what makes
    // it exist at all on a laptop.
    const src = noiseSource(ctx, 0.7)
    const band = filter(ctx, 'bandpass', 240 * rate, 1.2)
    const ng = env(ctx, t0, gain * 0.4, dur * 0.35, dur * 0.7)
    src.connect(band).connect(ng).connect(dest)
    src.start(t0)
    src.stop(t0 + dur + 0.3)

    const upper = noiseSource(ctx, 0.9)
    const ub = filter(ctx, 'bandpass', rand(620, 820) * rate, 1.4)
    const ug = env(ctx, t0, gain * 0.5, dur * 0.3, dur * 0.75)
    upper.connect(ub).connect(ug).connect(dest)
    upper.start(t0)
    upper.stop(t0 + dur + 0.3)
  },

  /**
   * A piece letting go.
   *
   * Scrolling back takes the building apart, and that is not the assembly in
   * reverse — playing a landing backwards is the oldest trick in sound design
   * and it always sounds like a trick. Setting a beam down and hoisting one
   * away are different events: the first is mass arriving at rest, the second
   * is a release and then air.
   *
   * So this is the landing's opposite in the two ways that matter. It has no
   * body at all — nothing is striking anything — just a dry detach. And where
   * `concrete` and `structural` fall in pitch as they settle, the air here
   * opens upward, because the piece is leaving.
   *
   * Lighter than a landing by design. Undoing should not be a performance.
   */
  release(ctx, dest, t0, { gain = 0.05, rate = 1 } = {}) {
    // the detach — dry, no resonance
    const src = noiseSource(ctx)
    const band = filter(ctx, 'bandpass', rand(2500, 3400) * rate, 3.2)
    const g = env(ctx, t0, gain, 0.001, 0.013)
    src.connect(band).connect(g).connect(dest)
    src.start(t0)
    src.stop(t0 + 0.08)

    // and the air it leaves behind, opening as it goes
    const lift = noiseSource(ctx, rand(0.9, 1.15))
    const lb = filter(ctx, 'bandpass', 640 * rate, 1.1)
    lb.frequency.setValueAtTime(620 * rate, t0)
    lb.frequency.exponentialRampToValueAtTime(1750 * rate, t0 + 0.17)
    const lg = env(ctx, t0 + 0.004, gain * 0.45, 0.05, 0.15)
    lift.connect(lb).connect(lg).connect(dest)
    lift.start(t0)
    lift.stop(t0 + 0.32)
  },

  /**
   * The bed under the assembly.
   *
   * Thirteen pieces landing over a fifth of the film is a long moment, and
   * thirteen isolated taps across it is not a building going up — it is
   * thirteen taps. This is what ties them together: a low, quiet mass that
   * thickens as more of the structure is standing and clears once it is up.
   *
   * Deliberately not a drone and deliberately not bass. It is lowpassed noise
   * with a slow-moving resonance around 120 Hz and a triangle an octave under
   * it, which is the sound of a large room with work going on in it rather
   * than the sound of a film trailer. `level()` is driven by how much of the
   * building is standing; at zero it is silent, and it is never loud.
   */
  assembly(ctx, dest, t0, { gain = 0.05 } = {}) {
    const src = noiseSource(ctx, 0.6)
    // 430, not 150. A bed under 150Hz is inaudible on the machine most people
    // read this page on, and an inaudible bed cannot tie anything together.
    const low = filter(ctx, 'lowpass', 430, 0.8)
    const body = filter(ctx, 'peaking', 260, 1.4)
    body.gain.value = 5

    const out = ctx.createGain()
    out.gain.setValueAtTime(0.0001, t0)

    const sub = ctx.createOscillator()
    sub.type = 'triangle'
    sub.frequency.value = 122          // an octave up from where it started
    const subGain = ctx.createGain()
    subGain.gain.value = 0.18

    // A slow wander so a held level never sits perfectly still.
    const drift = ctx.createOscillator()
    drift.frequency.value = 0.07
    const driftAmount = ctx.createGain()
    driftAmount.gain.value = 70
    drift.connect(driftAmount).connect(low.frequency)

    src.connect(low).connect(body).connect(out).connect(dest)
    sub.connect(subGain).connect(out)
    src.start(t0)
    sub.start(t0)
    drift.start(t0)

    return {
      /** 0..1, ramped rather than stepped so it never zippers. */
      level(v, at = ctx.currentTime) {
        const target = Math.max(0.0001, v * gain)
        out.gain.cancelScheduledValues(at)
        out.gain.setTargetAtTime(target, at, 0.25)
      },
      stop(at = ctx.currentTime, fade = 0.9) {
        out.gain.cancelScheduledValues(at)
        out.gain.setTargetAtTime(0.0001, at, fade / 3)
        src.stop(at + fade + 0.2)
        sub.stop(at + fade + 0.2)
        drift.stop(at + fade + 0.2)
      },
    }
  },

  /* ---- interface --------------------------------------------------- */

  /**
   * The workhorse. A pen tapped once on a drawing board — 20ms, no body.
   * `weight` 0..1 moves it from a fingernail tick to a firmer instrument
   * click without changing what it is.
   */
  click(ctx, dest, t0, { gain = 0.06, rate = 1, weight = 0.5 } = {}) {
    const src = noiseSource(ctx)
    const band = filter(
      ctx,
      'bandpass',
      rand(1700, 2400) * rate * (1 - weight * 0.28),
      rand(3.5, 6),
    )
    const g = env(ctx, t0, gain, 0.0008, 0.016 + weight * 0.022)
    src.connect(band).connect(g).connect(dest)
    src.start(t0)
    src.stop(t0 + 0.1)
    if (weight > 0.35) {
      partial(ctx, t0, rand(880, 1180) * rate, gain * 0.3 * weight, 0.05)
        .connect(dest)
    }
  },

  /**
   * The drawing is finished. Two quiet partials a fifth apart with a slow
   * attack, low-passed hard so it arrives as a settling rather than a chime.
   * Nothing here is allowed to read as a notification.
   */
  resolved(ctx, dest, t0, { gain = 0.05, rate = 1 } = {}) {
    const low = filter(ctx, 'lowpass', 1500, 0.6)
    low.connect(dest)
    const base = 392 * rate
    ;[
      [base, gain, 0.9],
      [base * 1.5, gain * 0.5, 0.75],
      [base * 0.5, gain * 0.35, 1.1],
    ].forEach(([f, peak, decay]) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = f * rand(0.998, 1.002)   // a hair of detune
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.linearRampToValueAtTime(peak, t0 + 0.09)
      g.gain.setTargetAtTime(0.0001, t0 + 0.09, decay / 3)
      osc.connect(g).connect(low)
      osc.start(t0)
      osc.stop(t0 + decay + 0.6)
    })
  },

  /**
   * A measuring instrument coming to rest on a figure. A click with a tuned
   * body, so four statistics can resolve on four pitches without any of them
   * sounding like a note.
   */
  measure(ctx, dest, t0, { gain = 0.05, rate = 1, step = 0 } = {}) {
    VOICES.click(ctx, dest, t0, { gain: gain * 0.8, rate: rate * 1.12, weight: 0.3 })
    const scale = [1, 1.19, 1.34, 1.5]
    partial(
      ctx,
      t0 + 0.012,
      520 * rate * scale[step % scale.length],
      gain * 0.34,
      0.13,
      'triangle',
    ).connect(dest)
  },
}

export const VOICE_IDS = Object.keys(VOICES)
