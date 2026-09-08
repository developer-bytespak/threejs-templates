/**
 * The whole experience is a pure function of one number.
 *
 * Scroll produces `progress` (0..1); every visual weight below is derived
 * from it with no timers, no tweens and no stored animation state. That is
 * what makes scrolling back up correct by construction: the scene cannot
 * drift out of sync with the page because it holds no opinion of its own
 * about where it is.
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
export function pulseWindow(value, a, b, c, d) {
  return ramp(value, a, b) * (1 - ramp(value, c, d))
}

/**
 * Where each act sits on the scroll. The morph ranges deliberately overlap
 * their neighbours: the sphere is still coming apart as the blocks begin to
 * gather, which is what stops the journey reading as six separate scenes.
 */
export const STAGE_RANGES = {
  sphere: [0.0, 0.15],
  transactions: [0.15, 0.32],
  separation: [0.32, 0.48],
  blockchain: [0.48, 0.68],
  globe: [0.68, 0.84],
  final: [0.84, 1.0],
}

/**
 * Writes the derived weights into `target` rather than returning a fresh
 * object: this runs every frame, and the loop should not allocate.
 */
export function deriveStage(progress, target = {}) {
  const p = clamp01(progress)

  // The three morph weights are applied as a chain in the particle shader
  // (sphere -> scatter -> blocks -> globe), so a later weight at 1 fully
  // overrides everything before it.
  const scatter = ramp(p, 0.32, 0.52)
  const block = ramp(p, 0.46, 0.66)
  const globe = ramp(p, 0.7, 0.88)

  target.progress = p
  target.scatter = scatter
  target.block = block
  target.globe = globe

  // Node-to-node lines are part of the hero, and last as long as the sphere
  // holds its shape.
  target.network = 1 - ramp(p, 0.33, 0.45)
  // Transaction arcs build through act two and fade as the sphere opens.
  target.transactions = pulseWindow(p, 0.12, 0.24, 0.33, 0.43)

  // The solid block shells exist only while the chain does.
  target.blockShell = pulseWindow(p, 0.5, 0.63, 0.7, 0.81)
  // Drives the validation sweep travelling along the chain.
  target.validation = ramp(p, 0.52, 0.7)

  // Globe extras, held on through the closing composition.
  target.arcs = ramp(p, 0.76, 0.9)
  target.atmosphere = ramp(p, 0.72, 0.9)
  target.final = ramp(p, 0.86, 1.0)

  // Rotation is damped down while the structure is rigid, so the chain reads
  // as architecture rather than as something tumbling in space.
  target.spinRate = 1 - ramp(p, 0.36, 0.5) * (1 - ramp(p, 0.74, 0.86))

  return target
}

/** The shape StageDriver keeps and every scene component reads. */
export function createStageState() {
  return deriveStage(0, { smoothed: 0, spinSphere: 0, spinGlobe: 0 })
}
