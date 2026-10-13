import {
  CONCRETE_PLANS, CONCRETE_GROUPS, CONCRETE_LABELS,
  LAST_CONCRETE_STAGE, clampConcreteIndex,
} from './concrete.js'

/**
 * The concrete events.
 *
 * Same philosophy as the excavation and the foundation — scroll is a TRIGGER
 * and nothing else — and the same guarantee: every frame is a pure function of
 * one number, so letting go of the wheel changes nothing, running the number
 * down plays the pour backwards exactly, and a hundred passes up and down the
 * page land on byte-identical transforms.
 *
 * WHAT A POUR IS
 *
 * A level rising. One scale, in Y, from the bottom of the form to the
 * finished height, and nothing else moves at all.
 *
 * It had a second scale once — a leading edge that ran along each footing
 * before the surface came up behind it — and it was wrong twice over. It
 * implied a direction, which implied a source, which is the same thing the
 * pour stream implied and the same thing this phase is not: nobody is
 * standing off-frame holding a hose. And a travelling front is not what
 * embeds reinforcement. A rising level is: the steel disappears into the
 * concrete from the bottom up, at the rate the concrete arrives, and whatever
 * is still above the surface is still visible. That is the whole effect, and
 * one scale is all it needs.
 *
 * Where the concrete GOES is still a sequence — perimeter, pads, beams,
 * corners — and inside each stage the pieces start a fifth of a second apart,
 * west to east, so the level comes up across the site rather than everywhere
 * at once. But no single piece ever travels.
 *
 * THE FIFTH EVENT
 *
 * Every pour finishes 2.2% over. The fifth event is not a pour at all: it
 * takes that over-fill back out of the whole foundation at once, which is what
 * a settling is — not a bounce, not a wobble, one slow consolidation of
 * everything in the ground. The geometry in the GLB is at the FINISHED level,
 * so the settle is the only state that is not a scale away from the asset.
 *
 * WHAT IS NOT HERE
 *
 * No stream, no pipe, no nozzle, no dust, no particles, no shake, no fluid.
 * Nothing calls out except three plain hooks for sound.
 */

/** One piece of a pour, bottom to finished level. */
const POUR_DURATION = 0.44

/**
 * How far apart the pieces of one pour start.
 *
 * With a 0.44 s piece this makes a pour 0.68 s end to end, inside the brief's
 * half to four-fifths of a second. Most of the offset is a west-to-east sweep
 * across the site and the rest is scattered, so the level comes up across the
 * job rather than four things filling in lockstep.
 */
const POUR_SPREAD = 0.24
const SWEEP_SHARE = 0.7

/** The consolidation. Longer than a pour, because settling is not a pour. */
const SETTLE_DURATION = 0.50

/** How far over the finished level a fresh pour stands, before it settles. */
export const OVERFILL = 1.022

/** How much quicker the whole thing runs backwards. */
const REVERSE_RATE = 1.3

/** The beat between one event and the next. */
const GAP = 0.10

/** Never scaled to exactly zero: a zero matrix is not invertible. */
const FLOOR = 0.004

/**
 * The level.
 *
 * Slow to start, quickest through the middle, easing into the finish — which
 * is what a form filling actually does, because the bottom of a footing is the
 * widest part of it and the last of the depth is the least of the volume.
 * Ends 2.2% over, and the fifth event takes that back out.
 */
const RISE = [
  { t: 0.00, s: 0.000 },
  { t: 0.22, s: 0.180 },
  { t: 0.58, s: 0.640 },
  { t: 0.84, s: 0.930 },
  { t: 1.00, s: OVERFILL },
]

/** The consolidation, decelerating hard: material finding its level. */
const SETTLE = [
  { t: 0.00, s: 0.00 },
  { t: 0.45, s: 0.72 },
  { t: 0.78, s: 0.95 },
  { t: 1.00, s: 1.00 },
]

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function soft(u) {
  return u * u * (3 - 2 * u)
}

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

