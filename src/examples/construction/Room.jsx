import { useMemo } from 'react'
import * as THREE from 'three'
import { useRoomModel } from './useRoomModel.js'
import { SUN_DIRECTION } from './palette.js'

const SUN_DISTANCE = 14

/**
 * The room plus the one light that matters.
 *
 * The toon shader works out its own flat colours from fixed directions, so
 * this light is not here to brighten anything — the sun exists purely to
 * render a shadow map. Everything the shader reads through getShadowMask()
 * comes from it, and that is what carves the wedge of window light across the
 * back wall.
 *
 * The shell is enclosed, ceiling included, so the only way sunlight reaches
 * the interior is through the window opening. That is the whole effect, and
 * it is why the light direction here has to stay in step with SUN_DIRECTION
 * in palette.js — the shader and the shadow map have to agree.
 */
function Room() {
  const { scene, size } = useRoomModel()

  // The light's target has to live in the scene graph for its world matrix to
  // update, so it is a real object rather than a bare vector.
  const target = useMemo(() => new THREE.Object3D(), [])

  const { position, reach, height } = useMemo(() => {
    const h = size.y * 0.5
    const direction = new THREE.Vector3(...SUN_DIRECTION).normalize()
    return {
      height: h,
      reach: Math.max(size.x, size.z) * 0.5 + 1.5,
      position: direction.multiplyScalar(SUN_DISTANCE).add(new THREE.Vector3(0, h, 0)),
    }
  }, [size])

  return (
    <>
      <primitive object={scene} />
      <primitive object={target} position={[0, height, 0]} />

      <directionalLight
        position={[position.x, position.y, position.z]}
        target={target}
        intensity={1}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-near={1}
        shadow-camera-far={SUN_DISTANCE * 2.5}
        shadow-camera-left={-reach}
        shadow-camera-right={reach}
        shadow-camera-top={reach}
        shadow-camera-bottom={-reach}
        // The toon step turns any shadow-map noise into hard speckles, so
        // these are biased harder than a PBR scene would need.
        shadow-bias={-0.0009}
        shadow-normalBias={0.075}
      />
    </>
  )
}

export default Room
