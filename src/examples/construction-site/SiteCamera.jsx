import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { prior } from './sequence.js'

const WORLD_UP = new THREE.Vector3(0, 1, 0)

const POSITION_DAMPING = 2.0
const LOOK_DAMPING = 2.6
const PARALLAX_DAMPING = 1.7

/** How far the pointer may push the camera off its rail, in metres. */
const PARALLAX_REACH = 1.6
const DRIFT_REACH = 0.26

/**
 * The rail the camera runs on.
 *
 * The brief is a site, not a building, so the lens stays fairly long — 33 to
 * 43 degrees vertical. Anything wider and a 72 by 52 metre site photographed
 * from inside its own fence starts to bend, and the excavation reads as a
 * bowl rather than a cut.
 *
 * The rail was rebuilt for the soil-mass asset. The old one framed a pit that
 * was the same shape and depth from the moment it appeared, so its excavation
 * shots could sit anywhere along the page and still show the same thing. This
 * excavation is somewhere different at every stage: it starts at the east end
 * a metre and a third deep, the front works west, the floor drops to
 * formation, and only at the end do the foundations get cut into it. The
 * camera has to be in a different place for each of those, and the places are
 * measured rather than chosen — the targets below are the centroids of the
 * ground that actually changes at each stage, read off the exported geometry:
 *
 *   stage 1   new ground centred x +12.1, 1.1 m deep
 *   stage 2   new ground centred x  +6.7, working face at x -2.9, 2.4 m deep
 *   stage 3   new ground centred x  +1.7, working face at x -10.2, 3.5 m deep
 *   stage 4   formation across x +/-13.6, z +/-8.6, cuts down to -5.5
 *
 * Two rules hold the excavation half together. The camera descends while the
 * dig does — 9.5 metres of height, then 4.6, then 4.0, then 2.4 — because a
 * hole seen from above is a darker rectangle, and the only way three or four
 * metres reads as three or four metres is to keep the rim in frame and let
 * the eye measure the wall against it. And it follows the front west, so the
 * part of the site being cut is the part being watched.
 *
 * The exception is the last pair, which climbs hard. The foundations are a
 * pattern — a strip footing round the edge, six pads, the beams between them
 * — and a pattern is the one thing a low camera cannot show. That climb is
 * also what makes the ending read as the completion of an excavation rather
 * than as a deeper hole: the shape that appears at the top of it is a
 * building's footprint, not a bigger void.
 */
