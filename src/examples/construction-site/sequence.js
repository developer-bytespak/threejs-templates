/**
 * The whole sequence is a pure function of one number.
 *
 * EMPTY SITE -> SURVEY -> SETOUT -> EARTH EXCAVATION -> COMPLETE PIT.
 *
 * There is no machine in it. An excavator was tried and cut: a rigged one
 * either has to be explained (where did it come from, how did it get into a
 * hole with no ramp) or it reads as having been buried and dug up, and every
 * answer to that cost more page than the earthwork itself was getting. What
 * is left is the earthwork, which was always the subject.
 *
 * Scroll produces `progress` (0..1); every weight below is derived from it
 * with no timers, no tweens and no stored animation state. That is what makes
 * scrolling back up correct by construction rather than by effort: nothing can
 * drift out of step with the page, because nothing holds an opinion of its own
 * about where it is. A refresh halfway down, a resize, or a flung scrollbar
 * all land on exactly the frame that scroll offset describes.
 *
 * It is also why the spoil can be honest. Each heap's growth is keyed to the
 * moment the dissolve front reaches its own stretch of ground, so dragging
 * the scrollbar backwards puts the earth back in the hole in the order it
 * came out.
 */

/**
 * How much of the page belongs to everything before the columns.
 *
 * The excavation, the foundation and the pour were composed against a page
 * that ended with them, and their thresholds are all fractions of it. The
 * columns need a span of their own, and there was none left — the pour sets
 * the reader down at 98.5% of the old page.
 *
 * So the page grew by a third, from twelve sections to sixteen, and everything
 * that was already on it is mapped through `prior()` onto the first three
 * quarters. Because the track grew by exactly the same factor, EVERY EXISTING
 * BEAT KEEPS ITS SCROLL DISTANCE: a trigger that was 40vh past the one before
 * it is still 40vh past it, the dig still runs over the same three screens,
 * and the last quarter of the page is new ground rather than borrowed.
 *
 * One factor, applied once, to published numbers that stay legible where they
 * were written. The alternative — restating fifty thresholds as new decimals —
 * would have made every one of them a number nobody could check.
 */
export const PRIOR_SPAN = 0.75

/** A beat composed against the old page, placed on the new one. */
export function prior(at) {
  return at * PRIOR_SPAN
}

export function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

/** Linear 0..1 across [a, b]. */
export function span(value, a, b) {
  return clamp01((value - a) / (b - a))
}

/** Eased 0..1 across [a, b] — flat at both ends so states settle. */
export function ramp(value, a, b) {
  const t = span(value, a, b)
  return t * t * (3 - 2 * t)
}

/** Rises over [a, b], holds, falls over [c, d]. */
export function pulseWindow(value, a, b, c, d) {
  return ramp(value, a, b) * (1 - ramp(value, c, d))
}

/**
 * One item's share of a group reveal.
 *
 * Twelve stakes appearing together is a switch being thrown; twelve stakes
 * appearing one after another is someone working down a list. `overlap` is how
 * much of the window each item gets: at 1 the last item only starts as the
 * first finishes, which drags; around 3 they tile into each other and the
 * group reads as continuous activity with a direction to it.
 */
export function stagger(progress, index, count, overlap = 3) {
  if (count <= 1) return ramp(progress, 0, 1)
  const width = overlap / (count - 1 + overlap)
  const start = (index / (count - 1)) * (1 - width)
  return ramp(progress, start, start + width)
}

/**
 * The beats, and why they sit where they do.
 *
 * This is a construction timeline now, not a survey with an earthwork at the
 * end of it, and the page is divided the way the job is: a quarter to set the
 * site out and get the first cut open, and the remaining three quarters to
 * take the ground away. The old split gave the survey more than half the page
 * and the excavation a third, which was the right shape when the excavation
 * was one dissolve and the wrong one now that it is four lifts, each of which
 * has to be seen arriving.
 *
 * Setting out is therefore compressed hard. It has to be: the stakes and the
 * strings are legible in about a screen and a half each, and every extra
 * screen spent on them is a screen the earthwork does not get.
 *
 * The one hard rule is unchanged. `open` cannot begin until `setout` has
 * finished — the premise is that the ground is cut where the building was set
 * out, and cutting it while the outline is still being drawn says the
 * opposite.
 */
