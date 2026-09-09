/**
 * One number drives the entire experience.
 *
 * Scroll produces `progress` (0..1) and every visual weight below is derived
 * from it — no timelines, no one-shot tweens, no stored animation state. That
 * is what makes scrolling backwards correct by construction: the scene holds
 * no opinion of its own about where it is, so it cannot fall out of step with
 * the page, however fast the user throws the scrollbar around.
 */

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
export function windowed(value, a, b, c, d) {
  return ramp(value, a, b) * (1 - ramp(value, c, d))
}

/**
 * Writes derived weights into `target` rather than returning a new object:
 * this runs every frame and the loop should not allocate.
 */
export function deriveStage(progress, target = {}) {
  const p = clamp01(progress)
  target.progress = p

  // --- the tree assembling itself -----------------------------------------
  // Growth ranges overlap their neighbours so the tree never finishes one
  // part before starting the next — that overlap is what makes it read as
  // growth rather than as a sequence of parts switching on.
  target.seedOpen = ramp(p, 0.015, 0.075)
  target.rootGrowth = ramp(p, 0.05, 0.15)
  target.trunkGrowth = ramp(p, 0.1, 0.21)
  target.branchGrowth = ramp(p, 0.19, 0.33)
  target.leafReveal = ramp(p, 0.19, 0.31)
  target.veinFlow = ramp(p, 0.08, 0.3)

  // --- the artifacts ------------------------------------------------------
  target.artifactReveal = ramp(p, 0.2, 0.3)
  target.museumProgress = span(p, 0.39, 0.58)
  // Deep in the canopy there is nothing to light the artifacts by, so the
  // museum carries its own travelling fill.
  target.museumFill = windowed(p, 0.34, 0.42, 0.6, 0.68)
  // How close a leaf may get to the lens before it dissolves. Kept deliberately
  // short: this exists to stop foliage smearing across the lens as the camera
  // threads the canopy, not to clear a path. Opening it wide enough to see
  // through the canopy just trades leaves for dither speckle.
  target.leafNear =
    1.7 * windowed(p, 0.34, 0.42, 0.6, 0.67) + 1.7 * windowed(p, 0.66, 0.72, 0.86, 0.92)

  // --- the campus ---------------------------------------------------------
  // Kept fully invisible until the approach begins. The campus geometry sits
  // physically inside the canopy, so anything above zero here can be glimpsed
  // through gaps in the leaves from a long way off.
  // A short dissolve, not a long one. The campus still cannot be seen before
  // the approach, but the reveal itself is carried by the camera coming
  // through the foliage and the windows coming on — a slow opacity ramp just
  // leaves dither speckle across the architecture for the whole chapter.
  target.campusVisibility = ramp(p, 0.655, 0.688)
  target.campusReveal = ramp(p, 0.73, 0.86)
  target.campusLights = ramp(p, 0.665, 0.8)
  // Once the camera is through, the leaves have done their job. Thinning them
  // is the difference between arriving somewhere and peering through a hedge.
  target.canopyClear = ramp(p, 0.74, 0.85)

  // --- atmosphere and light ------------------------------------------------
  // Cool and dark through the canopy, warming as the clearing opens.
  target.warmth = ramp(p, 0.7, 0.88)
  target.canopyDepth = windowed(p, 0.22, 0.34, 0.74, 0.86)
  target.seedGlow = 1 - ramp(p, 0.06, 0.16)
  target.motes = windowed(p, 0.0, 0.04, 0.9, 1.0)
  // The GLB scatters small mote meshes through the scene, and several sit
  // within a metre of the opening camera — close enough to fill the frame.
  // They belong to the canopy, so they only come up once the tree does.
  target.treeMotes = windowed(p, 0.13, 0.22, 0.88, 1.0)

  // --- editorial ----------------------------------------------------------
  target.connection = ramp(p, 0.56, 0.68)
  target.finalProgress = ramp(p, 0.9, 1.0)

  // Discipline hover is only offered while the branches are the subject.
  target.disciplinesLive = windowed(p, 0.24, 0.3, 0.56, 0.62)
  target.campusLive = ramp(p, 0.8, 0.86)

  return target
}

export function createStageState() {
  return deriveStage(0, {
    smoothed: 0,
    pointerX: 0,
    pointerY: 0,
    hoveredDiscipline: null,
    hoveredBuilding: null,
  })
}
