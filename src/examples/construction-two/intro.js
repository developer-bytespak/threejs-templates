/**
 * The opening move: a slow push in, once, as the loader lifts.
 *
 * This does not touch the storyboard. The camera's position for a given scroll
 * position is computed exactly as before; this only slides that result back
 * along its own view axis and lets it return. So it is a dolly — the shot is
 * the shot, just approached — and because the offset decays to nothing, the
 * camera is in its true position by the time anyone can scroll it.
 *
 * Pulling back along the axis to the look-at point rather than moving the
 * camera in world space is what keeps it honest: the framing is identical
 * throughout, so the move cannot drift off the composition the shot was
 * built around.
 */
const PUSH = 0.42      // how far back it starts, as a fraction of the shot's distance
const MS = 2400        // and how long it takes to give that back

let startAt = 0
let running = false

export function startIntro() {
  if (running) return
  startAt = performance.now()
  running = true
}

/** Skip it — reduced motion, or a page that arrived without a loader. */
export function cancelIntro() {
  running = false
  startAt = 0
}

/**
 * The extra distance, right now, as a fraction to add to 1.
 *
 * Smootherstep, so the curve is flat at both ends: the push eases out of rest
 * as the panel starts to lift, does most of its travel while the scene is
 * being uncovered, and comes to rest rather than stopping. The first attempt
 * decayed on a quintic, which put four fifths of the movement into the first
 * third of the duration — measured, the shot had effectively arrived before
 * the panel had finished clearing the screen, and what was left read as a
 * twitch rather than as a move.
 *
 * Deliberately still ~27% out at the moment the panel is fully gone, so the
 * camera is visibly settling into the opening shot rather than already sitting
 * in it.
 */
export function introPush() {
  if (!running) return 0
  const t = (performance.now() - startAt) / MS
  if (t >= 1) { running = false; return 0 }
  const e = t * t * t * (t * (t * 6 - 15) + 10)
  return PUSH * (1 - e)
}
