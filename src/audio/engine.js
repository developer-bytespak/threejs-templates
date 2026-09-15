/**
 * The one audio engine, shared by every route that has sound.
 *
 * This is construction-two's audio manager with the route-specific parts
 * lifted out. Nothing about its behaviour changed in the move — the rules it
 * enforces were learned the hard way on that page and they are the reason a
 * second route can have sound without relearning any of them:
 *
 *   Nothing before a gesture. The context is not constructed until someone
 *   presses the sound control. Until then every `sound()` is a silent no-op —
 *   no queueing, because a burst of held-back sounds arriving at once is
 *   worse than silence. `wheel` is not an activation-triggering event, which
 *   is why trying to unlock on scroll never worked.
 *
 *   Nothing twice. Every id carries a cooldown. A scroll-driven page fires its
 *   thresholds in a few frames; the cooldown turns that into one sound.
 *
 *   Nothing loud. Master runs into a compressor and then a tanh soft clip, so
 *   however many moments land on one frame the sum cannot exceed the ceiling.
 *   Structural, not a promise: a compressor has an attack time and a stack of
 *   transients is through it before it reacts.
 *
 *   Nothing at all, if the page would rather not. Reduced motion drops
 *   everything except the sounds a route marks essential. A coarse pointer
 *   drops every hover id. A blocked AudioContext disables the system silently.
 *
 * A route calls `configureAudio()` with its own table and palette. Only one
 * route is mounted at a time, so one configuration is live at a time; routing
 * away and back reconfigures rather than stacking.
 */

/* ------------------------------------------------------------------ config */
const EMPTY = {
  storageKey: 'bytes:sound',
  legacyKeys: [],
  master: 0.15,
  buses: { ambience: 0.2, interaction: 0.3, transitions: 0.2 },
  sounds: {},
  essential: new Set(),
  calibration: {},
  voices: {},
  manifest: null,
  onAudible: null,
  // Which sound answers a press. A route's own id, because the press has to
  // sound like it belongs to the page it happened on.
  confirmId: null,
}

let config = EMPTY

/* ------------------------------------------------------------------- state */
let ctx = null
let master = null
let buses = null
let enabled = false
let unlocked = false
let failed = false
let reduced = false
let coarse = false
const last = new Map()
const samples = new Map()
const listeners = new Set()
const beds = new Map()

export const dbToGain = (db) => 10 ** (db / 20)

/* -------------------------------------------------------------- preference */
/**
 * One preference for the whole site.
 *
 * Someone who turned sound on while reading one route should not have to ask
 * again on the next, so the key is not route-scoped. `legacyKeys` migrates the
 * answer from wherever an older build of a route stored it — a visitor who
 * already made this decision must not be asked a second time because the key
 * was renamed underneath them.
 */
function readPref() {
  try {
    const stored = localStorage.getItem(config.storageKey)
    if (stored !== null) return stored === 'on'
    for (const key of config.legacyKeys) {
      const old = localStorage.getItem(key)
      if (old !== null) {
        localStorage.setItem(config.storageKey, old)
        return old === 'on'
      }
    }
    return false
  } catch {
    return false
  }
}

function writePref(on) {
  try {
    localStorage.setItem(config.storageKey, on ? 'on' : 'off')
  } catch {
    /* private mode, blocked storage — the preference just won't persist */
  }
}

/** Has this visitor ever answered the question? Drives the invitation only. */
export function hasPref() {
  try {
    if (localStorage.getItem(config.storageKey) !== null) return true
    return config.legacyKeys.some((key) => localStorage.getItem(key) !== null)
  } catch {
    return true
  }
}

function notify() {
  // Routes with a sustained layer hang it off this rather than off the unlock
  // path, so one hook covers every way audibility can change: the first press,
  // a later mute, an unmute, a teardown.
  if (config.onAudible) config.onAudible(enabled && unlocked && !failed)
  for (const fn of listeners) fn({ enabled, unlocked, failed })
}

function media() {
  if (typeof matchMedia !== 'function') return
  reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  coarse = matchMedia('(hover: none)').matches
}

/* ------------------------------------------------------------------- graph */
/**
 *     bus → master → compressor → soft clip → destination
 *
 * Exported because the calibration tool and the policy tests need this exact
 * graph. They measure what a page will actually produce, and a second
 * hand-copied compressor in a tool file measures something that does not
 * exist — they had drifted once already.
 */
export function createChain(audioCtx, level = config.master, busLevels = config.buses) {
  const comp = audioCtx.createDynamicsCompressor()
  comp.threshold.value = -12
  comp.knee.value = 12
  comp.ratio.value = 6
  comp.attack.value = 0.004
  comp.release.value = 0.2

  const clip = audioCtx.createWaveShaper()
  const n = 2048
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i += 1) {
    const x = (i / (n - 1)) * 2 - 1
    curve[i] = Math.tanh(x * 1.2)
  }
  clip.curve = curve
  clip.oversample = '2x'

  const out = audioCtx.createGain()
  out.gain.value = level
  out.connect(comp).connect(clip).connect(audioCtx.destination)

  const made = {}
  for (const [name, busLevel] of Object.entries(busLevels)) {
    const g = audioCtx.createGain()
    g.gain.value = busLevel
    g.connect(out)
    made[name] = g
  }
  return { master: out, buses: made }
}