export function createConcreteEvents(rig, options = {}) {
  const pourDuration = options.pourDuration ?? POUR_DURATION
  /** Sound hooks. Called with plain data; nothing here waits on them. */
  const onStart = options.onStart ?? null
  const onStage = options.onStage ?? null
  const onFinish = options.onFinish ?? null

  const records = []
  const byGroup = new Map()
  /** The slab mesh, and the group whose pour covers it. */
  const embedded = rig ? (rig.embedded ?? []) : []
  const floorGroup = CONCRETE_GROUPS[CONCRETE_GROUPS.length - 1]
  /** The slab mesh nodes THIS engine hid, and so is the one to restore. */
  const hidden = new Set()

  let animated = true
  /** The stage actually on screen. -1 until the first target arrives. */
  let shown = -1
  /** The stage the page is asking for. */
  let target = 0
  /** The event in flight, or null. */
  let ev = null
  /** Seconds still to wait before the next event of a chain may open. */
  let gap = 0
  /** The chain, if one is running. A wall clock, for whatever carries the page. */
  let run = null

  if (rig) {
    for (const [name, group] of rig.groups) {
      const list = []
      for (const part of group.parts) {
        const r = {
          part,
          groupName: name,
          delay: POUR_SPREAD * (
            SWEEP_SHARE * (part.sweep ?? 0) +
            (1 - SWEEP_SHARE) * scatter(part.centre.x, part.centre.z)
          ),
          duration: pourDuration,
          p: 0,
        }
        records.push(r)
        list.push(r)
      }
      byGroup.set(name, list)
    }
  }

  /** How long each event takes. Index 1..4 are pours; 5 is the settle. */
  const stepSeconds = []
  for (let hi = 1; hi <= LAST_CONCRETE_STAGE; hi += 1) {
    const plan = CONCRETE_PLANS[hi]
    if (!plan.pour) { stepSeconds[hi] = SETTLE_DURATION; continue }
    let longest = 0
    for (const r of byGroup.get(plan.pour) ?? []) longest = Math.max(longest, r.delay + r.duration)
    stepSeconds[hi] = Math.max(longest, 1e-3)
  }

  function runSeconds(a, b) {
    const lo = Math.min(a, b)
    const hi = Math.max(a, b)
    let total = 0
    for (let i = lo + 1; i <= hi; i += 1) total += stepSeconds[i] + (i > lo + 1 ? GAP : 0)
    return (b > a ? total : total / REVERSE_RATE) || 1e-3
  }

  // ---- drawing -----------------------------------------------------------
  // Everything below writes one scale and one visibility flag. There is no
  // stored partial state anywhere in it: `paint` is handed the whole situation
  // each time and writes every piece of concrete in the scene from it, so no
  // piece can be left behind in a state belonging to an event that has ended.

  function rest(part, visible) {
    part.object.scale.copy(part.restScale)
    part.object.position.copy(part.restPosition)
    part.object.visible = visible
  }

  /** Where the surface sits once the pour is done: over-filled, then settled. */
  function finalLevel(settle) {
    return OVERFILL + (1 - OVERFILL) * sample(SETTLE, clamp01(settle))
  }

  /**
   * One piece, at one level.
   *
   * Y and only Y. The origin is the middle of the base, so this raises the
   * surface and leaves the underside, the plan and the position exactly where
   * the model put them — which is also why the beams, whose top face follows
   * the ground above them, are right at every height they pass through rather
   * than only at the end.
   */
  function drawPart(r, p, settle) {
    const part = r.part
    r.p = p
    if (p <= 0) { rest(part, false); return }
    const level = p >= 1 ? finalLevel(settle) : sample(RISE, p)
    part.object.position.copy(part.restPosition)
    part.object.scale.copy(part.restScale)
    part.object.scale.y = part.restScale.y * Math.max(level, FLOOR)
    part.object.visible = true
  }

  /**
   * Write the whole of the concrete from the current situation.
   *
   * Deliberately total rather than incremental. Twenty objects is nothing to
   * write, and writing all of them from (shown, event, clock) every time
   * removes the entire class of bug where a piece is left holding a transform
   * from an event that has since been reversed, closed or interrupted.
   */
  function paint() {
    const at = CONCRETE_PLANS[ev ? ev.lo : shown]
    const settle = ev && ev.settling
      ? clamp01(ev.clock / ev.duration)
      : at.settle
    for (const r of records) {
      const p = ev && ev.group === r.groupName
        ? clamp01((ev.clock - r.delay) / r.duration)
        : (at.poured.has(r.groupName) ? 1 : 0)
      drawPart(r, p, settle)
    }
    // Steel in a slab is inside it. The mat goes as the floor comes up over
    // it — at a third of the way, by which point there is enough concrete
    // around it to read as covered rather than as deleted — and comes back on
    // the way down.
    //
    // THE POUR ONLY EVER TAKES IT AWAY. It hides what it finds visible and
    // puts back exactly what it hid, and it never turns the mat on: the mat
    // belongs to the foundation's third stage, and a rule that wrote
    // `visible = !laid` every frame was also writing `visible = true` at every
    // scroll position with no concrete in it — which stood a slab mesh over a
    // bare excavation, hours before there was any reason for one. Ownership of
    // a thing you did not create is borrowed, and has to be given back rather
    // than asserted.
    if (embedded.length) {
      const floor = byGroup.get(floorGroup)
      const laid = at.poured.has(floorGroup) ||
        (ev && ev.group === floorGroup && floor && floor.length
          ? floor.every((r) => r.p > 0.34)
          : false)
      for (const o of embedded) {
        if (laid) {
          if (o.visible) { hidden.add(o); o.visible = false }
        } else if (hidden.has(o)) {
          hidden.delete(o)
          o.visible = true
        }
      }
    }
  }

  /** Land a whole stage now, with no animation. */
  function settleTo(index) {
    shown = clampConcreteIndex(index)
    ev = null
    gap = 0
    paint()
  }

  /**
   * Open an event between two adjacent stages.
   *
   * `lo` is always the lower stage whichever way the reader is going: an event
   * describes a transition, not a direction. Direction is `dir`, and it may
   * change from one frame to the next without the event being rebuilt — which
   * is what lets a reversal half way through carry on from the frame already
   * on screen instead of popping to one end.
   */
  function begin(lo, dir) {
    const hi = lo + 1
    const plan = CONCRETE_PLANS[hi]
    ev = {
      lo,
      hi,
      dir,
      group: plan.pour,
      settling: plan.settle === 1,
      clock: dir > 0 ? 0 : stepSeconds[hi],
      duration: Math.max(stepSeconds[hi], 1e-3),
    }
    paint()
  }

  /** Land on one end of the event and let the next one start next frame. */
  function close(index) {
    const forward = index === ev.hi
    const at = ev.hi
    shown = index
    ev = null
    paint()
    if (onStage) {
      onStage({
        index,
        arrived: at,
        label: CONCRETE_LABELS[index],
        forward,
        settle: CONCRETE_PLANS[index].settle === 1,
      })
    }
    if (forward && index === LAST_CONCRETE_STAGE && onFinish) onFinish()
  }

  /**
   * The trigger. The ONLY thing scroll is allowed to say.
   *
   * It records an intention and returns. It never touches a transform, never
   * starts an event mid-frame and never moves a clock, so how fast the reader
   * crossed the threshold, and whether they are still moving, cannot reach the
   * animation.
   */
  function setTarget(index) {
    const next = clampConcreteIndex(index)
    if (next === target && (run || next === shown)) return
    target = next
    // The first stage the page asks for is a state, not an event: a reader who
    // refreshes at the bottom has already missed the pour they are looking at.
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
    if (run.dir > 0 && onStart) onStart({ from: run.from, to: run.to, seconds: run.total })
  }

  return {
    /** How many pieces are mid-event. Zero means `update` is nearly free. */
    active: () => (ev ? (ev.group ? (byGroup.get(ev.group) ?? []).length : records.length) : 0),

    /** True while an event owns the picture. */
    playing: () => ev !== null,

    /** True from the first frame of the chain to the frame the last event closes. */
    running: () => run !== null,

    /** Which way the chain is going: +1 filling, -1 draining. */
    runDirection: () => (run ? run.dir : 0),

    /**
     * How far through the chain, 0..1, for whatever is carrying the page.
     *
     * A wall clock, not a state: its job is to move the scroll offset smoothly
     * while the events decide for themselves when they happen.
     */
    runProgress: () => (run ? clamp01(run.elapsed / run.total) : 1),

    /** How long a chain between two stages takes at the rate it plays. */
    runSeconds: (a, b) => runSeconds(a, b),

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
      settling: ev ? !!ev.settling : false,
      label: CONCRETE_LABELS[shown < 0 ? 0 : shown],
    }),

    /** Reduced motion, or a first paint that must not animate. */
    setAnimated(value) {
      animated = value
      if (!value && shown >= 0) { settleTo(target); run = null }
    },

    setTarget,

    /**
     * One frame. The same three rules as the other two engines:
     *
     *   an event in flight follows the target's SIDE, not its distance
     *   an event that reaches either end closes exactly on that stage
     *   with nothing in flight and the target elsewhere, open the next event
     */
    update(delta) {
      if (shown < 0 || !animated) return false
      if (run) run.elapsed += delta

      if (ev) {
        ev.dir = target >= ev.hi ? 1 : target <= ev.lo ? -1 : ev.dir
        ev.clock += ev.dir > 0 ? delta : -delta * REVERSE_RATE
        if (ev.clock >= ev.duration) { close(ev.hi); gap = shown === target ? 0 : GAP }
        else if (ev.clock <= 0) { close(ev.lo); gap = shown === target ? 0 : GAP }
        else paint()
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

    /** For tests and for anything that wants to inspect a piece. */
    stateOf(object) {
      const r = records.find((x) => x.part.object === object)
      return r ? { p: r.p, delay: r.delay, height: r.part.height } : null
    },

    /** The longest a single event can take. */
    longestEvent() {
      let longest = 0
      for (let i = 1; i <= LAST_CONCRETE_STAGE; i += 1) longest = Math.max(longest, stepSeconds[i])
      return longest
    },

    /** Every group the table drives, for tests. */
    groups: () => CONCRETE_GROUPS,
  }
}
