import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useRoomModel } from './useRoomModel.js'
import { easeInOutCubic, resolveKeyframes } from './story.js'

const WORLD_UP = new THREE.Vector3(0, 1, 0)
const FALLBACK_UP = new THREE.Vector3(0, 0, 1)

// How hard the camera resists the scroll. Lower is heavier and more filmic;
// this is the difference between a dolly and a cut. The camera is deliberately
// slower to settle than the scroll is to change, so a flick of the wheel is
// answered by a move that arrives a beat later and comes to rest gently.
const POSITION_DAMPING = 1.7
const LOOK_DAMPING = 2.1
const PARALLAX_DAMPING = 1.5

// Metres the cursor can push the camera off its rail, and the idle sway that
// keeps the frame alive when nobody is touching anything. Both are small: the
// cursor should be felt rather than noticed.
const PARALLAX_REACH = 0.105
const DRIFT_REACH = 0.019

/**
 * Drives the camera along the storyboard from scroll position, with cursor
 * parallax on top. `input` is a ref owned by the DOM layer holding the
 * current scroll progress (0..1) and pointer position (-1..1 on each axis);
 * reading it in the frame loop keeps scrolling off React's render path.
 */
function CinematicCamera({ input, reducedMotion }) {
  const { focus, bounds, anchors } = useRoomModel()
  const keys = useMemo(
    () => resolveKeyframes(focus, anchors, bounds),
    [focus, anchors, bounds],
  )

  // Scratch vectors, allocated once: this runs every frame.
  const scratch = useRef({
    position: new THREE.Vector3(),
    lookAt: new THREE.Vector3(),
    forward: new THREE.Vector3(),
    right: new THREE.Vector3(),
    up: new THREE.Vector3(),
    parallax: new THREE.Vector2(),
    smoothedLook: null,
    started: false,
  }).current

  useFrame((state, delta) => {
    const { camera, clock } = state
    const step = Math.min(delta, 0.1)

    // Keyframes sit at their own progress values rather than at equal
    // intervals, so find the pair the page is currently between and ease across
    // that gap. This is what lets the camera spend a quarter of the page on the
    // drawing and a twelfth on the opening without either being padded.
    const p = THREE.MathUtils.clamp(input.current.progress, 0, 1)
    let index = 0
    while (index < keys.length - 2 && p >= keys[index + 1].at) index += 1
    const from = keys[index]
    const to = keys[index + 1]
    const gap = Math.max(to.at - from.at, 1e-6)
    const blend = easeInOutCubic(THREE.MathUtils.clamp((p - from.at) / gap, 0, 1))

    scratch.position.lerpVectors(from.position, to.position, blend)
    scratch.lookAt.lerpVectors(from.lookAt, to.lookAt, blend)
    const fov = THREE.MathUtils.lerp(from.fov, to.fov, blend)

    if (!reducedMotion) {
      // Parallax is applied along the camera's own right/up axes so it reads
      // as a head movement regardless of which way the shot faces.
      scratch.parallax.x = THREE.MathUtils.damp(
        scratch.parallax.x,
        input.current.pointerX,
        PARALLAX_DAMPING,
        step,
      )
      scratch.parallax.y = THREE.MathUtils.damp(
        scratch.parallax.y,
        input.current.pointerY,
        PARALLAX_DAMPING,
        step,
      )

      scratch.forward.subVectors(scratch.lookAt, scratch.position).normalize()

      // Looking almost straight down makes forward parallel to world up, and
      // that cross product collapses to zero — normalising it yields NaN and
      // takes the whole frame out. Fall back to an axis that cannot be
      // parallel to forward.
      const up =
        Math.abs(scratch.forward.dot(WORLD_UP)) > 0.999 ? FALLBACK_UP : WORLD_UP

      scratch.right.crossVectors(scratch.forward, up).normalize()
      scratch.up.crossVectors(scratch.right, scratch.forward).normalize()

      scratch.position
        .addScaledVector(scratch.right, scratch.parallax.x * PARALLAX_REACH)
        .addScaledVector(scratch.up, scratch.parallax.y * PARALLAX_REACH)

      // Two slow, incommensurate periods, so the sway never repeats visibly.
      const time = clock.elapsedTime
      scratch.position.y += Math.sin(time * 0.21) * DRIFT_REACH
      scratch.position.addScaledVector(
        scratch.right,
        Math.sin(time * 0.13) * DRIFT_REACH,
      )
    }

    if (!scratch.started) {
      // First frame: snap, so the opening shot is not a swoop in from wherever
      // the default camera happened to be.
      camera.position.copy(scratch.position)
      scratch.smoothedLook = scratch.lookAt.clone()
      camera.near = 0.02
      camera.far = 60
      scratch.started = true
    } else {
      camera.position.lerp(
        scratch.position,
        1 - Math.exp(-POSITION_DAMPING * step),
      )
      scratch.smoothedLook.lerp(
        scratch.lookAt,
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

export default CinematicCamera
