import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createLightingState, resolveLighting } from './lightingStates.js'

const FOG_COOL = new THREE.Color('#080b10')
const FOG_WARM = new THREE.Color('#120e0c')

/** Radius the rig orbits at, well outside the canopy. */
const RIG_RADIUS = 30
/** How far the key leads the camera's azimuth, in radians. */
const KEY_LEAD = 0.85

/**
 * A studio rig for a subject the camera walks all the way around.
 *
 * The bark is nearly black, so a single fixed key leaves half the orbit as an
 * unreadable silhouette. This keeps the classic three-point relationship —
 * key, cool fill opposite, cool rim behind — but rotates the whole rig to hold
 * a fixed relationship with the camera's azimuth, heavily damped so it reads
 * as light in a room rather than as a lamp bolted to the lens. On top of that
 * sits a soft fill at the camera itself, which is what stops whatever the
 * camera has travelled to look at from going black inside the canopy, where
 * nothing else reaches.
 *
 * Intensities, fog and tone-mapping exposure interpolate between the chapter
 * states in lightingStates.js. No light is created after mount.
 */
function EducationLighting({ stage, rig }) {
  const refs = useRef({
    hemi: null,
    key: null,
    fill: null,
    rim: null,
    camFill: null,
    seedKey: null,
    seedEmber: null,
    campus: null,
    azimuth: 0,
    started: false,
    state: createLightingState(),
    camDir: new THREE.Vector3(),
  }).current

  const seedPosition = useMemo(
    () => rig.seedCentre.clone().add(new THREE.Vector3(0, 0.2, 0)),
    [rig.seedCentre],
  )
  const campusPosition = useMemo(
    () => rig.campusCentre.clone().add(new THREE.Vector3(0, 2.6, 0)),
    [rig.campusCentre],
  )

  useFrame((state, delta) => {
    const s = stage.current
    const step = Math.min(delta, 0.1)
    const L = resolveLighting(s.progress, refs.state)
    const warmth = s.warmth
    const camera = state.camera

    // --- rotate the rig to follow the camera -------------------------------
    const camAzimuth = Math.atan2(camera.position.z, camera.position.x)
    const wanted = camAzimuth + KEY_LEAD
    if (!refs.started) {
      refs.azimuth = wanted
      refs.started = true
    } else {
      // Shortest-path damping, or the rig swings the long way round whenever
      // the camera crosses the -x axis.
      let d = wanted - refs.azimuth
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      refs.azimuth += d * (1 - Math.exp(-1.1 * step))
    }

    const cos = Math.cos(refs.azimuth)
    const sin = Math.sin(refs.azimuth)
    const height = 14 + camera.position.y * 0.55

    if (refs.key) {
      refs.key.position.set(cos * RIG_RADIUS, height + 14, sin * RIG_RADIUS)
      refs.key.intensity = L.key
    }
    if (refs.fill) {
      // Opposite the key and low, so it recovers the shadow side without
      // flattening the form.
      refs.fill.position.set(-cos * RIG_RADIUS, height * 0.4, -sin * RIG_RADIUS)
      refs.fill.intensity = L.fill
    }
    if (refs.rim) {
      // Behind the subject from the camera's point of view, and high: this is
      // what puts an edge on the leaves and lifts them off the background.
      const rimAz = camAzimuth + Math.PI
      refs.rim.position.set(
        Math.cos(rimAz) * RIG_RADIUS,
        height + 18,
        Math.sin(rimAz) * RIG_RADIUS,
      )
      refs.rim.intensity = L.rim
    }

    if (refs.camFill) {
      // Sits above and behind the lens rather than on it, so it reads as
      // ambient spill rather than as a torch beam.
      camera.getWorldDirection(refs.camDir)
      refs.camFill.position.copy(camera.position)
      refs.camFill.position.addScaledVector(refs.camDir, -1.2)
      refs.camFill.position.y += 1.6
      refs.camFill.intensity = L.camFill * 9
    }

    if (refs.hemi) refs.hemi.intensity = L.hemi
    if (refs.seedEmber) refs.seedEmber.intensity = s.seedGlow * 5.5
    if (refs.seedKey) refs.seedKey.intensity = s.seedGlow * 1.6
    if (refs.campus) refs.campus.intensity = s.campusLights * 15

    // --- exposure and fog ---------------------------------------------------
    const gl = state.gl
    if (Math.abs(gl.toneMappingExposure - L.exposure) > 0.001) {
      gl.toneMappingExposure = L.exposure
    }

    const fog = state.scene.fog
    if (fog) {
      // Fog is for depth, not for hiding things: it never closes far enough to
      // swallow whatever the camera is currently framing.
      fog.color.copy(FOG_COOL).lerp(FOG_WARM, warmth)
      fog.near = L.fogNear
      fog.far = L.fogFar
    }
  })

  return (
    <>
      <fog attach="fog" args={['#080b10', 7, 34]} />

      {/* Ambient floor. Cool sky over a very dark warm ground, so the underside
          of the canopy does not read the same as the top of it. */}
      <hemisphereLight
        ref={(el) => { refs.hemi = el }}
        args={['#93aecb', '#17120c', 0.3]}
      />

      <directionalLight ref={(el) => { refs.key = el }} intensity={0} color="#ffeeda" />
      <directionalLight ref={(el) => { refs.fill = el }} intensity={0} color="#7d9ac4" />
      <directionalLight ref={(el) => { refs.rim = el }} intensity={0} color="#b8cfe8" />

      <pointLight
        ref={(el) => { refs.camFill = el }}
        intensity={0}
        distance={26}
        decay={2}
        color="#dfe8f5"
      />

      <pointLight
        ref={(el) => { refs.seedEmber = el }}
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
        ref={(el) => { refs.campus = el }}
        position={campusPosition}
        intensity={0}
        distance={30}
        decay={2}
        color="#ffc186"
      />
    </>
  )
}

export default EducationLighting