function build() {
  const Ctx =
    typeof AudioContext !== 'undefined'
      ? AudioContext
      : typeof webkitAudioContext !== 'undefined'
        ? webkitAudioContext // eslint-disable-line no-undef
        : null
  if (!Ctx) {
    failed = true
    return false
  }
  try {
    ctx = new Ctx({ latencyHint: 'interactive' })
  } catch {
    failed = true
    return false
  }
  const chain = createChain(ctx)
  master = chain.master
  buses = chain.buses
  master.gain.value = enabled ? config.master : 0
  return true
}

/* ----------------------------------------------------------------- samples */
/**
 * Optional real recordings.
 *
 * One request for a manifest that is not there by default. A route that ships
 * `manifest.json` mapping sound ids to files gets those ids played from the
 * recording; every other id stays synthesised, so a single sound can be
 * replaced without touching any code.
 */
async function loadSamples() {
  if (!config.manifest) return
  let list
  try {
    const res = await fetch(config.manifest, { cache: 'force-cache' })
    if (!res.ok) return
    list = await res.json()
  } catch {
    return // no manifest is the normal case
  }
  const base = config.manifest.replace(/manifest\.json$/, '')
  await Promise.all(
    Object.entries(list).map(async ([id, file]) => {
      if (!config.sounds[id]) return
      try {
        const res = await fetch(base + file)
        if (!res.ok) return
        samples.set(id, await ctx.decodeAudioData(await res.arrayBuffer()))
      } catch {
        /* a missing or undecodable file just leaves the voice synthesised */
      }
    }),
  )
}

/* -------------------------------------------------------------------- beds */
/**
 * Sustained layers — room tone, a growth bed, distant campus air.
 *
 * Built on demand and left running at zero rather than torn down and rebuilt,
 * because a reader scrolling back and forth across the same boundary would
 * otherwise start and stop an oscillator repeatedly, which is both wasteful
 * and audible. The engine owns every bed so muting and teardown can silence
 * them without each route remembering to.
 *
 * `level(v)` is 0..1. Changes smaller than `epsilon` are dropped: at 60fps an
 * unconditional ramp is sixty pointless scheduled events a second.
 */
export function bed(name, spec) {
  let entry = beds.get(name)
  if (!entry) {
    entry = { spec, handle: null, at: -1 }
    beds.set(name, entry)
  }
  entry.spec = spec

  return {
    level(v) {
      if (!enabled || !unlocked || failed || !ctx || (reduced && !spec.essential)) return
      if (!entry.handle) {
        const voice = config.voices[spec.voice]
        const bus = buses[spec.bus] ?? buses.ambience
        if (!voice || !bus) return
        const busLevel = config.buses[spec.bus] ?? 1
        try {
          entry.handle = voice(ctx, bus, ctx.currentTime, {
            gain:
              (dbToGain(spec.peak) / (busLevel * config.master)) * (spec.trim ?? 1),
          })
        } catch {
          entry.handle = null
          return
        }
      }
      const eps = spec.epsilon ?? 0.02
      if (Math.abs(v - entry.at) < eps) return
      entry.at = v
      try {
        // Two voice shapes exist: one returns a stop function, one returns a
        // controller. A bed that cannot be levelled is simply on or off.
        if (typeof entry.handle === 'object' && entry.handle.level) entry.handle.level(v)
      } catch {
        /* context went away underneath us */
      }
    },
    stop() {
      stopBed(name)
    },
  }
}

function stopBed(name) {
  const entry = beds.get(name)
  if (!entry || !entry.handle) return
  try {
    if (typeof entry.handle === 'function') entry.handle(ctx.currentTime, 0.8)
    else if (entry.handle.stop) entry.handle.stop(ctx.currentTime, 0.6)
  } catch {
    /* already torn down */
  }
  entry.handle = null
  entry.at = -1
}

function stopAllBeds() {
  for (const name of beds.keys()) stopBed(name)
}

/* -------------------------------------------------------------------- play */
/**
 * Play a named moment. Safe to call at any time, from anywhere: before the
 * context exists, after teardown, on a blocked browser, in a headless test.
 * The boolean is for tests only; nothing on a page reads it.
 */
