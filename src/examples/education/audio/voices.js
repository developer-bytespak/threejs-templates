/**
 * The education palette — seventeen synthesised voices.
 *
 * WHY THERE ARE NO AUDIO FILES
 *
 * Every sound here is made from noise and filters at the moment it plays. A
 * seed opening is a filtered noise transient plus two decaying resonances; a
 * page turn is a noise burst swept through a bandpass; graphite is noise with
 * a grain envelope. Those are what the recordings would be anyway, and
 * synthesising them means no repetition (every play differs by construction,
 * which is what "two or three variations of each sound" is really asking for),
 * no weight on a page already carrying 2.24 MB of geometry, and nothing to
 * licence. The engine reads a manifest if one is added later, so any single id
 * can be swapped for a real recording without touching code.
 *
 * WHAT THE BAND IS FOR
 *
 * These are tuned the same way construction-two's were, and for the same
 * reason: a mix measured correctly and still inaudible, because most of its
 * energy sat below 250 Hz where a laptop speaker radiates almost nothing.
 * Every voice here puts its identifying content between roughly 300 Hz and
 * 3.5 kHz, with lows present for body rather than for information.
 *
 * WHAT THEY ARE NOT
 *
 * Not a forest. This is a conceptual, educational space — the brief is
 * explicit that a nature documentary is the wrong register. The organic voices
 * are dry, close and small: a seed opening in a quiet room, not a woodland.
 */

/* One noise buffer, shared. Allocating two seconds of random numbers per
   sound would be the single most expensive thing this system does. */
let noiseBuffer = null

function noise(ctx) {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer
  const length = Math.floor(ctx.sampleRate * 2)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1
  noiseBuffer = buffer
  return buffer
}

function noiseSource(ctx, rate = 1) {
  const src = ctx.createBufferSource()
  src.buffer = noise(ctx)
  src.loop = true
  src.playbackRate.value = rate
  // A random start, so two plays of the same voice never read the same slice.
  src.loopStart = Math.random() * 1.6
  src.loopEnd = src.loopStart + 0.3
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
 * A gain with an attack and an exponential release.
 *
 * `setTargetAtTime` rather than a linear ramp: a decay that stops dead reads
 * as a sample being cut off, which is exactly the tell this palette exists to
 * avoid.
 */
function env(ctx, t0, peak, attack, release) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.linearRampToValueAtTime(peak, t0 + attack)
  g.gain.setTargetAtTime(0.0001, t0 + attack, release / 3)
  return g
}

/** A decaying partial. The body of anything struck, tapped or resonant. */
function partial(ctx, dest, t0, freq, peak, decay, type = 'sine') {
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.value = freq
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.linearRampToValueAtTime(peak, t0 + 0.004)
  g.gain.setTargetAtTime(0.0001, t0 + 0.004, decay / 3)
  osc.connect(g).connect(dest)
  osc.start(t0)
  osc.stop(t0 + decay + 0.12)
  return osc
}

const rand = (a, b) => a + Math.random() * (b - a)

