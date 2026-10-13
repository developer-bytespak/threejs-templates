import { prior } from './sequence.js'

/**
 * The columns, as a table rather than as code.
 *
 *   excavation -> rebar -> formwork -> concrete -> COLUMNS
 *
 * The first moment the thing being built stops being a hole. Four storeys of
 * frame, growing out of the finished slab, and the first time on this page
 * that anything appears ABOVE ground level.
 *
 * ONE TRIGGER, THE WHOLE FRAME
 *
 * The same shape as the dig and the pour, and for the same reason. A frame is
 * one operation: level one goes up, then level two off the head of it, then
 * three, then four. Splitting that across four scroll positions would turn one
 * continuous thing into four unrelated ones and put the reader back in charge
 * of a clock they should not be holding — and worse here than anywhere else,
 * because a half-built storey is not a state a building is ever in.
 *
 * So crossing `RISE_FROM` once runs all four levels back to back, and for the
 * three seconds that takes the page is carried from there to `RISE_TO` rather
 * than scrolled. Stop dead a pixel past the trigger and every level still
 * lands, because the only input to the animation is `delta`.
 *
 * WHAT THIS FILE NAMES
 *
 * Four groups, and nothing inside them. The export puts an empty over each
 * level — COLUMN_LEVEL_01 and so on — and the rig discovers whatever is under
 * it. The Blender build can move a column, add a bay or change the section
 * without this file knowing, exactly as with the three phases before it.
 */

/** The container node. Present for completeness; nothing drives it. */
export const COLUMNS_ROOT = 'COLUMNS'

/**
 * The four levels, bottom to top.
 *
 * They are not four arbitrary slices of a tall column: each is a separate cast
 * standing on the head of the one below it, which is how a frame is actually
 * built and why there is a seam at every storey line. Level one rises out of
 * the excavation and its head passes site datum; the other three are the
 * building coming out of the ground.
 */
export const COLUMN_GROUPS = [
  'COLUMN_LEVEL_01', // off the slab, rising to ground level
  'COLUMN_LEVEL_02', // the first storey above ground
  'COLUMN_LEVEL_03',
  'COLUMN_LEVEL_04',
]

export const COLUMN_LABELS = [
  'foundation complete',
  'first level',
  'second level',
  'third level',
  'structural frame complete',
]

/**
 * The states.
 *
 * Five entries for four events. Stage 0 is the finished foundation with
 * nothing standing on it — a state, not a construction event.
 */
export const COLUMN_PLANS = COLUMN_LABELS.map((label, index) => ({
  index,
  label,
  built: new Set(COLUMN_GROUPS.slice(0, index)),
  /** Which level this stage is the arrival of. Null for stage 0. */
  build: index > 0 ? COLUMN_GROUPS[index - 1] : null,
}))

export const LAST_COLUMN_STAGE = COLUMN_PLANS.length - 1

/**
 * Where the frame fires, and how the reader gets back out of it.
 *
 * The same four-state armed latch as the dig and the pour, on the page's own
 * axis rather than through `prior()` — this phase was composed against the
 * page that exists now.
 *
 * `RISE_FROM` sits four per cent above `POUR_TO` (which `prior()` puts at
 * 0.739), so the concrete has landed and the page has stopped moving before
 * anything can be stood on it. `RISE_REST` sits at 0.748 — above `POUR_LEAVE`
 * at 0.705 — so reversing the whole frame never disturbs the pour underneath
 * it; a reader who wants the concrete back out has to keep going up.
 */
export const RISE_FROM = 0.780     // foundation poured, and below: this is where it fires
export const RISE_EXIT = 0.758     // built but never armed: this is where it lets go
export const RISE_ARM = 0.960      // built and this far along: the way back opens
export const RISE_LEAVE = 0.936    // armed: this is where the reverse fires
export const RISE_TO = 0.982       // where the forward run sets the reader down
export const RISE_REST = 0.748     // where the reverse run sets the reader down

/**
 * Which of the four latch states mean there is a frame standing.
 *
 * States 0 and 3 are both a bare foundation — one below the trigger and one
 * above it — so the latch is not a number to be compared. Reading it as one
 * is a bug the excavation already paid for once.
 */
export function riseIsOn(latch) {
  return latch === 1 || latch === 2
}

export function riseWanted(progress, previous = 0) {
  switch (previous) {
    case 1:  // built, but the page has not been across it yet
      if (progress <= RISE_EXIT) return 0
      return progress >= RISE_ARM ? 2 : 1
    case 2:  // built, and the way back is open
      return progress <= RISE_LEAVE ? 3 : 2
    case 3:  // bare, sitting above the trigger
      if (progress < RISE_FROM) return 0
      return progress >= RISE_ARM ? 1 : 3
    default: // bare, below the trigger
      return progress >= RISE_FROM ? 1 : 0
  }
}

export function clampColumnIndex(index) {
  if (!Number.isFinite(index)) return 0
  return index < 0
    ? 0
    : index > LAST_COLUMN_STAGE
      ? LAST_COLUMN_STAGE
      : Math.round(index)
}

// `prior` is imported so this file states its relationship to the phases
// before it in code rather than in a comment: the pour's far side is where
// this phase's near side has to clear.
export const POUR_LANDS_AT = prior(0.985)
