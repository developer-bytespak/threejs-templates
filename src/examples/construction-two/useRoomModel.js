import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import {
  BUILDING_GROUP,
  MODEL_URL,
  OUTLINE_GROUP,
  SHADOW_RECEIVERS_ONLY,
  UNSHADOWED_GROUPS,
} from './palette.js'
import { outlineMaterial, toonMaterialFor } from './toonMaterial.js'

export { MODEL_URL }

/**
 * Which group a mesh belongs to.
 *
 * v2 of the model writes `group` into each node's glTF extras, which arrive as
 * `object.userData.group` — an explicit contract set in Blender rather than
 * something inferred from a name. The "Grp_Desk_3" fallback is what v1 used
 * and is kept so the older asset still loads.
 *
 * Either way this walks up the tree rather than reading the mesh's own name: a
 * node with several materials becomes a Group whose child meshes GLTFLoader
 * names after the glTF *mesh* ("Mesh001_2"), and only the ancestor carries the
 * group information.
 */
function groupNameOf(object) {
  for (let node = object; node; node = node.parent) {
    const tagged = node.userData?.group
    if (typeof tagged === 'string' && tagged) return tagged
    const name = node.name ?? ''
    if (name.startsWith('Grp_')) return name.slice(4).replace(/(_\d+)+$/, '')
  }
  return object.name ?? ''
}

/**
 * Where a building piece sits in the assembly.
 *
 * v2 writes an explicit `order` into extras. v1 encoded it in the trailing
 * number of the node name, which meant renaming a piece silently reordered the
 * animation — the reason this is now read from userData first.
 */
function assemblyOrderOf(object) {
  for (let node = object; node; node = node.parent) {
    const tagged = node.userData?.order
    if (typeof tagged === 'number' && Number.isFinite(tagged)) return tagged
  }
  return Number(object.name.match(/_(\d+)$/)?.[1] ?? 0)
}

/**
 * A building piece's resting state, captured once and never re-read from the
 * live transform afterwards.
 *
 * Building.jsx animates these meshes every frame and useGLTF hands every caller
 * the same cached scene, so a second pass through this hook would otherwise
 * "capture" a mid-animation pose as the piece's resting place, and each pass
 * would compound the last. Everything the animation needs is frozen here:
 * position, orientation, scale, and the mesh's own local vertical bounds.
 *
 * Those local bounds matter. The thirteen pieces share ONE origin, at the
 * model's base on the desk, with each piece's height baked into its local Y —
 * so a piece's geometry is neither centred on its origin nor sitting on it.
 * Bld_13_mast's local Y runs 0.521 to 0.691. Growth maths that assumes either
 * lands the solid somewhere its wireframe is not.
 */
function restingState(mesh) {
  let rest = mesh.userData.rest
  if (!rest) {
    mesh.geometry.computeBoundingBox()
    const local = mesh.geometry.boundingBox
    rest = {
      position: mesh.position.clone(),
      quaternion: mesh.quaternion.clone(),
      scale: mesh.scale.clone(),
      localMinY: local.min.y,
      localHeight: Math.max(local.max.y - local.min.y, 1e-4),
    }
    mesh.userData.rest = rest
  }

  // Put the mesh back where it rests before anything is measured off it. Once
  // Building.jsx has wrapped it, resting *is* the identity transform: the
  // wrapper carries the rest transform and the mesh animates inside it.
  if (mesh.parent?.userData?.pieceRoot) {
    mesh.position.set(0, 0, 0)
    mesh.quaternion.identity()
    mesh.scale.set(1, 1, 1)
  } else {
    mesh.position.copy(rest.position)
    mesh.quaternion.copy(rest.quaternion)
    mesh.scale.copy(rest.scale)
  }

  return rest
}

