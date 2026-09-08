import * as THREE from 'three'
import {
  BLOCK_COUNT,
  BLOCK_SIZE,
  GLOBE_RADIUS,
  SPHERE_RADIUS,
  blockPosition,
  fibonacciPoint,
  makeRandom,
} from './layout.js'
import { isLand, latLonToVector } from './worldMask.js'

/**
 * Builds every position buffer the particle field will ever need, once.
 *
 * One Points object carries the whole story: the shader interpolates between
 * these four targets, so the sphere does not get swapped for a chain — the
 * same particles travel there. That is also why this is precomputed rather
 * than animated on the CPU; per-frame work stays at "upload a few uniforms".
 */
export function buildFieldData({ count, nodeCount, seed = 1337 }) {
  const random = makeRandom(seed)
  const v = new THREE.Vector3()

  const sphere = new Float32Array(count * 3)
  const scatter = new Float32Array(count * 3)
  const block = new Float32Array(count * 3)
  const globe = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  const sizes = new Float32Array(count)
  const tones = new Float32Array(count)
  const globeTones = new Float32Array(count)

  // Nodes get their own even distribution and the field's first particles are
  // placed exactly on them, so the network lines terminate on visible points
  // rather than floating near them.
  // The globe splits its particles into three groups. Each needs its own
  // index range when sampling the Fibonacci lattice: feeding it a slice of
  // the global index yields a latitude band, not an even spread.
  const landCount = Math.floor(count * 0.76)
  const oceanCount = Math.floor(count * 0.14)
  const atmosphereCount = count - landCount - oceanCount

  const nodes = new Float32Array(nodeCount * 3)
  for (let i = 0; i < nodeCount; i += 1) {
    fibonacciPoint(i, nodeCount, v).multiplyScalar(SPHERE_RADIUS)
    nodes[i * 3] = v.x
    nodes[i * 3 + 1] = v.y
    nodes[i * 3 + 2] = v.z
  }

  for (let i = 0; i < count; i += 1) {
    const o = i * 3
    const isNode = i < nodeCount

    // --- state 01: the data sphere ---------------------------------------
    if (isNode) {
      v.set(nodes[o], nodes[o + 1], nodes[o + 2])
    } else {
      fibonacciPoint(i, count, v)
      // Density variation: a low-frequency wobble pushes particles slightly
      // off the shell so the surface never reads as a perfect dotted ball.
      const banding =
        Math.sin(v.y * 5.1 + v.x * 2.3) * 0.5 + Math.sin(v.x * 3.7 - v.z * 4.1) * 0.5
      const shell = SPHERE_RADIUS * (1 + banding * 0.035 + (random() - 0.5) * 0.09)
      // A minority sit clearly inside or outside, giving the shell thickness.
      const stray = random() < 0.14 ? (random() - 0.5) * SPHERE_RADIUS * 0.42 : 0
      v.multiplyScalar(shell + stray)
    }
    sphere[o] = v.x
    sphere[o + 1] = v.y
    sphere[o + 2] = v.z

    seeds[i] = random()
    sizes[i] = isNode ? 1.9 + random() * 0.7 : 0.55 + random() * 0.85
    tones[i] = isNode ? 1 : 0.42 + random() * 0.5

    // --- state 03: controlled separation ----------------------------------
    // Particles drift outward along their own normal rather than exploding
    // from the centre, so the cloud keeps the sphere's silhouette as it opens.
    const outward = 1.15 + random() * 0.95
    scatter[o] = sphere[o] * outward + (random() - 0.5) * 1.2
    scatter[o + 1] = sphere[o + 1] * outward * 0.7 + (random() - 0.5) * 1.2
    scatter[o + 2] = sphere[o + 2] * outward + (random() - 0.5) * 1.2

    // --- state 04: the chain ----------------------------------------------
    const blockIndex = Math.min(
      BLOCK_COUNT - 1,
      Math.floor((i / count) * BLOCK_COUNT + random() * 0.4),
    )
    blockPosition(blockIndex, v)
    const role = random()
    if (role < 0.6) {
      // On a face of the shell.
      const half = { x: BLOCK_SIZE.x / 2, y: BLOCK_SIZE.y / 2, z: BLOCK_SIZE.z / 2 }
      const face = Math.floor(random() * 6)
      const a = (random() - 0.5) * 2
      const b = (random() - 0.5) * 2
      if (face === 0 || face === 1) v.set(v.x + (face === 0 ? half.x : -half.x), v.y + a * half.y, v.z + b * half.z)
      else if (face === 2 || face === 3) v.set(v.x + a * half.x, v.y + (face === 2 ? half.y : -half.y), v.z + b * half.z)
      else v.set(v.x + a * half.x, v.y + b * half.y, v.z + (face === 4 ? half.z : -half.z))
    } else if (role < 0.78) {
      // Data held inside the core.
      v.x += (random() - 0.5) * BLOCK_SIZE.x * 0.62
      v.y += (random() - 0.5) * BLOCK_SIZE.y * 0.62
      v.z += (random() - 0.5) * BLOCK_SIZE.z * 0.62
    } else {
      // Still in transit: a loose stream orbiting the chain.
      const angle = random() * Math.PI * 2
      const ring = 0.95 + random() * 1.5
      v.x += (random() - 0.5) * 2.4
      v.y += Math.sin(angle) * ring * 0.6
      v.z += Math.cos(angle) * ring
    }
    block[o] = v.x
    block[o + 1] = v.y
    block[o + 2] = v.z

    // --- state 05: the globe ----------------------------------------------
    if (i < landCount) {
      // Rejection-sample until the point lands on a continent. At ~29% land
      // coverage, fourteen tries finds one virtually always; the rare miss
      // falls through as ocean, which is harmless.
      let lat = 0
      let lon = 0
      let found = false
      for (let attempt = 0; attempt < 14 && !found; attempt += 1) {
        lat = Math.asin(random() * 2 - 1) * (180 / Math.PI)
        lon = random() * 360 - 180
        // Dither the sample so box edges do not read as straight coastlines.
        if (isLand(lat + (random() - 0.5) * 2.5, lon + (random() - 0.5) * 2.5)) found = true
      }
      latLonToVector(lat, lon, GLOBE_RADIUS * (1 + (random() - 0.5) * 0.012), v)
      globeTones[i] = found ? 0.92 + random() * 0.08 : 0.3
    } else if (i < landCount + oceanCount) {
      // A sparse lattice over the whole sphere, so the oceans still read as
      // surface rather than as empty space.
      fibonacciPoint(i - landCount, oceanCount, v).multiplyScalar(GLOBE_RADIUS)
      globeTones[i] = 0.1 + random() * 0.06
    } else {
      // Atmosphere shell, spread over the full sphere rather than a cap.
      fibonacciPoint(i - landCount - oceanCount, atmosphereCount, v).multiplyScalar(
        GLOBE_RADIUS * (1.05 + random() * 0.13),
      )
      globeTones[i] = 0.07 + random() * 0.08
    }
    globe[o] = v.x
    globe[o + 1] = v.y
    globe[o + 2] = v.z
  }

  return { sphere, scatter, block, globe, seeds, sizes, tones, globeTones, nodes }
}
