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
 * Total scroll length of the journey, and the run-out at the end of it.
 *
 * 1000vh of scroll paces the eight chapters, and that is the number the whole
 * thing is tuned against. RUNOUT is extra track BEYOND the end of the story:
 * scroll that exists purely so progress can reach 1 — and the scene can settle
 * on it — while the footer is still below the fold.
 *
 * Without it, progress hit 1 at exactly the scroll position where the footer's
 * top edge touched the bottom of the viewport. That is fine for the number and
 * wrong for the picture, because the scene damps its own progress before the
 * camera reads it: the value said "finished" while the tree was visibly still
 * a few tenths behind, and the footer then slid over a growth that had not
 * happened yet. The faster you scrolled, the further behind it was.
 *
 * So the track is the story plus the run-out, and the reader measures progress
 * against the story part alone.
 *
 * The footer is NOT in here: it follows the track in ordinary document flow,
 * which is why scroll progress is measured against this element rather than
 * against the document.
 */
export const TRACK_VH = 1160

/** Viewport heights of settle between the story ending and the footer arriving. */
export const RUNOUT_VH = 0.6