const BEATS = {
  arrive: [prior(0.015), prior(0.075)],
  stakes: [prior(0.055), prior(0.135)],
  setout: [prior(0.095), prior(0.200)],
  hold: [prior(0.200), prior(0.235)],
  // The earthwork as a weight: rim pegs, audio, camera energy. It now runs
  // over the span the excavation carries the page across rather than over most
  // of the page, because the excavation is no longer spread over most of the
  // page — it is one four-second event, and everything that belongs to it has
  // to happen while it is happening.
  open: [prior(0.235), prior(0.620)],
}

/**
 * The excavation is ONE event, and this is where it fires.
 *
 * It used to be five boundaries at 20% intervals of a dig window that took up
 * three quarters of the page: cross one, get one lift. That is a scrub with
 * five detents in it, and it had the failure the reader actually complained
 * about — stop scrolling between two of them and the earthwork stops too,
 * waiting to be dragged the rest of the way.
 *
 * Now there is one trigger and one span. Crossing `DIG_FROM` going down runs
 * the whole dig, and for the four seconds that takes the page is carried from
 * there to `DIG_TO` rather than scrolled (see `scrollHold.js`) — so the camera
 * still travels over the excavation as it happens, in step with it, and a
 * reader cannot get past the earthwork without seeing it.
 *
 * `DIG_TO` sits just short of the camera's 0.69 shot, so the span covers
 * exactly the three earthwork shots and hands back in time for the two that
 * look at the finished pit.
 *
 * Coming back up is where this gets its state, and it needs four values, not
 * two. Two was tried and each version broke somewhere:
 *
 *   leave at the far end only — at the instant the trigger fires the reader is
 *   still standing at the near end, which is already past it, so the latch
 *   un-sets on the next frame and the dig opens and closes in one frame
 *
 *   leave at the near end only — stable, but the way back is a stub: the
 *   reader walks the whole span by hand and the reverse gets thirty pixels
 *
 * So: the dig is ARMED once the page has actually reached the far side of it,
 * and only an armed dig is left by scrolling back up past `LEAVE_AT`, which is
 * what makes the way home symmetrical with the way out. Unarmed — which is
 * where reduced motion leaves it, having resolved the whole thing on the spot
 * without the page moving at all — it is left at `EXIT_AT`, just above where
 * it was entered. And the fourth state is the undug site sitting ABOVE the
 * trigger, which exists only so that leaving at the far end does not
 * immediately read as entering at the near one.
 *
 * Every threshold is paired with a second one three per cent of the page away,
 * so no single position can sit on a boundary and oscillate.
 *
 * `DIG_REST` is where the reverse sets the reader down: far enough below
 * `DIG_FROM` that arriving there does not read as crossing it again.
 */
export const DIG_FROM = prior(0.235)      // undug, and below: this is where it fires
export const DIG_EXIT = prior(0.205)      // dug but never armed: this is where it lets go
export const DIG_ARM = prior(0.610)       // dug and this far along: the way back opens
export const DIG_LEAVE = prior(0.580)     // armed: this is where the reverse fires
export const DIG_TO = prior(0.660)        // where the forward run sets the reader down
export const DIG_REST = prior(0.180)      // where the reverse run sets the reader down

/**
 * Which of the four latch states mean the excavation exists.
 *
 * Worth its own function rather than a `> 0` at the call site, because the
 * states are not ordered by dugness: 0 and 3 are both an untouched site — one
 * below the trigger and one above it — and reading the latch as a number cost
 * an afternoon when state 3 went to the controller as "three hundred per cent
 * excavated" and the site refused to un-dig.
 */
