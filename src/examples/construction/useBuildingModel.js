import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { AXIS_EPSILON, LAYERS, LAYOUT, MODEL_URL, levelOf } from './layers.js'
import { enhanceLayer } from './materials.js'

export { MODEL_URL }

/**
 * Turns the loaded GLB into an animation rig.
 *
 * The important idea here is that nothing downstream ever sets a coordinate.
 * This measures each part's authored transform once, works out the offset that
 * part should travel when its system explodes, and hands back a flat list of
 * `{ object, origin, offset }`. The frame loop then only ever evaluates
 * `origin + offset * weight`, which has two consequences worth the setup:
 *
 *   - at weight 0 the part is back on its authored transform *exactly*, not
 *     approximately, so reassembly is lossless however the user scrolled;
 *   - a revised model with different coordinates re-measures on load instead
 *     of quietly animating to numbers that no longer mean anything.
 *
 * Parts are read by name, never by child order — glTF makes no ordering
 * guarantee and this exporter has reordered them between versions.
 */
function buildRig(scene, transmission) {
  const parts = []
  const materials = []
  const materialsByLayer = {}
  const groups = {}
  const missing = []

  for (const layer of LAYERS) {
    const group = scene.getObjectByName(layer)
    if (!group) {
      missing.push(layer)
      continue
    }
    groups[layer] = group

    const config = LAYOUT[layer] ?? {}
    // Each system is animated through the direct children of its group, so
    // every offset below lives in one consistent space.
    const children = group.children
    if (children.length === 0) continue

    const meshes = []
    group.traverse((object) => {
      if (object.isMesh) meshes.push(object)
    })
    const layerMaterials = enhanceLayer(layer, meshes, { transmission })
    materialsByLayer[layer] = layerMaterials
    materials.push(...layerMaterials)

    for (const mesh of meshes) {
      const glass = mesh.material.transparent || mesh.material.transmission > 0
      // Glazing casting a hard shadow onto the slabs behind it reads as a
      // solid panel, which defeats the point of glazing it.
      mesh.castShadow = !glass
      mesh.receiveShadow = !glass
    }

    // Measure the system from its own parts. Mid-range rather than mean, so
    // an uneven number of parts still fans symmetrically.
    let minY = Infinity
    let maxY = -Infinity
    let minLevel = Infinity
    for (const child of children) {
      minY = Math.min(minY, child.position.y)
      maxY = Math.max(maxY, child.position.y)
      const level = levelOf(child.name)
      if (level !== null) minLevel = Math.min(minLevel, level)
    }
    const centre = config.anchor === 'bottom' ? minY : (minY + maxY) / 2
    const step = config.levelStep ?? config.indexStep ?? 0

    for (const child of children) {
      const origin = child.position.clone()
      const offset = new THREE.Vector3()

      // Lift the system, then fan its own parts about `centre`. A spacing of
      // 1 leaves the system rigid; above 1 opens the slab stack out; below 1
      // draws a full-height shell into a band that reads as a single layer.
      offset.y = config.lift + (origin.y - centre) * ((config.spacing ?? 1) - 1)

      const level = levelOf(child.name)
      if (step && level !== null && minLevel !== Infinity) {
        offset.y += step * (level - minLevel)
      }

      const radius = Math.hypot(origin.x, origin.z)
      let shell = 0
      if (radius > AXIS_EPSILON) {
        // Off-axis parts — columns, facade corners and fins — can simply move
        // away from the building's vertical axis.
        if (config.radial) {
          offset.x = (origin.x / radius) * config.radial
          offset.z = (origin.z / radius) * config.radial
        }
      } else {
        // Bands and glazing strips are rings centred on that axis. Translating
        // one slides the whole ring sideways; the only way it opens outward is
        // by growing.
        shell = config.shell ?? 0
      }

      parts.push({
        object: child,
        layer,
        origin,
        originScale: child.scale.clone(),
        offset,
        shell,
      })
    }
  }

  if (missing.length > 0) {
    console.error(
      `[construction] model is missing expected systems: ${missing.join(', ')}. ` +
        'Check that the GLB still exports the group names listed in layers.js.',
    )
  }

  return { parts, materials, materialsByLayer, groups }
}

/**
 * useGLTF caches the scene by URL, so the rig is cached against that scene.
 * Without this, StrictMode's double mount — and any future second caller —
 * would clone a second set of materials over the top of the first and leak
 * the originals.
 */
const RIGS = new WeakMap()

export function useBuildingModel(transmission) {
  const { scene } = useGLTF(MODEL_URL)

  return useMemo(() => {
    const cached = RIGS.get(scene)
    if (cached && cached.transmission === transmission) return cached

    const rig = buildRig(scene, transmission)
    rig.transmission = transmission
    rig.scene = scene
    RIGS.set(scene, rig)
    return rig
  }, [scene, transmission])
}

useGLTF.preload(MODEL_URL)
