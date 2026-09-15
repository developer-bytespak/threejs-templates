import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  airLevel,
  campusLevel,
  distantLevel,
  growthLevel,
  leafLevel,
  sound,
  woodLevel,
} from './AudioManager.js'
import { makeThresholds } from './useAudio.js'

/**
 * The journey, heard.
 *
 * This is a null component inside the Canvas, and that placement is the whole
 * performance story: it reads the stage weights the scene has already computed
 * this frame, on the frame loop that is already running. There is no second
 * requestAnimationFrame, no polling, no React state, and nothing is allocated
 * per frame — a loading screen or an audio layer that costs the thing it is
 * decorating is an unusually silly way to lose frames.
 *
 * WHY IT READS STAGE WEIGHTS RATHER THAN PROGRESS
 *
 * The visuals derive everything from one number and hold no animation state of
 * their own, which is what makes reversing correct by construction. Audio
 * follows the same rule by listening to the same derived weights: `seedOpen`,
 * `trunkGrowth`, `campusReveal` and the rest. A sound therefore cannot
 * disagree with what is on screen, because it is triggered by the number that
 * put it there. A separate audio timeline would be a second opinion about
 * where the page is, and second opinions drift.
 *
 * Two kinds of event, and they are different on purpose:
 *
 *   MARKS    one-shot moments, forward-only with hysteresis. Crossing a
 *            boundary fires once; reversing over it re-arms without firing;
 *            jiggling on it does nothing.
 *   LAYERS   the four things that come into existence, plus the air the
 *            camera moves through. Levelled every frame from how fast they
 *            are CHANGING, so each one sounds while it forms or comes apart
 *            and is silent whenever it is static — at zero and at complete
 *            alike. See `activity` below; that function is the whole idea.
 *
 *   AMBIENCE the room and the distant campus. These genuinely are continuous,
 *            because a place does not stop existing when you stop moving.
 */

/**
 * Milestones, in the order the reader meets them.
 *
 * Each is a weight the scene already computes, at a point where something
 * visible has actually happened — not at an arbitrary scroll percentage.
 * `back` is where the mark re-arms, always well below `at`, so the two never
 * chatter against each other.
 */
const MARKS = [
  // 0 — seed. Something shifts, then it opens.
  { key: 'seedOpen', at: 0.18, back: 0.08, id: 'seed.stir' },
  { key: 'seedOpen', at: 0.8, back: 0.55, id: 'seed.open' },

  // 1 — growth. Only the roots are an event; the wood and the leaves are
  // formations, and they are levelled below rather than triggered here.
  { key: 'rootGrowth', at: 0.35, back: 0.18, id: 'grow.roots' },

  // Props arriving, as one phrase. Five artifact groups land in turn across
  // `artifactReveal`, so five pitches climbing a scale turn what would be five
  // identical thuds into something that goes somewhere.
  { key: 'artifactReveal', at: 0.1, back: 0.04, id: 'prop.tung', opts: { step: 0 } },
  { key: 'artifactReveal', at: 0.3, back: 0.2, id: 'prop.tung', opts: { step: 3 } },
  { key: 'artifactReveal', at: 0.5, back: 0.4, id: 'prop.tung', opts: { step: 7 } },
  { key: 'artifactReveal', at: 0.7, back: 0.6, id: 'prop.tung', opts: { step: 10 } },
  { key: 'artifactReveal', at: 0.9, back: 0.8, id: 'prop.tung', opts: { step: 12 } },

  // 2 — the disciplines resolve. The composition settling, once.
  { key: 'branchGrowth', at: 0.97, back: 0.85, id: 'disc.resolved' },

  // 3 — the museum opens out. Sub-stops are driven from React, not here.
  { key: 'museumProgress', at: 0.03, back: 0.01, id: 'museum.enter' },
  { key: 'museumProgress', at: 0.96, back: 0.8, id: 'museum.settle' },

  // 5 — the glimpse. One distant resonance, pitched up and quiet: a place,
  // not an announcement.
  { key: 'campusVisibility', at: 0.55, back: 0.3, id: 'glimpse.sense' },

  // 6 — the reveal. Air first as the canopy parts, the campus itself once it
  // is actually readable, and foliage passing the lens on the way through.
  { key: 'canopyClear', at: 0.12, back: 0.05, id: 'reveal.open' },
  { key: 'canopyClear', at: 0.45, back: 0.3, id: 'reveal.near' },
  { key: 'campusReveal', at: 0.5, back: 0.3, id: 'reveal.campus' },

  // 7 — and it settles.
  { key: 'finalProgress', at: 0.55, back: 0.35, id: 'future.settle' },
]

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

