import * as THREE from 'three'

/**
 * The storyboard, with the camera and the content pulled apart.
 *
 * The old `shots.js` put a camera position and a block of copy in the same
 * object, and that shape decided how the page felt: every time the camera
 * moved, another caption had to appear, because the two were the same thing.
 * Nine stops meant nine captions whether the story wanted them or not.
 *
 * Here they are separate concerns:
 *
 *   CAMERA_KEYFRAMES   where the camera is, at what progress, and nothing else
 *   STORY_CHAPTERS     what the page is saying, over what span, in which mode
 *
 * There are more keyframes than chapters, which is the point — the camera can
 * travel through the desk approach and the footprint transition without either
 * one demanding a paragraph.
 *
 * All progress values are normalised 0..1 over the whole scroll track and are
 * deliberately uneven: the drawing and the build together own roughly half the
 * page, because that is the sequence this template exists to show.
 */

/**
 * Total scroll length. Deliberate, not a multiple of the shot count.
 *
 * Long on purpose. Every beat below is a fraction of this, so this one number
 * sets the pace of the whole page: at 1050 the camera crossed from the desk to
 * the sheet in about five wheel clicks, which read as a cut rather than a move.
 * The story wants room to breathe more than it wants to be short.
 */
export const TRACK_VH = 1680

// ---------------------------------------------------------------- the beats
// Named so the ranges below read as a sequence rather than as loose numbers.
export const DRAWING_BEGIN = 0.408
export const DRAWING_END = 0.612
export const RESOLVED_HOLD_END = 0.640
export const FOOTPRINT_HOLD_END = 0.668
export const BUILD_START = 0.668
export const BUILD_END = 0.862

/** Building.jsx reads this. Same contract as before — only the span moved. */
export const BUILD_RANGE = { start: BUILD_START, end: BUILD_END }

// ---------------------------------------------------------------- camera
/**
 * `aim` resolves against the measured object groups first, then the model's
 * anchor empties, so a keyframe can target `Building` or `Building_Spawn_Anchor`
 * and mean something real either way. `from` is an offset in metres from the
 * aim point; `lift` raises the aim point off the group's centre.
 *
 * Axes, Y-up: the pin-up wall is toward -Z, the window toward -X, the credenza
 * toward +X, and the open cutaway side is +Z.
 */
export const CAMERA_KEYFRAMES = [
  // wide establishing, from the open side
  { at: 0.000, aim: 'Floor', lift: 1.15, from: [2.00, 0.75, 3.15], fov: 40 },
  // in toward the desk
  { at: 0.120, aim: 'Desk', lift: 0.62, from: [1.25, 0.62, 2.10], fov: 44 },
  // the documentation wall fills the frame
  { at: 0.215, aim: 'Pinboard', lift: 0.00, from: [0.55, 0.15, 3.15], fov: 40 },
  // across to the window
  { at: 0.320, aim: 'Window', lift: -0.05, from: [3.15, 0.20, 1.35], fov: 46 },
  // over her shoulder onto the working surface
  { at: 0.400, aim: 'Anchor_Preconstruction_Desk', lift: -0.25, from: [0.62, 0.85, 1.75], fov: 42 },
  // down onto the sheet — the drawing plots from here
  { at: 0.480, aim: 'Drawing', lift: 0.02, from: [0.14, 0.84, 0.74], fov: 40 },
  // lower and closer as the footprint resolves
  { at: 0.635, aim: 'Building_Spawn_Anchor', lift: 0.02, from: [0.30, 0.52, 0.82], fov: 42 },
  // the build: lifted, and swung ~30 degrees round the model
  { at: 0.780, aim: 'Building', lift: 0.06, from: [-0.18, 0.76, 1.06], fov: 44 },
  // back out into the studio
  { at: 1.000, aim: 'Floor', lift: 1.30, from: [2.25, 0.95, 3.45], fov: 38 },
]

// ---------------------------------------------------------------- chapters
/**
 * Six chapters, each with its own presentation `mode`. The modes are the
 * reason this is not six of the same card: the page speaks through a pinned
 * working paper, then through labels on the wall itself, then through three
 * words and a lot of silence, then barely at all.
 *
 * Weights follow the pacing brief: drawing and build together take half.
 */
export const STORY_CHAPTERS = [
  {
    id: 'preconstruction',
    index: 1,
    from: 0.000,
    to: 0.120,
    mode: 'paper',
    label: 'Preconstruction',
    headline: ['Built before', "it's built."],
    meta: ['Preconstruction', 'Planning', 'Delivery'],
    paper: {
      tag: 'Preconstruction / 01',
      lead: ['Scope,', 'defined.'],
      items: ['Cost', 'Programme', 'Logistics', 'Delivery'],
    },
  },
  {
    id: 'coordination',
    index: 2,
    from: 0.120,
    to: 0.270,
    mode: 'annotations',
    label: 'Coordination',
    headline: ['Every detail', 'coordinated.'],
    meta: ['Coordination'],
  },
  {
    id: 'context',
    index: 3,
    from: 0.270,
    to: 0.370,
    mode: 'context',
    label: 'Context',
    headline: ['Built for the', 'real world.'],
    words: ['Site.', 'Scale.', 'City.'],
  },
  {
    id: 'documentation',
    index: 4,
    from: 0.370,
    to: 0.620,
    mode: 'quiet',
    label: 'Documentation',
    headline: ['Drawn', 'to build.'],
    meta: ['04 / Documentation'],
  },
  {
    id: 'build',
    index: 5,
    from: 0.620,
    to: 0.870,
    mode: 'build',
    label: 'Build',
    headline: ['Plan to', 'structure.'],
    poles: ['Plan', 'Structure'],
  },
  {
    id: 'built-work',
    index: 6,
    from: 0.870,
    to: 1.000,
    mode: 'final',
    label: 'Built work',
    headline: ['Built to', 'perform.'],
    sectors: ['Commercial', 'Industrial', 'Mixed-use', 'Hospitality'],
    actions: [
      { label: 'View projects', href: '#projects' },
      { label: 'Start a project', href: '#contact' },
    ],
  },
]

