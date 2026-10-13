import { STAGE_PLANS, LAST_STAGE, clampStageIndex } from './excavation.js'

/**
 * The excavation events.
 *
 * The controller upstream decides WHICH stage the page is asking for. This
 * decides how the site gets there, and the answer is: one complete event at a
 * time, on a clock of its own.
 *
 * ONE TRIGGER, THE WHOLE DIG
 *
 * Nothing in here reads scroll. The only thing the outside world may say is
 * `setTarget(stageIndex)`, and in this page it only ever says two things: 0,
 * the untouched site, and 5, the finished excavation. Crossing the trigger
 * once runs the entire earthwork — five lifts, a short beat between each, the
 * pits opening one after another — and the reader does not have to scroll
 * again for any of it. Stop dead a pixel past the trigger and every one of the
 * five still lands, because the only input to the animation is `delta`.
 *
 * A RUN is that chain; an EVENT is one lift of it.
 *
 * That is enforced by construction rather than by care. An event is one number,
 * `clock`, running from 0 to `duration`; every body's state is a pure function
 * of it:
 *
 *     p_body = clamp01((clock - delay_body) / duration_body)
 *
 * There is no per-body integration and no stored partial state, so the same
 * clock always draws the same frame. Run the clock down instead of up and the
 * event plays backwards exactly — same curves, same bodies, same order
 * reversed — and forward, backward, forward, backward lands on byte-identical
 * transforms every time.
 *
 * It orchestrates four things and owns none of them:
 *
 *   SOIL REMOVAL   here
 *   SPOIL GROWTH   here
 *   DUST           `onCut`, handed to whatever is drawing particles
 *   CAMERA SHAKE   `onImpact`, handed to the camera's additive layer
 */

/** One body, start to finish. */
const SOIL_DURATION = 0.50

/** The heap, once the earth has had time to get there. */
const SPOIL_DURATION = 0.56
const SPOIL_LEAD = 0.06

/**
 * How far apart the bodies of one stage let go.
 *
 * A stage is ONE event, not a queue of objects. These are the widest offsets in
 * the group, and they are small on purpose: at 0.13 s a six-body stage has
 * everything moving within an eighth of a second of the first, which reads as
 * a face of ground giving way rather than as four things being switched off in
 * turn. The offsets are drawn from each body's own position rather than from
 * its index, so the order is not the order they happen to sit in the file, and
 * it is the same order every time.
 */
const SOIL_SPREAD = 0.12
const SPOIL_SPREAD = 0.08

/**
 * How much quicker the same movement runs backwards.
 *
 * Going back up the page is a correction, not a scene. Same curves, same
 * bodies, same clock — three quarters of the time.
 */
const REVERSE_RATE = 1.35

/**
 * The beat between one lift and the next.
 *
 * Short enough that five of them still read as one continuous earthwork, long
 * enough that they read as five. With nothing between them the dust of one
 * lift is still going up as the next collapses and the whole thing blurs into
 * a single event; at half a second it stops being an excavation and becomes a
 * slideshow.
 */
const GAP = 0.15

/** How far into a body's collapse the dust leaves it. */
const DUST_AT = 0.26

/** Never scaled to exactly zero: a zero matrix is not invertible. */
const FLOOR = 0.02

/**
 * The removal, phase by phase.
 *
 *   t     how far through
 *   sink  how far it has dropped, in multiples of its own height
 *   sy    vertical scale — the collapse
 *   sxz   horizontal scale — drawing in towards its own middle
 *   o     opacity
 *
 * Read the sink column: 0.03 of its own height in the first fifth, then two
 * thirds, then nearly two heights. That acceleration is the whole effect. By
 * 0.86 the body is a sixth of its height and two heights under the ground it
 * has uncovered, which is to say out of sight — so opacity has nothing to hide
 * and is only there to stop the last few frames drawing something that is
 * technically still in the scene. This is not a fade; it is a collapse that
 * happens to end below the floor.
 */
const REMOVAL = [
  { t: 0.00, sink: 0.00, sy: 1.00, sxz: 1.00, o: 1.00 },
  { t: 0.20, sink: 0.03, sy: 0.95, sxz: 0.99, o: 1.00 },
  { t: 0.62, sink: 0.72, sy: 0.40, sxz: 0.86, o: 1.00 },
  { t: 0.86, sink: 1.90, sy: 0.16, sxz: 0.72, o: 0.50 },
  { t: 1.00, sink: 2.60, sy: 0.10, sxz: 0.66, o: 0.00 },
]

