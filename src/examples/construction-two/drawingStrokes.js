import * as THREE from 'three'

/**
 * Turning the plot geometry into strokes a pen can draw.
 *
 * Every drawn line in the model exports as its own little flat quad — 924 of
 * them across the seven stages, 119 metres of linework in total. They arrive
 * merged into one mesh per stage, which is why the previous implementation
 * could only reveal a whole stage at a time.
 *
 * This splits each stage mesh back into its individual lines and works out,
 * for each one, which direction it runs and how long it is. That is all the
 * animation needs: to show a stroke half drawn, slide the vertices past the
 * halfway point back along the stroke's own axis until they sit on it. The
 * quad is truncated exactly at the pen, keeps the line weight the model gave
 * it, and grows continuously rather than in segments.
 *
 * Working on the real geometry rather than substitute THREE.Line objects also
 * means the finished drawing is pixel-identical to the approved model: same
 * widths, same materials, same everything.
 */

/** Union-find over the index buffer: one set per disconnected line. */
function components(index, vertexCount) {
  const parent = new Int32Array(vertexCount)
  for (let i = 0; i < vertexCount; i += 1) parent[i] = i

  const find = (x) => {
    let r = x
    while (parent[r] !== r) r = parent[r]
    while (parent[x] !== r) {
      const next = parent[x]
      parent[x] = r
      x = next
    }
    return r
  }
  const union = (a, b) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }

  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i)
    const b = index.getX(i + 1)
    const c = index.getX(i + 2)
    union(a, b)
    union(b, c)
  }

  const groups = new Map()
  for (let i = 0; i < vertexCount; i += 1) {
    const root = find(i)
    const list = groups.get(root)
    if (list) list.push(i)
    else groups.set(root, [i])
  }
  return [...groups.values()]
}

/**
 * The direction a line runs, from the spread of its own vertices.
 *
 * Power iteration on the covariance matrix — six lines instead of pulling in an
 * eigen-solver, and for a shape this simple it converges in a handful of steps.
 */
function principalAxis(points, centroid) {
  const c = new THREE.Matrix3()
  const e = c.elements
  e.fill(0)
  const d = new THREE.Vector3()
  for (const p of points) {
    d.subVectors(p, centroid)
    e[0] += d.x * d.x; e[1] += d.x * d.y; e[2] += d.x * d.z
    e[3] += d.y * d.x; e[4] += d.y * d.y; e[5] += d.y * d.z
    e[6] += d.z * d.x; e[7] += d.z * d.y; e[8] += d.z * d.z
  }

  let v = new THREE.Vector3(1, 0.37, 0.11).normalize()
  const tmp = new THREE.Vector3()
  for (let i = 0; i < 24; i += 1) {
    tmp.set(
      e[0] * v.x + e[1] * v.y + e[2] * v.z,
      e[3] * v.x + e[4] * v.y + e[5] * v.z,
      e[6] * v.x + e[7] * v.y + e[8] * v.z,
    )
    if (tmp.lengthSq() < 1e-18) break
    v = tmp.clone().normalize()
  }
  return v
}

/**
 * One stroke: the vertices that belong to it, how far along the stroke each one
 * sits, and where the pen starts and finishes.
 */
function buildStroke(indices, position, original) {
  const points = indices.map(
    (i) => new THREE.Vector3(original[i * 3], original[i * 3 + 1], original[i * 3 + 2]),
  )

  const centroid = new THREE.Vector3()
  for (const p of points) centroid.add(p)
  centroid.multiplyScalar(1 / points.length)

  const axis = principalAxis(points, centroid)

  let min = Infinity
  let max = -Infinity
  const offsets = new Float32Array(points.length)
  for (let i = 0; i < points.length; i += 1) {
    const t = points[i].dot(axis)
    offsets[i] = t
    if (t < min) min = t
    if (t > max) max = t
  }

  const length = max - min
  for (let i = 0; i < offsets.length; i += 1) offsets[i] -= min

  // Draw every stroke in a consistent direction so the pen does not wander
  // backwards through the sheet: away from the sheet's near-left corner.
  const start = centroid.clone().addScaledVector(axis, min - centroid.dot(axis))
  const end = centroid.clone().addScaledVector(axis, max - centroid.dot(axis))

  return {
    indices: Int32Array.from(indices),
    offsets,
    axis,
    length,
    start,
    end,
    // Tiny square marks — grid bubbles, column dots — have no meaningful
    // direction. They still get a slot, they just take the shortest one.
    isMark: length < 0.006,
    applied: -1,
  }
}

