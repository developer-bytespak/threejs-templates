import * as THREE from 'three'
import { makeRandom } from './layout.js'

/**
 * Builds a set of arcs between points on a sphere, sampled once into flat
 * buffers.
 *
 * The line geometry and the travelling pulses share the same samples: the
 * pulses just index into `samples` and lerp, so animating them costs a
 * handful of array reads per frame instead of curve evaluation.
 */
export function buildArcs({ endpoints, pairs, radius, bulge = 0.32, samples = 36, seed = 7 }) {
  const random = makeRandom(seed)
  const count = pairs.length
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const p = new THREE.Vector3()

  const curveSamples = new Float32Array(count * samples * 3)
  const linePositions = new Float32Array(count * (samples - 1) * 2 * 3)
  const lineT = new Float32Array(count * (samples - 1) * 2)
  const lineCurve = new Float32Array(count * (samples - 1) * 2)
  const speeds = new Float32Array(count)

  let lineOffset = 0
  for (let c = 0; c < count; c += 1) {
    const [ia, ib] = pairs[c]
    a.set(endpoints[ia * 3], endpoints[ia * 3 + 1], endpoints[ia * 3 + 2]).normalize()
    b.set(endpoints[ib * 3], endpoints[ib * 3 + 1], endpoints[ib * 3 + 2]).normalize()

    // How far apart the endpoints are decides how high the arc lifts, so
    // short hops stay tight to the surface and long ones sweep wide.
    const angle = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1))
    const lift = bulge * (0.35 + (angle / Math.PI) * 0.9)
    speeds[c] = 0.16 + random() * 0.16

    for (let s = 0; s < samples; s += 1) {
      const t = s / (samples - 1)
      // Spherical interpolation keeps the arc on a great circle; the sine
      // term lifts it off the surface at the midpoint.
      p.copy(a).lerp(b, t)
      if (p.lengthSq() < 1e-6) p.copy(a)
      p.normalize().multiplyScalar(radius * (1 + Math.sin(Math.PI * t) * lift))

      const o = (c * samples + s) * 3
      curveSamples[o] = p.x
      curveSamples[o + 1] = p.y
      curveSamples[o + 2] = p.z

      // Every sample except the last opens a segment; every sample except
      // the first closes one.
      if (s < samples - 1) {
        linePositions[lineOffset * 3] = p.x
        linePositions[lineOffset * 3 + 1] = p.y
        linePositions[lineOffset * 3 + 2] = p.z
        lineT[lineOffset] = t
        lineCurve[lineOffset] = c
        lineOffset += 1
      }
      if (s > 0) {
        linePositions[lineOffset * 3] = p.x
        linePositions[lineOffset * 3 + 1] = p.y
        linePositions[lineOffset * 3 + 2] = p.z
        lineT[lineOffset] = t
        lineCurve[lineOffset] = c
        lineOffset += 1
      }
    }
  }

  return { curveSamples, linePositions, lineT, lineCurve, speeds, count, samples }
}

/** Picks node pairs that are far enough apart to read as long-haul routes. */
export function pickPairs({ positions, nodeCount, wanted, minAngle = 0.9, seed = 11 }) {
  const random = makeRandom(seed)
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const pairs = []
  const seen = new Set()

  let guard = 0
  while (pairs.length < wanted && guard < wanted * 60) {
    guard += 1
    const i = Math.floor(random() * nodeCount)
    const j = Math.floor(random() * nodeCount)
    if (i === j) continue
    const key = i < j ? `${i}:${j}` : `${j}:${i}`
    if (seen.has(key)) continue

    a.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]).normalize()
    b.set(positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]).normalize()
    if (Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)) < minAngle) continue

    seen.add(key)
    pairs.push([i, j])
  }
  return pairs
}

/**
 * Connects each node to its nearest neighbours, but only within a radius and
 * only up to a small cap — connecting everything turns the sphere into a ball
 * of wool rather than a network.
 */
export function buildNeighbourLines({ positions, nodeCount, maxDistance, perNode = 2 }) {
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const seen = new Set()
  const out = []

  for (let i = 0; i < nodeCount; i += 1) {
    a.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
    const candidates = []
    for (let j = 0; j < nodeCount; j += 1) {
      if (i === j) continue
      b.set(positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2])
      const d = a.distanceTo(b)
      if (d < maxDistance) candidates.push([d, j])
    }
    candidates.sort((x, y) => x[0] - y[0])
    for (let k = 0; k < Math.min(perNode, candidates.length); k += 1) {
      const j = candidates[k][1]
      const key = i < j ? `${i}:${j}` : `${j}:${i}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(i, j)
    }
  }

  const linePositions = new Float32Array(out.length * 3)
  for (let n = 0; n < out.length; n += 1) {
    const idx = out[n]
    linePositions[n * 3] = positions[idx * 3]
    linePositions[n * 3 + 1] = positions[idx * 3 + 1]
    linePositions[n * 3 + 2] = positions[idx * 3 + 2]
  }
  return linePositions
}