/**
 * The tip.
 *
 * Earth arrives in one go and beds in: the heap overshoots by 7% as the load
 * lands and settles back. The pivot is its base, so it grows out of the ground
 * rather than inflating about its own middle.
 */
const TIP = [
  { t: 0.00, s: 0.03, o: 0.0 },
  { t: 0.35, s: 0.82, o: 0.9 },
  { t: 0.62, s: 1.07, o: 1.0 },
  { t: 0.84, s: 0.97, o: 1.0 },
  { t: 1.00, s: 1.00, o: 1.0 },
]

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function soft(u) {
  return u * u * (3 - 2 * u)
}

/** Stable pseudo-random in [0,1) from a body's own world position. */
function scatter(x, z) {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return s - Math.floor(s)
}

/**
 * Read a key table at t.
 *
 * The first segment is eased and the rest are straight. The sink values already
 * accelerate from key to key, so straight lines between them describe something
 * falling; easing every segment would put a dead stop at each phase boundary —
 * four little pauses on the way down, which is the one thing a heavy movement
 * must not have.
 */
function sample(keys, t, out) {
  let i = 0
  while (i < keys.length - 2 && t > keys[i + 1].t) i += 1
  const a = keys[i]
  const b = keys[i + 1]
  const span = b.t - a.t
  let u = clamp01(span > 1e-6 ? (t - a.t) / span : 1)
  if (i === 0) u = soft(u)
  for (const field in out) out[field] = a[field] + (b[field] - a[field]) * u
  return out
}

