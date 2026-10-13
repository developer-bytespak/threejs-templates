import { prior } from './sequence.js'

/**
 * The concrete pour, as a table rather than as code.
 *
 *   excavation  ->  rebar  ->  formwork  ->  CONCRETE
 *
 * The formwork is finished and the job is ready for concrete. This names the
 * four pours, the fifth event that is not a pour, and the one place on the
 * page where the whole thing fires.
 *
 * ONE TRIGGER, THE WHOLE POUR
 *
 * Not one trigger per pour, the way the rebar and the formwork go in. A pour
 * is one operation: the level comes up in the perimeter, then in the pads,
 * then in the beams, then in the corners that close the ring, then the floor
 * comes up over all of it, and then the whole of it settles. Breaking that across five scroll positions would turn one
 * continuous thing into five unrelated ones, and would put the reader back in
 * charge of a clock they should not be holding.
 *
 * So this borrows the excavation's shape rather than the foundation's:
 * crossing `POUR_FROM` once runs all five events back to back, and for the
 * three and a half seconds that takes the page is carried from there to
 * `POUR_TO` rather than scrolled. Stop dead a pixel past the trigger and every
 * one of them still lands, because the only input to the animation is `delta`.
 *
 * WHAT THIS FILE NAMES
 *
 * Four groups, and nothing inside them. The export puts an empty over each
 * pour — CONCRETE_STAGE_01 and so on — and the rig discovers whatever is under
 * it. The Blender build can split a run or add a pad without this file
 * knowing, exactly as with the excavation and the foundation.
 */

/** The container node. Present for completeness; nothing drives it. */
export const CONCRETE_ROOT = 'CONCRETE'

/**
 * The four pours, in the order a job does them.
 *
 * The split is the construction logic, not the geometry: the perimeter first
 * because it is the deepest and the furthest from anything else, then the pads
 * it will eventually be tied to, then the beams that connect those pads into a
 * grid, and last the four corners that close the ring and the service pit.
 */
export const CONCRETE_GROUPS = [
  'CONCRETE_STAGE_01', // perimeter strip footing, four runs
  'CONCRETE_STAGE_02', // six pad footings
  'CONCRETE_STAGE_03', // five ground beams, pad to pad
  'CONCRETE_STAGE_04', // the four corners that close the ring, and the pit
  'CONCRETE_STAGE_05', // the ground slab: the floor of the whole thing
]

/**
 * The slab mesh, which the slab pour embeds.
 *
 * The one place this module names anything belonging to another phase, and it
 * earns it. The mat is laid on the ground and the floor is poured over it, so
 * once the concrete is up there is nothing to see — steel inside a slab is
 * inside it. Leaving it visible would put 60 mm of bar standing out of a
 * finished floor, which is the sort of detail that makes the whole thing look
 * like a mistake.
 *
 * It is hidden by the pour and restored by the reverse, and the foundation
 * engine owns it again the moment the reader scrolls back into its band.
 */
export const SLAB_MESH = ['REBAR_G_SLAB_X', 'REBAR_G_SLAB_Y']

/**
 * The pour streams, which no longer exist.
 *
 * There were four: a tapered tube per stage, running down into the form and
 * back out again. They are gone from the model and from the animation,
 * because a visible stream is a visible SOURCE, and a source implies somebody
 * standing out of frame holding it. This site builds itself; nothing pours it.
 *
 * The name is kept for one reason: a browser holding a cached copy of the
 * older GLB would otherwise stand four pipes over the foundation forever. The
 * rig looks this group up and hides whatever it finds.
 */
export const LEGACY_STREAM_GROUP = 'CONCRETE_STREAMS'

export const CONCRETE_LABELS = [
  'formwork complete',
  'perimeter footing',
  'pad footings',
  'ground beams',
  'ring closed',
  'ground slab',
  'concrete settled',
]

/**
 * The states.
 *
 * Six entries for five events, and the fifth event is not a pour. Stages 1-4
 * each arrive with a group; stage 5 arrives with `settle`, which is the whole
 * foundation consolidating the over-fill back out. It has no geometry of its
 * own on purpose — a settling is something that happens TO concrete that is
 * already there, and giving it a group would have meant inventing a layer of
 * material to stand for it.
 */
export const CONCRETE_PLANS = CONCRETE_LABELS.map((label, index) => ({
  index,
  label,
  poured: new Set(CONCRETE_GROUPS.slice(0, Math.min(index, CONCRETE_GROUPS.length))),
  /** Which pour this stage is the arrival of. Null for stage 0 and the settle. */
  pour: index > 0 && index <= CONCRETE_GROUPS.length ? CONCRETE_GROUPS[index - 1] : null,
  /** 1 once the concrete has been consolidated to its finished level. */
  settle: index > CONCRETE_GROUPS.length ? 1 : 0,
}))

export const LAST_CONCRETE_STAGE = CONCRETE_PLANS.length - 1

/**
 * Where the pour fires, and how the reader gets back out of it.
 *
 * The same four-state latch the excavation uses, for the same reason: at the
 * instant the trigger fires the reader is standing at the near end of the
 * span, which is already past it, so a latch keyed only to the far end would
 * un-set on the next frame and the pour would open and close in one. The pour
 * is ARMED once the page has reached the far side, and only an armed pour is
 * left by scrolling back up past `POUR_LEAVE` — which is what makes the way
 * home symmetrical with the way out.
 *
 * Every threshold is paired with a second one about two per cent of the page
 * away, so no single position can sit on a boundary and oscillate.
 *
 * `POUR_FROM` sits four per cent of the page above the last formwork trigger,
 * so the boards are up and standing still before anything is poured into
 * them; `POUR_REST` sits above the point at which the formwork would start to
 * come back out, so reversing the pour never disturbs it.
 */
export const POUR_FROM = prior(0.880)     // formwork up, and below: this is where it fires
export const POUR_EXIT = prior(0.858)     // poured but never armed: this is where it lets go
export const POUR_ARM = prior(0.962)      // poured and this far along: the way back opens
export const POUR_LEAVE = prior(0.940)    // armed: this is where the reverse fires
export const POUR_TO = prior(0.985)       // where the forward run sets the reader down
export const POUR_REST = prior(0.848)     // where the reverse run sets the reader down

/**
 * Which of the four latch states mean there is concrete in the ground.
 *
 * States 0 and 3 are both an empty foundation — one below the trigger and one
 * above it — so the latch is not a number to be compared, and reading it as
 * one is a bug the excavation already paid for once.
 */
export function pourIsOn(latch) {
  return latch === 1 || latch === 2
}

export function pourWanted(progress, previous = 0) {
  switch (previous) {
    case 1:  // poured, but the page has not been across it yet
      if (progress <= POUR_EXIT) return 0
      return progress >= POUR_ARM ? 2 : 1
    case 2:  // poured, and the way back is open
      return progress <= POUR_LEAVE ? 3 : 2
    case 3:  // empty, sitting above the trigger
      if (progress < POUR_FROM) return 0
      return progress >= POUR_ARM ? 1 : 3
    default: // empty, below the trigger
      return progress >= POUR_FROM ? 1 : 0
  }
}

export function clampConcreteIndex(index) {
  if (!Number.isFinite(index)) return 0
  return index < 0
    ? 0
    : index > LAST_CONCRETE_STAGE
      ? LAST_CONCRETE_STAGE
      : Math.round(index)
}