/**
 * Split one stage mesh into strokes. Cached on the mesh, because useGLTF hands
 * every caller the same geometry and the animation mutates it — a second
 * extraction would read half-drawn vertices as if they were the real line.
 */
export function extractStrokes(mesh) {
  if (mesh.userData.strokes) return mesh.userData.strokes

  const geometry = mesh.geometry
  const position = geometry.getAttribute('position')
  const index = geometry.getIndex()
  if (!index) return null

  const original = Float32Array.from(position.array)
  const groups = components(index, position.count)
  const strokes = groups.map((g) => buildStroke(g, position, original))

  const payload = { strokes, position, original, geometry }
  mesh.userData.strokes = payload
  return payload
}

/**
 * Show `fraction` of a stroke.
 *
 * Vertices past the pen are pulled back along the stroke's axis onto the pen's
 * position, so the quad ends exactly there. At 0 the stroke collapses onto its
 * own start point and is invisible; at 1 every vertex is back where the model
 * put it, to the float.
 */
export function drawStroke(stroke, fraction, position, original) {
  if (Math.abs(fraction - stroke.applied) < 1e-4) return false
  stroke.applied = fraction

  const cut = fraction * stroke.length
  const { indices, offsets, axis } = stroke
  const array = position.array

  for (let k = 0; k < indices.length; k += 1) {
    const i = indices[k]
    const o = i * 3
    const over = offsets[k] - cut
    if (over <= 0) {
      array[o] = original[o]
      array[o + 1] = original[o + 1]
      array[o + 2] = original[o + 2]
    } else {
      array[o] = original[o] - axis.x * over
      array[o + 1] = original[o + 1] - axis.y * over
      array[o + 2] = original[o + 2] - axis.z * over
    }
  }
  return true
}

/** Put every vertex back exactly where the model had it. */
export function restoreStrokes(payload) {
  if (!payload) return
  payload.position.array.set(payload.original)
  payload.position.needsUpdate = true
  for (const s of payload.strokes) s.applied = -1
}

/**
 * Order the strokes into a pen path.
 *
 * Not model order — that is whatever the build script happened to emit, and it
 * makes the pen jump around the sheet at random. Greedy nearest-neighbour from
 * wherever the pen already is: the plotter finishes a line, lifts, and moves to
 * the closest place it has not drawn yet, which is what a real one does and
 * what makes the sequence read as one continuous hand.
 */
export function orderStrokes(strokes, from) {
  const remaining = strokes.slice()
  const path = []
  const pen = from.clone()

  while (remaining.length) {
    let best = 0
    let bestD = Infinity
    let flip = false

    for (let i = 0; i < remaining.length; i += 1) {
      const s = remaining[i]
      const dStart = pen.distanceToSquared(s.start)
      const dEnd = pen.distanceToSquared(s.end)
      const d = Math.min(dStart, dEnd)
      if (d < bestD) {
        bestD = d
        best = i
        flip = dEnd < dStart
      }
    }

    const stroke = remaining.splice(best, 1)[0]
    // Draw it from whichever end the pen is nearer, so it never starts a line
    // by teleporting across it.
    if (flip) reverseStroke(stroke)
    path.push(stroke)
    pen.copy(stroke.end)
  }

  return path
}

function reverseStroke(stroke) {
  stroke.axis.negate()
  const { offsets, length } = stroke
  for (let i = 0; i < offsets.length; i += 1) offsets[i] = length - offsets[i]
  const start = stroke.start
  stroke.start = stroke.end
  stroke.end = start
}