/**
 * Loads the studio, swaps in the stylised materials, re-seats it so its
 * footprint is centred on the origin with the floor at y = 0, and measures a
 * focus point per object group.
 *
 * The re-seating deliberately ignores the skyline: those cards sit outside the
 * window, several metres past the wall, and letting them into the bounds would
 * drag the whole room off-centre.
 *
 * useGLTF caches by URL, so every caller shares one scene. Both the material
 * swap and the re-seating are idempotent, so calling this from more than one
 * component is safe.
 */
export function useRoomModel() {
  const { scene } = useGLTF(MODEL_URL)

  return useMemo(() => {
    let outline = null

    scene.traverse((object) => {
      if (!object.isMesh) return

      const group = groupNameOf(object)
      const isOutline = group === OUTLINE_GROUP

      if (object.material?.userData?.toon) {
        // Already swapped on an earlier pass; nothing to do.
      } else if (isOutline) {
        // Optional: v2 ships clean geometry with no inverted-hull shells, so
        // this only runs if a model that has them is loaded.
        outline = outline ?? outlineMaterial()
        object.material = outline
      } else {
        const replacement = toonMaterialFor(object.material?.name ?? '')
        if (replacement) object.material = replacement
      }

      const participates = !UNSHADOWED_GROUPS.has(group)
      object.castShadow = participates && !SHADOW_RECEIVERS_ONLY.has(group)
      object.receiveShadow = participates
      object.frustumCulled = true
    })

    // Freeze — or restore — every building piece before a single measurement is
    // taken, so the shell, the group bounds and the camera focus points are all
    // read off the assembled model rather than whatever frame the last mount
    // happened to stop on.
    const resting = new Map()
    scene.traverse((object) => {
      if (!object.isMesh) return
      if (groupNameOf(object) !== BUILDING_GROUP) return
      resting.set(object, restingState(object))
    })

    scene.position.set(0, 0, 0)
    scene.updateMatrixWorld(true)

    const shell = new THREE.Box3()
    scene.traverse((object) => {
      if (!object.isMesh) return
      if (UNSHADOWED_GROUPS.has(groupNameOf(object))) return
      shell.union(new THREE.Box3().setFromObject(object))
    })

    const centre = shell.getCenter(new THREE.Vector3())
    scene.position.set(-centre.x, -shell.min.y, -centre.z)
    scene.updateMatrixWorld(true)

    const groups = new Map()
    const building = []
    scene.traverse((object) => {
      if (!object.isMesh) return
      const key = groupNameOf(object)
      const box = new THREE.Box3().setFromObject(object)
      const existing = groups.get(key)
      if (existing) existing.union(box)
      else groups.set(key, box)

      if (key !== BUILDING_GROUP) return

      building.push({
        order: assemblyOrderOf(object),
        mesh: object,
        rest: resting.get(object) ?? restingState(object),
      })

      // Nothing on the desk until the scroll reaches it.
      object.visible = false
    })
    building.sort((a, b) => a.order - b.order)

    const focus = new Map()
    for (const [key, box] of groups) {
      focus.set(key, {
        centre: box.getCenter(new THREE.Vector3()),
        size: box.getSize(new THREE.Vector3()),
      })
    }

    // The room shell only — what the camera has to stay inside.
    const bounds = shell.clone().translate(scene.position)
    const size = bounds.getSize(new THREE.Vector3())

    if (import.meta.env.DEV) {
      const describe = (v) => v.toArray().map((n) => n.toFixed(2)).join(', ')
      console.info('[room] shell size:', describe(size), '| building pieces:', building.length)
      console.info('[room] assembly:', building.map((p) => `${p.order}:${p.mesh.name}`).join(' '))
      for (const [key, box] of [...groups].sort()) {
        console.info(
          `[room] ${key.padEnd(17)} centre ${describe(box.getCenter(new THREE.Vector3()))}`,
          `| size ${describe(box.getSize(new THREE.Vector3()))}`,
        )
      }
    }

    return { scene, size, bounds, focus, building }
  }, [scene])
}

useGLTF.preload(MODEL_URL)