export function digIsOn(latch) {
  return latch === 1 || latch === 2
}

export function digWanted(progress, previous = 0) {
  switch (previous) {
    case 1:  // dug, but the page has not been across it yet
      if (progress <= DIG_EXIT) return 0
      return progress >= DIG_ARM ? 2 : 1
    case 2:  // dug, and the way back is open
      return progress <= DIG_LEAVE ? 3 : 2
    case 3:  // undug, sitting above the trigger
      if (progress < DIG_FROM) return 0
      return progress >= DIG_ARM ? 1 : 3
    default: // undug, below the trigger
      return progress >= DIG_FROM ? 1 : 0
  }
}


export function deriveStage(progress, target = {}) {
  const p = clamp01(progress)
  target.progress = p

  // Survey kit walking on. The instrument and the case stay for the rest of
  // the page — they are clear of the works — so this only ever rises.
  target.arrive = ramp(p, BEATS.arrive[0], BEATS.arrive[1])

  // The setout being established. Individual stakes and lines take their own
  // share of these through `stagger`, keyed by their position in the order a
  // surveyor would actually work in.
  target.stakes = ramp(p, BEATS.stakes[0], BEATS.stakes[1])
  target.setout = ramp(p, BEATS.setout[0], BEATS.setout[1])

  // The footprint complete and legible, before anything disturbs it.
  // Falls over the first sliver of the excavation, not the whole of it: the
  // hold is "the setout is finished and nothing has touched it", and the
  // moment the ground starts coming away that is no longer true.
  target.hold = pulseWindow(p, BEATS.hold[0], BEATS.hold[1], BEATS.open[0], BEATS.open[0] + prior(0.06))

  // The ground opening, as a weight: rim pegs, audio, camera energy.
  target.open = ramp(p, BEATS.open[0], BEATS.open[1])

  // `target.dig` is NOT set here. It is a latch, and it is the one thing on
  // this object that is not a pure function of scroll: the scene sets it, from
  // the RAW scroll offset rather than the damped one, and freezes it while the
  // excavation is running. Everything else here stays derivable.
  target.excavation = digIsOn(target.dig) ? 1 : 0

  // The setout stands on the ground being removed, so it goes when it goes.
  // The page is being carried across this span at the speed of the dig, so
  // keying it to scroll still keeps it in step with the earthwork — it is the
  // same clock, arriving by a different route.
  target.consumed = ramp(p, 0.245, 0.500)

  // Settles the scene at both ends: idle motion and lighting drama ease off
  // over the empty site and again once the excavation is finished.
  target.calm = Math.max(1 - ramp(p, 0.02, 0.10), ramp(p, 0.94, 1))

  // How much is going on, for lighting and camera energy. Peaks while the
  // machine is working.
  target.activity = Math.max(target.arrive * 0.45, target.setout * 0.7, target.open)

  return target
}

/**
 * The shape the scene keeps and every child reads.
 *
 * `stakesIn`, `linesIn`, `spoil` and `spoilIn` are not derived here: they are
 * written by the scene each frame as it places those things, and read by the
 * audio layer. Deriving them twice would be two opinions about how much of
 * the setout exists and how much earth has come out.
 */
export function createStageState() {
  return deriveStage(0, {
    smoothed: 0, stakesIn: 0, linesIn: 0, spoil: 0, spoilIn: 0,
    excavationStage: null, dig: 0, foundation: 0, pour: 0, concrete: 0,
    rise: 0, columns: 0,
  })
}

export { BEATS }

/**
 * A rise that overshoots slightly and comes back.
 *
 * Used for anything that is placed rather than grown — a stake driven into
 * the ground, a peg reset at the pit rim. A pure ease-in-out makes them look
 * like they are inflating; a small overshoot makes them look struck.
 */
export function settle(t) {
  const u = clamp01(t)
  return 1 - Math.pow(1 - u, 2.2) * Math.cos(u * 4.4) * (1 - u)
}
