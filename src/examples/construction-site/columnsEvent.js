import { COLUMN_PLANS, LAST_COLUMN_STAGE, clampColumnIndex } from './columns.js'

/**
 * The column events.
 *
 * The same machine as the foundation's — one clock, a pure function of it, a
 * chain when several stages are owed — because that machine is what makes
 * "cross the trigger, let go, and it still finishes" true, and it is worth
 * having in exactly one shape. What is different is the subject, and the
 * differences are all here rather than spread through the file:
 *
 *   ONE TRIGGER, FOUR LEVELS. The foundation has five triggers for five
 *   stages; the frame has one for four. So the normal path through the chain
 *   machinery is the one the foundation treats as an exception — the scene
 *   asks for stage four and this runs one, two, three and four back to back.
 *
 *   UP, AND ONLY UP. `draw` writes `scale.y` and nothing else. Not the
 *   measured growth axis, the way the foundation does it: the rig has already
 *   established that every column stands on its own base, and a column has no
 *   other direction it could honestly grow in. Writing the axis by name is
 *   what makes "no column scales from its centre" a property of this file
 *   rather than a result that depends on the export.
 *
 *   A LEVEL CANNOT START EARLY. It does not need a rule: level three's event
 *   only opens when level two's has closed, and a closed event has put every
 *   one of its columns on its authored transform. So the head each level
 *   stands on is always exactly where the model says it is.
 *
 * An event is one number, `clock`, from 0 to `duration`, and every column's
 * state is a pure function of it:
 *
 *     p_column = clamp01((clock - delay_column) / duration_column)
 *
 * No per-column integration and no stored partial state, so the same clock
 * always draws the same frame, running it down plays the event backwards
 * exactly, and a hundred passes up and down the page land on byte-identical
 * transforms.
 */

/** One column, foot to head. */
const RISE_DURATION = 0.44

/**
 * How far apart the six columns of one level start.
 *
 * 0.26 on a 0.44 s column makes a level 0.70 s end to end, and four of those
 * with a beat between them is 3.1 s for the whole frame — which is where this
 * wants to be. Long enough that each level is a thing that happened, short
 * enough that nobody is watching individual columns.
 *
 * Nearly all of the offset is the west-to-east sweep and the rest is scattered
 * off each column's own position, so a level reads as work crossing the site
 * rather than as six things switched on together — and it is the same order
 * every time, being a function of where a column is rather than of when it
 * arrived in a list.
 */
const RISE_SPREAD = 0.26
const SWEEP_SHARE = 0.78

/** How much quicker the same movement runs backwards. */
const REVERSE_RATE = 1.3

/** The beat between one level and the next. */
const GAP = 0.10

/** Never scaled to exactly zero: a zero matrix is not invertible. */
const FLOOR = 0.004

/**
 * The growth curve.
 *
 * Decelerating throughout and with no overshoot anywhere in it. Overshoot is
 * wrong here for a reason particular to a frame: two per cent past the top of
 * a 3.6 m storey is 70 mm of column standing above the level it belongs to and
 * pulling back down, and every column in the level does it at once. That reads
 * as the building bouncing.
 *
 * Slower off the mark than the foundation's curve — 1.1 against 1.4 in opening
 * slope — because a column is heavy and a starter bar is not. The first
 * segment is eased so a column leaves the slab rather than snapping off it;
 * the rest are straight, so the deceleration is continuous instead of pausing
 * at every key.
 */
const RISE = [
  { t: 0.00, s: 0.000 },
  { t: 0.28, s: 0.310 },
  { t: 0.62, s: 0.780 },
  { t: 0.86, s: 0.962 },
  { t: 1.00, s: 1.000 },
]

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function soft(u) {
  return u * u * (3 - 2 * u)
}

/** Stable pseudo-random in [0,1) from a column's own position. */
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

