/**
 * The whole experience is a pure function of one number.
 *
 * Scroll produces `progress` (0..1) and every weight below is derived from it
 * with no timers, no tweens and no stored animation state. That is what makes
 * scrolling back up correct by construction: nothing can drift out of sync
 * with the page because nothing holds an opinion of its own about where it is.
 *
 * It also means a refresh halfway down, a resize, or a flung scrollbar all
 * land on exactly the frame that scroll offset describes.
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
 * When each system leaves the building and when it comes back.
 *
 * The outward ranges overlap their neighbours so the envelope peels away as
 * one continuous gesture rather than eight separate moves. The return ranges
 * deliberately do not mirror them: reassembly runs in reverse structural
 * order — columns settle, then beams, slabs, walls, glazing, facade and
 * finally the roof closes — which reads as a building being put together
 * rather than a video played backwards.
 *
 * Every system's return ends by 0.968, so the last stretch of the page holds a
 * genuinely finished building. Because the weight reaches exactly 0 there, the
 * parts land on their original transforms exactly, not approximately.
 */
export const SYSTEM_RANGES = {
  rooftop: [0.12, 0.24, 0.912, 0.968],
  facade: [0.2, 0.34, 0.89, 0.95],
  windows: [0.27, 0.4, 0.868, 0.93],
  walls: [0.34, 0.48, 0.845, 0.91],
  slabs: [0.42, 0.63, 0.82, 0.89],
  beams: [0.48, 0.68, 0.805, 0.87],
  columns: [0.52, 0.7, 0.79, 0.855],
}

const SYSTEM_NAMES = Object.keys(SYSTEM_RANGES)

/**
 * Writes the derived weights into `target` rather than returning a fresh
 * object: this runs every frame, and the loop should not allocate.
 */
export function deriveStage(progress, target = {}) {
  const p = clamp01(progress)
  target.progress = p

  // Per-system explosion, 0 = seated in the building, 1 = fully separated.
  let open = 0
  for (const name of SYSTEM_NAMES) {
    const [a, b, c, d] = SYSTEM_RANGES[name]
    const weight = pulseWindow(p, a, b, c, d)
    target[name] = weight
    if (weight > open) open = weight
  }

  // The foundation is the one system that never moves — it is what the rest
  // of the building explodes away from, and what keeps the composition
  // anchored to the ground plane.
  target.foundation = 0

  // How exploded the building is overall. Drives hover strength (layers are
  // only worth inspecting once they have separated) and the camera's pull-back.
  target.open = open

  // Structural emphasis: the skeleton picks up a cool rim while it stands
  // alone, then releases as the envelope returns around it.
  target.structure = ramp(p, 0.46, 0.62) * (1 - ramp(p, 0.8, 0.9))

  // The held inspection frame, where the camera does the moving.
  target.inspect = pulseWindow(p, 0.68, 0.76, 0.84, 0.9)

  // Settles the scene at both ends of the page: idle motion and lighting
  // drama ease off once the building is whole.
  target.calm = Math.max(1 - ramp(p, 0.02, 0.1), ramp(p, 0.9, 1))

  return target
}

/** The shape the scene keeps and every child reads. */
export function createStageState() {
  return deriveStage(0, { smoothed: 0, idle: 0 })
}
