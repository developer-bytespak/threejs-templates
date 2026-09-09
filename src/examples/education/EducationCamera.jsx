import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const WORLD_UP = new THREE.Vector3(0, 1, 0)
const FALLBACK_UP = new THREE.Vector3(0, 0, 1)

const POSITION_DAMPING = 2.2
const LOOK_DAMPING = 2.8
const PARALLAX_DAMPING = 1.7

/**
 * The camera path, in the models' own world space.
 *
 * Every coordinate here was read off the GLBs rather than guessed: the seed
 * sits at (0.32, 0.53, 2.62), the trunk runs up the Y axis to about y = 10,
 * the five branch systems fan out between y = 9 and y = 20, and the campus is
 * tucked inside the canopy around (0.3, 14.2, -2.3). The museum stops are
 * ordered as one continuous orbit — technology, science, design, engineering,
 * business — so the camera circles the tree once instead of criss-crossing it.
 *
 * `shiftX` / `shiftY` are signed multipliers on the composition offset, so the
 * subject swings away from whichever side the copy occupies. `parallax` is how
 * far the pointer may push the camera in that moment: almost nothing at the
 * seed, most in the open canopy.
 */
const PATH = [
  // 01 — the seed, close and nearly abstract
  { at: 0.0, pos: [2.25, 1.15, 6.25], look: [0.32, 0.55, 2.62], fov: 28, shiftX: 0.8, shiftY: 0, parallax: 0.3 },
  { at: 0.075, pos: [2.7, 1.45, 7.1], look: [0.3, 0.62, 2.5], fov: 30, shiftX: 0.8, shiftY: 0, parallax: 0.35 },
  // 02 — pull back for roots and trunk, then tilt up and climb
  { at: 0.135, pos: [3.7, 1.9, 7.3], look: [0.0, 1.3, 0.6], fov: 42, shiftX: -0.7, shiftY: 0, parallax: 0.5 },
  { at: 0.195, pos: [5.9, 5.3, 10.3], look: [0.0, 6.2, 0.0], fov: 46, shiftX: -0.8, shiftY: 0.1, parallax: 0.6 },
  // 03 — into the branch region
  { at: 0.26, pos: [8.4, 11.2, 12.2], look: [0.0, 11.6, 0.0], fov: 46, shiftX: 0.85, shiftY: 0, parallax: 0.8 },
  { at: 0.345, pos: [9.2, 14.6, 10.4], look: [0.2, 13.6, 0.2], fov: 44, shiftX: 0.5, shiftY: 0, parallax: 0.9 },
  // 04 — the museum, one orbit through the five disciplines
  { at: 0.42, pos: [8.9, 16.5, 6.8], look: [4.95, 16.05, 2.85], fov: 36, shiftX: -0.85, shiftY: 0, parallax: 0.7 },
  { at: 0.472, pos: [-8.8, 16.4, 6.2], look: [-4.4, 15.7, 2.6], fov: 36, shiftX: 0.85, shiftY: 0, parallax: 0.7 },
  { at: 0.512, pos: [-7.4, 19.4, 2.4], look: [-3.3, 17.9, -0.9], fov: 38, shiftX: -0.6, shiftY: 0.15, parallax: 0.7 },
  { at: 0.548, pos: [-8.4, 12.4, -8.4], look: [-3.9, 11.8, -4.6], fov: 40, shiftX: 0.8, shiftY: 0, parallax: 0.7 },
  { at: 0.578, pos: [11.4, 12.6, -2.2], look: [6.2, 12.0, -0.6], fov: 38, shiftX: -0.8, shiftY: 0, parallax: 0.7 },
  // 05 — swing to the front and start moving inward
  { at: 0.645, pos: [0.0, 12.6, 11.5], look: [0.3, 13.4, -1.2], fov: 46, shiftX: 0, shiftY: 0, parallax: 0.5 },
  // 06 — the approach, threading the foliage
  { at: 0.73, pos: [0.8, 14.6, 7.4], look: [0.3, 14.5, -2.3], fov: 40, shiftX: 0, shiftY: 0.1, parallax: 0.35 },
  // 07 — through, and over the clearing
  { at: 0.815, pos: [1.5, 19.2, 8.6], look: [0.3, 14.4, -2.3], fov: 42, shiftX: -0.45, shiftY: 0, parallax: 0.6 },
  { at: 0.885, pos: [-6.2, 19.4, 7.2], look: [0.1, 14.3, -2.6], fov: 44, shiftX: 0.55, shiftY: 0, parallax: 0.6 },
  // 08 — rise away for the closing composition
  { at: 1.0, pos: [9.5, 24.5, 20.0], look: [0.6, 12.0, -1.2], fov: 46, shiftX: 0.55, shiftY: 0.3, parallax: 0.45 },
]

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * Drives camera position, look target and field of view from scroll progress,
 * then damps all three. Damping is what stops a flung scrollbar teleporting
 * the camera through the tree; it also gives the whole path a little weight,
 * which is the difference between a dolly and a cut.
 */
