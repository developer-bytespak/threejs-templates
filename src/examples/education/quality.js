/**
 * Everything that scales with the device.
 *
 * The three GLBs total 2.25 MB with no textures, so geometry is not the
 * constraint here — resolution, the mote count, shadows and how far the
 * camera is allowed to travel laterally are what decide frame rate and
 * whether the composition still reads on a narrow screen.
 */
export function resolveQuality(width, coarsePointer) {
  if (width < 720) {
    return {
      tier: 'compact',
      maxDpr: 1.5,
      motes: 260,
      shadows: false,
      hover: false,
      pointerStrength: 0.35,
      // Phones get a shallower path: big lateral moves on a narrow frame read
      // as the world sliding sideways rather than as the camera travelling.
      pathScale: 0.62,
      // And a wider lens, so the tree still fits the tall thin viewport.
      fovBoost: 8,
      labels: 3,
    }
  }
  if (width < 1200) {
    return {
      tier: 'medium',
      maxDpr: 1.75,
      motes: 480,
      shadows: false,
      hover: !coarsePointer,
      pointerStrength: 0.7,
      pathScale: 0.85,
      fovBoost: 3,
      labels: 4,
    }
  }
  return {
    tier: 'full',
    maxDpr: 2,
    motes: 720,
    shadows: false,
    hover: !coarsePointer,
    pointerStrength: 1,
    pathScale: 1,
    fovBoost: 0,
    labels: 5,
  }
}

/**
 * How far the subject may sit from centre frame, as a fraction of the
 * half-frame. Magnitudes only — each camera keyframe supplies the signed
 * direction, so the tree swings away from whichever side the copy occupies.
 * Narrow screens cannot afford a side-by-side split, so the horizontal range
 * collapses and the subject simply lifts above the copy instead.
 */
export function resolveComposition(width) {
  if (width >= 1180) return { x: 0.3, y: 0.26, yBase: 0 }
  if (width >= 820) return { x: 0.14, y: 0.18, yBase: 0.08 }
  return { x: 0, y: 0, yBase: 0.26 }
}

/**
 * Total scroll length of the journey.
 *
 * 1100vh is 1000vh of actual scroll on a full-height window, and that is the
 * number the eight chapters are paced against.
 *
 * There is no run-out any more. There used to be half a screen of track after
 * the story finished, so the scene could settle before the ending began — and
 * it did settle, but the cost was half a screen of scroll where the page did
 * not move at all. Four notches of a wheel, nothing happening. The ending
 * overlaps the story's tail instead, which removes the stall and is also just
 * better: you watch the page start leaving while the last of it is still
 * arriving.
 *
 * The footer is NOT in here: it is fixed behind the panel, and the handoff
 * scroll is a spacer sized from LIFT_SCROLL and LIFT_LEAD below.
 */
export const TRACK_VH = 1100

/**
 * Scroll spent on the handoff, as a multiple of how far the panel travels.
 *
 * Above 1 the panel rises more slowly than the page scrolls, which is what
 * makes it read as a surface being drawn away rather than as a div moving.
 * 1.25 puts it at four fifths of scroll speed; the footer behind it moves at
 * roughly a quarter, and that ratio between the two is the whole effect.
 */
export const LIFT_SCROLL = 1.25

/**
 * How much of the lift happens BEFORE the story ends, as a fraction of it.
 *
 * This is what makes the ending continuous. At 0 the panel waits for progress
 * to reach exactly 1 and the two motions meet at a single point — which in
 * practice reads as a stop, because the eye needs the new movement to have
 * begun before the old one finishes to believe they are one gesture. At 0.3
 * the panel is already rising through the last few per cent of the journey,
 * so nothing ever pauses; by the time the tree has finished settling it is a
 * third of the way gone.
 */
export const LIFT_LEAD = 0.3
