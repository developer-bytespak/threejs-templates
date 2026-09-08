import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const WORLD_UP = new THREE.Vector3(0, 1, 0)

const POSITION_DAMPING = 2.4
const LOOK_DAMPING = 3.0
const PARALLAX_DAMPING = 1.9

/** How far the pointer may push the camera off its rail, in world units. */
const PARALLAX_REACH = 0.34
const DRIFT_REACH = 0.045

/**
 * The rail the camera runs on, with one keyframe near the middle of each
 * scroll section so the framing has settled while that section's copy is on
 * screen.
 *
 * `shiftX` and `shiftY` are signed multipliers on the composition magnitude:
 * positive X pushes the subject right (copy on the left), negative pushes it
 * left (copy on the right), zero centres it, and positive Y lifts it clear of
 * copy sitting low in the frame.
 */
const SHOTS = [
  // 01 sphere — copy left, subject right.
  { at: 0.0, position: [0.0, 0.35, 9.2], fov: 42, shiftX: 1.0, shiftY: 0 },
  { at: 0.09, position: [0.35, 0.2, 8.7], fov: 41, shiftX: 1.0, shiftY: 0 },
  // 02 transactions — copy right, subject swings left and closer.
  { at: 0.235, position: [0.5, 0.1, 7.5], fov: 40, shiftX: -0.95, shiftY: 0 },
  // 03 decentralized — copy centred inside the opening cloud.
  { at: 0.4, position: [-2.4, 1.5, 9.6], fov: 46, shiftX: 0, shiftY: 0.05 },
  // 04 blockchain — copy low left, chain lifted above it.
  { at: 0.58, position: [4.6, 1.7, 7.4], fov: 36, shiftX: 0.16, shiftY: 0.55 },
  // 05 global — copy right, globe left.
  { at: 0.76, position: [-0.9, 0.9, 8.4], fov: 40, shiftX: -0.95, shiftY: 0 },
  // 06 final — globe centred and raised, copy centred beneath it.
  { at: 1.0, position: [0.0, 0.3, 11.0], fov: 38, shiftX: 0, shiftY: 0.9 },
]

/** Where the camera sits when motion is reduced: one calm, wide framing. */
const NEUTRAL = { position: [0.4, 0.5, 9.8], fov: 40 }

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * Moves the camera as part of the storytelling: closer for transactions, a
 * slow arc around the opening cloud, a three-quarter view of the chain, then
 * a pull back for the globe. Every position is derived from scroll progress
 * and then damped, so reversing the scroll retraces the same path.
 */
function CryptoCamera({ stage, input, composition, reducedMotion }) {
  const keyframes = useMemo(
    () =>
      SHOTS.map((shot) => ({
        ...shot,
        vector: new THREE.Vector3().fromArray(shot.position),
      })),
    [],
  )

  const scratch = useRef({
    position: new THREE.Vector3(),
    target: new THREE.Vector3(),
    forward: new THREE.Vector3(),
    right: new THREE.Vector3(),
    up: new THREE.Vector3(),
    smoothedLook: new THREE.Vector3(),
    neutral: new THREE.Vector3(),
    parallaxX: 0,
    parallaxY: 0,
    started: false,
  }).current

  useFrame((state, delta) => {
    const step = Math.min(delta, 0.1)
    const camera = state.camera
    const p = stage.current.progress

    // Locate the pair of keyframes we are between and ease within them, so
    // the camera settles at each framing instead of sliding through at a
    // constant rate.
    let index = 0
    while (index < keyframes.length - 2 && p > keyframes[index + 1].at) index += 1
    const from = keyframes[index]
    const to = keyframes[index + 1]
    const local = easeInOutCubic(
      THREE.MathUtils.clamp((p - from.at) / (to.at - from.at), 0, 1),
    )

    scratch.position.lerpVectors(from.vector, to.vector, local)
    let fov = THREE.MathUtils.lerp(from.fov, to.fov, local)

    // Field of view is vertical, so on a portrait viewport the frame is
    // narrower than it is tall and the subject spills out of the sides.
    // Backing off by a power of the inverse aspect fits it to the limiting
    // dimension; the exponent keeps phones from pulling back so far that the
    // scene turns into a distant speck.
    const aspect = state.viewport.aspect
    if (aspect < 1) {
      scratch.position.multiplyScalar(
        Math.min(2.2, Math.pow(1 / aspect, 0.55)),
      )
    }
    const shiftX = THREE.MathUtils.lerp(from.shiftX, to.shiftX, local)
    const shiftY = THREE.MathUtils.lerp(from.shiftY, to.shiftY, local)

    // Composition: looking to one side of the subject pushes it to the other
    // side of frame, which is what leaves room for the copy.
    //
    // The offset is scaled by distance and field of view, so it is a constant
    // fraction of the frame rather than a fixed distance in the world — a
    // fixed offset throws the subject off-screen as soon as the camera moves
    // in for a closer state.
    const halfHeight = Math.tan((fov * Math.PI) / 360) * scratch.position.length()
    scratch.target.set(
      -composition.x * shiftX * halfHeight * aspect,
      -(composition.yBase + composition.y * shiftY) * halfHeight,
      0,
    )

    if (reducedMotion) {
      // Keep the scroll-driven states, but pull most of the camera travel out
      // of them so the framing barely moves.
      scratch.neutral.fromArray(NEUTRAL.position)
      if (aspect < 1) {
        scratch.neutral.multiplyScalar(Math.min(2.2, Math.pow(1 / aspect, 0.55)))
      }
      scratch.position.lerp(scratch.neutral, 0.55)
      fov = THREE.MathUtils.lerp(fov, NEUTRAL.fov, 0.55)
    } else {
      scratch.parallaxX = THREE.MathUtils.damp(
        scratch.parallaxX, input.current.pointerX, PARALLAX_DAMPING, step,
      )
      scratch.parallaxY = THREE.MathUtils.damp(
        scratch.parallaxY, input.current.pointerY, PARALLAX_DAMPING, step,
      )

      scratch.forward.subVectors(scratch.target, scratch.position).normalize()
      scratch.right.crossVectors(scratch.forward, WORLD_UP).normalize()
      scratch.up.crossVectors(scratch.right, scratch.forward).normalize()

      scratch.position
        .addScaledVector(scratch.right, scratch.parallaxX * PARALLAX_REACH)
        .addScaledVector(scratch.up, scratch.parallaxY * PARALLAX_REACH)

      const time = state.clock.elapsedTime
      scratch.position.y += Math.sin(time * 0.29) * DRIFT_REACH
      scratch.position.addScaledVector(scratch.right, Math.sin(time * 0.19) * DRIFT_REACH)
    }

    if (!scratch.started) {
      camera.position.copy(scratch.position)
      scratch.smoothedLook.copy(scratch.target)
      scratch.started = true
    } else {
      camera.position.lerp(scratch.position, 1 - Math.exp(-POSITION_DAMPING * step))
      scratch.smoothedLook.lerp(scratch.target, 1 - Math.exp(-LOOK_DAMPING * step))
    }

    camera.lookAt(scratch.smoothedLook)

    const nextFov = THREE.MathUtils.damp(camera.fov, fov, LOOK_DAMPING, step)
    if (Math.abs(nextFov - camera.fov) > 0.001) {
      camera.fov = nextFov
      camera.updateProjectionMatrix()
    }
  })

  return null
}

export default CryptoCamera
