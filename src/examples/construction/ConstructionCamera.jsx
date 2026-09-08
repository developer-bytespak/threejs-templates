import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const WORLD_UP = new THREE.Vector3(0, 1, 0)

const POSITION_DAMPING = 2.2
const LOOK_DAMPING = 2.8
const PARALLAX_DAMPING = 1.7

/** How far the pointer may push the camera off its rail, in metres. */
const PARALLAX_REACH = 1.9
const DRIFT_REACH = 0.34

/**
 * The rail the camera runs on.
 *
 * Architectural photography, not a flythrough: the lens stays between roughly
 * 38 and 42 degrees vertical — the long end of normal — because anything
 * wider bends the verticals of a 33-metre tower outward and the building
 * immediately stops looking like a building.
 *
 * `target` rises through the sequence. The assembled building centres near
 * y=15; the exploded composition's centre of mass is nearer y=29, so the
 * camera has to climb with it or the whole diagram drifts out of the top of
 * the frame exactly when it becomes worth looking at.
 */
const SHOTS = [
  // 01 — the complete building, three-quarter, slightly above eye level.
  { at: 0.0, position: [46, 26, 52], fov: 38, target: [0, 15.5, 0] },
  // 02 — press in as the roof lifts.
  { at: 0.12, position: [42, 25, 48], fov: 38, target: [0, 16.5, 0] },
  { at: 0.24, position: [45, 33, 50], fov: 39, target: [0, 21, 0] },
  // 03 — the envelope peels; the camera rises and backs off with it.
  { at: 0.4, position: [66, 52, 70], fov: 40, target: [0, 27, 0] },
  // 04 — the skeleton stands alone; wide enough to take in the slab fan.
  { at: 0.55, position: [76, 62, 80], fov: 41, target: [0, 30, 0] },
  // 05 — the full exploded composition. The diagram is 62m tall and 29m
  //      deep, and in three-quarter view the near corner magnifies by about
  //      a third, so this sits further back than the height alone suggests.
  { at: 0.68, position: [80, 66, 84], fov: 41, target: [0, 31, 0] },
  // 06 — inspection: a slow swing around the model, tilting down onto it.
  { at: 0.78, position: [54, 76, 100], fov: 40, target: [0, 32, 0] },
  { at: 0.85, position: [28, 68, 110], fov: 40, target: [0, 30, 0] },
  // 07 — reassembly draws the camera back toward the opening angle.
  { at: 0.93, position: [46, 40, 74], fov: 39, target: [0, 22, 0] },
  // 08 — the closing hero, a touch more frontal than the opening.
  { at: 1.0, position: [42, 24, 53], fov: 38, target: [0, 15.5, 0] },
]

/**
 * The opening shot doubles as the rig's origin. Smaller tiers explode the
 * building less, so the camera's climb and pull-back are scaled back from
 * here by the same factor — otherwise a phone frames a large amount of empty
 * air above a building that never got that tall.
 */
const BASE = SHOTS[0]

/** Where the camera sits when motion is reduced: one calm, wide framing. */
const NEUTRAL = { position: [58, 44, 64], fov: 40, target: [0, 24, 0] }

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * Moves the camera as part of the storytelling, entirely from scroll progress
 * and then damped — so reversing the scroll retraces the same path rather than
 * unwinding some separate animation that has drifted away from the page.
 */
