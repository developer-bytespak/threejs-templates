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
 * 1100vh paced the eight chapters, and that number is the fixed point: the 3D
 * should run at exactly the speed it was tuned at whatever else the page grows.
 *
 * The editorial chapters occupy holds inside the same track, and those holds
 * now contain their own entrance and exit rather than bleeding into the story
 * either side of them (see timeline.js) — which is what stopped the tree
 * growing behind a half-risen sheet, and which made the holds longer. They are
 * a little over half the track. 1100 / (0.625 / 1.26) ≈ 2218.
 *
 * The call to action and the footer are NOT in here: they follow the track in
 * ordinary document flow, which is why scroll progress is measured against
 * this element rather than against the document.
 */
export const TRACK_VH = 2220
