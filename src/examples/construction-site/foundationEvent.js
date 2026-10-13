import {
  FOUNDATION_PLANS, LAST_FOUNDATION_STAGE, clampFoundationIndex,
} from './foundation.js'

/**
 * The foundation events.
 *
 * Same philosophy as the excavation, deliberately: scroll is a TRIGGER and
 * nothing else. Crossing a threshold says "stage three, please" and returns.
 * Everything after that is this module and a `delta`, so a reader who crosses
 * a trigger and stops dead — or keeps going, or turns round — still gets the
 * whole event, because the only input the animation has is how much time has
 * passed.
 *
 * An event is one number, `clock`, from 0 to `duration`, and every component's
 * state is a pure function of it:
 *
 *     p_part = clamp01((clock - delay_part) / duration_part)
 *
 * No per-part integration and no stored partial state, so the same clock
 * always draws the same frame, running it down plays the event backwards
 * exactly, and a hundred passes up and down the page land on byte-identical
 * transforms.
 *
 * WHAT IS DIFFERENT FROM THE EXCAVATION, AND WHY
 *
 * Excavation is impact: a face of ground gives way, throws dust, and the
 * camera feels it. Foundation is precision. So there is no dust, no shake, no
 * particle field and nothing to call out to — this module has no callbacks at
 * all. There is no fade either: steel is placed, not revealed, and a bar that
 * arrives by growing along its own axis needs no opacity to explain itself.
 *
 * And the events are separate rather than chained. The dig is ONE thing that
 * happens to take five lifts, so it runs on one trigger and carries the page
 * with it. The foundation is five operations that happen in order over the
 * last third of the page, each with its own trigger, each finishing on its own
 * clock whether or not the reader is still moving. The chain machinery below
 * exists for the case where the reader flings the page and owes four of them
 * at once — not as the normal path.
 */

/** One component, start to finish. */
const BUILD_DURATION = 0.42

/**
 * How far apart the components of one stage start.
 *
 * With a 0.42 s component this makes a stage 0.64 s end to end, which is where
 * a construction event wants to be: long enough to read as placement, short
 * enough that five of them do not turn the last third of the page into a
 * waiting room. Most of the offset is a west-to-east sweep across the site and
 * the rest is scattered, so a stage reads as work crossing the ground rather
 * than as a list being ticked off — and it is the same sweep every time, being
 * a function of position rather than of arrival order.
 */
const BUILD_SPREAD = 0.22
const SWEEP_SHARE = 0.65

/**
 * How much quicker the same movement runs backwards.
 *
 * Going back up the page is a correction, not a scene.
 */
const REVERSE_RATE = 1.3

/** The beat between one stage and the next, when several are owed at once. */
const GAP = 0.10

/** Never scaled to exactly zero: a zero matrix is not invertible. */
const FLOOR = 0.004

/**
 * The growth curve.
 *
 * Decelerating throughout — 1.4, 1.2, 0.6, 0.2 in slope — and with no
 * overshoot anywhere in it. Overshoot was tried and cut: it is right for
 * something struck, like a stake, and wrong for everything here. Two per cent
 * past the end of a 25 m bar run is half a metre of steel poking out of the
 * corner of the excavation and pulling back, which reads as a mistake being
 * corrected rather than as a length of bar being laid.
 *
 * The first segment is eased, so a bar leaves the floor rather than snapping
 * off it; the rest are straight, so the deceleration is continuous instead of
 * pausing at every key.
 */
const GROW = [
  { t: 0.00, s: 0.000 },
  { t: 0.30, s: 0.420 },
  { t: 0.65, s: 0.850 },
  { t: 0.88, s: 0.980 },
  { t: 1.00, s: 1.000 },
]

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function soft(u) {
  return u * u * (3 - 2 * u)
}

/** Stable pseudo-random in [0,1) from a component's own position. */
function scatter(x, z) {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return s - Math.floor(s)
}

function sample(keys, t) {
  let i = 0
  while (i < keys.length - 2 && t > keys[i + 1].t) i += 1
  const a = keys[i]
  const b = keys[i + 1]
  const span = b.t - a.t
  let u = clamp01(span > 1e-6 ? (t - a.t) / span : 1)
  if (i === 0) u = soft(u)
  return a.s + (b.s - a.s) * u
}

