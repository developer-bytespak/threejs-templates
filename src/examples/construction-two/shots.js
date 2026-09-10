import * as THREE from 'three'

/**
 * The storyboard. Each shot aims at an object group measured from the model
 * (see useRoomModel) and places the camera at `from`, an offset in metres
 * relative to that aim point. `lift` raises the aim point off the group's
 * centre; `nudge` slides it in world space when a group's centre is not the
 * part worth looking at.
 *
 * Axes, Y-up: the pin-up wall is toward -Z, the window toward -X, the credenza
 * toward +X. She sits facing -Z, so a camera over her shoulder has positive Z
 * in its offset. The studio is a cutaway — the +Z side is open — so the camera
 * has room to establish and depart without breaking through a wall.
 *
 * Shell is roughly 7.0 x 3.6 x 7.8. resolveShots warns in dev about any camera
 * that leaves it.
 */
export const SHOTS = [
  {
    id: 'arrival',
    eyebrow: '01 — Arrival',
    title: 'Late in the afternoon',
    body: 'One window, one long desk, and light coming in at the angle that means the day is nearly over.',
    aim: 'Floor',
    lift: 1.35,
    from: [1.70, 0.55, 2.70],
    fov: 52,
  },
  {
    id: 'desk',
    eyebrow: '02 — The desk',
    title: 'Still working',
    body: 'Both forearms on the walnut, pencil set down, the sheet angled to catch what light is left.',
    aim: 'Figure',
    lift: 0.42,
    from: [1.05, 0.92, 2.10],
    fov: 38,
  },
  {
    id: 'pinboard',
    eyebrow: '03 — The wall',
    title: 'Everything pinned up',
    body: 'Plans, elevations, one section, a stack of axonometrics. The whole project, flattened and tacked.',
    // Pulled back past her shoulder: she reads as foreground, the desk as
    // midground, the board fills the frame behind both.
    aim: 'Pinboard',
    lift: -0.05,
    from: [0.30, 0.10, 4.55],
    fov: 55,
  },
  {
    id: 'window',
    eyebrow: '04 — The window',
    title: 'The city, flattened',
    body: 'Four panes of dark steel, and a skyline reduced to three planes of grey.',
    aim: 'Window',
    lift: -0.15,
    from: [3.05, 0.30, 1.60],
    fov: 46,
  },
  {
    id: 'desktop',
    eyebrow: '05 — The page',
    title: 'Where the work is',
    body: 'A plan under tracing paper, a scale rule, four material samples squared off at the edge.',
    aim: 'Desktop',
    lift: 0.10,
    from: [0.62, 0.92, 1.72],
    fov: 36,
  },
  {
    id: 'model',
    eyebrow: '06 — The model',
    title: 'What it will be',
    body: 'Thirteen pieces of card and frosted acrylic — a podium, four floor plates, an exposed core.',
    aim: 'Building',
    lift: 0.04,
    // Steep, but not straight down: a dead-vertical camera has no stable
    // right-vector, and the cantilevers are worth keeping in silhouette.
    from: [0.46, 0.74, 0.82],
    fov: 40,
  },
  {
    id: 'credenza',
    eyebrow: '07 — The library',
    title: 'Filed and forgotten',
    body: 'Nine spines, two sample boxes, three rolled sets, and one older model nobody has thrown out.',
    aim: 'Credenza',
    lift: 0.16,
    from: [-2.30, 0.62, 1.60],
    fov: 48,
  },
  {
    id: 'chair',
    eyebrow: '08 — The seat',
    title: 'Turned away',
    body: 'A slim back on a steel pedestal, turned toward the work. She has not moved from it in a while.',
    aim: 'Chair',
    lift: 0.34,
    from: [1.80, 0.58, 1.20],
    fov: 44,
  },
  {
    id: 'departure',
    eyebrow: '09 — Departure',
    title: 'Leave it running',
    body: 'The light will go before she does. Close the door on the way out.',
    aim: 'Floor',
    lift: 1.55,
    from: [2.00, 0.80, 3.05],
    fov: 56,
  },
]

/**
 * When the model assembles, expressed in the same 0..1 scroll progress the
 * camera runs on. Derived from where the 'model' shot sits in the storyboard
 * rather than hard-coded, so reordering the shots moves the build with its
 * camera. The range ends just before the shot settles, so the last piece lands
 * as the camera arrives rather than after it.
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
