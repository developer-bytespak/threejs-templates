import { prior } from './sequence.js'

/**
 * The foundation, as a table rather than as code.
 *
 * The excavation leaves a formation level with the footings already cut into
 * it — strip trenches round the edge, six pad bases, the ground beams between
 * them and one service pit. This is what goes into those cuts, in the order a
 * job actually does it: steel first, bottom-up, then the boards that will hold
 * the pour.
 *
 * Exactly like `excavation.js`, this names GROUPS and nothing inside them. The
 * export puts an empty over each stage's components — FOUNDATION_STAGE_01 and
 * so on — and the rig discovers whatever meshes hang under it. Sixty-five
 * objects are named in the GLB and none of them are named here, so the
 * Blender build can add a bar run or split a formwork panel without this file
 * or the animation knowing.
 *
 * WHAT THIS IS NOT
 *
 * It is not a second copy of the excavation's machinery. The two share a
 * shape — a table of cumulative states, a clock-driven event per step, one
 * trigger per event — because that shape is what makes "let go of the wheel
 * and it still finishes" true, and it is worth having exactly once. They do
 * not share a module because they do not share a subject: soil is taken away
 * in lifts with dust and weight behind it, and steel is placed. The curves,
 * the durations and the things they call out to are different, and the one
 * thing they must never share is a clock.
 */

/** The container node. Present for completeness; nothing drives it. */
export const FOUNDATION_ROOT = 'FOUNDATION'

/**
 * The five construction stages, in the order they are built.
 *
 * Each is an empty in the export with that stage's components parented under
 * it. The split follows the trade, not the geometry: everything in one stage
 * is work that happens at the same point in the job, which is why the
 * formwork is two stages and not one — the perimeter shutters go up round the
 * outside of the slab, and the internal boxes for the pads and beams are a
 * separate operation inside them.
 */
export const FOUNDATION_GROUPS = [
  'FOUNDATION_STAGE_01', // vertical starter bars: strips, pads, beams, pit
  'FOUNDATION_STAGE_02', // horizontal main bars threaded through them
  'FOUNDATION_STAGE_03', // the grid: pad mats, slab mesh, links round the strips
  'FOUNDATION_STAGE_04', // perimeter formwork, inner and outer face
  'FOUNDATION_STAGE_05', // internal formwork: the pad and beam boxes, pit shutter
]

/** What each stage is, in one phrase. For logs and for the dev probe. */
export const FOUNDATION_LABELS = [
  'excavation complete',
  'vertical rebar',
  'horizontal rebar',
  'rebar grid',
  'perimeter formwork',
  'foundation ready',
]

/**
 * The states, derived rather than written out.
 *
 * Stage n has groups 1..n built. Six entries for five stages, because stage 0
 * is the bare formation — a state, not a construction event.
 */
export const FOUNDATION_PLANS = FOUNDATION_LABELS.map((label, index) => ({
  index,
  label,
  built: new Set(FOUNDATION_GROUPS.slice(0, index)),
  /** Which group this stage is the arrival of. Null for stage 0. */
  build: index > 0 ? FOUNDATION_GROUPS[index - 1] : null,
}))

export const LAST_FOUNDATION_STAGE = FOUNDATION_PLANS.length - 1

/**
 * Where each stage fires, as a fraction of the page.
 *
 * `TRIGGERS[i]` is where stage `i + 1` is asked for. They live above the
 * excavation's `DIG_TO` (0.660), which is where the dig sets the reader down,
 * so the earthwork has finished and handed the wheel back before the first
 * one is reachable.
 *
 * They were 55 thousandths of the page apart and now they are 35, which is the
 * one thing the concrete phase changed about the foundation. The concrete is a
 * single trigger with a hold behind it and it needs somewhere to fire from
 * that is clear of the last shutter going up: compressing this band to
 * 0.700-0.840 leaves 0.840 to 1.0 for the pour, and 35 thousandths of the page
 * is still 40vh — comfortably more than a wheel notch and comfortably more
 * than the hysteresis below. Nothing else about this phase moved.
 *
 * These are TRIGGERS, not a timeline. Crossing one asks for a stage and
 * nothing else; how long the stage then takes, and whether the reader is still
 * scrolling while it happens, has no effect on it whatsoever.
 */
export const FOUNDATION_TRIGGERS =
  [0.700, 0.735, 0.770, 0.805, 0.840].map(prior)

/**
 * How far back below a trigger a stage un-commits.
 *
 * Wider than a wheel notch, so a reader who stops with a trigger under their
 * thumb cannot rock a stage in and out of existence, and narrower than the
 * 3.5% gap between triggers, so every stage still has a band of scroll where
 * it is unambiguously the answer.
 */
export const FOUNDATION_HYSTERESIS = prior(0.026)

export function clampFoundationIndex(index) {
  if (!Number.isFinite(index)) return 0
  return index < 0
    ? 0
    : index > LAST_FOUNDATION_STAGE
      ? LAST_FOUNDATION_STAGE
      : Math.round(index)
}

/**
 * Which stage the page is asking for, given where it already was.
 *
 * A pure function of (progress, previous), so the same pair always gives the
 * same answer and scrolling back down retraces exactly what scrolling up
 * undid. Converges fully rather than stepping once per call, so a fling from
 * the top of the foundation band to the bottom of the page asks for stage 5 in
 * the frame it lands, and the event layer plays the five events it owes.
 */
export function foundationWanted(progress, previous = 0) {
  let index = clampFoundationIndex(previous)
  const p = Number.isFinite(progress) ? progress : 0
  while (index < LAST_FOUNDATION_STAGE && p >= FOUNDATION_TRIGGERS[index]) index += 1
  while (index > 0 && p <= FOUNDATION_TRIGGERS[index - 1] - FOUNDATION_HYSTERESIS) index -= 1
  return index
}

/**
 * Apply a stage to a resolved rig, with no animation.
 *
 * Writes visibility and the growth transform, because for this layer they are
 * the same statement: a component that is not built is not merely invisible,
 * it is at zero along its growth axis, and anything that leaves it at zero
 * while visible leaves a sliver of steel standing in the cut.
 */
export function applyFoundationStage(rig, index) {
  const plan = FOUNDATION_PLANS[clampFoundationIndex(index)]
  if (!rig) return plan
  for (const [name, group] of rig.groups) {
    const built = plan.built.has(name)
    for (const part of group.parts) {
      part.object.visible = built
      part.object.scale.copy(part.restScale)
      part.object.position.copy(part.restPosition)
    }
  }
  return plan
}
