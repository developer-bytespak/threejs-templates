import {
  CONCRETE_ROOT, CONCRETE_GROUPS, LEGACY_STREAM_GROUP, SLAB_MESH,
} from './concrete.js'
import { measureGrowth, markSweep } from './growthAxis.js'

/**
 * Turning the loaded concrete into something an animation can drive.
 *
 * There is one measurement and it is the same for every pour: HOW HIGH, and
 * from where. Concrete has no direction of travel — it has a level, and the
 * level rises. So the fill axis here is always up, and "up" is not assumed,
 * it is checked: a pour is only drivable if its local bounding box stands on
 * its own origin, because that is what makes scaling in Y raise the surface
 * instead of moving the whole casting.
 *
 * Deliberately NOT read off `growthAxis.js`'s longest-anchored-axis rule, the
 * way the rebar and the formwork are. That rule answers "which way was this
 * built", which for a 25 m footing is along the run — the right answer for a
 * bar being laid and the wrong one for concrete, which does not arrive from
 * one end. Asking a different question of the same geometry also means this
 * rig is correct against the export whether the origins sit at the end of a
 * run or in the middle of it: either way the box stands on its base.
 */

export function resolveConcreteRig(site) {
  const absent = []
  const groups = new Map()

  const root = site.getObjectByName(CONCRETE_ROOT)
  if (!root) absent.push(CONCRETE_ROOT)

  function measure(child) {
    const part = measureGrowth(child)
    if (!part) return null
    // Standing on its own origin, to within a centimetre. Everything the
    // concrete build emits does; anything that does not cannot be filled from
    // the bottom and is reported rather than animated sideways.
    part.rises = Math.abs(part.low.y) < 0.01 && part.high.y - part.low.y > 0.02
    part.height = part.high.y - part.low.y
    return part
  }

  for (const name of CONCRETE_GROUPS) {
    const node = site.getObjectByName(name)
    if (!node) { absent.push(name); continue }
    const parts = []
    for (const child of node.children) {
      let hasMesh = false
      child.traverse((c) => { if (c.isMesh) hasMesh = true })
      if (!hasMesh) continue
      const part = measure(child)
      if (!part) { absent.push(`${child.name} (no geometry to measure)`); continue }
      if (!part.rises) {
        absent.push(`${child.name} (does not stand on its own origin: it cannot be filled)`)
        continue
      }
      parts.push(part)
    }
    if (!parts.length) absent.push(`${name} (nothing under it)`)
    groups.set(name, { name, node, parts })
  }

  const parts = markSweep([...groups.values()].flatMap((g) => g.parts))

  // Nothing is in the ground until an event puts it there. A rig that cannot
  // be driven fails towards an empty formwork rather than towards a finished
  // pour standing in a hole that has not been dug.
  for (const part of parts) part.object.visible = false

  // The steel the floor is poured over. Held as plain objects rather than as
  // parts: nothing animates them, the pour simply stops showing them.
  const embedded = []
  for (const name of SLAB_MESH) {
    const node = site.getObjectByName(name)
    if (node) embedded.push(node)
    else absent.push(`${name} (the slab mesh the floor embeds)`)
  }

  // The pour streams are gone. This hides any that a model built before they
  // were removed still carries, rather than leaving four pipes standing over
  // a foundation that fills itself — a stale asset should cost the scene
  // nothing, not add a hose to it.
  let legacy = 0
  const stale = site.getObjectByName(LEGACY_STREAM_GROUP)
  if (stale) {
    stale.visible = false
    stale.traverse((c) => { c.visible = false; legacy += c.isMesh ? 1 : 0 })
  }

  if (absent.length) {
    console.error(
      '[construction] the concrete model is missing parts the stage table ' +
        'drives:\n  ' + absent.join('\n  ') +
        '\nCheck the exported node names against concrete.js. Anything listed ' +
        'here stays exactly as exported; nothing else is affected.',
    )
  }

  return { root, groups, parts, embedded, legacy, absent }
}
