import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { DISCIPLINES } from './chapters.js'

/**
 * Labels pinned to places in the world rather than to the page.
 *
 * They are deliberately hard to keep on screen all at once, and that is the
 * point: each one fades on its own distance to the camera and disappears the
 * moment its anchor leaves the frame, so what you read is whatever the camera
 * is actually near. Opacity is written straight to the DOM node in the frame
 * loop — routing it through React state would re-render the scene sixty times
 * a second to move some text a few pixels.
 */
function WorldLabels({ rig, stage, quality }) {
  const refs = useRef({}).current
  const scratch = useMemo(() => new THREE.Vector3(), [])

  const anchors = useMemo(() => {
    const list = []
    for (const discipline of DISCIPLINES) {
      const branch = rig.branches[discipline.id]
      if (!branch) continue
      list.push({
        id: discipline.id,
        number: discipline.number,
        name: discipline.name,
        accent: discipline.accent,
        anchor: branch.anchor,
      })
    }
    return list.slice(0, quality.labels)
  }, [rig.branches, quality.labels])

  useFrame((state) => {
    const s = stage.current
    const camera = state.camera
    const live = s.disciplinesLive

    for (const item of anchors) {
      const node = refs[item.id]
      if (!node) continue

      scratch.copy(item.anchor)
      const distance = scratch.distanceTo(camera.position)
      scratch.project(camera)

      const onScreen =
        scratch.z < 1 && Math.abs(scratch.x) < 0.92 && Math.abs(scratch.y) < 0.88

      // Near enough to be about this branch, far enough that the label is not
      // sitting on top of the geometry it names.
      const byDistance =
        THREE.MathUtils.smoothstep(distance, 34, 22) *
        (1 - THREE.MathUtils.smoothstep(distance, 5, 2.5))

      const focused = s.hoveredDiscipline === item.id
      const dimmed = s.hoveredDiscipline && !focused ? 0.28 : 1

      const opacity = onScreen ? live * byDistance * dimmed : 0
      node.style.opacity = opacity.toFixed(3)
      node.style.transform = `translateY(${(1 - opacity) * 6}px)`
      node.style.setProperty('--accent', item.accent)
    }
  })

  return (
    <>
      {anchors.map((item) => (
        <Html
          key={item.id}
          position={item.anchor}
          center
          zIndexRange={[12, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div
            className="edu-pin"
            ref={(el) => {
              refs[item.id] = el
            }}
          >
            <span className="edu-pin__num">{item.number}</span>
            <span className="edu-pin__name">{item.name}</span>
          </div>
        </Html>
      ))}
    </>
  )
}

export default WorldLabels