// ---------------------------------------------------------------- drawing
/**
 * The seven drawing stages, in the order a project actually resolves. The
 * `stage` numbers are the ones the Blender pass wrote into glTF extras — this
 * table only decides *when* each one plots, never what it is.
 *
 * Windows overlap by design: the perimeter starts before the grid has finished,
 * so the sheet fills continuously instead of in seven visible steps.
 */
const STAGE_COUNT = 7
const STAGE_SPAN = DRAWING_END - DRAWING_BEGIN
const STAGE_DURATION = STAGE_SPAN * 0.26
const STAGE_STAGGER = (STAGE_SPAN - STAGE_DURATION) / (STAGE_COUNT - 1)

export const DRAWING_STAGES = [
  { stage: 1, key: 'grid', label: 'Registration' },
  { stage: 2, key: 'perimeter', label: 'Perimeter' },
  { stage: 3, key: 'structure', label: 'Structure' },
  { stage: 4, key: 'core', label: 'Core' },
  { stage: 5, key: 'dimensions', label: 'Dimensions' },
  { stage: 6, key: 'annotations', label: 'Annotation' },
  { stage: 7, key: 'footprint', label: 'Footprint' },
].map((s, i) => ({
  ...s,
  from: DRAWING_BEGIN + i * STAGE_STAGGER,
  to: DRAWING_BEGIN + i * STAGE_STAGGER + STAGE_DURATION,
}))

// ---------------------------------------------------------------- phases
/**
 * Delivery phases. The model exports `phase` and `phase_index` on every piece,
 * so this table is a fallback and a label source — not the source of truth.
 * `orderFallback` is only consulted if a GLB ever turns up without the extras.
 */
export const BUILD_PHASES = [
  { index: 0, key: 'foundation', label: 'Foundation', orderFallback: [1, 2] },
  { index: 1, key: 'structure', label: 'Structure', orderFallback: [3, 5, 7, 9, 11] },
  { index: 2, key: 'envelope', label: 'Envelope', orderFallback: [4, 6, 8, 10] },
  { index: 3, key: 'completion', label: 'Completion', orderFallback: [12, 13] },
]

export function phaseFromPiece(userData) {
  if (typeof userData?.phase_index === 'number') return userData.phase_index
  if (typeof userData?.phase === 'string') {
    const hit = BUILD_PHASES.find((p) => p.key === userData.phase)
    if (hit) return hit.index
  }
  const order = Number(userData?.order)
  const guess = BUILD_PHASES.find((p) => p.orderFallback.includes(order))
  return guess ? guess.index : 0
}

// ---------------------------------------------------------------- helpers
export function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** 0 before `from`, 1 after `to`, linear between. */
export function span(progress, from, to) {
  return clamp01((progress - from) / Math.max(to - from, 1e-6))
}

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function chapterAt(progress) {
  const p = clamp01(progress)
  for (let i = STORY_CHAPTERS.length - 1; i >= 0; i -= 1) {
    if (p >= STORY_CHAPTERS[i].from) return STORY_CHAPTERS[i]
  }
  return STORY_CHAPTERS[0]
}

/** Where inside its own chapter the page currently is, 0..1. */
export function chapterProgress(progress, chapter) {
  return span(progress, chapter.from, chapter.to)
}

/**
 * Turns the keyframes into world-space camera poses.
 *
 * `focus` is the measured group map and `anchors` the model's empties; an aim
 * that matches neither falls back to the room centre and warns, so a renamed
 * node degrades to a wide shot instead of throwing.
 */
export function resolveKeyframes(focus, anchors, bounds) {
  const floor = focus.get('Floor')
  const fallback = floor ? floor.centre : new THREE.Vector3(0, 1.2, 0)

  return CAMERA_KEYFRAMES.map((key) => {
    const group = focus.get(key.aim)
    const anchor = anchors?.get(key.aim)
    const target = group?.centre ?? anchor?.position

    if (!target && import.meta.env.DEV) {
      console.warn(
        `[story] keyframe at ${key.at} aims at "${key.aim}", which is neither a`,
        'measured group nor a model anchor. Falling back to the room centre.',
      )
    }

    const lookAt = (target ?? fallback).clone()
    lookAt.y += key.lift ?? 0
    if (key.nudge) lookAt.add(new THREE.Vector3(...key.nudge))

    const position = lookAt.clone().add(new THREE.Vector3(...key.from))

    if (bounds && import.meta.env.DEV && !bounds.containsPoint(position)) {
      console.warn(
        `[story] keyframe at ${key.at} puts the camera outside the room at`,
        position.toArray().map((v) => v.toFixed(2)).join(', '),
      )
    }

    return { ...key, lookAt, position }
  })
}
