import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'

const KEY_BASE = new THREE.Vector3(-42, 58, 34)
const LIGHT_DAMPING = 1.1
/** How far the pointer may swing the key light, in metres. */
const LIGHT_REACH = 7

/**
 * Architectural lighting: one dominant key with a real shadow, a cool rim to
 * separate the structure from the background, and enough ambient fill that
 * nothing in an exploded diagram falls into unreadable black.
 *
 * The key sits opposite the camera's side of the building rather than behind
 * it. Lighting from behind the lens flattens both visible elevations to the
 * same value; from across the model, one face takes the light and the other
 * falls away, which is the whole reason a building reads as a solid.
 *
 * The reflections come from lightformers baked into a small environment map
 * rather than from a downloaded HDRI. That keeps the example self-contained —
 * it builds and runs with no network — and a few soft rectangles are closer to
 * a photographic studio than most HDRIs anyway.
 */
function ConstructionLighting({ stage, input, quality, reducedMotion }) {
  const key = useRef()
  const scratch = useRef({ x: 0, y: 0 }).current

  useFrame((state, delta) => {
    if (!key.current) return
    const step = Math.min(delta, 0.1)
    const reach = reducedMotion || !quality.pointer ? 0 : LIGHT_REACH

    // The key light follows the pointer a little. On a metallic facade this
    // reads as the highlight travelling across the elevation, which does more
    // for the sense of a real surface than any amount of extra reflectivity.
    scratch.x = THREE.MathUtils.damp(
      scratch.x,
      input.current.pointerX * reach,
      LIGHT_DAMPING,
      step,
    )
    scratch.y = THREE.MathUtils.damp(
      scratch.y,
      input.current.pointerY * reach * 0.6,
      LIGHT_DAMPING,
      step,
    )

    key.current.position.set(
      KEY_BASE.x + scratch.x,
      KEY_BASE.y + scratch.y,
      KEY_BASE.z - scratch.x * 0.4,
    )

    // Lift the key as the building opens, so light reaches down between the
    // separated layers instead of only skimming the top of the stack.
    key.current.target.position.y = 14 + stage.current.open * 18
    key.current.target.updateMatrixWorld()
  })

  return (
    <>
      {/* Sky/ground bounce. Cool from above, near-black from the floor, which
          is what keeps the concrete from going flat and grey. */}
      <hemisphereLight args={['#8c95a6', '#08090c', 0.4]} />

      <directionalLight
        ref={key}
        position={KEY_BASE}
        intensity={2.05}
        color="#fff1dc"
        castShadow={quality.shadows}
        shadow-mapSize-width={quality.shadowMap}
        shadow-mapSize-height={quality.shadowMap}
        // The frustum has to hold the exploded composition, which is roughly
        // twice the height of the assembled building.
        shadow-camera-left={-64}
        shadow-camera-right={64}
        shadow-camera-top={64}
        shadow-camera-bottom={-64}
        shadow-camera-near={1}
        shadow-camera-far={260}
        shadow-bias={-0.0004}
        shadow-normalBias={0.05}
      >
        <object3D attach="target" position={[0, 14, 0]} />
      </directionalLight>

      {/* Cool rim from behind and opposite the key, catching the column and
          beam edges and keeping the shadow side off pure black. */}
      <directionalLight
        position={[54, 24, -44]}
        intensity={1.05}
        color="#9dbcff"
      />

      {/* Low front fill, just enough to keep the shadow side readable. */}
      <directionalLight
        position={[16, 10, 58]}
        intensity={0.4}
        color="#4a5a72"
      />

      <Environment resolution={quality.environment} frames={1}>
        {/* A soft overhead box and two side strips — a studio, in three
            rectangles. These are what the facade and glazing actually
            reflect. */}
        <Lightformer
          form="rect"
          intensity={2.4}
          color="#ffffff"
          position={[0, 60, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[70, 70, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.5}
          color="#cddcff"
          position={[-60, 24, 10]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[60, 50, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.9}
          color="#ffd9b0"
          position={[55, 18, 30]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[45, 40, 1]}
        />
      </Environment>
    </>
  )
}

export default ConstructionLighting
