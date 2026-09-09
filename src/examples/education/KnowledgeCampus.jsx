import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { setFade } from './revealMaterial.js'

/** How each building answers the pointer. Restrained, and different per kind. */
const RESPONSE = {
  warm: { emissive: 0.9, lift: 0.05, tint: '#ffbe7a' },
  lantern: { emissive: 1.35, lift: 0.04, tint: '#ffd39a' },
  cool: { emissive: 0.6, lift: 0.05, tint: '#9ec9e8' },
  clean: { emissive: 0.68, lift: 0.04, tint: '#bfe3d0' },
  expressive: { emissive: 0.82, lift: 0.07, tint: '#cbb4ea' },
  structural: { emissive: 0.55, lift: 0.06, tint: '#cddcbc' },
  restrained: { emissive: 0.46, lift: 0.03, tint: '#e6d0aa' },
}

/**
 * The miniature campus, hidden in the canopy.
 *
 * It genuinely sits inside the tree — the GLB places it around y = 14, in
 * among the leaves — so the concealment is real geometry and the branches
 * occlude it right up until the camera comes through them. What this adds is
 * the last part of the trick: the campus stays entirely discarded until the
 * approach begins, because even at a few percent opacity it can be caught
 * through gaps in the foliage from across the scene, which gives it away.
 */
function KnowledgeCampus({ rig, stage, quality, interactive, onHoverBuilding }) {
  const local = useRef(null)

  const ensure = () => {
    if (local.current) return local.current
    const emissiveSet = new Set(rig.campusEmissive)
    local.current = {
      hovered: null,
      // Written every frame, so held here rather than reached through `rig`.
      root: rig.campusRoot,
      materials: rig.campusMaterials,
      windows: rig.campusEmissive,
      buildings: rig.buildings.map((building) => ({
        ...building,
        // Window-light materials are shared and already driven by the reveal,
        // so hover must not fight them.
        tintable: building.materials.filter(
          (material) => material.emissive && !emissiveSet.has(material),
        ),
        lift: 0,
        glow: 0,
      })),
    }
    return local.current
  }

  const handleMove = (event) => {
    if (!interactive || !quality.hover) return
    const store = ensure()
    let node = event.object
    while (node) {
      const match = store.buildings.find((building) => building.object === node)
      if (match) {
        if (store.hovered !== match.node) {
          store.hovered = match.node
          onHoverBuilding(match)
        }
        return
      }
      node = node.parent
    }
    if (store.hovered !== null) {
      store.hovered = null
      onHoverBuilding(null)
    }
  }

  const handleOut = () => {
    const store = ensure()
    if (store.hovered === null) return
    store.hovered = null
    onHoverBuilding(null)
  }

  useFrame((state, delta) => {
    const store = ensure()
    const s = stage.current
    const step = Math.min(delta, 0.1)
    const visible = s.campusVisibility

    store.root.visible = visible > 0.005
    if (!store.root.visible) return

    setFade(store.materials, visible)

    // Window light comes up before the camera is through the leaves: warm
    // pinpricks seen through foliage are the first sign anything is in there.
    for (const material of store.windows) {
      material.emissiveIntensity = s.campusLights * 2.4
    }

    for (const building of store.buildings) {
      const isHovered = store.hovered === building.node
      const response = RESPONSE[building.kind] ?? RESPONSE.warm

      building.lift = THREE.MathUtils.damp(
        building.lift, isHovered ? response.lift : 0, 7, step,
      )
      building.object.position.copy(building.basePosition)
      building.object.position.y += building.lift

      building.glow = THREE.MathUtils.damp(
        building.glow, isHovered ? response.emissive : 0, 7, step,
      )

      for (const material of building.tintable) {
        if (building.glow > 0.002) material.emissive.set(response.tint)
        material.emissiveIntensity = building.glow
      }
    }
  })

  return (
    <primitive
      object={rig.campus}
      onPointerMove={handleMove}
      onPointerOut={handleOut}
    />
  )
}

export default KnowledgeCampus
