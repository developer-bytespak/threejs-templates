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
 * Node names in this GLB read as "Grp_Desk_3": the middle is the group, the
 * trailing index only keeps names unique. Shots aim at those groups so camera
 * targets come from real geometry instead of copied coordinates.
 *
 * This walks up the tree rather than reading the mesh's own name, because a
 * node with several materials — the figure has five — becomes a Group holding
 * child meshes that GLTFLoader names after the glTF *mesh* ("Mesh001_2"), not
 * the node. Only the ancestor still carries the "Grp_" name.
 */
function groupNameOf(object) {
  for (let node = object; node; node = node.parent) {
    const name = node.name ?? ''
    if (name.startsWith('Grp_')) return name.slice(4).replace(/(_\d+)+$/, '')
  }
  return object.name ?? ''
}

/**
 * Loads the room, swaps in the two-tone materials, re-seats it so its
 * footprint is centred on the origin with the floor at y = 0, and measures a
 * focus point per object group.
 *
 * The re-seating deliberately ignores the skyline: those cards sit outside
 * the window, several metres past the wall, and letting them into the bounds
 * would drag the whole room off-centre. Outline shells are ignored for the
 * same measurement because they duplicate geometry that is already counted.
 *
 * useGLTF caches by URL, so every caller shares one scene. Both the material
 * swap and the re-seating are idempotent, so calling this from more than one
 * component is safe.
 */
export function useRoomModel() {
  const { scene } = useGLTF(MODEL_URL)

  return useMemo(() => {
    const outline = outlineMaterial()

    scene.traverse((object) => {
      if (!object.isMesh) return

      const group = groupNameOf(object)
      const isOutline = group === OUTLINE_GROUP

      if (object.material?.userData?.toon) {
        // Already swapped on an earlier pass; nothing to do.
      } else if (isOutline) {
        object.material = outline
      } else {
        const replacement = toonMaterialFor(object.material?.name ?? '')
        if (replacement) object.material = replacement
      }

      // Outline shells would thicken every shadow they touch, and the skyline
      // sits outside the window where it would block the sun from entering.
      const participates = !UNSHADOWED_GROUPS.has(group)
      object.castShadow = participates && !SHADOW_RECEIVERS_ONLY.has(group)
      object.receiveShadow = participates
      object.frustumCulled = true
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

      // Assembly order is baked into the node name: the Blender pieces were
      // numbered bottom-up, so Grp_Building_1 is the base plate.
      const order = Number(object.name.match(/_(\d+)$/)?.[1] ?? 0)

      object.geometry.computeBoundingBox()
      const local = object.geometry.boundingBox
      const height = Math.max(local.max.y - local.min.y, 1e-4)

      building.push({
        order,
        mesh: object,
        height,
        // Where the piece's underside sits in its parent's space, so it can be
        // grown upward from there instead of out of its own centre.
        footY: object.position.y + local.min.y,
        restY: object.position.y,
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
      for (const [key, box] of [...groups].sort()) {
        console.info(
          `[room] ${key.padEnd(9)} centre ${describe(box.getCenter(new THREE.Vector3()))}`,
          `| size ${describe(box.getSize(new THREE.Vector3()))}`,
        )
      }
    }

    return { scene, size, bounds, focus, building }
  }, [scene])
}

useGLTF.preload(MODEL_URL)
