import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { DISCIPLINES } from './chapters.js'
import { setFade } from './revealMaterial.js'

/**
 * The educational objects held in the branches.
 *
 * Every artifact drifts a little on its own — a slow float, a slow turn, a
 * breath of scale — so the museum is alive even when the scroll is still. All
 * of it is expressed as an offset from the transform Blender authored, so a
 * hover that ends, or a scroll that reverses, returns each object exactly
 * where the artist put it rather than somewhere near it.
 */
function KnowledgeArtifacts({ rig, stage, quality, interactive, onHoverArtifact }) {
  const local = useRef(null)

  const ensure = () => {
    if (local.current) return local.current

    const groups = DISCIPLINES.map((discipline, index) => {
      const entry = rig.artifactGroups[discipline.id]
      return entry ? { id: discipline.id, index, ...entry } : null
    }).filter(Boolean)

    const heroes = rig.heroes.map((hero) => {
      const emissives = []
      hero.object.traverse((node) => {
        if (node.isMesh && node.material.emissive) emissives.push(node.material)
      })
      return { ...hero, emissives, scale: 1 }
    })

    local.current = { groups, heroes, hovered: null }
    return local.current
  }

  const handleMove = (event) => {
    if (!interactive || !quality.hover) return
    const store = ensure()
    let node = event.object
    while (node) {
      const match = store.heroes.find((hero) => hero.object === node)
      if (match) {
        if (store.hovered !== match.node) {
          store.hovered = match.node
          onHoverArtifact(match)
        }
        return
      }
      node = node.parent
    }
    if (store.hovered !== null) {
      store.hovered = null
      onHoverArtifact(null)
    }
  }

  const handleOut = () => {
    const store = ensure()
    if (store.hovered === null) return
    store.hovered = null
    onHoverArtifact(null)
  }

  useFrame((state, delta) => {
    const store = ensure()
    const s = stage.current
    const step = Math.min(delta, 0.1)
    const time = state.clock.elapsedTime
    const focus = s.hoveredDiscipline
    const alive = quality.pointerStrength > 0 ? 1 : 0

    for (const entry of store.groups) {
      // Staggered, so the artifacts resolve out of the canopy in sequence.
      const weight = THREE.MathUtils.clamp(
        (s.artifactReveal - entry.index * 0.07) / 0.72,
        0,
        1,
      )
      const dim = focus && focus !== entry.id ? 0.4 : 1
      entry.group.visible = weight > 0.01
      setFade(entry.materials, weight * dim)
    }

    for (const hero of store.heroes) {
      const object = hero.object
      const isHovered = store.hovered === hero.node

      // Idle motion: a slow float on its own phase, a slow turn, and a breath
      // of scale. Small enough to read as life rather than as animation.
      const bob = Math.sin(time * 0.55 + hero.phase) * 0.11 * alive
      const sway = Math.cos(time * 0.37 + hero.phase) * 0.06 * alive

      hero.scale = THREE.MathUtils.damp(hero.scale, isHovered ? 1.05 : 1, 6, step)
      const breath = 1 + Math.sin(time * 0.8 + hero.phase) * 0.012 * alive
      object.scale.copy(hero.baseScale).multiplyScalar(hero.scale * breath)

      object.position.copy(hero.basePosition)
      object.position.y += bob
      object.position.x += sway
      // Hover nudges the object toward the viewer as well as growing it, which
      // reads as attention rather than as a UI state.
      if (hero.scale > 1.001) object.position.y += (hero.scale - 1) * 1.4

      object.rotation.y += step * (isHovered ? 0.5 : 0.16) * alive

      for (const material of hero.emissives) {
        material.emissiveIntensity = THREE.MathUtils.damp(
          material.emissiveIntensity ?? 1,
          isHovered ? 3.2 : 1.1,
          6,
          step,
        )
      }
    }
  })

  return (
    <primitive
      object={rig.artifacts}
      onPointerMove={handleMove}
      onPointerOut={handleOut}
    />
  )
}

export default KnowledgeArtifacts