export const VOICES = {
  /* ------------------------------------------------------------- ambience */
  /**
   * The quiet room the whole journey happens in.
   *
   * Deliberately not a forest and not a drone: filtered noise with a slow
   * wander on the filter, so it reads as air in a large space rather than as a
   * held note. Returns a stop function.
   */
  quietSpace(ctx, dest, t0, { gain = 0.04 } = {}) {
    const src = noiseSource(ctx, 0.6)
    const lp = filter(ctx, 'lowpass', 620, 0.5)
    const hp = filter(ctx, 'highpass', 190, 0.4)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(gain, t0 + 3.2)

    // Two incommensurate periods, so the wander never repeats audibly.
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.043
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 130
    lfo.connect(lfoGain).connect(lp.frequency)
    lfo.start(t0)

    src.connect(hp).connect(lp).connect(g).connect(dest)
    src.start(t0)

    return (t, fade = 1.2) => {
      g.gain.cancelScheduledValues(t)
      g.gain.setValueAtTime(g.gain.value, t)
      g.gain.linearRampToValueAtTime(0.0001, t + fade)
      src.stop(t + fade + 0.1)
      lfo.stop(t + fade + 0.1)
    }
  },

  /**
   * A place that exists somewhere beyond the foliage.
   *
   * The campus, heard before it is seen. Band-limited hard — distance is
   * mostly the absence of high frequencies — with a slow swell so it breathes
   * rather than sits. Levelled 0..1 rather than started and stopped, because
   * the approach crosses its boundary in both directions.
   */
  distantPlace(ctx, dest, t0, { gain = 0.05 } = {}) {
    const src = noiseSource(ctx, 0.45)
    const bp = filter(ctx, 'bandpass', 430, 0.8)
    const lp = filter(ctx, 'lowpass', 1150, 0.6)
    const level = ctx.createGain()
    level.gain.setValueAtTime(0.0001, t0)

    const swell = ctx.createOscillator()
    swell.frequency.value = 0.061
    const swellGain = ctx.createGain()
    swellGain.gain.value = 95
    swell.connect(swellGain).connect(bp.frequency)
    swell.start(t0)

    // One low partial for the sense of a large volume of air, kept above the
    // range a laptop speaker throws away.
    const body = ctx.createOscillator()
    body.type = 'sine'
    body.frequency.value = 138
    const bodyGain = ctx.createGain()
    bodyGain.gain.value = 0.12
    body.connect(bodyGain).connect(level)
    body.start(t0)

    src.connect(bp).connect(lp).connect(level).connect(dest)
    src.start(t0)

    return {
      level(v) {
        const t = ctx.currentTime
        level.gain.cancelScheduledValues(t)
        level.gain.setTargetAtTime(Math.max(0.0001, gain * v), t, 0.9)
      },
      stop(t, fade = 1.4) {
        level.gain.cancelScheduledValues(t)
        level.gain.setValueAtTime(level.gain.value, t)
        level.gain.linearRampToValueAtTime(0.0001, t + fade)
        src.stop(t + fade + 0.1)
        swell.stop(t + fade + 0.1)
        body.stop(t + fade + 0.1)
      },
    }
  },

  /**
   * The bed under the growing tree.
   *
   * Not a tree sound — a sense of something under tension increasing. Two
   * partials a fifth apart with slow beating, plus a breath of filtered noise.
   * Levelled by how far the growth front has climbed.
   */
  growthBed(ctx, dest, t0, { gain = 0.05 } = {}) {
    const level = ctx.createGain()
    level.gain.setValueAtTime(0.0001, t0)
    level.connect(dest)

    const voices = [
      { f: 196, g: 0.5 },
      { f: 294, g: 0.32 },
      { f: 391, g: 0.18 },
    ]
    const oscs = voices.map(({ f, g }) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = f * rand(0.998, 1.002)
      const vg = ctx.createGain()
      vg.gain.value = g
      osc.connect(vg).connect(level)
      osc.start(t0)
      return osc
    })

    const src = noiseSource(ctx, 0.8)
    const bp = filter(ctx, 'bandpass', 760, 1.1)
    const ng = ctx.createGain()
    ng.gain.value = 0.22
    src.connect(bp).connect(ng).connect(level)
    src.start(t0)

    return {
      level(v) {
        const t = ctx.currentTime
        level.gain.cancelScheduledValues(t)
        level.gain.setTargetAtTime(Math.max(0.0001, gain * v), t, 0.55)
      },
      stop(t, fade = 0.8) {
        level.gain.cancelScheduledValues(t)
        level.gain.setValueAtTime(level.gain.value, t)
        level.gain.linearRampToValueAtTime(0.0001, t + fade)
        for (const osc of oscs) osc.stop(t + fade + 0.1)
        src.stop(t + fade + 0.1)
      },
    }
  },

  /* -------------------------------------------------------------- organic */
  /** Small organic movement — something shifting in soil. Dry and close. */
  soil(ctx, dest, t0, { gain = 0.05, rate = 1 } = {}) {
    const src = noiseSource(ctx, rand(0.85, 1.1))
    const bp = filter(ctx, 'bandpass', rand(520, 700) * rate, 1.4)
    const g = env(ctx, t0, gain, 0.006, 0.1)
    src.connect(bp).connect(g).connect(dest)
    src.start(t0)
    src.stop(t0 + 0.22)
    partial(ctx, dest, t0, rand(150, 178) * rate, gain * 0.3, 0.2)
  },

  /**
   * The seed opening.
   *
   * A short shell crack — a hard transient through a high bandpass — then a
   * softer opening as the two halves part, and one low resonance underneath so
   * it has a size. This is the first thing anyone hears, so it is the most
   * carefully shaped voice here and still the quietest kind of event.
   */
  seedOpen(ctx, dest, t0, { gain = 0.05, rate = 1 } = {}) {
    const crack = noiseSource(ctx, rand(1.0, 1.2))
    const cb = filter(ctx, 'bandpass', rand(1750, 2200) * rate, 3.0)
    const cg = env(ctx, t0, gain, 0.001, 0.016)
    crack.connect(cb).connect(cg).connect(dest)
    crack.start(t0)
    crack.stop(t0 + 0.1)

    // The part sweeps downward: something opening, not something snapping.
    const part = noiseSource(ctx, rand(0.9, 1.05))
    const pb = filter(ctx, 'bandpass', 1300 * rate, 1.0)
    pb.frequency.setValueAtTime(1300 * rate, t0 + 0.01)
    pb.frequency.exponentialRampToValueAtTime(520 * rate, t0 + 0.3)
    const pg = env(ctx, t0 + 0.012, gain * 0.5, 0.05, 0.24)
    part.connect(pb).connect(pg).connect(dest)
    part.start(t0)
    part.stop(t0 + 0.55)

    partial(ctx, dest, t0 + 0.01, rand(310, 350) * rate, gain * 0.34, 0.4)
  },

  /** Wood under load. The trunk and the major branches. */
  branchCreak(ctx, dest, t0, { gain = 0.05, rate = 1 } = {}) {
    const src = noiseSource(ctx, rand(0.5, 0.7))
    const bp = filter(ctx, 'bandpass', rand(400, 520) * rate, 5.5)
    // A slow upward drift is what makes it read as load increasing.
    bp.frequency.linearRampToValueAtTime(rand(620, 760) * rate, t0 + 0.42)
    const g = env(ctx, t0, gain, 0.05, 0.3)
    src.connect(bp).connect(g).connect(dest)
    src.start(t0)
    src.stop(t0 + 0.75)
    // No low partial. One was here, and a short decaying sine at 230 Hz under
    // a noise transient is a drum — which is exactly what it sounded like.
    // Wood under load is all midrange fibre; the body has to come from the
    // filter's Q, not from a struck tone underneath it.
  },

  /** Foliage. A brief dry rustle, nothing like wind in trees. */
  leaf(ctx, dest, t0, { gain = 0.04, rate = 1, dur = 0.3 } = {}) {
    const src = noiseSource(ctx, rand(1.2, 1.5))
    const hp = filter(ctx, 'highpass', 900 * rate, 0.7)
    const bp = filter(ctx, 'bandpass', rand(2100, 2900) * rate, 0.9)
    const g = env(ctx, t0, gain, 0.03, dur)
    src.connect(hp).connect(bp).connect(g).connect(dest)
    src.start(t0)
    src.stop(t0 + dur + 0.3)
  },

  /* ------------------------------------------------------------ knowledge */
  /** Paper being moved. Flat, dry, handled. */
  paper(ctx, dest, t0, { gain = 0.045, rate = 1, dur = 0.26 } = {}) {
    const src = noiseSource(ctx, rand(1.1, 1.4))
    const bp = filter(ctx, 'bandpass', rand(1500, 2100) * rate, 0.8)
    const g = env(ctx, t0, gain, 0.02, dur)
    src.connect(bp).connect(g).connect(dest)
    src.start(t0)
    src.stop(t0 + dur + 0.25)
  },

  /**
   * A page turning.
   *
   * The sweep is the whole identity: a bandpass climbing then falling across
   * a third of a second is a sheet passing through an arc. This is what the
   * museum uses between exhibits instead of a whoosh.
   */
  page(ctx, dest, t0, { gain = 0.05, rate = 1 } = {}) {
    const src = noiseSource(ctx, rand(0.95, 1.2))
    const bp = filter(ctx, 'bandpass', 900 * rate, 0.9)
    bp.frequency.setValueAtTime(760 * rate, t0)
    bp.frequency.exponentialRampToValueAtTime(2300 * rate, t0 + 0.14)
    bp.frequency.exponentialRampToValueAtTime(880 * rate, t0 + 0.34)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(gain, t0 + 0.06)
    g.gain.linearRampToValueAtTime(gain * 0.75, t0 + 0.2)
    g.gain.setTargetAtTime(0.0001, t0 + 0.22, 0.09)
    src.connect(bp).connect(g).connect(dest)
    src.start(t0)
    src.stop(t0 + 0.6)
  },

  /** Graphite on paper. Grain, not a scrape. */
  pencil(ctx, dest, t0, { gain = 0.045, rate = 1, dur = 0.12 } = {}) {
    const src = noiseSource(ctx, rand(1.5, 1.9))
    const bp = filter(ctx, 'bandpass', rand(2300, 3100) * rate, 1.6)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    // Stepped rather than smooth: graphite is a sequence of catches.
    const steps = 5
    for (let i = 0; i < steps; i += 1) {
      const t = t0 + (dur * i) / steps
      g.gain.linearRampToValueAtTime(gain * rand(0.45, 1), t + 0.004)
      g.gain.linearRampToValueAtTime(gain * 0.16, t + dur / steps)
    }
    g.gain.setTargetAtTime(0.0001, t0 + dur, 0.035)
    src.connect(bp).connect(g).connect(dest)
    src.start(t0)
    src.stop(t0 + dur + 0.2)
  },

  /** Soft glass. Laboratory, not a chime. Two partials, short. */
  glass(ctx, dest, t0, { gain = 0.045, rate = 1 } = {}) {
    const src = noiseSource(ctx, 1.4)
    const bp = filter(ctx, 'bandpass', rand(2600, 3300) * rate, 4)
    const g = env(ctx, t0, gain * 0.5, 0.001, 0.014)
    src.connect(bp).connect(g).connect(dest)
    src.start(t0)
    src.stop(t0 + 0.08)
    partial(ctx, dest, t0, rand(1180, 1320) * rate, gain * 0.5, 0.26)
    partial(ctx, dest, t0, rand(1760, 1980) * rate, gain * 0.22, 0.17)
  },

  /* ------------------------------------------------------------ technical */
  /** A technical click. Narrow, electronic, no ring. */
  technical(ctx, dest, t0, { gain = 0.05, rate = 1, weight = 0.5 } = {}) {
    const src = noiseSource(ctx, rand(1.1, 1.35))
    const bp = filter(ctx, 'bandpass', rand(1900, 2500) * rate, 5)
    const g = env(ctx, t0, gain, 0.001, 0.011)
    src.connect(bp).connect(g).connect(dest)
    src.start(t0)
    src.stop(t0 + 0.06)
    if (weight > 0.2) partial(ctx, dest, t0, rand(760, 880) * rate, gain * weight * 0.4, 0.06)
  },

  /** A small mechanism. A detent, not a machine. */
  mechanism(ctx, dest, t0, { gain = 0.05, rate = 1 } = {}) {
    const src = noiseSource(ctx, rand(0.9, 1.1))
    const bp = filter(ctx, 'bandpass', rand(620, 820) * rate, 3.4)
    const g = env(ctx, t0, gain, 0.002, 0.03)
    src.connect(bp).connect(g).connect(dest)
    src.start(t0)
    src.stop(t0 + 0.12)
    partial(ctx, dest, t0 + 0.012, rand(430, 500) * rate, gain * 0.3, 0.1)
  },

  /**
   * A clean tone, for the two halves of the connection and for confirmations.
   *
   * `step` transposes it within one scale so a pair reads as related rather
   * than as two unrelated beeps, which is the whole point of the connection
   * chapter.
   */
  tone(ctx, dest, t0, { gain = 0.045, rate = 1, step = 0, dur = 0.7 } = {}) {
    const base = 392 * Math.pow(2, step / 12) * rate
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = base
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(gain, t0 + 0.09)
    g.gain.setTargetAtTime(0.0001, t0 + 0.12, dur / 3)
    osc.connect(g).connect(dest)
    osc.start(t0)
    osc.stop(t0 + dur + 0.3)
    // A fifth above at a fraction of the level: presence without a chord.
    partial(ctx, dest, t0, base * 1.5, gain * 0.16, dur * 0.5)
  },


  /* ------------------------------------------------- forming (continuous) */
  /**
   * Wood coming into existence. Continuous, levelled by how fast the tree is
   * changing.
   *
   * GRAINS, NOT A WASH. The first attempt was two bandpassed noise layers with
   * slow filter sweeps, and it sounded like the sea — which, listening back,
   * is exactly what that recipe is: broadband noise moving slowly is surf, and
   * no amount of retuning the band was going to fix it, because the problem
   * was the smoothness itself.
   *
   * Wood giving way is not smooth. It is thousands of small separate events —
   * fibres letting go one after another — so this discards everything quiet
   * and keeps only peaks, then rings what is left through three tight
   * resonators. The result is a scatter of grains with a woody body, and it
   * gets DENSER rather than merely louder as the tree forms faster, because
   * the level drives the amount of signal pushed past the threshold.
   *
   * There is no LFO anywhere in here. That was the ocean.
   */
  woodForm(ctx, dest, t0, { gain = 0.05 } = {}) {
    const out = ctx.createGain()
    out.gain.setValueAtTime(0.0001, t0)
    out.connect(dest)

    // Slow playback spreads the noise out in time, so what survives the dead
    // zone below is a scatter of separate events rather than a continuous
    // rush. This is the difference between fibres and surf.
    const src = noiseSource(ctx, 0.3)

    // Density control. Raising the level into the shaper pushes more of the
    // waveform past the threshold, so more grains get through — which means
    // "forming faster" is literally "more fibres letting go per second"
    // rather than just the same wash turned up.
    const pre = ctx.createGain()
    pre.gain.setValueAtTime(0.8, t0)

    // A dead zone with a steep shoulder. Everything quiet is discarded and
    // only peaks survive, turning smooth noise into sparse spikes.
    const shaper = ctx.createWaveShaper()
    const n = 1024
    const curve = new Float32Array(n)
    for (let i = 0; i < n; i += 1) {
      const x = (i / (n - 1)) * 2 - 1
      const a = Math.abs(x)
      curve[i] = a < 0.74 ? 0 : Math.sign(x) * ((a - 0.74) / 0.26) ** 0.55
    }
    shaper.curve = curve
    shaper.oversample = '2x'
    src.connect(pre).connect(shaper)

    // Three tight resonators give each grain a woody ring. High Q is what
    // makes a click sound like it came off something solid; the ratios are
    // deliberately not harmonic, because a harmonic set is a musical note.
    const bank = [
      [318, 15, 1.0],
      [742, 13, 0.62],
      [1490, 11, 0.34],
    ].map(([freq, q, level]) => {
      const bp = filter(ctx, 'bandpass', freq, q)
      const g = ctx.createGain()
      g.gain.value = level
      shaper.connect(bp).connect(g).connect(out)
      return bp
    })

    src.start(t0)

    return {
      level(v) {
        const t = ctx.currentTime
        out.gain.cancelScheduledValues(t)
        out.gain.setTargetAtTime(Math.max(0.0001, gain * v), t, 0.1)
        // More grains under load, and the bank opens slightly upward so it
        // tightens rather than just thickening.
        pre.gain.setTargetAtTime(0.7 + v * 2.4, t, 0.15)
        bank[0].frequency.setTargetAtTime(318 + v * 46, t, 0.4)
        bank[1].frequency.setTargetAtTime(742 + v * 110, t, 0.4)
      },
      stop(t, fade = 0.45) {
        out.gain.cancelScheduledValues(t)
        out.gain.setValueAtTime(out.gain.value, t)
        out.gain.linearRampToValueAtTime(0.0001, t + fade)
        src.stop(t + fade + 0.1)
      },
    }
  },

  /**
   * Foliage filling in. Continuous, levelled by how much canopy exists.
   *
   * The one-shot version arrived once, late, and was over — "one note", which
   * is a fair description of a single 300ms rustle standing in for thousands of
   * leaves appearing. Dense small-grain noise with an amplitude flicker gives
   * it population: it sounds like many small things, and more of them as the
   * level rises.
   */
  leafForm(ctx, dest, t0, { gain = 0.05 } = {}) {
    const level = ctx.createGain()
    level.gain.setValueAtTime(0.0001, t0)
    level.connect(dest)

    const src = noiseSource(ctx, 1.6)
    const hp = filter(ctx, 'highpass', 1100, 0.6)
    const bp = filter(ctx, 'bandpass', 2600, 0.8)
    src.connect(hp).connect(bp).connect(level)
    src.start(t0)

    // Flicker, not tremolo: two slow rates well under any audible pitch, so it
    // reads as a surface being disturbed rather than as modulation.
    const f1 = ctx.createOscillator()
    f1.frequency.value = 3.3
    const f1g = ctx.createGain()
    f1g.gain.value = 0.35
    f1.connect(f1g).connect(level.gain)
    f1.start(t0)

    const f2 = ctx.createOscillator()
    f2.frequency.value = 1.7
    const f2g = ctx.createGain()
    f2g.gain.value = 0.22
    f2.connect(f2g).connect(level.gain)
    f2.start(t0)

    return {
      level(v) {
        const t = ctx.currentTime
        level.gain.cancelScheduledValues(t)
        level.gain.setTargetAtTime(Math.max(0.0001, gain * v), t, 0.25)
        f1g.gain.setTargetAtTime(gain * v * 0.35, t, 0.25)
        f2g.gain.setTargetAtTime(gain * v * 0.22, t, 0.25)
        bp.frequency.setTargetAtTime(2300 + v * 700, t, 0.4)
      },
      stop(t, fade = 0.7) {
        level.gain.cancelScheduledValues(t)
        level.gain.setValueAtTime(level.gain.value, t)
        level.gain.linearRampToValueAtTime(0.0001, t + fade)
        src.stop(t + fade + 0.1)
        f1.stop(t + fade + 0.1)
        f2.stop(t + fade + 0.1)
      },
    }
  },

  /**
   * A prop arriving — the "tung".
   *
   * A struck tonal body: a short noise transient for the contact, then three
   * partials in a slightly inharmonic relationship so it rings like an object
   * rather than like a note. `step` moves it through a scale, which is what
   * turns five artifact groups landing in turn into a phrase instead of five
   * identical thuds.
   */
  tung(ctx, dest, t0, { gain = 0.05, rate = 1, step = 0 } = {}) {
    const base = 247 * Math.pow(2, step / 12) * rate

    const hit = noiseSource(ctx, 1.2)
    const hb = filter(ctx, 'bandpass', base * 5.5, 2.4)
    const hg = env(ctx, t0, gain * 0.5, 0.001, 0.014)
    hit.connect(hb).connect(hg).connect(dest)
    hit.start(t0)
    hit.stop(t0 + 0.07)

    // Slightly stretched, the way a struck solid is.
    partial(ctx, dest, t0, base, gain * 0.85, 1.05)
    partial(ctx, dest, t0, base * 2.04, gain * 0.3, 0.6)
    partial(ctx, dest, t0, base * 3.11, gain * 0.13, 0.32)
  },

  /**
   * The college coming into existence. Continuous, levelled by how fast it is
   * resolving.
   *
   * A BUILDING, NOT A CHORD. The first attempt stacked sine partials on
   * 174 / 261 / 349 / 523 — which is a major triad with an octave on top, and
   * a major triad swelling up underneath a reveal is a fanfare. It sounded
   * like winning something, which is the opposite of the feeling: the campus
   * is not a prize, it is a place that turns out to have been there all along.
   *
   * So there is no chord here and no consonance to hear. What a large built
   * volume actually sounds like is a low body, a broad band of moving air, and
   * a couple of modal peaks where the room resonates — and those modes are at
   * deliberately irrational ratios (2.76, 5.41) so no interval can form
   * between them. Stone and glass, not brass.
   */
  campusForm(ctx, dest, t0, { gain = 0.05 } = {}) {
    const level = ctx.createGain()
    level.gain.setValueAtTime(0.0001, t0)
    level.connect(dest)

    // Body. Two voices a fraction apart so it beats slowly and reads as large
    // rather than as a held note.
    const base = 116
    const body = [base, base * 1.006].map((f) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = f
      const g = ctx.createGain()
      g.gain.value = 0.3
      osc.connect(g).connect(level)
      osc.start(t0)
      return osc
    })

    // Room modes. Irrational ratios, so they colour the space without
    // implying a key.
    const modes = [
      [base * 2.76, 0.12],
      [base * 5.41, 0.055],
    ].map(([f, g]) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = f
      const vg = ctx.createGain()
      vg.gain.value = g
      osc.connect(vg).connect(level)
      osc.start(t0)
      return osc
    })

    // The air in the volume. Broad and still — a large room's floor, not a
    // sweep, because a sweep is weather.
    const src = noiseSource(ctx, 0.8)
    const hp = filter(ctx, 'highpass', 620, 0.5)
    const lp = filter(ctx, 'lowpass', 2300, 0.5)
    const ng = ctx.createGain()
    ng.gain.value = 0.34
    src.connect(hp).connect(lp).connect(ng).connect(level)
    src.start(t0)

    return {
      level(v) {
        const t = ctx.currentTime
        level.gain.cancelScheduledValues(t)
        level.gain.setTargetAtTime(Math.max(0.0001, gain * v), t, 0.35)
        // The volume opens up as it resolves: more air, higher ceiling.
        lp.frequency.setTargetAtTime(1700 + v * 1400, t, 0.5)
      },
      stop(t, fade = 0.9) {
        level.gain.cancelScheduledValues(t)
        level.gain.setValueAtTime(level.gain.value, t)
        level.gain.linearRampToValueAtTime(0.0001, t + fade)
        for (const osc of [...body, ...modes]) osc.stop(t + fade + 0.1)
        src.stop(t + fade + 0.1)
      },
    }
  },

  /**
   * Air past the lens. Continuous, levelled by how fast the camera is moving.
   *
   * Not a transition whoosh — there is no trigger and no envelope. It is a
   * function of camera velocity, so it exists only while the camera is
   * actually travelling and its intensity is the travel. Scrolling slowly
   * produces almost nothing; flinging the scrollbar produces a real rush; a
   * still camera is silent. Because it is derived rather than scheduled, it
   * cannot fire at the wrong moment.
   *
   * Band-limited well below a hiss: the frequency and the Q both open with
   * level, so faster reads as wider and closer rather than just louder.
   */
  airMove(ctx, dest, t0, { gain = 0.05 } = {}) {
    const level = ctx.createGain()
    level.gain.setValueAtTime(0.0001, t0)
    level.connect(dest)

    const src = noiseSource(ctx, 1.0)
    const bp = filter(ctx, 'bandpass', 480, 0.6)
    const lp = filter(ctx, 'lowpass', 2600, 0.4)
    src.connect(bp).connect(lp).connect(level)
    src.start(t0)

    return {
      level(v) {
        const t = ctx.currentTime
        level.gain.cancelScheduledValues(t)
        // Fast up, slower down: air arrives with the movement and falls away
        // behind it, which is how motion actually sounds.
        level.gain.setTargetAtTime(Math.max(0.0001, gain * v), t, v > 0.05 ? 0.06 : 0.35)
        bp.frequency.setTargetAtTime(420 + v * 900, t, 0.12)
        bp.Q.setTargetAtTime(0.6 + v * 1.1, t, 0.12)
      },
      stop(t, fade = 0.4) {
        level.gain.cancelScheduledValues(t)
        level.gain.setValueAtTime(level.gain.value, t)
        level.gain.linearRampToValueAtTime(0.0001, t + fade)
        src.stop(t + fade + 0.1)
      },
    }
  },

  /* ---------------------------------------------------------- transitions */
  /** Moving between exhibits. Air displaced, not a whoosh. */
  spatial(ctx, dest, t0, { gain = 0.04, rate = 1, dur = 0.5 } = {}) {
    const src = noiseSource(ctx, rand(0.7, 0.9))
    const bp = filter(ctx, 'bandpass', 700 * rate, 0.7)
    bp.frequency.setValueAtTime(560 * rate, t0)
    bp.frequency.exponentialRampToValueAtTime(1500 * rate, t0 + dur * 0.55)
    bp.frequency.exponentialRampToValueAtTime(620 * rate, t0 + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(gain, t0 + dur * 0.35)
    g.gain.setTargetAtTime(0.0001, t0 + dur * 0.5, dur / 4)
    src.connect(bp).connect(g).connect(dest)
    src.start(t0)
    src.stop(t0 + dur + 0.4)
  },

  /**
   * The campus reveal. The one large moment on the page.
   *
   * Large is doing a lot of work in that sentence: it is still under −20 dBFS.
   * What makes it feel like the biggest thing that happens is that it is the
   * only voice with a long tail and a real low end — an airy expansion over a
   * slow chord that opens rather than lands. Explicitly not an impact: there
   * is no transient at the front at all.
   */
  revealResonance(ctx, dest, t0, { gain = 0.06, rate = 1 } = {}) {
    // Air opening outward.
    const src = noiseSource(ctx, 0.55)
    const bp = filter(ctx, 'bandpass', 480 * rate, 0.6)
    bp.frequency.setValueAtTime(400 * rate, t0)
    bp.frequency.exponentialRampToValueAtTime(1500 * rate, t0 + 1.5)
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.0001, t0)
    ng.gain.linearRampToValueAtTime(gain * 0.55, t0 + 0.55)
    ng.gain.setTargetAtTime(0.0001, t0 + 0.8, 0.8)
    src.connect(bp).connect(ng).connect(dest)
    src.start(t0)
    src.stop(t0 + 3.4)

    // A chord that opens: root, fifth, octave, entering in turn.
    const base = 294 * rate
    partial(ctx, dest, t0 + 0.02, base, gain * 0.5, 2.0)
    partial(ctx, dest, t0 + 0.18, base * 1.5, gain * 0.34, 1.9)
    partial(ctx, dest, t0 + 0.34, base * 2, gain * 0.2, 1.7)
    partial(ctx, dest, t0 + 0.05, base * 0.5, gain * 0.26, 2.2)
  },

  /**
   * Something settling into place. The end of a chapter, or of the page.
   *
   * A fifth resolving downward with no transient — heard as an answer rather
   * than as an event.
   */
  resolution(ctx, dest, t0, { gain = 0.045, rate = 1 } = {}) {
    const base = 330 * rate
    partial(ctx, dest, t0, base * 1.5, gain * 0.4, 0.5)
    partial(ctx, dest, t0 + 0.1, base, gain * 0.6, 1.0)
    partial(ctx, dest, t0 + 0.1, base * 2, gain * 0.14, 0.8)
  },
}

export const VOICE_IDS = Object.keys(VOICES)