/**
 * How fast something is changing, in either direction, smoothed.
 *
 * THIS IS THE WHOLE IDEA BEHIND THE FORMATION LAYERS.
 *
 * A formation sounds while it is *happening* and is silent when it is not —
 * and "not happening" includes both ends: nothing has started, and it is
 * finished. So the level is the derivative of how much of the thing exists,
 * not the amount itself and not a floor under it.
 *
 * Three behaviours fall out of that for free, which is how you know it is the
 * right quantity rather than a clever one:
 *
 *   - stop scrolling mid-growth and the wood stops, because nothing is
 *     forming any more, even though a half-built tree is on screen
 *   - scroll faster and it gets louder, because more is forming per second
 *   - scroll backwards and it sounds again, because coming apart is also
 *     something happening. Hence the absolute value: an earlier version took
 *     only the rising direction, which left the whole page silent on the way
 *     back up even as the tree visibly un-built itself.
 *
 * The smoothing is a one-pole low pass with a ~170 ms time constant. Fast
 * enough that releasing the scrollbar goes quiet promptly, slow enough that
 * the per-frame jitter in a damped scroll value does not make it stutter.
 */
function activity(store, key, value, step) {
  const previous = store[key]
  store[key] = value
  if (previous === undefined || step <= 0) return store[`${key}:s`] ?? 0
  const delta = Math.abs(value - previous) / step
  const smoothedKey = `${key}:s`
  const was = store[smoothedKey] ?? 0
  const next = was + (delta - was) * Math.min(1, step * 6)
  store[smoothedKey] = next
  return next
}

/**
 * Rate, as a level. Saturating, so a fling is loud but not a wall.
 *
 * The per-layer scale is not a taste knob — it normalises for how much scroll
 * each weight is spread over. `leafReveal` runs 0 to 1 across ten per cent of
 * the page while the wood takes twenty-four, so at the same scroll speed the
 * leaves change nearly two and a half times faster and would sit pinned at
 * full while the wood was still finding its level. These numbers make one
 * turn of the wheel mean roughly the same loudness whichever thing it is
 * building.
 */
const asLevel = (rate, scale) => clamp01(rate * scale)

/** Spread of each weight over the scroll, inverted. See `asLevel`. */
const SCALE = { wood: 2.2, leaf: 1.0, campus: 1.3, grow: 1.7 }