export function createExcavationEvents(rig, options = {}) {
  const soilDuration = options.soilDuration ?? SOIL_DURATION
  const spoilDuration = options.spoilDuration ?? SPOIL_DURATION
  /** Called with (regions) when a body lets go. Regions are reused — read them now. */
  const onCut = options.onCut ?? null
  /** Called with a 0..1 weight when the ground takes the hit. */
  const onImpact = options.onImpact ?? null

  /** Every body, by group, so an event can pick up a stage in one lookup. */
  const groups = new Map()
  const records = new Map()
  const region = { x: 0, y: 0, z: 0, radius: 1, strength: 1 }
  const regions = [region]
  const removal = { sink: 0, sy: 1, sxz: 1, o: 1 }
  const tip = { s: 1, o: 1 }

  let animated = true
  /** The stage actually on screen. -1 until the first target arrives. */
  let shown = -1
  /** The stage the page is asking for. */
  let target = 0
  /** The event in flight, or null. */
  let ev = null
  /** Seconds still to wait before the next lift of a run may open. */
  let gap = 0
  /**
   * The chain, if one is running: which stages it spans and how far through it
   * is in seconds. Its only job outside this module is to tell the page how far
   * to carry the reader, so it is a wall clock rather than a state machine —
   * the lifts themselves are sequenced by `shown` and `target`, not by this.
   */
  let run = null

  if (rig) {
    const add = (body, kind, group, order, count) => {
      const spread = kind === 'soil' ? SOIL_SPREAD : SPOIL_SPREAD
      // A third of the offset comes from the order the bodies sit in, so the
      // group still has a direction; the rest is scattered by position, so it
      // does not read as a list being worked through. Both are fixed for the
      // life of the page.
      const lead = kind === 'soil' ? 0 : SPOIL_LEAD
      const ramp = count > 1 ? Math.min(order, 3) / 3 : 0
      const r = {
        body,
        kind,
        group,
        // 0 = the stage before this event, 1 = the stage after it. Soil reads
        // it as "how gone", spoil as "how tipped".
        p: 0,
        delay: lead + spread * (0.3 * ramp + 0.7 * scatter(body.top.x, body.top.z)),
        duration: kind === 'soil' ? soilDuration : spoilDuration,
        emitted: false,
        casts: body.object.castShadow,
        // Whether this layer has taken the shadow flag off the body. Without
        // it, a snap on the very first frame writes the flag the GLB loaded
        // with back over the one the quality tier had just set, and the soil
        // stops casting for the rest of the page.
        touchedShadow: false,
      }
      records.set(body.object, r)
      let list = groups.get(group)
      if (!list) { list = []; groups.set(group, list) }
      list.push(r)
    }
    for (const [name, group] of rig.soil) {
      group.bodies.forEach((b, i) => add(b, 'soil', name, i, group.bodies.length))
    }
    for (const [name, group] of rig.spoil) {
      group.bodies.forEach((b, i) => add(b, 'spoil', name, i, group.bodies.length))
    }
  }

  /** How long the lift arriving at stage `hi` takes, beat included. */
  const stepSeconds = []
  for (let hi = 1; hi <= LAST_STAGE; hi += 1) {
    const step = STAGE_PLANS[hi]
    let longest = 0
    for (const r of [...(groups.get(step.cut) ?? []), ...(groups.get(step.tip) ?? [])]) {
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

  function setFade(r, value) {
    const opaque = value >= 0.999
    const mats = r.body.materials
    for (let i = 0; i < mats.length; i += 1) {
      const m = mats[i]
      m.opacity = opaque ? 1 : value
      // Transparent only while it has to be. Leaving it on permanently puts
      // every soil body into the sorted pass for the whole page, and a sorted
      // pass is where flicker comes from. Depth writing is left alone: these
      // are closed solids, and a solid drawn without depth writes shows its own
      // back faces through its front.
      m.transparent = opaque ? r.body.opaque[i] : true
    }
  }

  /**
   * Put a body back exactly as the asset had it.
   *
   * Every event both begins and ends here, which is what makes repetition
   * exact: nothing is ever nudged from wherever it happened to be, so no offset
   * in position, scale, opacity or the shadow flag can accumulate over a
   * hundred passes up and down the page.
   */
  function rest(r, visible) {
    const b = r.body
    b.object.position.copy(b.restPosition)
    b.object.scale.copy(b.restScale)
    b.object.visible = visible
    if (r.touchedShadow) {
      b.object.castShadow = r.casts
      r.touchedShadow = false
    }
    setFade(r, 1)
  }

  function draw(r) {
    const b = r.body
    if (r.kind === 'soil') {
      if (r.p >= 1) { rest(r, false); return }
      if (r.p <= 0) { rest(r, true); return }
      sample(REMOVAL, r.p, removal)
      const sy = Math.max(removal.sy, FLOOR)
      const sxz = Math.max(removal.sxz, FLOOR)
      b.object.scale.set(b.restScale.x * sxz, b.restScale.y * sy, b.restScale.z * sxz)
      // Hold the pivot still while the body scales about it, then drop the
      // whole thing clear of the surface underneath.
      b.object.position.set(
        b.restPosition.x + b.pivot.x * (1 - sxz),
        b.restPosition.y + b.pivot.y * (1 - sy) - removal.sink * b.height,
        b.restPosition.z + b.pivot.z * (1 - sxz),
      )
      b.object.visible = true
      setFade(r, removal.o)
    } else {
      if (r.p <= 0) { rest(r, false); return }
      if (r.p >= 1) { rest(r, true); return }
      sample(TIP, r.p, tip)
      const s = Math.max(tip.s, FLOOR)
      b.object.scale.set(b.restScale.x * s, b.restScale.y * s, b.restScale.z * s)
      b.object.position.set(
        b.restPosition.x + b.pivot.x * (1 - s),
        b.restPosition.y + b.pivot.y * (1 - s),
        b.restPosition.z + b.pivot.z * (1 - s),
      )
      b.object.visible = true
      setFade(r, tip.o)
    }
  }

  function emit(r) {
    if (!onCut) return
    const b = r.body
    region.x = b.top.x
    region.y = b.top.y
    region.z = b.top.z
    region.radius = b.radius
    // Big areas throw more dust than small ones, but not proportionally: a
    // chunk four times the size does not make four times the cloud.
    region.strength = clamp01(0.45 + Math.sqrt(b.footprint) / 14)
    onCut(regions)
  }

  /**
   * Land a whole stage now, with no animation and no events.
   *
   * The only way any body ever reaches a stage state other than by running an
   * event through, so "the site at stage three" means exactly one arrangement
   * of transforms however it was arrived at.
   */
  function settleTo(index) {
    const plan = STAGE_PLANS[clampStageIndex(index)]
    for (const [, r] of records) {
      const want = r.kind === 'soil'
        ? (plan.removed.has(r.group) ? 1 : 0)
        : (plan.spoil.has(r.group) ? 1 : 0)
      r.p = want
      r.emitted = false
      rest(r, r.kind === 'soil' ? want < 0.5 : want > 0.5)
    }
    if (rig && rig.base) rig.base.visible = true
    shown = clampStageIndex(index)
    ev = null
    gap = 0
  }

  /**
   * Open an event between two adjacent stages.
   *
   * `lo` is always the lower stage and `hi` the higher one, whichever way the
   * reader is going: an event is a description of a transition, not of a
   * direction. Direction is `dir`, and it is free to change from one frame to
   * the next without the event being rebuilt — which is what lets a reversal
   * half way through carry on from the frame that is already on screen instead
   * of popping back to one end.
   */
  function begin(lo, dir) {
    const hi = lo + 1
    // The group that is arriving at `hi` — the soil it takes and the heap it
    // makes. Going backwards it is the same group, undone.
    const step = STAGE_PLANS[hi]
    const bodies = [...(groups.get(step.cut) ?? []), ...(groups.get(step.tip) ?? [])]
    let duration = 0
    let weight = 0
    for (const r of bodies) {
      duration = Math.max(duration, r.delay + r.duration)
      if (r.kind === 'soil') weight += r.body.footprint
    }
    ev = {
      lo, hi, dir, bodies,
      clock: dir > 0 ? 0 : duration,
      duration: Math.max(duration, 1e-3),
      weight,
      // The ground takes one hit per event, and only going forward. Set on a
      // reverse so undoing an event cannot shake the camera, and cleared only
      // by closing the event — so turning around half way and coming forward
      // again finishes the hit it already gave rather than giving a second.
      hit: dir < 0,
    }

    for (const r of bodies) {
      // Dust only ever leaves a body on the way down, and only once per pass.
      // Opening a reverse marks them all spent so undoing an event does not
      // throw a fresh cloud; dropping back below the threshold clears the flag
      // again, so a genuine second forward pass does throw one.
      r.emitted = dir < 0
      if (r.kind === 'soil') {
        // A body on its way out still casts a full-strength shadow: three's
        // depth pass has no idea it is fading, or that it is now under the
        // floor. A chunk dropping into the cut would print a hard shadow of
        // itself across the ground it is uncovering.
        if (!r.touchedShadow) {
          r.casts = r.body.object.castShadow
          r.touchedShadow = true
        }
        r.body.object.castShadow = false
      }
    }

    render()
  }

  function render() {
    for (const r of ev.bodies) {
      const p = clamp01((ev.clock - r.delay) / r.duration)
      r.p = p
      draw(r)
      if (r.kind !== 'soil') continue
      if (p < DUST_AT) r.emitted = false
      else if (!r.emitted && ev.dir > 0) {
        r.emitted = true
        emit(r)
        // The camera is hit when the ground actually gives, not when the event
        // was scheduled: the first body to pass the collapse threshold is the
        // impact, and everything after it is the same impact continuing.
        // Scaled by how much ground is going, so the three small first cuts do
        // not hit as hard as the stage that takes out half the site.
        if (!ev.hit && onImpact && ev.weight > 0) {
          ev.hit = true
          onImpact(clamp01(0.45 + ev.weight / 420))
        }
      }
    }
  }

  /** Land on one end of the event and let the next one start next frame. */
  function close(index) {
    const plan = STAGE_PLANS[index]
    for (const r of ev.bodies) {
      const want = r.kind === 'soil'
        ? (plan.removed.has(r.group) ? 1 : 0)
        : (plan.spoil.has(r.group) ? 1 : 0)
      r.p = want
      r.emitted = false
      rest(r, r.kind === 'soil' ? want < 0.5 : want > 0.5)
    }
    shown = index
    ev = null
  }

  /**
   * The trigger. The ONLY thing scroll is allowed to say.
   *
   * It records an intention and returns. It never touches a transform, never
   * starts an event mid-frame and never moves a clock, so how fast the reader
   * crossed the boundary, and whether they are still moving, cannot reach the
   * animation. What happens next is decided in `update`, from `delta`.
   */
  function setTarget(index) {
    const next = clampStageIndex(index)
    if (next === target && (run || next === shown)) return
    target = next
    // The first stage the page asks for is a state, not an event: a reader who
    // refreshes half way down has already missed the excavation they are
    // looking at, and watching the site dig itself on arrival would be showing
    // them something that happened before they got there.
    if (shown < 0 || !animated) { settleTo(target); run = null; return }
    if (target === shown) { run = null; return }
    // Open the chain. `elapsed` is a wall clock for the page travel only; what
    // actually decides when each lift starts is `shown` reaching the next
    // stage, below.
    run = { from: shown, to: target, dir: target > shown ? 1 : -1, elapsed: 0, total: runSeconds(shown, target) }
    gap = 0
  }

  return {
    /** How many bodies are mid-event. Zero means `update` is nearly free. */
    active: () => (ev ? ev.bodies.length : 0),

    /** True while an event owns the picture. */
    playing: () => ev !== null,

    /**
     * How far through the chain, 0..1, for whatever is carrying the page.
     *
     * A wall clock, not a state: it is allowed to run a few tens of
     * milliseconds ahead of or behind the lifts, because its job is to move
     * the scroll offset smoothly and the lifts decide for themselves when they
     * happen. It reaches 1 and stops; `running` is what says when to let go.
     */
    runProgress: () => (run ? clamp01(run.elapsed / run.total) : 1),

    /** True from the first frame of a chain to the frame the last lift closes. */
    running: () => run !== null,

    /** Which way the chain is going: +1 digging, -1 putting it back. */
    runDirection: () => (run ? run.dir : 0),

    /** How long the whole chain takes at the rate it plays. */
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

    /** What the controller calls. Its change object carries the audio data too. */
    onStage(change) {
      if (change) setTarget(change.index)
    },

    /**
     * One frame.
     *
     * The whole state machine is here, and it is three rules:
     *
     *   an event in flight follows the target's SIDE, not its distance
     *   an event that reaches either end closes exactly on that stage
     *   with nothing in flight and the target elsewhere, open the next event
     *
     * There is no queue object. The backlog is simply `target - shown`, read
     * fresh every frame, so a reader who flings the page and then flings it
     * back never leaves a stack of events behind them to be worked through.
     */
    update(delta) {
      if (shown < 0 || !animated) return false
      if (run) run.elapsed += delta

      if (ev) {
        // Which way this event is playing follows which side of it the target
        // is on. Nothing else: not how far past, not how fast it got there.
        ev.dir = target >= ev.hi ? 1 : target <= ev.lo ? -1 : ev.dir
        ev.clock += ev.dir > 0 ? delta : -delta * REVERSE_RATE
        if (ev.clock >= ev.duration) { close(ev.hi); gap = shown === target ? 0 : GAP }
        else if (ev.clock <= 0) { close(ev.lo); gap = shown === target ? 0 : GAP }
        else render()
        return true
      }

      if (target === shown) { run = null; return false }

      // The beat between lifts. Nothing is drawn and nothing is decided; the
      // site simply sits at the stage the last lift finished on.
      if (gap > 0) { gap -= delta; return true }

      // Every step in the chain plays. This used to land the backlog at once
      // and play only the last lift, on the grounds that a reader who had
      // flung the page should not have to wait for a past they had scrolled
      // through. That reasoning does not survive the excavation becoming one
      // event: the five lifts ARE the thing, and skipping four of them to
      // catch up with a thumb is exactly what the page is holding the wheel to
      // prevent.
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

    /** For tests and for anything that wants to inspect a body's state. */
    stateOf(object) {
      const r = records.get(object)
      return r ? { p: r.p, running: ev ? ev.bodies.includes(r) : false, delay: r.delay } : null
    },

    /** The longest an event can take, for tests and for tuning. */
    longestEvent() {
      let longest = 0
      for (let i = 1; i <= LAST_STAGE; i += 1) {
        const step = STAGE_PLANS[i]
        for (const r of [...(groups.get(step.cut) ?? []), ...(groups.get(step.tip) ?? [])]) {
          longest = Math.max(longest, r.delay + r.duration)
        }
      }
      return longest
    },
  }
}