export function sound(id, opts = {}) {
  const spec = config.sounds[id]
  if (!spec || !enabled || !unlocked || failed || !ctx) return false
  if (reduced && !config.essential.has(id)) return false
  if (coarse && spec.hover) return false

  const now = performance.now()
  // `has` rather than `|| 0`: a sound that has never played must not be
  // treated as having played at time zero. That is exactly the clock a test
  // rig provides, and a rule only true because the numbers happen to be big
  // is not a rule.
  const prev = last.has(id) ? last.get(id) : -Infinity
  const cooldown = opts.cooldown ?? spec.cooldown ?? 120
  if (now - prev < cooldown) return false
  last.set(id, now)

  const busName = spec.bus
  const bus = buses[busName] || buses.interaction
  const t = ctx.currentTime + (opts.delay || 0)
  const vary = spec.vary || 0
  const rate = (opts.rate ?? 1) * (1 + (Math.random() * 2 - 1) * vary)
  // Undo the bus and the master so the number in the table is what actually
  // reaches the speaker. The voice trims make `gain` mean peak amplitude, so
  // this is the whole conversion.
  const busLevel = config.buses[busName] ?? config.buses.interaction ?? 1
  const target = dbToGain(opts.peak ?? spec.peak) / (busLevel * config.master)
  // Level jitter is deliberately narrower than rate jitter: a sound that
  // changes loudness run to run reads as a fault, one that changes colour
  // reads as a hand.
  const gain = target * (0.92 + Math.random() * 0.16)

  try {
    // A pan is optional and costs a node only where a route asks for one.
    let dest = bus
    const pan = opts.pan ?? spec.pan
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner()
      p.pan.value = Math.max(-1, Math.min(1, pan))
      p.connect(bus)
      dest = p
    }

    const buffer = samples.get(id)
    if (buffer) {
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.playbackRate.value = rate
      const g = ctx.createGain()
      g.gain.value = gain
      src.connect(g).connect(dest)
      src.start(t)
      return true
    }

    const voice = config.voices[spec.voice]
    if (!voice) return false
    voice(ctx, dest, t, {
      ...spec,
      ...opts,
      rate,
      gain: gain * (config.calibration[id] ?? 1),
    })
    return true
  } catch {
    return false // a bad frame must never break the page
  }
}

/* ------------------------------------------------------------------ unlock */
/**
 * There is exactly one way sound starts, and it is someone pressing the
 * control. An earlier version listened for pointerdown, touch, keys and
 * eventually wheel, trying to start audio the moment anything happened. That
 * was wrong in both directions: it made the page unpredictable, and it did not
 * work, because the spec does not count scrolling as user activation and these
 * pages are read by scrolling.
 */
function start(after) {
  if (failed) return false
  if (!ctx && !build()) {
    notify()
    return false
  }
  ctx.resume()
    .then(() => {
      if (ctx.state !== 'running') return
      unlocked = true
      loadSamples()
      notify()
      // Anything the press itself should make audible has to wait for this
      // point: resume() is async, so a sound fired straight after the press
      // would be dropped for not being unlocked yet.
      if (after) after()
    })
    .catch(() => {
      /* nothing to recover: the next press tries again */
    })
  return true
}

/* --------------------------------------------------------------------- api */
/**
 * Point the engine at a route's table and palette, then read the environment
 * and the stored preference. Creates nothing — no context, no listeners.
 */
export function configureAudio(next) {
  config = { ...EMPTY, ...next }
  if (next.essential && !(next.essential instanceof Set)) {
    config.essential = new Set(next.essential)
  }
  media()
  // Re-read rather than trust an earlier look: another tab may have written
  // the preference since this module was evaluated.
  enabled = readPref()
  notify()
}

export function setEnabled(on) {
  enabled = !!on
  writePref(enabled)
  if (master && ctx) {
    const t = ctx.currentTime
    master.gain.cancelScheduledValues(t)
    master.gain.setValueAtTime(master.gain.value, t)
    master.gain.linearRampToValueAtTime(enabled ? config.master : 0.0001, t + 0.25)
  }
  if (!enabled) stopAllBeds()
  notify()
}

export function toggleEnabled() {
  const press = config.confirmId ? () => sound(config.confirmId) : undefined
  // A stored preference is not a state. Nothing is audible until a gesture has
  // unlocked the context, so a visitor arriving with 'on' saved has the wish
  // but not the sound — and the first press there must START it, not mute it.
  // Without this the press writes 'off' over a preference nobody withdrew,
  // stays silent, and takes a second press to do what the first one looked
  // like it would do.
  if (enabled && !unlocked && !failed) {
    start(press)
    return true
  }
  const next = !enabled
  setEnabled(next)
  if (next) start(press)
  return next
}

/**
 * Is sound actually coming out?
 *
 * Distinct from `enabled`, which is only what the visitor last asked for. A
 * page reloaded with 'on' saved has `enabled` true and nothing playing, and a
 * control that reads the preference rather than this reports itself as on over
 * a silent page.
 */
export function isAudible() {
  return enabled && unlocked && !failed
}

export function audioState() {
  return { enabled, unlocked, failed, reduced, coarse }
}

export function subscribe(fn) {
  listeners.add(fn)
  fn({ enabled, unlocked, failed })
  return () => listeners.delete(fn)
}

export function teardownAudio() {
  stopAllBeds()
  listeners.clear()
  last.clear()
  samples.clear()
  beds.clear()
  if (ctx) {
    try {
      ctx.close()
    } catch {
      /* already closed */
    }
  }
  ctx = null
  master = null
  buses = null
  unlocked = false
}

/** For the calibration tool and the policy tests. */
export const __engine = {
  get config() {
    return config
  },
  dbToGain,
}
