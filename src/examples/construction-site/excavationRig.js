import * as THREE from 'three'
import {
  GROUND_BASE, SOIL_MASS, EXCAVATION_GROUPS, SPOIL_GROUPS,
} from './excavation.js'

/**
 * Turning the loaded soil mass into something an animation can drive.
 *
 * Resolved by GROUP, not by chunk. The export puts an empty over each stage's
 * chunks; this walks it and takes whatever meshes are under it. The stage
 * table therefore never has to know how many chunks a stage holds, and the
 * next model — which will have different chunks, and probably a different
 * number of them — needs no change here or in the table.
 *
 * Every measurement an animation could want is taken once, now: the rest
 * transform, the local pivot to scale about, the size, and where the body sits
 * in the world. A frame loop that calls `setFromObject` on a twenty-thousand
 * triangle body to find out where it is is a frame loop that drops frames, and
 * the answer never changes anyway.
 */

const box = new THREE.Box3()

function measureBody(object, isolateMaterials) {
  object.updateWorldMatrix(true, false)
  // Local space, because the pivot has to survive the body being moved by the
  // animation — and because these chunks carry an identity transform with
  // their geometry out at its world coordinates, so "scale it about itself" is
  // meaningless without this box.
  box.makeEmpty()
  object.traverse((child) => {
    if (!child.isMesh || !child.geometry) return
    if (!child.geometry.boundingBox) child.geometry.computeBoundingBox()
    box.union(child.geometry.boundingBox)
  })
  if (box.isEmpty()) box.set(new THREE.Vector3(), new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const centre = box.getCenter(new THREE.Vector3())
  // Each body gets its own copy of its materials. glTF hands out one instance
  // per material in the file, so every chunk shares one soil material — fading
  // one of them out would fade the walls of the finished excavation with it.
  // Cloning per body costs a few dozen materials, adds no draw calls, and
  // removes the whole class of bug.
  const materials = isolateMaterials(object)
  return {
    name: object.name,
    object,
    materials,
    // Whether each material was already transparent, so the fade can put it
    // back exactly rather than leaving every soil body in the sorted pass for
    // the rest of the page.
    opaque: materials.map((m) => m.transparent),
    restPosition: object.position.clone(),
    restScale: object.scale.clone(),
    // Collapse about the underside and the middle: the top comes down to meet
    // the bottom, and the sides draw in towards the centre.
    pivot: new THREE.Vector3(centre.x, box.min.y, centre.z),
    height: Math.max(size.y, 0.05),
    // Where the dust comes from, in world space: the top of the body, because
    // that is the surface that is about to stop existing.
    top: object.localToWorld(new THREE.Vector3(centre.x, box.max.y, centre.z)),
    radius: Math.max(size.x, size.z) * 0.5,
    footprint: Math.max(size.x * size.z, 0.01),
  }
}

export function resolveExcavationRig(site, isolateMaterials) {
  const absent = []

  function resolveGroups(names, kind) {
    const map = new Map()
    for (const name of names) {
      const node = site.getObjectByName(name)
      if (!node) { absent.push(name); continue }
      const bodies = []
      // Direct children only. A chunk is a child of its stage empty; going
      // deeper would collect a chunk's own sub-meshes as separate bodies and
      // animate one piece of soil twice, in two directions.
      for (const child of node.children) {
        let hasMesh = false
        child.traverse((c) => { if (c.isMesh) hasMesh = true })
        if (hasMesh) bodies.push(measureBody(child, isolateMaterials))
      }
      if (!bodies.length) absent.push(`${name} (nothing under it)`)
      map.set(name, { name, node, kind, bodies })
    }
    return map
  }

  const soil = resolveGroups(EXCAVATION_GROUPS, 'soil')
  const spoil = resolveGroups(SPOIL_GROUPS, 'spoil')

  const base = site.getObjectByName(GROUND_BASE)
  if (!base) absent.push(GROUND_BASE)
  // The container is not driven — it is looked up only so a missing one is
  // reported here rather than found later as a stage that does nothing.
  if (!site.getObjectByName(SOIL_MASS)) absent.push(SOIL_MASS)

  if (absent.length) {
    // Not fatal, and deliberately so. Anything this cannot find simply never
    // changes visibility: the stage table only consults groups that made it
    // into the maps, so a renamed export costs those bodies their part in the
    // sequence and leaves the rest of the site working.
    console.error(
      '[construction] the excavation model is missing groups the stage table ' +
        'drives:\n  ' + absent.join('\n  ') +
        '\nCheck the exported node names against excavation.js. Those bodies ' +
        'will stay as exported; nothing else is affected.',
    )
  }

  const bodies = [
    ...[...soil.values()].flatMap((g) => g.bodies),
    ...[...spoil.values()].flatMap((g) => g.bodies),
  ]

  return {
    soil,
    spoil,
    base,
    bodies,
    absent,
    all: [...bodies.map((b) => b.object), ...(base ? [base] : [])],
  }
}
