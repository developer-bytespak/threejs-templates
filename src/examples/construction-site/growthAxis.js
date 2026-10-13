import * as THREE from 'three'

/**
 * Which way a component is built, read off its own geometry.
 *
 * The one measurement the foundation and the concrete both need, and the
 * reason neither of them has a table of node names in it. Every component in
 * those two models has its vertices written relative to an origin placed at
 * the point it grows FROM — the bottom of a starter bar, the end of a bar run,
 * the base of a shutter, the top of a pour stream. That leaves a signature in
 * the local bounding box: one axis with an end sitting on zero. Reading it
 * back gives the growth axis and its direction without a naming convention and
 * without the animation ever having to know what a pad is.
 *
 * It also means a rebuilt model re-measures. Move a run, split a panel, add a
 * stage: nothing on the JavaScript side changes, because nothing on the
 * JavaScript side was written down.
 *
 * Extracted from `foundationRig.js` unchanged when the concrete arrived
 * needing the same answer. Two copies of a measurement are two chances for the
 * models to disagree about which way up they are.
 */

/** How close to zero an end of the box has to be to count as the anchor. */
export const ANCHOR_EPS = 0.06

const AXES = ['x', 'y', 'z']

const box = new THREE.Box3()

/**
 * An axis is a candidate when one end of the local box sits on zero. Ties come
 * up occasionally: a mat of 42 mm bars is 84 mm thick about its own origin, so
 * its thickness axis technically has both ends within a hair of zero. The
 * longest candidate wins, which resolves every one of them correctly and would
 * go on doing so if the bars got thicker.
 */
function growthOf(b) {
  let best = null
  for (const axis of AXES) {
    const min = b.min[axis]
    const max = b.max[axis]
    const length = max - min
    if (length < 1e-4) continue
    const lowAnchored = Math.abs(min) < ANCHOR_EPS
    const highAnchored = Math.abs(max) < ANCHOR_EPS
    if (!lowAnchored && !highAnchored) continue
    // Both ends near zero happens only on a thin axis; whichever end is
    // nearer is the one the origin was actually placed on.
    const direction = Math.abs(min) <= Math.abs(max) ? 1 : -1
    if (!best || length > best.length) best = { axis, direction, length }
  }
  return best
}

/**
 * Measure one component.
 *
 * Returns null when nothing qualifies, which is a modelling error rather than
 * a runtime one: the component would have no defensible direction to grow in,
 * and a rig that says so is worth more than one that picks an axis.
 */
export function measureGrowth(object) {
  object.updateWorldMatrix(true, false)
  // Local space. These components carry their position on the node and their
  // geometry about their own origin, which is the whole point — a world-space
  // box would say nothing about where the growth starts.
  box.makeEmpty()
  object.traverse((child) => {
    if (!child.isMesh || !child.geometry) return
    if (!child.geometry.boundingBox) child.geometry.computeBoundingBox()
    box.union(child.geometry.boundingBox)
  })
  if (box.isEmpty()) return null

  const growth = growthOf(box)
  if (!growth) return null

  const centre = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())

  return {
    name: object.name,
    object,
    axis: growth.axis,
    direction: growth.direction,
    length: growth.length,
    restPosition: object.position.clone(),
    restScale: object.scale.clone(),
    // Where it is on the site, for sweep ordering. Taken from the middle of
    // the component rather than from its node, because half of these nodes
    // sit at the world origin with their geometry out at its real coordinates.
    centre: object.localToWorld(centre.clone()),
    size,
    /** The local box itself, for anything that needs a second axis. */
    low: box.min.clone(),
    high: box.max.clone(),
  }
}

/**
 * How far each part is across the site, west to east, 0..1.
 *
 * Written onto the parts rather than returned, because it is a property of the
 * set: one part on its own has no position in an order. Normalised over the
 * whole model rather than per stage, so every stage sweeps the same way at the
 * same rate.
 */
export function markSweep(parts) {
  let west = Infinity
  let east = -Infinity
  for (const part of parts) {
    west = Math.min(west, part.centre.x)
    east = Math.max(east, part.centre.x)
  }
  const span = east - west
  for (const part of parts) {
    part.sweep = span > 1e-3 ? (part.centre.x - west) / span : 0
  }
  return parts
}
