import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const COOL = new THREE.Color('#7d9dc4')
const WARM = new THREE.Color('#ffb672')
const FOG_COOL = new THREE.Color('#06080b')
const FOG_WARM = new THREE.Color('#100c0c')

/**
 * The lighting journey.
 *
 * The scene starts almost unlit — one warm ember inside the seed and barely
 * enough ambient to find the silhouette — and opens out as the tree grows.
 * Through the canopy it stays cool and deep; as the clearing opens it turns
 * over to warm architectural light. Fog does most of the depth work: pulling
 * it in tight during the canopy chapters is what hides the campus without
 * hiding it, and pushing it back at the reveal is most of the payoff.
 */
function EducationLighting({ stage, rig }) {
  const refs = useRef({
    key: null,
    fill: null,
    ambient: null,
    seedLight: null,
    campusLight: null,
    colour: new THREE.Color(),
  }).current

  const seedPosition = useMemo(
    () => rig.seedCentre.clone().add(new THREE.Vector3(0, 0.25, 0)),
    [rig.seedCentre],
  )
  const campusPosition = useMemo(
    () => rig.campusCentre.clone().add(new THREE.Vector3(0, 2.4, 0)),
    [rig.campusCentre],
  )

  useFrame((state) => {
    const s = stage.current
    const warmth = s.warmth
    const opened = s.trunkGrowth

    if (refs.ambient) {
      // Ambient stays part-cool even at full warmth. Turning every light over
      // to the same amber flattens the campus into one beige mass; keeping the
      // fill cool is what leaves the warm window light somewhere to read
      // against.
      refs.ambient.intensity = 0.06 + opened * 0.55 + warmth * 0.3
      refs.ambient.color.copy(COOL).lerp(WARM, warmth * 0.45)
    }

    if (refs.key) {
      // Held back at full warmth on purpose. The bark is nearly black, and a
      // strong amber key turns the whole tree to milk chocolate — the warmth
      // of the reveal should come from the campus windows, not from repainting
      // everything around them.
      refs.key.intensity = 0.25 + opened * 2.4 + warmth * 0.5
      refs.key.color.copy(COOL).lerp(WARM, warmth * 0.55)
    }

    if (refs.fill) {
      refs.fill.intensity = 0.15 + opened * 1.1
    }

    if (refs.seedLight) {
      // The ember fades out once the tree can carry the frame on its own.
      refs.seedLight.intensity = s.seedGlow * 5.5
    }

    if (refs.seedKey) {
      // The ember sits inside the shell, so on its own it lights nothing you
      // can see. This is the one dim key that finds the outside of the seed,
      // and it leaves as soon as the tree can carry the frame.
      refs.seedKey.intensity = s.seedGlow * 2.1
    }

    if (refs.campusLight) {
      refs.campusLight.intensity = s.campusLights * 9
    }

    if (refs.museumLight) {
      // Rides with the camera: inside the canopy there is no sky and no bounce,
      // so whatever the camera has come to look at has to bring its own light.
      refs.museumLight.position.copy(state.camera.position)
      refs.museumLight.intensity = s.museumFill * 16
    }

    const fog = state.scene.fog
    if (fog) {
      // Tight and cold in the canopy, wide and warm once through it. The near
      // plane closing to within a few metres is what makes the approach feel
      // like pushing through something.
      const depth = s.canopyDepth
      fog.color.copy(FOG_COOL).lerp(FOG_WARM, warmth)
      fog.near = THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(2.5, 1.0, depth),
        14,
        warmth,
      )
      fog.far = THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(26, 15, depth),
        95,
        warmth,
      )
    }
  })

  return (
    <>
      <fog attach="fog" args={['#06080b', 3, 26]} />
      <ambientLight ref={(el) => { refs.ambient = el }} intensity={0.06} />
      <hemisphereLight args={['#5f7ea8', '#0f0b06', 0.6]} />

      <directionalLight
        ref={(el) => { refs.key = el }}
        position={[9, 22, 12]}
        intensity={0.25}
      />
      <directionalLight
        ref={(el) => { refs.fill = el }}
        position={[-12, 8, -10]}
        intensity={0.15}
        color="#5f7ea8"
      />

      <pointLight
        ref={(el) => { refs.seedLight = el }}
        position={seedPosition}
        intensity={0}
        distance={9}
        decay={2}
        color="#ff9f47"
      />
      <directionalLight
        ref={(el) => { refs.seedKey = el }}
        position={[3.4, 3.2, 6.4]}
        intensity={0}
        color="#ffe0bd"
      />
      <pointLight
        ref={(el) => { refs.museumLight = el }}
        intensity={0}
        distance={16}
        decay={2}
        color="#ffe4c4"
      />
      <pointLight
        ref={(el) => { refs.campusLight = el }}
        position={campusPosition}
        intensity={0}
        distance={26}
        decay={2}
        color="#ffc186"
      />
    </>
  )
}

export default EducationLighting