export function createFoundationEvents(rig, options = {}) {
  const buildDuration = options.buildDuration ?? BUILD_DURATION
  const buildSpread = options.buildSpread ?? BUILD_SPREAD

  /** Every component, by group, so an event can pick up a stage in one lookup. */
  const groups = new Map()
  const records = new Map()

  let animated = true
  /** The stage actually on screen. -1 until the first target arrives. */
  let shown = -1
  /** The stage the page is asking for. */
  let target = 0
  /** The event in flight, or null. */
  let ev = null
  /** Seconds still to wait before the next stage of a chain may open. */
  let gap = 0
  /** The chain, if one is running. */
  let run = null

  if (rig) {
    for (const [name, group] of rig.groups) {
      for (const part of group.parts) {
        const r = {
          part,
          group,
          groupName: name,
          /** 0 = not built, 1 = built. */
          p: 0,
          delay: buildSpread * (
            SWEEP_SHARE * (part.sweep ?? 0) +
            (1 - SWEEP_SHARE) * scatter(part.centre.x, part.centre.z)
          ),
          duration: buildDuration,
        }
        records.set(part.object, r)
        let list = groups.get(name)
        if (!list) { list = []; groups.set(name, list) }
        list.push(r)
      }
    }
  }

  /** How long the event arriving at stage `hi` takes. */
  const stepSeconds = []
  for (let hi = 1; hi <= LAST_FOUNDATION_STAGE; hi += 1) {
    const plan = FOUNDATION_PLANS[hi]
    let longest = 0
    for (const r of groups.get(plan.build) ?? []) {
      longest = Math.max(longest, r.delay + r.duration)
    }
    stepSeconds[hi] = Math.max(longest, 1e-3)
  }

  /** The whole chain from `a` to `b`, in seconds, at the rate it will play. */
  function runSeconds(a, b) {
    const lo = Math.min(a, b)
    const hi = Math.max(a, b)
    let total = 0
    for (let i = lo + 1; i <= hi; i += 1) total += stepSeconds[i] + (i > lo + 1 ? GAP : 0)
    return (b > a ? total : total / REVERSE_RATE) || 1e-3
  }

  /**
   * Put a component back exactly as the asset had it.
   *
   * Every event both begins and ends here, which is what makes repetition
   * exact: nothing is ever nudged from wherever it happened to be, so no
   * offset in scale can accumulate over a hundred passes up and down the page.
   */
  function rest(r, visible) {
    const part = r.part
    part.object.scale.copy(part.restScale)
    part.object.position.copy(part.restPosition)
    part.object.visible = visible
  }

  /**
   * Draw one component at its own progress.
   *
   * Scale along the growth axis, and nothing else — no position term, which is
   * the whole reason the exporter puts the origin where it does. The geometry
   * is anchored on that axis at zero, so scaling about the node's own origin
   * IS growing from the base of a bar or the end of a run. A pivot correction
   * here would be a second opinion about where the component starts, and the
   * two would disagree the first time a component was moved in Blender.
   */
  function draw(r) {
    const part = r.part
    if (r.p >= 1) { rest(r, true); return }
    if (r.p <= 0) { rest(r, false); return }
    const s = Math.max(sample(GROW, r.p), FLOOR)
    part.object.scale.copy(part.restScale)
    part.object.scale[part.axis] = part.restScale[part.axis] * s
    part.object.position.copy(part.restPosition)
    part.object.visible = true
  }

  /** Land a whole stage now, with no animation. */
  function settleTo(index) {
    const plan = FOUNDATION_PLANS[clampFoundationIndex(index)]
    for (const [, r] of records) {
      const want = plan.built.has(r.groupName) ? 1 : 0
      r.p = want
      rest(r, want > 0.5)
    }
    shown = clampFoundationIndex(index)
    ev = null
    gap = 0
  }

  /**
   * Open an event between two adjacent stages.
   *
   * `lo` is always the lower stage and `hi` the higher one, whichever way the
   * reader is going: an event describes a transition, not a direction.
   * Direction is `dir`, and it may change from one frame to the next without
   * the event being rebuilt — which is what lets a reversal half way through
   * carry on from the frame already on screen instead of popping to one end.
   */
  function begin(lo, dir) {
    const hi = lo + 1
    const plan = FOUNDATION_PLANS[hi]
    const parts = groups.get(plan.build) ?? []
    let duration = 0
    for (const r of parts) duration = Math.max(duration, r.delay + r.duration)
    ev = {
      lo, hi, dir, parts,
      clock: dir > 0 ? 0 : duration,
      duration: Math.max(duration, 1e-3),
    }
    render()
  }

  function render() {
    for (const r of ev.parts) {
      r.p = clamp01((ev.clock - r.delay) / r.duration)
      draw(r)
    }
  }

  /** Land on one end of the event and let the next one start next frame. */
  function close(index) {
    const plan = FOUNDATION_PLANS[index]
    for (const r of ev.parts) {
      const want = plan.built.has(r.groupName) ? 1 : 0
      r.p = want
      rest(r, want > 0.5)
    }
    shown = index
    ev = null
  }

  /**
   * The trigger. The ONLY thing scroll is allowed to say.
   *
   * It records an intention and returns. It never touches a transform, never
   * starts an event mid-frame and never moves a clock, so how fast the reader
   * crossed the threshold, and whether they are still moving, cannot reach the
   * animation. What happens next is decided in `update`, from `delta`.
   */
  function setTarget(index) {
    const next = clampFoundationIndex(index)
    if (next === target && (run || next === shown)) return
    target = next
    // The first stage the page asks for is a state, not an event: a reader who
    // refreshes at the bottom has already missed the construction they are
    // looking at, and watching it assemble on arrival would be showing them
    // something that happened before they got there.
    if (shown < 0 || !animated) { settleTo(target); run = null; return }
    if (target === shown) { run = null; return }
    run = {
      from: shown,
      to: target,
      dir: target > shown ? 1 : -1,
      elapsed: 0,
      total: runSeconds(shown, target),
    }
    gap = 0
  }

  return {
    /** How many components are mid-event. Zero means `update` is nearly free. */
    active: () => (ev ? ev.parts.length : 0),

    /** True while an event owns the picture. */
    playing: () => ev !== null,

    /** True from the first frame of a chain to the frame the last event closes. */
    running: () => run !== null,

    /** Which way the chain is going: +1 building, -1 taking it back out. */
    runDirection: () => (run ? run.dir : 0),

    /** How far through the chain, 0..1. A wall clock, for anything watching. */
    runProgress: () => (run ? clamp01(run.elapsed / run.total) : 1),

    /** How long a chain between two stages takes at the rate it plays. */
    runSeconds: (a, b) => runSeconds(a, b),

    /** What is on screen, and what the page is asking for. */
    state: () => ({
      shown,
      target,
      playing: ev !== null,
      running: run !== null,
      runProgress: run ? clamp01(run.elapsed / run.total) : 1,
      runTotal: run ? run.total : 0,
      from: ev ? ev.lo : null,
      to: ev ? ev.hi : null,
      dir: ev ? ev.dir : 0,
      clock: ev ? ev.clock : 0,
      duration: ev ? ev.duration : 0,
    }),

    /** Reduced motion, or a first paint that must not animate. */
    setAnimated(value) {
      animated = value
      if (!value && shown >= 0) { settleTo(target); run = null }
    },

    setTarget,

    /**
     * One frame.
     *
     * The same three rules as the excavation, and for the same reason — they
     * are what makes a fling survivable:
     *
     *   an event in flight follows the target's SIDE, not its distance
     *   an event that reaches either end closes exactly on that stage
     *   with nothing in flight and the target elsewhere, open the next event
     *
     * There is no queue object. The backlog is `target - shown`, read fresh
     * every frame, so a reader who flings the page down and immediately back
     * up never leaves a stack of events behind them to be worked through.
     */
    update(delta) {
      if (shown < 0 || !animated) return false
      if (run) run.elapsed += delta

      if (ev) {
        ev.dir = target >= ev.hi ? 1 : target <= ev.lo ? -1 : ev.dir
        ev.clock += ev.dir > 0 ? delta : -delta * REVERSE_RATE
        if (ev.clock >= ev.duration) { close(ev.hi); gap = shown === target ? 0 : GAP }
        else if (ev.clock <= 0) { close(ev.lo); gap = shown === target ? 0 : GAP }
        else render()
        return true
      }

      if (target === shown) { run = null; return false }

      if (gap > 0) { gap -= delta; return true }

      const dir = target > shown ? 1 : -1
      begin(dir > 0 ? shown : shown - 1, dir)
      return true
    },

    /** Drop everything and land on the state the page is asking for. */
    finish() {
      if (shown < 0) return
      settleTo(target)
      run = null
    },

    /** For tests and for anything that wants to inspect a component's state. */
    stateOf(object) {
      const r = records.get(object)
      return r
        ? { p: r.p, running: ev ? ev.parts.includes(r) : false, delay: r.delay, axis: r.part.axis }
        : null
    },

    /** The longest an event can take, for tests and for tuning. */
    longestEvent() {
      let longest = 0
      for (let i = 1; i <= LAST_FOUNDATION_STAGE; i += 1) longest = Math.max(longest, stepSeconds[i])
      return longest
    },
  }
}