const SHOTS = [
  // --- setting out: the first fifth of the page -----------------------------
  // 01 — the empty site, three-quarter from the south-east, above the fence.
  { at: prior(0.000), position: [54, 27, 48], fov: 36, target: [0, 1.0, 0] },
  // 02 — in to the instrument as the kit is set up. The total station stands
  //      at (19.5, 15.5), clear of the works; this shot is about it arriving.
  { at: prior(0.055), position: [30, 9, 26], fov: 40, target: [17, 1.2, 12] },
  // 03 — up and across as the stakes go in. The camera has to climb: a 0.34
  //      metre stake read from standing height on a site this size is a
  //      speck, and what makes it legible is the pattern the stakes make
  //      together, which only exists from above.
  { at: prior(0.115), position: [26, 22, 30], fov: 35, target: [2, 0.5, 3] },
  // 04 — the whole footprint in frame while the last corners are pegged and
  //      the first strings are pulled.
  { at: prior(0.175), position: [16, 16, 24], fov: 36, target: [0, 0.4, 1] },
  // 05 — the hold. The only near-plan view before the end, and the only
  //      moment that deserves one: the setout complete and nothing cut yet.
  //      It has to clear 37 metres across, not 30 — the control baseline and
  //      its two stations sit outside the footprint.
  { at: prior(0.215), position: [5, 40, 30], fov: 33, target: [0, 0.2, 2] },

  // --- the excavation: the remaining three quarters -------------------------
  // 06 — the first cut, at the east end where the dig starts. Placed just
  //      after the stage lands at 0.23 so the camera is still travelling as
  //      the ground comes away rather than parked waiting for it. The first
  //      spoil heap sits about fourteen degrees off axis, inside the frame:
  //      the earth and the hole it came out of are in the same shot from the
  //      first moment there is either.
  { at: prior(0.265), position: [33, 9.5, 24], fov: 39, target: [11.5, -0.7, -3.5] },
  // 07 — the second pass. Down to four and a half metres and in close, with
  //      the working face across the middle distance and the north batter
  //      raking through the frame. This is the shot that has to carry the
  //      soil layers, so it is the closest of the four.
  { at: prior(0.460), position: [20, 5.0, 13.5], fov: 42, target: [1.0, -1.6, -3.4] },
  // 08 — the third. Lower, and pulled back and round along the pit, so the
  //      frame is length rather than detail: the face at x -10 with twenty-five
  //      metres of opened ground in front of it is what says how big this is.
  //      The pull-back is also what keeps this pair moving. It is the longest
  //      segment on the rail — nearly a quarter of the page — and the earlier
  //      framing sat barely a metre and a half from this one, so the camera
  //      crept through the whole of the second lift and stood still at both
  //      ends of it. Seven metres of travel over the same stretch reads as a
  //      dolly instead.
  { at: prior(0.690), position: [26, 4.2, 17], fov: 40, target: [-7.5, -2.5, -1.0] },
  // 09 — the last of the general dig, from just above the rim. The floor
  //      fills the lower frame, which is where the foundations are about to
  //      be cut — so they appear under the camera rather than off to one side.
  { at: prior(0.860), position: [14, 2.4, 11], fov: 43, target: [-3.0, -3.2, -1.0] },
  // 10 — the foundations. The climb starts before the stage lands at 0.92, so
  //      the strip footing and the pads come up into a frame that is already
  //      rising to meet them. Framed on the cuts themselves: they span 27
  //      metres by 17, and at this distance that is three quarters of frame
  //      height.
  { at: prior(0.940), position: [16, 22, 20], fov: 35, target: [-0.5, -4.0, 0.0] },
  // 11 — the finished excavation, and the bank of earth that came out of it.
  //      The page holds here for its last twelfth.
  { at: prior(1.000), position: [46, 25, 42], fov: 36, target: [0, -2.2, -4.0] },
  // --- the columns: the last quarter of the page ---------------------------
  // Everything above was composed against a page that ended with the
  // excavation, and `prior()` puts it back where it was on a page that no
  // longer does. What follows is new, and it is on the page's own axis
  // because there is nothing older to agree with.
  //
  // The job here is not to be interesting. It is to get out of the way of
  // fourteen metres of frame arriving in three seconds: the camera climbs and
  // retreats just enough that the head of level four is inside the frame when
  // it lands, and does nothing else. No cut, no roll, no push.
  //
  // 12 — the finished foundation, from the rim. Lower and nearer than shot 11
  //      so the slab reads as a floor rather than as a plan, and placed above
  //      the trigger so the camera is already moving when the first level
  //      starts.
  { at: 0.762, position: [30, 6.5, 24], fov: 40, target: [0, -3.2, 0] },
  // 13 — levels one and two. The frame's head passes site datum here, which
  //      is the moment the building stops being in a hole, so the camera is
  //      pulling up through it rather than watching from above it.
  { at: 0.850, position: [36, 12, 30], fov: 38, target: [0, 0.5, 0] },
  // 14 — levels three and four. 10.5 m of column at 46 m is most of frame
  //      height at this fov, and the context blocks behind are 17.5 m, so the
  //      frame has something to be measured against.
  { at: 0.930, position: [46, 20, 39], fov: 36, target: [0, 3.2, 0] },
  // 15 — the finished frame. Wide and square-on to the long face, the way the
  //      empty site was shot in 01: the page opens on a site with nothing on
  //      it and closes on the same view with a building standing in it.
  { at: 1.000, position: [58, 26, 50], fov: 36, target: [0, 3.0, -1.0] },
]