export function createColumnEvents(rig, options = {}) {
  const riseDuration = options.riseDuration ?? RISE_DURATION
  const riseSpread = options.riseSpread ?? RISE_SPREAD

  /** Every column, by level, so an event can pick up a level in one lookup. */
  const groups = new Map()
  const records = new Map()

  let animated = true
  /** The level actually on screen. -1 until the first target arrives. */
  let shown = -1
  /** The level the page is asking for. */
  let target = 0
  /** The event in flight, or null. */
  let ev = null
  /** Seconds still to wait before the next level may open. */
  let gap = 0
  /** The chain, if one is running. */
  let run = null

  if (rig) {
    for (const [name, group] of rig.groups) {
      for (const part of group.parts) {
        const r = {
          part,
          groupName: name,
          /** 0 = not cast, 1 = full height. */
          p: 0,
          delay: riseSpread * (
            SWEEP_SHARE * (part.sweep ?? 0) +
            (1 - SWEEP_SHARE) * scatter(part.centre.x, part.centre.z)
          ),
          duration: riseDuration,
        }
        records.set(part.object, r)
        let list = groups.get(name)
        if (!list) { list = []; groups.set(name, list) }
        list.push(r)
      }
    }
  }

  /** How long the event arriving at level `hi` takes. */
  const stepSeconds = []
  for (let hi = 1; hi <= LAST_COLUMN_STAGE; hi += 1) {
    const plan = COLUMN_PLANS[hi]
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
   * Put a column back exactly as the asset had it.
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
   * Draw one column at its own progress.
   *
   * Scale in Y, and nothing else. No position term — the foot stays where the
   * export put it, and it stays there because nothing in this function can
   * move it. That is the whole contract: the geometry runs 0..H upward from
   * the node's own origin, so scaling about that origin raises the head and
   * leaves the foot on the slab.
   */
  function draw(r) {
    const part = r.part
    if (r.p >= 1) { rest(r, true); return }
    if (r.p <= 0) { rest(r, false); return }
    const s = Math.max(sample(RISE, r.p), FLOOR)
    part.object.scale.copy(part.restScale)
    part.object.scale.y = part.restScale.y * s
    part.object.position.copy(part.restPosition)
    part.object.visible = true
  }

  /** Land a whole level now, with no animation. */
  function settleTo(index) {
    const plan = COLUMN_PLANS[clampColumnIndex(index)]
    for (const [, r] of records) {
      const want = plan.built.has(r.groupName) ? 1 : 0
      r.p = want
      rest(r, want > 0.5)
    }
    shown = clampColumnIndex(index)
    ev = null
    gap = 0
  }

  /**
   * Open an event between two adjacent levels.
   *
   * `lo` is always the lower level and `hi` the higher one, whichever way the
   * reader is going: an event describes a transition, not a direction.
   * Direction is `dir`, and it may change from one frame to the next without
   * the event being rebuilt — which is what lets a reversal half way up a
   * storey carry on from the frame already on screen instead of popping to
   * one end of it.
   */
  function begin(lo, dir) {
    const hi = lo + 1
    const plan = COLUMN_PLANS[hi]
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
    const plan = COLUMN_PLANS[index]
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
    const next = clampColumnIndex(index)
    if (next === target && (run || next === shown)) return
    target = next
    // The first level the page asks for is a state, not an event: a reader who
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
    /** How many columns are mid-event. Zero means `update` is nearly free. */
    active: () => (ev ? ev.parts.length : 0),

    /** True while an event owns the picture. */
    playing: () => ev !== null,

    /** True from the first frame of the chain to the frame the last one closes. */
    running: () => run !== null,

    /** Which way the chain is going: +1 building, -1 taking it back down. */
    runDirection: () => (run ? run.dir : 0),

    /** How far through the chain, 0..1. A wall clock, for the page hold. */
    runProgress: () => (run ? clamp01(run.elapsed / run.total) : 1),

    /** How long a chain between two levels takes at the rate it plays. */
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
     * The same three rules as the excavation and the foundation, and for the
     * same reason — they are what makes a fling survivable:
     *
     *   an event in flight follows the target's SIDE, not its distance
     *   an event that reaches either end closes exactly on that level
     *   with nothing in flight and the target elsewhere, open the next event
     *
     * There is no queue object. The backlog is `target - shown`, read fresh
     * every frame, so a reader who flings the page down and immediately back
     * up never leaves a stack of levels behind them to be worked through.
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

    /** Drop everything and land on the level the page is asking for. */
    finish() {
      if (shown < 0) return
      settleTo(target)
      run = null
    },

    /** For tests and for anything that wants to inspect one column. */
    stateOf(object) {
      const r = records.get(object)
      return r
        ? { p: r.p, running: ev ? ev.parts.includes(r) : false, delay: r.delay }
        : null
    },

    /** The longest a single level can take, for tests and for tuning. */
    longestEvent() {
      let longest = 0
      for (let i = 1; i <= LAST_COLUMN_STAGE; i += 1) longest = Math.max(longest, stepSeconds[i])
      return longest
    },
  }
}