function SceneAudio({ stage, covered = false }) {
  // One checker per weight, built once. Grouping by key means each frame does
  // a handful of numeric comparisons over a fixed array and touches nothing
  // else.
  const checks = useMemo(() => {
    const byKey = new Map()
    for (const mark of MARKS) {
      if (!byKey.has(mark.key)) byKey.set(mark.key, [])
      byKey.get(mark.key).push(mark)
    }
    return [...byKey.entries()].map(([key, marks]) => ({
      key,
      check: makeThresholds(marks),
    }))
  }, [])

  const beds = useRef({ growth: -1, distant: -1, wood: -1, leaf: -1, campus: -1 })
  const rates = useRef({})

  // Camera velocity, for the air. Position and rotation are tracked separately
  // because a slow dolly and a fast pan are different kinds of movement and
  // both should be heard.
  const cam = useRef({
    last: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    speed: 0,
    started: false,
  })

  /**
   * Silence, when there is nothing left to see.
   *
   * This is an effect rather than a line in the frame loop because the frame
   * loop is exactly what stops. The page stops rendering once the footer has
   * covered the stage, and every level below is written from inside `useFrame`
   * — so whatever was sounding at that moment simply stayed sounding, at the
   * gain it happened to have. Arrive at the footer mid-canopy and the leaves
   * kept forming, audibly, forever, over a page with no tree on it.
   *
   * Zeroing the rate stores as well as the gains matters: on the way back up
   * the first frame would otherwise see a delta measured against a value from
   * before the gap and report a formation that never happened. Same for the
   * camera, which would report one enormous lurch of air.
   */
  useEffect(() => {
    if (!covered) return undefined
    woodLevel(0)
    leafLevel(0)
    campusLevel(0)
    growthLevel(0)
    airLevel(0)
    distantLevel(0)
    beds.current = { growth: 0, distant: 0, wood: 0, leaf: 0, campus: 0 }
    rates.current = {}
    cam.current.started = false
    return undefined
  }, [covered])

  useFrame((state, delta) => {
    const s = stage.current
    if (!s) return
    if (covered) return
    const step = Math.min(delta, 0.1)

    for (let i = 0; i < checks.length; i += 1) {
      const value = s[checks[i].key]
      if (typeof value === 'number') checks[i].check(value)
    }

    /* ---- the four formations -----------------------------------------
     * Each layer is driven by how fast its thing is changing, not by how much
     * of it exists. Sound while it forms or comes apart; silence when it is
     * static, at either end.
     *
     * Each "amount" below is written so that it falls as well as rises, which
     * is what lets one number cover both directions: the canopy amount, for
     * instance, includes the thinning, so leaves sound while they fill in and
     * again while they clear.
     */

    // Wood. Trunk and branches together are the structure.
    const woodAmount = Math.min(1, s.trunkGrowth * 0.45 + s.branchGrowth * 0.55)
    const woodNow = asLevel(activity(rates.current, 'wood', woodAmount, step), SCALE.wood)
    if (Math.abs(woodNow - beds.current.wood) > 0.012) {
      beds.current.wood = woodNow
      woodLevel(woodNow)
    }

    // Leaves, including their thinning: the canopy clearing is the foliage
    // coming apart, and that is as much a change as it filling in.
    const leafAmount = s.leafReveal * (1 - s.canopyClear)
    const leafNow = asLevel(activity(rates.current, 'leaf', leafAmount, step), SCALE.leaf)
    if (Math.abs(leafNow - beds.current.leaf) > 0.012) {
      beds.current.leaf = leafNow
      leafLevel(leafNow)
    }

    // The college resolving out of the foliage, and un-resolving back into it.
    //
    // Averaged rather than maxed, and `campusVisibility` counts for as much as
    // `campusReveal`. That first weight is the campus physically materialising
    // inside the canopy at p≈0.66 — which is when it forms — and it used to be
    // scaled to a third, so the layer barely moved there and all the sound
    // arrived at p≈0.73 with the camera. That is the camera arriving, not the
    // building appearing, and it was the wrong moment. Under `max()` the two
    // could not both be heard at all: visibility reaches 1 first, so the
    // reveal that followed never raised the total and made no sound.
    //
    // The two weights are scaled by the scroll each is spread over, not summed
    // evenly: `campusVisibility` completes in about 3% of the page while
    // `campusReveal` takes 13%, so an even sum makes the first a spike and the
    // second a murmur. These make both read.
    const campusAmount = s.campusVisibility * 0.3 + s.campusReveal * 1.15
    const campusNow = asLevel(activity(rates.current, 'campus', campusAmount, step), SCALE.campus)
    if (Math.abs(campusNow - beds.current.campus) > 0.015) {
      beds.current.campus = campusNow
      campusLevel(campusNow)
    }

    // The tonal layer under the wood, on the same activity so the two start
    // and stop together rather than one droning under the other.
    const growNow = asLevel(activity(rates.current, 'grow', woodAmount, step), SCALE.grow)
    if (Math.abs(growNow - beds.current.growth) > 0.015) {
      beds.current.growth = growNow
      growthLevel(growNow)
    }

    /* ---- air, from the camera itself --------------------------------- */
    // Derived from what the camera is actually doing rather than from a
    // transition, so it cannot fire at the wrong moment: a still camera is
    // silent, a slow dolly is almost nothing, a flung scrollbar rushes.
    const camera = state.camera
    const c = cam.current
    if (!c.started) {
      c.last.copy(camera.position)
      c.quat.copy(camera.quaternion)
      c.started = true
    } else if (step > 0) {
      const moved = camera.position.distanceTo(c.last) / step
      // Radians per second, which at this scale is comparable to metres.
      const turned = (2 * Math.acos(Math.min(1, Math.abs(c.quat.dot(camera.quaternion))))) / step
      c.last.copy(camera.position)
      c.quat.copy(camera.quaternion)
      // Rotation is weighted up: a pan sweeps the whole frame while a dolly of
      // the same magnitude barely changes it.
      const raw = clamp01((moved / 9 + turned / 1.5) * 0.5)
      // Asymmetric smoothing — air arrives with the movement and falls away
      // behind it.
      c.speed = THREE.MathUtils.damp(c.speed, raw, raw > c.speed ? 9 : 3, step)
      airLevel(c.speed < 0.012 ? 0 : c.speed)
    }

    // The campus, heard before it is seen and then all around: faint while it
    // is only glimpsed through the foliage, full once the clearing is open.
    // Scaled by how much of the world is still on screen, so the place fades
    // out as the footer covers it rather than cutting when the loop stops.
    const near =
      Math.max(s.campusVisibility * 0.45, s.campusReveal) * (s.exposure ?? 1)
    if (Math.abs(near - beds.current.distant) > 0.02) {
      beds.current.distant = near
      distantLevel(near)
    }
  })

  return null
}

export default SceneAudio