/**
 * The aspect these framings were composed for. Narrower than this and the
 * camera backs off to keep the site in frame; wider and it does nothing.
 */
const REF_ASPECT = 1.6

/** Where the camera sits when motion is reduced: one calm, wide framing. */
const NEUTRAL = { position: [48, 26, 44], fov: 38, target: [0, -1.4, -2] }

/**
 * The ease between two framings.
 *
 * Cubic on its own is too flat at the ends for segments this long. Between
 * the second and third excavation framings it held the camera within a few
 * centimetres for five percent of the page — a fifth of a screen of scrolling
 * with a lift of soil coming away and nothing moving to watch it. Blending a
 * third of a linear ramp back in keeps the settle at each beat and takes the
 * dead stop out of it: the camera slows at a framing instead of stopping on
 * it.
 */
function easeShot(t) {
  const cubic = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  return cubic * 0.66 + t * 0.34
}

/**
 * Moves the camera as part of the storytelling, entirely from scroll progress
 * and then damped — so reversing the scroll retraces the same path rather
 * than unwinding a separate animation that has drifted away from the page.
 */
function SiteCamera({ stage, input, quality, reducedMotion, shake = null }) {
  const keyframes = useMemo(
    () =>
      SHOTS.map((shot) => ({
        ...shot,
        vector: new THREE.Vector3().fromArray(shot.position),
        focus: new THREE.Vector3().fromArray(shot.target),
      })),
    [],
  )

  const scratch = useRef({
    position: new THREE.Vector3(),
    // The camera's own path, damped, with nothing added to it. The shake is
    // applied to a copy on its way to the camera and never to this, which is
    // the whole reason there is nothing to drift: an additive layer that is
    // allowed to write back into the value it is added to is an integrator.
    base: new THREE.Vector3(),
    target: new THREE.Vector3(),
    offset: new THREE.Vector3(),
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

    // Find the pair of framings we are between and ease within them, so the
    // camera settles at each one instead of sliding through at a constant
    // rate.
    let index = 0
    while (index < keyframes.length - 2 && p > keyframes[index + 1].at) index += 1
    const from = keyframes[index]
    const to = keyframes[index + 1]
    const local = easeShot(
      THREE.MathUtils.clamp((p - from.at) / (to.at - from.at), 0, 1),
    )

    scratch.position.lerpVectors(from.vector, to.vector, local)
    scratch.target.lerpVectors(from.focus, to.focus, local)
    let fov = THREE.MathUtils.lerp(from.fov, to.fov, local)

    // Field of view is vertical, so a narrow viewport sees less across than a
    // wide one at the same distance, and the site spills out of the sides.
    // Backing off along the view direction fits it back in.
    //
    // Two details that were both wrong in the first cut. It is done relative
    // to the TARGET rather than to the world origin, because half these
    // framings are looking into the cut rather than at the middle of the
    // site, and scaling those from the origin swings the camera as well as
    // pulling it back. And the reference is 16:10, not square: a 72 by 52
    // metre site framed for a laptop is already cropped at 4:3, so waiting
    // for portrait to start compensating loses the composition on every
    // tablet. At the reference aspect this is exactly 1, so the framings
    // above mean precisely what they say on the screen they were tuned on.
    //
    // Full compensation would be REF / aspect, which on a phone is nearly 4x
    // and leaves a site you cannot see. The exponent takes most of it — a
    // phone gets about 2.7 — and the cap is the point past which pulling back
    // stops helping because everything has become too small to read anyway.
    const aspect = state.viewport.aspect
    const fit =
      aspect < REF_ASPECT
        ? Math.min(2.8, Math.pow(REF_ASPECT / aspect, 0.8))
        : 1
    if (fit !== 1) {
      scratch.position
        .sub(scratch.target)
        .multiplyScalar(fit)
        .add(scratch.target)
    }

    if (reducedMotion) {
      // Keep every scroll-driven state, but take most of the camera travel
      // out of it so the framing barely moves.
      scratch.neutral.fromArray(NEUTRAL.position)
      scratch.neutralTarget.fromArray(NEUTRAL.target)
      if (fit !== 1) {
        scratch.neutral
          .sub(scratch.neutralTarget)
          .multiplyScalar(fit)
          .add(scratch.neutralTarget)
      }
      scratch.position.lerp(scratch.neutral, 0.74)
      scratch.target.lerp(scratch.neutralTarget, 0.74)
      fov = THREE.MathUtils.lerp(fov, NEUTRAL.fov, 0.74)
    } else {
      const reach = quality.pointer ? 1 : 0
      scratch.parallaxX = THREE.MathUtils.damp(
        scratch.parallaxX, input.current.pointerX * reach, PARALLAX_DAMPING, step,
      )
      scratch.parallaxY = THREE.MathUtils.damp(
        scratch.parallaxY, input.current.pointerY * reach, PARALLAX_DAMPING, step,
      )

      scratch.forward.subVectors(scratch.target, scratch.position).normalize()
      scratch.right.crossVectors(scratch.forward, WORLD_UP).normalize()
      scratch.up.crossVectors(scratch.right, scratch.forward).normalize()

      // Parallax opens up during the excavation — the one stretch of the page
      // where the user should feel they are standing at the edge of the hole
      // rather than being shown a picture of it.
      const gain = PARALLAX_REACH * (1 + s.open * 0.8)
      scratch.position
        .addScaledVector(scratch.right, scratch.parallaxX * gain)
        .addScaledVector(scratch.up, scratch.parallaxY * gain)

      // Breathing. Small enough to read as a held camera, not as drift, and
      // it eases off at both ends so the opening and closing frames are calm.
      const time = state.clock.elapsedTime
      const life = 1 - s.calm * 0.6
      scratch.position.y += Math.sin(time * 0.23) * DRIFT_REACH * life
      scratch.position.addScaledVector(
        scratch.right, Math.sin(time * 0.17) * DRIFT_REACH * life,
      )
    }

    if (!scratch.started) {
      // A refresh halfway down the page must open on that frame, not travel
      // to it from the top.
      scratch.base.copy(scratch.position)
      scratch.smoothedLook.copy(scratch.target)
      scratch.started = true
    } else {
      scratch.base.lerp(scratch.position, 1 - Math.exp(-POSITION_DAMPING * step))
      scratch.smoothedLook.lerp(scratch.target, 1 - Math.exp(-LOOK_DAMPING * step))
    }

    camera.position.copy(scratch.base)

    // ---- the excavation, felt rather than seen -----------------------------
    // Added here, at the very end, and to a copy: the base path above has
    // already been damped and is what the next frame damps from, so nothing
    // the shake does can be carried forward. When no soil is moving the offset
    // is exactly zero and this is three additions of zero.
    const jolt = shake && !reducedMotion
      ? shake.sample(state.clock.elapsedTime, step)
      : null
    if (jolt && jolt.level > 0) {
      camera.position.x += jolt.x
      camera.position.y += jolt.y
      camera.position.z += jolt.z
    }

    camera.lookAt(scratch.smoothedLook)

    // Rotation goes on after the look, so it is re-applied from a known
    // orientation every frame rather than compounding on the last one.
    if (jolt && jolt.level > 0) {
      camera.rotateX(jolt.pitch)
      camera.rotateY(jolt.yaw)
      camera.rotateZ(jolt.roll)
    }

    const nextFov = THREE.MathUtils.damp(camera.fov, fov, LOOK_DAMPING, step)
    if (Math.abs(nextFov - camera.fov) > 0.001) {
      camera.fov = nextFov
      camera.updateProjectionMatrix()
    }
  })

  return null
}

export default SiteCamera
