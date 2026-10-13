/**
 * The excavation, as a table rather than as code.
 *
 * The asset is a solid mass of soil, not a pit with a lid. Inside the site's
 * opening there is a closed body of earth cut into eighteen chunks plus the
 * foundation cuts; showing all of them is untouched ground, and the excavation
 * appears by taking them away. So the only thing this layer has to do is
 * decide which soil still exists at a given moment — there is no geometry to
 * reveal, because the hole is the absence of these objects.
 *
 * Everything below is data. Nothing here reaches into the scene, allocates, or
 * knows that React exists, which is what lets the controller be a thin wrapper
 * and lets this file be checked on its own.
 *
 * WHAT THIS FILE NAMES, AND WHAT IT DOES NOT
 *
 * It names the five STAGE GROUPS and nothing inside them. The export puts an
 * empty over each stage's chunks — EXCAVATION_STAGE_01 and so on — and the rig
 * discovers whatever meshes hang under it. That is deliberate: the chunk
 * geometry is going to be rebuilt, and when it is, the number of chunks per
 * stage and their names will change. A table that listed eighteen chunk names
 * would have to be rewritten on every export; a table that lists five groups
 * does not have to be touched at all.
 *
 * If the asset is re-exported with different GROUP names, this is the only
 * file that changes, and `useSiteModel` will report anything it cannot find
 * rather than silently animating nothing.
 */

/** The container node. Present for completeness; nothing drives it. */
export const SOIL_MASS = 'SOIL_MASS'

/** The soil that is never removed. Its top surface is the finished pit. */
export const GROUND_BASE = 'GROUND_BASE'

/**
 * The five removal stages, in the order they come out.
 *
 * Each is an empty in the export with that stage's chunks parented under it.
 * The last one holds the foundation cuts, which behave exactly like a chunk:
 * earth that is present until it is dug, so hiding it is what makes the
 * trenches exist.
 */
export const EXCAVATION_GROUPS = [
  'EXCAVATION_STAGE_01',
  'EXCAVATION_STAGE_02',
  'EXCAVATION_STAGE_03',
  'EXCAVATION_STAGE_04',
  'EXCAVATION_STAGE_05',
]

/** What came out, heaped beside the cut. One group per stage, cumulative. */
export const SPOIL_GROUPS = [
  'SPOIL_STAGE_01',
  'SPOIL_STAGE_02',
  'SPOIL_STAGE_03',
  'SPOIL_STAGE_04',
  'SPOIL_STAGE_05',
]

/**
 * Where each stage lands on the excavation's own 0..100.
 *
 * Six entries for five removals: stage 0 is untouched ground, which is a state
 * and not a removal. The page maps its dig band onto this range, so these
 * numbers decide nothing about scroll — they are the excavation's own clock.
 */
export const STAGE_KEYS = [0, 20, 40, 60, 80, 100]

/**
 * The stages, derived rather than written out.
 *
 * The previous table was written longhand on the argument that a table you can
 * read top to bottom is worth more than a clever derivation. That was true
 * when the rule was "these four names, in this order, for no reason you could
 * state". It is no longer true: the rule now IS the model — stage n has
 * removed groups 1..n and tipped spoil 1..n — and writing five cumulative
 * lists out longhand states the same rule five times, with five chances to get
 * it wrong. What the reader needs is the rule, and it is one line.
 */
export const STAGE_PLANS = STAGE_KEYS.map((key, index) => ({
  key,
  index,
  removed: new Set(EXCAVATION_GROUPS.slice(0, index)),
  spoil: new Set(SPOIL_GROUPS.slice(0, index)),
  /** Which group this stage is the arrival of. Null for stage 0. */
  cut: index > 0 ? EXCAVATION_GROUPS[index - 1] : null,
  tip: index > 0 ? SPOIL_GROUPS[index - 1] : null,
}))

export const LAST_STAGE = STAGE_PLANS.length - 1

