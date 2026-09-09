/**
 * The lighting journey, as keyframes on the master scroll progress.
 *
 * Lights are created once and interpolated between these states — nothing is
 * rebuilt per frame. The goal throughout is a dark *background* with clearly
 * readable subjects, which is not the same thing as a dark picture: the tree
 * has near-black bark, and without a real key and rim it reads as a silhouette
 * with no surface information at all.
 *
 *   hemi     ambient floor, so black materials never clip to zero detail
 *   key      the shape-defining light (neutral-warm, roughly 4500K)
 *   fill     cool, opposite the key, recovers the shadow side
 *   rim      cool desaturated back light — separates leaves from background
 *   camFill  a soft, heavily damped fill riding the camera, so whatever the
 *            camera has travelled to see is never completely unlit
 *   exposure tone-mapping exposure (ACES crushes darks, so this matters)
 */
export const LIGHT_STATES = [
  // 01 seed — almost everything off. One ember, and just enough key to find
  // the curvature of the shell.
  { at: 0.0, hemi: 0.3, key: 0.55, fill: 0.18, rim: 0.35, camFill: 0.7, exposure: 1.05, fogNear: 7, fogFar: 34 },
  { at: 0.1, hemi: 0.5, key: 1.2, fill: 0.35, rim: 0.7, camFill: 0.6, exposure: 1.1, fogNear: 9, fogFar: 44 },
  // 02–03 the tree — bring the rig up as there is more to see.
  { at: 0.22, hemi: 0.85, key: 2.1, fill: 0.65, rim: 1.3, camFill: 0.5, exposure: 1.18, fogNear: 12, fogFar: 62 },
  { at: 0.35, hemi: 0.95, key: 2.4, fill: 0.8, rim: 1.6, camFill: 0.45, exposure: 1.2, fogNear: 14, fogFar: 70 },
  // 04 the museum — the camera is out on the orbit looking into the canopy,
  // where the key alone cannot reach. The camera fill carries these shots.
  { at: 0.5, hemi: 1.0, key: 2.5, fill: 0.9, rim: 1.8, camFill: 1.15, exposure: 1.2, fogNear: 10, fogFar: 55 },
  { at: 0.6, hemi: 0.95, key: 2.4, fill: 0.85, rim: 1.7, camFill: 1.0, exposure: 1.18, fogNear: 10, fogFar: 55 },
  // 06 the approach — pull the fog in for depth, but not so far that the
  // foliage the camera is threading turns into a flat dark mass.
  { at: 0.73, hemi: 0.8, key: 2.0, fill: 0.7, rim: 1.5, camFill: 0.95, exposure: 1.15, fogNear: 7, fogFar: 42 },
  // 07 the reveal — the campus brings its own warmth; the rig opens back out.
  { at: 0.86, hemi: 0.9, key: 2.1, fill: 0.8, rim: 1.0, camFill: 0.5, exposure: 1.2, fogNear: 16, fogFar: 85 },
  // 08 closing — balanced, wide, calm.
  { at: 1.0, hemi: 0.9, key: 2.2, fill: 0.8, rim: 1.3, camFill: 0.3, exposure: 1.18, fogNear: 20, fogFar: 105 },
]

const FIELDS = ['hemi', 'key', 'fill', 'rim', 'camFill', 'exposure', 'fogNear', 'fogFar']

/** Interpolates the rig for a given progress, writing into `target`. */
export function resolveLighting(progress, target) {
  let i = 0
  while (i < LIGHT_STATES.length - 2 && progress > LIGHT_STATES[i + 1].at) i += 1
  const from = LIGHT_STATES[i]
  const to = LIGHT_STATES[i + 1]
  const span = to.at - from.at
  const t = span <= 0 ? 0 : Math.max(0, Math.min(1, (progress - from.at) / span))
  // Smoothstepped, so the rig settles at each state rather than sliding
  // linearly between them.
  const e = t * t * (3 - 2 * t)
  for (const key of FIELDS) target[key] = from[key] + (to[key] - from[key]) * e
  return target
}

export function createLightingState() {
  return resolveLighting(0, {})
}
