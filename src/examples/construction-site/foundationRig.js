import { FOUNDATION_ROOT, FOUNDATION_GROUPS } from './foundation.js'
import { measureGrowth, markSweep } from './growthAxis.js'

/**
 * Turning the loaded foundation into something an animation can drive.
 *
 * The animation needs one thing from every component and it is not a
 * keyframe: it needs to know WHICH WAY that component is built. A starter bar
 * rises out of the blinding, a main bar runs out along the trench, a shutter
 * goes up off the floor — three different directions, sixty-five components,
 * and not one of them should be listed by hand in JavaScript.
 *
 * So it is measured rather than written down, by `growthAxis.js` — which the
 * concrete now uses for the same purpose and by the same rule. Everything
 * else a frame loop could want is taken once, here, for the same reason the
 * excavation's rig does it: `setFromObject` on a five-thousand triangle cage
 * is not a thing to do sixty times a second, and the answer never changes.
 */

export function resolveFoundationRig(site) {
  const absent = []
  const groups = new Map()

  const root = site.getObjectByName(FOUNDATION_ROOT)
  if (!root) absent.push(FOUNDATION_ROOT)

  for (const name of FOUNDATION_GROUPS) {
    const node = site.getObjectByName(name)
    if (!node) { absent.push(name); continue }
    const parts = []
    // Direct children only, exactly as the excavation resolves its chunks:
    // one component is one child of its stage empty, and going deeper would
    // find its sub-meshes and grow the same steel twice.
    for (const child of node.children) {
      let hasMesh = false
      child.traverse((c) => { if (c.isMesh) hasMesh = true })
      if (!hasMesh) continue
      const part = measureGrowth(child)
      if (part) parts.push(part)
      else absent.push(`${child.name} (no growth axis: its origin is not on the geometry)`)
    }
    if (!parts.length) absent.push(`${name} (nothing under it)`)
    groups.set(name, { name, node, parts })
  }

  const parts = markSweep([...groups.values()].flatMap((g) => g.parts))

  // Left un-built. The page starts on an untouched site, the event layer
  // settles on whatever stage the first frame asks for, and a rig that cannot
  // be driven for any reason fails towards an excavation with nothing in it
  // rather than towards sixty-five components standing in a hole that has not
  // been dug yet.
  for (const part of parts) part.object.visible = false

  if (absent.length) {
    console.error(
      '[construction] the foundation model is missing parts the stage table ' +
        'drives:\n  ' + absent.join('\n  ') +
        '\nCheck the exported node names against foundation.js. Anything ' +
        'listed here stays exactly as exported; nothing else is affected.',
    )
  }

  return { root, groups, parts, absent }
}