if (EXCAVATION_GROUPS.length !== STAGE_KEYS.length - 1 ||
    SPOIL_GROUPS.length !== STAGE_KEYS.length - 1) {
  console.error(
    '[construction] excavation.js: there must be one excavation group and one ' +
      'spoil group per stage key after the first. Check the lists against the ' +
      'exported GLB.',
  )
}

export function clampStageIndex(index) {
  if (!Number.isFinite(index)) return 0
  return index < 0 ? 0 : index > LAST_STAGE ? LAST_STAGE : Math.round(index)
}

/**
 * How far back below a boundary the progress has to fall before the stage
 * un-commits.
 *
 * Without it, a value parked on a boundary — which is exactly where a scroll
 * comes to rest, because the beats are tuned to land there — flickers between
 * two stages as the damped value crosses back and forth by a thousandth.
 *
 * The slack is only on the way back. Going forward the stage commits exactly
 * on its own number, so 20% is stage 20 and 100% is stage 100 rather than
 * something a hair past them; padding the forward edge as well would have put
 * the last boundary past 100 and made the final stage unreachable from scroll.
 *
 * It is wide — a twentieth of the dig, about four per cent of the page — and
 * that is the point now that crossing a boundary fires a whole event rather
 * than nudging a weight. A narrow band lets a reader who stops with the
 * boundary under their thumb rock an event forwards and backwards with tiny
 * movements, which is the closest this design can come to scrubbing. Four per
 * cent of the page is comfortably more than a wheel notch and comfortably less
 * than a deliberate scroll back.
 */
export const STAGE_HYSTERESIS = 5.0

/**
 * How far short of a boundary still counts as having reached it.
 *
 * Scroll is damped, and damping approaches its target asymptotically: a page
 * scrolled to the very bottom settles at 99.9997% and never at 100. Requiring
 * the boundary exactly therefore leaves the last stage permanently one
 * thousandth of a percent out of reach, which is invisible in a sweep test and
 * obvious at the bottom of the page, where the excavation simply never
 * finishes.
 */
export const STAGE_EDGE = 0.05

/**
 * Which stage a percentage is in, given where it already was.
 *
 * Converges fully rather than stepping one stage per call, so a jump from 0 to
 * 100 lands on 100 in the same frame, and it is still a pure function: the
 * same (percent, previous) pair always gives the same answer, which is what
 * keeps scrubbing backwards exact.
 */
export function stageIndexFor(percent, previous = 0) {
  let index = clampStageIndex(previous)
  const p = Number.isFinite(percent) ? percent : 0
  while (index < LAST_STAGE && p >= STAGE_KEYS[index + 1] - STAGE_EDGE) index += 1
  while (index > 0 && p <= STAGE_KEYS[index] - STAGE_HYSTERESIS) index -= 1
  return index
}

/** Nearest stage to a percentage, ignoring history. For direct jumps. */
export function nearestStageIndex(percent) {
  let best = 0
  for (let i = 1; i < STAGE_KEYS.length; i += 1) {
    if (Math.abs(percent - STAGE_KEYS[i]) < Math.abs(percent - STAGE_KEYS[best])) best = i
  }
  return best
}

export function stageIndexOfKey(key) {
  const index = STAGE_KEYS.indexOf(Number(key))
  return index < 0 ? null : index
}

/**
 * Apply a stage to a resolved rig.
 *
 * Split out from the component so the same function serves the frame loop, the
 * imperative API and any test: given the groups and an index, the scene is in a
 * defined state afterwards regardless of what it was before. That is what
 * makes scrubbing backwards correct rather than merely likely.
 *
 * It writes only visibility. Transforms, opacity and shadow flags belong to
 * whatever is animating, and the one rule between the two layers is that the
 * animation must leave every body on the state this function would have given
 * it.
 */
export function applyStage(rig, index) {
  const plan = STAGE_PLANS[clampStageIndex(index)]
  if (!rig) return plan
  for (const [name, group] of rig.soil) {
    const gone = plan.removed.has(name)
    for (const body of group.bodies) body.object.visible = !gone
  }
  for (const [name, group] of rig.spoil) {
    const shown = plan.spoil.has(name)
    for (const body of group.bodies) body.object.visible = shown
  }
  if (rig.base) rig.base.visible = true
  return plan
}