function ConstructionCamera({ stage, input, quality, reducedMotion }) {
  const keyframes = useMemo(
    () =>
      SHOTS.map((shot) => ({
        ...shot,
        vector: new THREE.Vector3().fromArray(shot.position),
        focus: new THREE.Vector3().fromArray(shot.target),
      })),
    [],
  )

  const origin = useMemo(
    () => ({
      position: new THREE.Vector3().fromArray(BASE.position),
      target: new THREE.Vector3().fromArray(BASE.target),
    }),
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
    neutralTarget: new THREE.Vector3(),
    parallaxX: 0,
    parallaxY: 0,
    started: false,
  }).current

  useFrame((state, delta) => {
    const step = Math.min(delta, 0.1)
    const camera = state.camera
    const s = stage.current
    const p = s.progress

    // Locate the pair of keyframes we are between and ease within them, so the
    // camera settles at each framing instead of sliding through at a constant
    // rate.
    let index = 0
    while (index < keyframes.length - 2 && p > keyframes[index + 1].at) index += 1
    const from = keyframes[index]
    const to = keyframes[index + 1]
    const local = easeInOutCubic(
      THREE.MathUtils.clamp((p - from.at) / (to.at - from.at), 0, 1),
    )

    scratch.position.lerpVectors(from.vector, to.vector, local)
    scratch.target.lerpVectors(from.focus, to.focus, local)
    let fov = THREE.MathUtils.lerp(from.fov, to.fov, local)

    // Scale the whole move away from the opening framing by how far this tier
    // actually explodes the building. At full quality this is the identity.
    const reachScale = quality.explodeScale
    if (reachScale !== 1) {
      scratch.position
        .sub(origin.position)
        .multiplyScalar(reachScale)
        .add(origin.position)
      scratch.target
        .sub(origin.target)
        .multiplyScalar(reachScale)
        .add(origin.target)
    }

    // Field of view is vertical, so a portrait viewport is narrower than it is
    // tall and the building spills out of the sides. Backing off by a power of
    // the inverse aspect fits it to the limiting dimension; the exponent stops
    // phones retreating so far that the model becomes a distant speck.
    const aspect = state.viewport.aspect
    if (aspect < 1) {
      const fit = Math.min(1.85, Math.pow(1 / aspect, 0.46))
      scratch.position.multiplyScalar(fit)
    }

    if (reducedMotion) {
      // Keep the scroll-driven states, but pull most of the camera travel out
      // of them so the framing barely moves.
      scratch.neutral.fromArray(NEUTRAL.position)
      scratch.neutralTarget.fromArray(NEUTRAL.target)
      if (aspect < 1) {
        scratch.neutral.multiplyScalar(Math.min(1.85, Math.pow(1 / aspect, 0.46)))
      }
      scratch.position.lerp(scratch.neutral, 0.72)
      scratch.target.lerp(scratch.neutralTarget, 0.72)
      fov = THREE.MathUtils.lerp(fov, NEUTRAL.fov, 0.72)
    } else {
      const reach = quality.pointer ? 1 : 0
      scratch.parallaxX = THREE.MathUtils.damp(
        scratch.parallaxX,
        input.current.pointerX * reach,
        PARALLAX_DAMPING,
        step,
      )
      scratch.parallaxY = THREE.MathUtils.damp(
        scratch.parallaxY,
        input.current.pointerY * reach,
        PARALLAX_DAMPING,
        step,
      )

      scratch.forward.subVectors(scratch.target, scratch.position).normalize()
      scratch.right.crossVectors(scratch.forward, WORLD_UP).normalize()
      scratch.up.crossVectors(scratch.right, scratch.forward).normalize()

      // Parallax opens up during the inspection hold, which is the one stretch
      // of the page where the user is meant to feel they are moving around a
      // model rather than being shown one.
      const gain = PARALLAX_REACH * (1 + s.inspect * 0.9)
      scratch.position
        .addScaledVector(scratch.right, scratch.parallaxX * gain)
        .addScaledVector(scratch.up, scratch.parallaxY * gain)

      // Breathing. Small enough to read as a held camera, not as drift.
      const time = state.clock.elapsedTime
      scratch.position.y += Math.sin(time * 0.23) * DRIFT_REACH
      scratch.position.addScaledVector(
        scratch.right,
        Math.sin(time * 0.17) * DRIFT_REACH,
      )
    }

    if (!scratch.started) {
      // A refresh halfway down the page must open on that frame, not travel to
      // it from the top.
      camera.position.copy(scratch.position)
      scratch.smoothedLook.copy(scratch.target)
      scratch.started = true
    } else {
      camera.position.lerp(
        scratch.position,
        1 - Math.exp(-POSITION_DAMPING * step),
      )
      scratch.smoothedLook.lerp(
        scratch.target,
        1 - Math.exp(-LOOK_DAMPING * step),
      )
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

export default ConstructionCamera
