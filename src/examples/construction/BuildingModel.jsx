import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { LAYERS } from './layers.js'
import { applyHover, disposeMaterials } from './materials.js'
import { useBuildingModel } from './useBuildingModel.js'

/** Pointer influence on the model's own orientation, in radians (~3.4°). */
const POINTER_YAW = 0.06
const POINTER_PITCH = 0.022
const POINTER_DAMPING = 1.6
const HOVER_DAMPING = 7

/** Idle sway while the building is whole — under a degree, on a long period. */
const IDLE_YAW = 0.011
const IDLE_PERIOD = 0.11

/** Hover raycasts run on a timer, not per frame: the cursor is not that fast. */
const RAYCAST_INTERVAL = 0.05

/**
 * Walks up from whatever mesh the ray hit to the system it belongs to. The
 * groups carry the names, the meshes underneath them do not.
 */
function layerOf(object) {
  for (let node = object; node; node = node.parent) {
    if (LAYERS.includes(node.name)) return node.name
  }
  return null
}

/**
 * Drives every part of the building from the stage weights.
 *
 * The loop is deliberately dull: no easing, no tweens, no stored animation
 * state — just `origin + offset * weight` for each part, every frame. All the
 * character lives in how the weights themselves are shaped (see stages.js),
 * which is what lets the whole thing run backwards perfectly.
 */
function BuildingModel({ stage, input, quality, reducedMotion, onHoverChange }) {
  const rig = useBuildingModel(quality.transmission)
  const root = useRef()
  const raycaster = useThree((state) => state.raycaster)
  const camera = useThree((state) => state.camera)

  // Per-frame working values. Held in a ref and only ever read inside the
  // frame loop, so none of this can drag the component into a re-render.
  const scratch = useRef({
    yaw: 0,
    pitch: 0,
    dim: 0,
    since: 0,
    hovered: null,
    pointer: new THREE.Vector2(),
    hover: Object.fromEntries(LAYERS.map((layer) => [layer, 0])),
  })

  // The rig owns materials it created rather than materials the loader cached,
  // so it is responsible for freeing them. Geometry and the glTF scene itself
  // stay with useGLTF's cache for the next visit.
  useEffect(() => () => disposeMaterials(rig.materials), [rig])

  // Anything that was hovered when the pointer left should relax, not freeze
  // holding a highlight the cursor is no longer anywhere near.
  useEffect(() => {
    if (!quality.hover) {
      scratch.current.hovered = null
      onHoverChange(null)
    }
  }, [quality.hover, onHoverChange])

  const parts = useMemo(() => rig.parts, [rig])

  useFrame((state, delta) => {
    const step = Math.min(delta, 0.1)
    const s = stage.current
    const sc = scratch.current
    const scale = quality.explodeScale

    // --- the explosion -----------------------------------------------------
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i]
      const weight = s[part.layer] * scale
      const { origin, offset, originScale } = part

      part.object.position.set(
        origin.x + offset.x * weight,
        origin.y + offset.y * weight,
        origin.z + offset.z * weight,
      )

      if (part.shell !== 0) {
        const grow = 1 + part.shell * weight
        part.object.scale.set(
          originScale.x * grow,
          originScale.y,
          originScale.z * grow,
        )
      }
    }

    // --- orientation -------------------------------------------------------
    // The pointer nudges the whole building a couple of degrees; it never
    // takes hold of it. Scroll stays the thing that is telling the story.
    const reach = reducedMotion || !quality.pointer ? 0 : 1
    sc.yaw = THREE.MathUtils.damp(
      sc.yaw,
      input.current.pointerX * POINTER_YAW * reach,
      POINTER_DAMPING,
      step,
    )
    sc.pitch = THREE.MathUtils.damp(
      sc.pitch,
      -input.current.pointerY * POINTER_PITCH * reach,
      POINTER_DAMPING,
      step,
    )

    // Idle sway only survives while the building is whole and the page is at
    // rest — mid-explosion there is already plenty going on.
    const idle = reducedMotion ? 0 : s.calm * IDLE_YAW
    const sway = Math.sin(state.clock.elapsedTime * IDLE_PERIOD) * idle

    if (root.current) {
      root.current.rotation.y = sc.yaw + sway
      root.current.rotation.x = sc.pitch
    }

    // --- hover -------------------------------------------------------------
    sc.since += step
    if (quality.hover && sc.since >= RAYCAST_INTERVAL && root.current) {
      sc.since = 0

      let found = null
      if (input.current.pointerActive) {
        sc.pointer.set(input.current.pointerX, input.current.pointerY)
        raycaster.setFromCamera(sc.pointer, camera)
        const hits = raycaster.intersectObject(root.current, true)
        if (hits.length > 0) found = layerOf(hits[0].object)
      }

      if (found !== sc.hovered) {
        sc.hovered = found
        onHoverChange(found)
      }
    }

    // Layers are only worth picking apart once they have started to separate,
    // so the response is scaled by how open the building currently is.
    const authority = 0.35 + 0.65 * s.open
    sc.dim = THREE.MathUtils.damp(
      sc.dim,
      sc.hovered ? 1 : 0,
      HOVER_DAMPING,
      step,
    )

    for (const layer of LAYERS) {
      const want = layer === sc.hovered ? 1 : 0
      const current = THREE.MathUtils.damp(
        sc.hover[layer],
        want,
        HOVER_DAMPING,
        step,
      )
      sc.hover[layer] = current

      const materials = rig.materialsByLayer[layer]
      if (!materials) continue
      applyHover(
        materials,
        current * authority,
        // Only the systems that are *not* hovered settle back.
        sc.dim * (1 - current) * 0.9,
      )
    }
  })

  return <primitive ref={root} object={rig.scene} />
}

export default BuildingModel