/**
 * The excavation as a plain object, with no React in it.
 *
 * Pulled out of the component for two reasons. It is the half worth testing —
 * given a rig and a sequence of calls, the visibility of every body is decided
 * here — and a driver that does not need a canvas can be exercised in a few
 * lines instead of a headless renderer. It is also what the animation layer
 * holds on to: an animation does not want a React component, it wants
 * something it can call and something that will call it back.
 *
 * `update` is how a progress source drives it, and it ignores a value it has
 * already seen. That is not a micro-optimisation. Without it the frame loop
 * re-derives the stage from scroll sixty times a second and immediately undoes
 * anything set from outside, so `setStage(100)` would last exactly one frame.
 * Ignoring repeats means an imperative call stands until the page actually
 * moves again, which is the only behaviour that makes the API worth having.
 */
export function createExcavationDriver(rig, onStageChange = null) {
  let index = -1
  let lastPercent = null
  const warned = new Set()

  function commit(next) {
    if (!rig || next === index) return false
    const previous = index
    index = next
    // Deliberately NOT applying the stage here. This layer decides which stage
    // the page is asking for and says so; what is on screen belongs to the
    // event layer, which is running a clock this one knows nothing about.
    // Switching visibility here as well would pop the new stage into place and
    // then animate it, which is what "scrolling scrubs the excavation" looked
    // like from the outside.
    if (onStageChange) {
      onStageChange({
        index: next,
        key: STAGE_KEYS[next],
        previousIndex: previous,
        previousKey: previous >= 0 ? STAGE_KEYS[previous] : null,
        // How much of the earthwork has been done, 0..1. The audio layer reads
        // this as its spoil weight, so what you hear is driven by the number
        // that decided what you see rather than by a second opinion.
        fraction: next / LAST_STAGE,
        spoilShown: STAGE_PLANS[next].spoil.size,
        /** True the first time the driver commits anything: a load, not an event. */
        initial: previous < 0,
        /** Forward is an excavation. Backward is an undo. They are not the same. */
        forward: next > previous,
        /** How many stages this change skipped. 1 is an ordinary step. */
        span: previous < 0 ? 0 : Math.abs(next - previous),
      })
    }
    return true
  }

  const from = () => (index < 0 ? 0 : index)

  return {
    stageKeys: STAGE_KEYS,
    nodes: rig,

    current() {
      return {
        index,
        key: index >= 0 ? STAGE_KEYS[index] : null,
        fraction: index >= 0 ? index / LAST_STAGE : 0,
      }
    },

    /** Driven by a progress source, in percent. Repeats are ignored. */
    update(percent) {
      if (lastPercent !== null && Math.abs(percent - lastPercent) < 1e-4) return false
      lastPercent = percent
      return commit(stageIndexFor(percent, from()))
    },

    /** 0..1, the unit the rest of this module uses. */
    setProgress(fraction) {
      const percent = fraction * 100
      lastPercent = percent
      return commit(stageIndexFor(percent, from()))
    },

    /** A key from the table — 0, 20, 40, 60, 80 or 100. */
    setStage(key) {
      const next = stageIndexOfKey(key)
      if (next === null) {
        if (!warned.has(key)) {
          warned.add(key)
          console.warn(
            `[construction] no excavation stage "${key}". ` +
              `Stages are ${STAGE_KEYS.join(', ')}.`,
          )
        }
        return false
      }
      return commit(next)
    },

    /** Nearest stage to an arbitrary percentage, ignoring hysteresis. */
    snapTo(percent) {
      return commit(nearestStageIndex(percent))
    },

    /**
     * Re-assert the current stage. Falls back to the first one rather than
     * doing nothing, so calling this before anything has driven the driver
     * still leaves the scene in a defined state instead of whatever visibility
     * flags the GLB happened to load with.
     */
    refresh() {
      if (!rig) return false
      if (index < 0) return commit(0)
      // Re-announce rather than re-apply: the event layer holds the picture.
      const previous = index
      index = -1
      return commit(previous)
    },
  }
}
