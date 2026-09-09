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
  // 01 — the seed. Far enough back that it reads as a small object in a large
  // dark space rather than filling the frame: about a fifth of frame height.
  { at: 0.0, pos: [3.3, 2.7, 11.2], look: [0.32, 0.55, 2.62], fov: 30, shiftX: 0.8, shiftY: 0, parallax: 0.3 },
  { at: 0.075, pos: [4.2, 3.4, 12.6], look: [0.3, 0.7, 2.5], fov: 32, shiftX: 0.8, shiftY: 0, parallax: 0.35 },
  // 02 — roots and trunk, seen as a growing object. The whole base has to fit.
  { at: 0.14, pos: [9.0, 5.0, 16.0], look: [0.0, 3.5, 0.0], fov: 42, shiftX: -0.7, shiftY: 0, parallax: 0.5 },
  { at: 0.2, pos: [11.0, 9.0, 17.0], look: [0.0, 7.5, 0.0], fov: 44, shiftX: -0.8, shiftY: 0.1, parallax: 0.6 },
  // 03 — climb alongside the trunk, then one clean overview from outside the
  // canopy that establishes the geography before anything closer.
  { at: 0.27, pos: [14.0, 13.0, 18.0], look: [0.0, 11.5, 0.0], fov: 42, shiftX: 0.85, shiftY: 0, parallax: 0.8 },
  { at: 0.345, pos: [17.0, 16.0, 16.0], look: [0.0, 13.5, 0.0], fov: 40, shiftX: 0.5, shiftY: 0, parallax: 0.9 },
  // 04 — the museum, as one orbit at a safe radius outside the canopy, looking
  // inward at each hero. Ordered by azimuth so the camera sweeps once around
  // rather than crossing the tree, and the long leg carries a corridor
  // waypoint: a straight lerp between opposite sides goes through the trunk.
  { at: 0.415, pos: [13.41, 13.4, 3.3], look: [6.14, 11.97, 0.29], fov: 30, shiftX: -0.85, shiftY: 0, parallax: 0.6, arc: true },
  { at: 0.45, pos: [13.05, 16.2, 7.39], look: [5.27, 15.9, 2.98], fov: 30, shiftX: -0.8, shiftY: 0, parallax: 0.6, arc: true },
  { at: 0.48, pos: [0.0, 17.0, 15.0], look: [0.0, 15.5, 2.0], fov: 40, shiftX: 0, shiftY: 0, parallax: 0.5, arc: true },
  { at: 0.51, pos: [-12.75, 16.19, 6.13], look: [-5.36, 16.19, 3.07], fov: 30, shiftX: 0.85, shiftY: 0, parallax: 0.6, arc: true },
  { at: 0.545, pos: [-14.34, 19.2, -4.39], look: [-1.85, 16.13, -0.58], fov: 32, shiftX: -0.6, shiftY: 0.15, parallax: 0.6, arc: true },
  { at: 0.572, pos: [-13.91, 17.28, 1.15], look: [-2.88, 9.96, -3.42], fov: 32, shiftX: 0.8, shiftY: 0, parallax: 0.6, arc: true },
  // 05 — swing back to the front, outside, and begin moving inward.
  { at: 0.645, pos: [0.0, 13.5, 17.0], look: [0.3, 13.6, -1.0], fov: 44, shiftX: 0, shiftY: 0, parallax: 0.5, arc: true },
  // 06 — the approach. This is the one place foliage is meant to be in the
  // way, so the camera comes to the canopy edge rather than through it.
  { at: 0.73, pos: [0.9, 18.4, 12.4], look: [0.3, 14.5, -2.3], fov: 40, shiftX: 0, shiftY: 0.1, parallax: 0.35 },
  // 07 — over the rim and above the clearing.
  { at: 0.815, pos: [2.2, 23.8, 9.4], look: [0.3, 14.4, -2.3], fov: 42, shiftX: -0.45, shiftY: 0, parallax: 0.6 },
  { at: 0.885, pos: [12.5, 19.44, -9.35], look: [0.1, 14.3, -2.6], fov: 44, shiftX: 0.55, shiftY: 0, parallax: 0.6 },
  // 08 — rise away for the closing composition.
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
        // Cylindrical form, for the legs that orbit the tree.
        radius: Math.hypot(key.pos[0], key.pos[2]),
        azimuth: Math.atan2(key.pos[2], key.pos[0]),
        height: key.pos[1],
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
    glance: new THREE.Vector3(),
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

    if (from.arc && to.arc) {
      // Orbit legs interpolate in cylindrical space. Lerping the two positions
      // directly draws a chord, and a chord between opposite sides of the tree
      // goes straight through the trunk — which is exactly how the camera used
      // to end up inside the canopy between hero shots.
      let sweep = to.azimuth - from.azimuth
      while (sweep > Math.PI) sweep -= Math.PI * 2
      while (sweep < -Math.PI) sweep += Math.PI * 2
      const azimuth = from.azimuth + sweep * local
      const radius = THREE.MathUtils.lerp(from.radius, to.radius, local)
      const height = THREE.MathUtils.lerp(from.height, to.height, local)
      scratch.position.set(
        Math.cos(azimuth) * radius,
        height,
        Math.sin(azimuth) * radius,
      )
      scratch.target.lerpVectors(from.target, to.target, local)

      // Look where you are going. Holding the aim on a distant artifact while
      // swinging round the tree means staring through the canopy for the whole
      // move; glancing at the near foliage instead keeps the frame full of
      // what the camera is actually passing. Zero at both ends, so each shot
      // still lands exactly on its hero.
      // Aimed at the near surface of the canopy, not into the middle of it.
      // At a third of the orbit radius the target sits deep inside the tree,
      // so the camera spends the whole move looking through ten metres of
      // leaves — which is exactly what buried the transitional statements.
      scratch.glance.set(
        Math.cos(azimuth) * radius * 0.62,
        height * 0.96,
        Math.sin(azimuth) * radius * 0.62,
      )
      scratch.target.lerp(scratch.glance, Math.sin(local * Math.PI) * 0.7)
    } else {
      scratch.position.lerpVectors(from.position, to.position, local)
      scratch.target.lerpVectors(from.target, to.target, local)
    }
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
