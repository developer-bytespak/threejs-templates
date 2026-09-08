/** Shared geometry constants, so the field, the blocks and the camera agree. */

export const SPHERE_RADIUS = 2.25
export const GLOBE_RADIUS = 2.05

export const BLOCK_COUNT = 7
export const BLOCK_SIZE = { x: 0.92, y: 0.74, z: 0.74 }
export const BLOCK_SPACING = 1.1

/**
 * The chain runs along X with staggered depth and height rather than sitting
 * in a flat row — it needs to read as a structure from a 3/4 camera.
 */
export function blockPosition(index, target) {
  const t = index - (BLOCK_COUNT - 1) / 2
  target.set(
    t * BLOCK_SPACING,
    Math.sin(index * 1.15) * 0.33,
    Math.cos(index * 0.92) * 0.6,
  )
  return target
}

/** Deterministic PRNG, so every reload composes the scene identically. */
export function makeRandom(seed) {
  let a = seed >>> 0
  return function random() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Evenly spread point i of n on a unit sphere (Fibonacci lattice). */
export function fibonacciPoint(i, n, target) {
  const y = 1 - (i / (n - 1)) * 2
  const radius = Math.sqrt(Math.max(0, 1 - y * y))
  const theta = i * 2.399963229728653
  target.set(Math.cos(theta) * radius, y, Math.sin(theta) * radius)
  return target
}
