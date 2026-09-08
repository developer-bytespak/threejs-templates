import * as THREE from 'three'

/**
 * The storyboard. Each shot aims at an object group measured from the model
 * (see useRoomModel) and places the camera at `from`, an offset in metres
 * relative to that aim point. `lift` raises the aim point off the group's
 * centre; `nudge` slides it in world space when a group's centre is not the
 * part worth looking at.
 *
 * Axes, Y-up: the pinboard wall is toward -Z, the window is toward -X, the
 * credenza toward +X. She sits facing -Z, so a camera over her shoulder has
 * positive Z in its offset.
 *
 * Keeping every camera inside the room's roughly 5.0 x 2.9 x 7.0 shell is the
 * one hard constraint: the walls are single-sided, so a camera outside sees
 * nothing at all. resolveShots warns in dev when a shot breaks out.
 */
export const SHOTS = [
  {
    id: 'arrival',
    eyebrow: '01 — Arrival',
    title: 'Late in the afternoon',
    body: 'One window, one desk, and light coming in at the angle that means the day is nearly over.',
    aim: 'Floor',
    lift: 1.35,
    from: [1.6, 0.5, 2.6],
    fov: 52,
  },
  {
    id: 'desk',
    eyebrow: '02 — The desk',
    title: 'Still working',
    body: 'Both forearms on the surface, pen within reach, the page angled to catch what light there is.',
    // Matches the Blender camera exactly: this offset is that camera's
    // position minus the figure's centre, so lift has to stay at zero.
    aim: 'Figure',
    lift: 0,
    from: [0.72, 0.75, 1.52],
    fov: 34,
  },
  {
    id: 'pinboard',
    eyebrow: '03 — The wall',
    title: 'Everything pinned up',
    body: 'Seventeen sheets, a few tacks, and the sun cutting a hard wedge across all of it.',
    aim: 'Pinboard',
    lift: -0.1,
    from: [0.35, 0.05, 3.15],
    fov: 38,
  },
  {
    id: 'window',
    eyebrow: '04 — The window',
    title: 'The city, flattened',
    body: 'Rooftops reduced to shapes, a spire, three clouds that have not moved all afternoon.',
    // Nearly head-on: the glazing faces +X, so keeping the z offset small
    // stops the camera seeing past the edge of the sky card behind it.
    aim: 'Window',
    lift: 0,
    from: [2.35, 0.12, 0.55],
    fov: 40,
  },
  {
    id: 'desktop',
    eyebrow: '05 — The page',
    title: 'Where the work is',
    body: 'Loose sheets, a notebook shut on top of itself, a pen set down mid-thought.',
    aim: 'Desktop',
    lift: 0.05,
    from: [0.55, 0.75, 1.35],
    fov: 34,
  },
  {
    id: 'model',
    eyebrow: '06 — The model',
    title: 'What it will be',
    body: 'Thirteen pieces of card, stacked and set back, standing in for something not built yet.',
    aim: 'Building',
    lift: 0.02,
    // Steep, but not straight down: a dead-vertical camera has no stable
    // right-vector, and the silhouette of the setbacks is worth keeping.
    from: [0.26, 0.6, 0.46],
    fov: 42,
  },
  {
    id: 'credenza',
    eyebrow: '06 — The credenza',
    title: 'Filed and forgotten',
    body: 'Three trays, a stack that never made it into them, and shapes arranged by someone with a system.',
    // The group box is dominated by the tall back panel, so its centre sits
    // well above the trays and stacks worth looking at — hence the drop.
    aim: 'Credenza',
    lift: -0.15,
    from: [-1.6, 0.4, 1.9],
    fov: 45,
  },
  {
    // The plant reads as blue-on-blue from every angle — it sits on the
    // shadow side and both its palette colours are dark — so this beat looks
    // at the chair instead, which catches the window light side-on.
    id: 'chair',
    eyebrow: '07 — The seat',
    title: 'Turned away',
    body: 'Cream vinyl on a steel stem, back turned to the room. She has not moved from it in a while.',
    aim: 'Chair',
    lift: 0.3,
    from: [1.5, 0.35, 0.4],
    fov: 42,
  },
  {
    id: 'departure',
    eyebrow: '08 — Departure',
    title: 'Leave it running',
    body: 'The light will go before she does. Close the door on the way out.',
    aim: 'Floor',
    lift: 1.5,
    from: [1.9, 0.7, 2.9],
    fov: 56,
  },
]

/**
 * When the model assembles, expressed in the same 0..1 scroll progress the
 * camera runs on. It is derived from where the 'model' shot sits in the
 * storyboard rather than hard-coded, so reordering the shots moves the build
 * along with its camera. The range ends just before the shot settles, so the
 * last piece lands as the camera arrives rather than after it.
 */
const MODEL_INDEX = SHOTS.findIndex((shot) => shot.id === 'model')
const SEGMENT = 1 / (SHOTS.length - 1)

export const BUILD_RANGE = {
  start: (MODEL_INDEX - 0.9) * SEGMENT,
  end: (MODEL_INDEX - 0.04) * SEGMENT,
}

/**
 * Turns the storyboard into world-space camera keyframes using the measured
 * focus points. Unknown group names fall back to the room centre rather than
 * throwing, so a renamed object degrades to a wide shot instead of a crash.
 *
 * `bounds` is optional; when passed, dev builds warn about any camera that
 * ends up outside the shell, which renders as an empty frame.
 */
export function resolveShots(focus, bounds) {
  const floor = focus.get('Floor')
  const fallback = floor ? floor.centre : new THREE.Vector3(0, 1.2, 0)

  return SHOTS.map((shot) => {
    const group = focus.get(shot.aim)
    if (!group && import.meta.env.DEV) {
      console.warn(`Shot "${shot.id}" aims at unknown group "${shot.aim}"`)
    }

    const lookAt = (group ? group.centre : fallback).clone()
    lookAt.y += shot.lift ?? 0
    if (shot.nudge) lookAt.add(new THREE.Vector3(...shot.nudge))

    const position = lookAt.clone().add(new THREE.Vector3(...shot.from))

    if (bounds && import.meta.env.DEV && !bounds.containsPoint(position)) {
      console.warn(
        `Shot "${shot.id}" puts the camera outside the room at`,
        position.toArray().map((v) => v.toFixed(2)).join(', '),
      )
    }

    if (import.meta.env.DEV) {
      console.info(
        `[shot] ${shot.id.padEnd(10)} aim ${lookAt.toArray().map((v) => v.toFixed(2)).join(', ')}`,
        `| eye ${position.toArray().map((v) => v.toFixed(2)).join(', ')}`,
      )
    }

    return { ...shot, lookAt, position }
  })
}
