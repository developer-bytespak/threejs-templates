import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createStageState, deriveStage } from './stages.js'
import BuildingModel from './BuildingModel.jsx'
import ConstructionCamera from './ConstructionCamera.jsx'
import ConstructionLighting from './ConstructionLighting.jsx'
import ConstructionGround from './ConstructionGround.jsx'

/**
 * Scene state lives here and only this component writes it. Children receive
 * it read-only, so there is a single source of truth for what the building is
 * currently doing.
 *
 * On the size of the explosion: the offsets in layers.js keep the whole
 * composition to roughly 1.8x the building's height. The separations used to
 * validate the model in Blender were several times larger, and at that scale
 * the systems stop reading as one building coming apart — they become eight
 * unrelated objects, and no camera framing recovers it. Composition beats
 * separation here, which is also why the envelope shells compress into bands
 * rather than keeping their full 28-metre height on the way up.
 */
function ConstructionScene({ input, quality, reducedMotion, onHoverChange }) {
  const stage = useRef(createStageState())

  // Priority -1 runs this before every default-priority frame callback, so the
  // rest of the scene reads values computed this frame rather than last.
  useFrame((state, delta) => {
    const step = Math.min(delta, 0.1)
    const s = stage.current

    // Damp the raw scroll. A flung scrollbar should move the building quickly
    // but never teleport it, and this is the single place that fast scrolling
    // is smoothed — everything downstream is a pure function of the result,
    // so no layer can jump ahead of another.
    s.smoothed = THREE.MathUtils.damp(
      s.smoothed,
      input.current.progress,
      reducedMotion ? 26 : 5,
      step,
    )
    deriveStage(s.smoothed, s)
  }, -1)

  return (
    <>
      <ConstructionCamera
        stage={stage}
        input={input}
        quality={quality}
        reducedMotion={reducedMotion}
      />

      {/* Restrained, and far enough out that it only touches the ground plane
          as it runs away from the building. */}
      <fog attach="fog" args={['#070809', 90, 260]} />

      <ConstructionLighting
        stage={stage}
        input={input}
        quality={quality}
        reducedMotion={reducedMotion}
      />

      <ConstructionGround quality={quality} />

      <BuildingModel
        stage={stage}
        input={input}
        quality={quality}
        reducedMotion={reducedMotion}
        onHoverChange={onHoverChange}
      />
    </>
  )
}

export default ConstructionScene
