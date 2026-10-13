import { COLUMNS_ROOT, COLUMN_GROUPS } from './columns.js'
import { measureGrowth, markSweep } from './growthAxis.js'

/**
 * Turning the loaded frame into something an animation can drive.
 *
 * One measurement, and it is the same for every column: HOW TALL, and from
 * where. A column has no direction of travel along the ground — it has a head,
 * and the head goes up. So the growth axis here is always vertical, and
 * "vertical" is not assumed, it is checked: a column is only drivable if its
 * local bounding box stands on its own origin, because that is what makes
 * scaling it raise the head instead of moving the whole casting.
 *
 * Deliberately NOT read off `growthAxis.js`'s longest-anchored-axis rule the
 * way the rebar and the formwork are. That rule answers "which way was this
 * built", which is right for a 25 m bar run being laid along its length and
 * would be right here too — a 3.6 m column is anchored only in its vertical
 * axis, so the general rule and this one agree. Asking the narrower question
 * anyway is what makes the disagreement impossible rather than unlikely: if a
 * future export ever centres a column on its own middle, this rig says so on
 * the console instead of quietly growing the building sideways.
 *
 * `measureGrowth` is still used, because the rest state, the local box and
 * the world centre are exactly what it returns and there is no reason to
 * measure them twice.
 */

export function resolveColumnRig(site) {
  const absent = []
  const groups = new Map()

  const root = site.getObjectByName(COLUMNS_ROOT)
  if (!root) absent.push(COLUMNS_ROOT)

  for (const name of COLUMN_GROUPS) {
    const node = site.getObjectByName(name)
    if (!node) { absent.push(name); continue }
    const parts = []
    for (const child of node.children) {
      let hasMesh = false
      child.traverse((c) => { if (c.isMesh) hasMesh = true })
      if (!hasMesh) continue

      const part = measureGrowth(child)
      if (!part) { absent.push(`${child.name} (no geometry to measure)`); continue }

      // Standing on its own base, to within a centimetre, and tall enough to
      // be a storey rather than a plate. Everything the column build emits is.
      part.height = part.high.y - part.low.y
      part.rises = Math.abs(part.low.y) < 0.01 && part.height > 0.5
      if (!part.rises) {
        absent.push(
          `${child.name} (does not stand on its own base: it would grow from its middle)`,
        )
        continue
      }
      // The foot, in world space. Nothing animates it — it is recorded so the
      // validation pass can assert it never moves, which is the one promise
      // this whole phase makes.
      part.foot = part.object.localToWorld(part.low.clone())
      part.level = name
      parts.push(part)
    }
    if (!parts.length) absent.push(`${name} (nothing under it)`)
    // West to east within the level, then south to north. The pour order.
    parts.sort((a, b) => (a.centre.x - b.centre.x) || (a.centre.z - b.centre.z))
    groups.set(name, { name, node, parts })
  }

  const parts = markSweep([...groups.values()].flatMap((g) => g.parts))

  // Nothing is standing until an event puts it there. A rig that cannot be
  // driven fails towards a bare foundation rather than towards a finished
  // building sitting on a hole that has not been dug.
  for (const part of parts) part.object.visible = false

  if (absent.length) {
    console.error(
      '[construction] the column model is missing parts the level table ' +
        'drives:\n  ' + absent.join('\n  ') +
        '\nCheck the exported node names against columns.js. Anything listed ' +
        'here stays exactly as exported; nothing else is affected.',
    )
  }

  return { root, groups, parts, absent }
}