function EducationCamera({ stage, quality, composition, reducedMotion }) {
  const keys = useMemo(
    () =>
      PATH.map((key) => ({
        ...key,
        position: new THREE.Vector3().fromArray(key.pos),
        target: new THREE.Vector3().fromArray(key.look),
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
    parallaxX: 0,
    parallaxY: 0,
    started: false,
  }).current

  useFrame((state, delta) => {
    const step = Math.min(delta, 0.1)
    const camera = state.camera
    const s = stage.current
    const p = s.progress

    let index = 0
    while (index < keys.length - 2 && p > keys[index + 1].at) index += 1
    const from = keys[index]
    const to = keys[index + 1]
    const local = easeInOutCubic(
      THREE.MathUtils.clamp((p - from.at) / (to.at - from.at), 0, 1),
    )

    scratch.position.lerpVectors(from.position, to.position, local)
    scratch.target.lerpVectors(from.target, to.target, local)
    let fov = THREE.MathUtils.lerp(from.fov, to.fov, local) + quality.fovBoost
    const shiftX = THREE.MathUtils.lerp(from.shiftX, to.shiftX, local)
    const shiftY = THREE.MathUtils.lerp(from.shiftY, to.shiftY, local)
    const parallax = THREE.MathUtils.lerp(from.parallax, to.parallax, local)

    // Smaller screens travel a shallower path: the full lateral swing reads as
    // the world sliding sideways rather than as the camera moving around it.
    if (quality.pathScale < 1) {
      scratch.position.x = THREE.MathUtils.lerp(
        scratch.target.x,
        scratch.position.x,
        quality.pathScale,
      )
      scratch.position.z = THREE.MathUtils.lerp(
        scratch.target.z,
        scratch.position.z,
        Math.min(1, quality.pathScale + 0.2),
      )
    }

    // Field of view is vertical, so a portrait frame is narrower than it is
    // tall and the tree spills out of the sides. Backing off by a power of the
    // inverse aspect fits it to the limiting dimension instead.
    const aspect = state.viewport.aspect
    if (aspect < 1) {
      const fit = Math.min(2.1, Math.pow(1 / aspect, 0.5))
      scratch.position.sub(scratch.target).multiplyScalar(fit).add(scratch.target)
    }

    // Composition: looking to one side of the subject pushes it to the other
    // side of frame, scaled by distance so it stays a constant fraction of the
    // frame however far away the camera is.
    const distance = scratch.position.distanceTo(scratch.target)
    const halfHeight = Math.tan((fov * Math.PI) / 360) * distance

    scratch.forward.subVectors(scratch.target, scratch.position).normalize()
    const up =
      Math.abs(scratch.forward.dot(WORLD_UP)) > 0.999 ? FALLBACK_UP : WORLD_UP
    scratch.right.crossVectors(scratch.forward, up).normalize()
    scratch.up.crossVectors(scratch.right, scratch.forward).normalize()

    scratch.target
      .addScaledVector(scratch.right, -composition.x * shiftX * halfHeight * aspect)
      .addScaledVector(
        scratch.up,
        -(composition.yBase + composition.y * shiftY) * halfHeight,
      )

    if (reducedMotion) {
      fov = Math.min(fov + 4, 62)
    } else {
      scratch.parallaxX = THREE.MathUtils.damp(
        scratch.parallaxX, s.pointerX, PARALLAX_DAMPING, step,
      )
      scratch.parallaxY = THREE.MathUtils.damp(
        scratch.parallaxY, s.pointerY, PARALLAX_DAMPING, step,
      )

      const reach = parallax * quality.pointerStrength * distance * 0.055
      scratch.position
        .addScaledVector(scratch.right, scratch.parallaxX * reach)
        .addScaledVector(scratch.up, scratch.parallaxY * reach)

      const time = state.clock.elapsedTime
      scratch.position.addScaledVector(scratch.up, Math.sin(time * 0.27) * reach * 0.16)
    }

    if (!scratch.started) {
      camera.position.copy(scratch.position)
      scratch.smoothedLook.copy(scratch.target)
      camera.near = 0.08
      camera.far = 220
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

export default EducationCamera
