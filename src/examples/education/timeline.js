/**
 * The page's timeline: where the 3D story runs, and where it holds still while
 * an editorial section has the screen.
 *
 * THE PROBLEM THIS SOLVES
 *
 * The 3D journey is one continuous shot driven by a single 0..1. Wrapping
 * editorial sections around it could have been done two ways, and one of them
 * is wrong: letting the scroll keep driving the camera while an opaque
 * editorial surface covers it means the tree grows, the museum orbits and the
 * campus reveals with nobody watching. Choreography that expensive should not
 * play to an empty room.
 *
 * So document scroll is remapped into *story* progress through the table
 * below. A `story` segment advances the journey; a `hold` segment freezes it
 * at a value while an editorial section takes over. The camera, the chapter
 * system, `deriveStage` and the audio all keep consuming exactly the number
 * they always did and none of them know this exists — which is the point. The
 * remap is a pure function of scroll, so it inherits the property the whole
 * page is built on: scrolling backwards is correct by construction.
 *
 * `doc` is a fraction of the scroll track. `story` is the 0..1 the 3D reads.
 * Both run in order and each doc span picks up where the last left off.
 */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

/**
 * Every segment, in order.
 *
 * `id` is present on holds so the editorial layer can ask "how far through my
 * own section am I" without knowing anything about the rest of the timeline.
 *
 * The holds are placed where the story reaches a natural resting point: after
 * the tree has settled, after the branches have fanned out, after the museum
 * orbit completes, and after the campus has resolved. Each editorial section
 * therefore answers the chapter it follows rather than interrupting one.
 */
export const SEGMENTS = [
  { kind: 'story', doc: 0.09, from: 0.0, to: 0.1 },        // 01 seed
  { kind: 'hold', doc: 0.13, at: 0.1, id: 'intro' },       //    → the idea
  { kind: 'story', doc: 0.085, from: 0.1, to: 0.22 },      // 02 growth
  { kind: 'story', doc: 0.08, from: 0.22, to: 0.39 },      // 03 branches
  { kind: 'hold', doc: 0.175, at: 0.39, id: 'disciplines' }, // → five ways
  { kind: 'story', doc: 0.115, from: 0.39, to: 0.58 },     // 04 museum
  { kind: 'hold', doc: 0.16, at: 0.58, id: 'connection' }, //    → what connects
  { kind: 'story', doc: 0.06, from: 0.58, to: 0.68 },      // 05 connection
  { kind: 'story', doc: 0.06, from: 0.68, to: 0.77 },      // 06 glimpse
  { kind: 'story', doc: 0.085, from: 0.77, to: 0.9 },      // 07 reveal
  { kind: 'hold', doc: 0.17, at: 0.9, id: 'campus' },      //    → the place
  { kind: 'story', doc: 0.05, from: 0.9, to: 1.0 },        // 08 future
]

/* Normalised once: the doc column is written as weights so a segment can be
   retimed without rebalancing every other number by hand. */
const TOTAL = SEGMENTS.reduce((sum, s) => sum + s.doc, 0)

const SPANS = (() => {
  let at = 0
  return SEGMENTS.map((segment) => {
    const start = at
    const end = at + segment.doc / TOTAL
    at = end
    return { ...segment, start, end }
  })
})()

export const HOLDS = SPANS.filter((s) => s.kind === 'hold')

/** Document position (0..1 of the track) → the 0..1 the 3D story reads. */
export function storyProgress(doc) {
  const p = clamp01(doc)
  for (let i = 0; i < SPANS.length; i += 1) {
    const s = SPANS[i]
    if (p > s.end && i < SPANS.length - 1) continue
    if (s.kind === 'hold') return s.at
    const local = (p - s.start) / Math.max(s.end - s.start, 1e-6)
    return s.from + (s.to - s.from) * clamp01(local)
  }
  return 1
}

/**
 * How far through a given hold the reader is, 0..1, and -1 when it is not on
 * screen at all. The editorial sections animate from this rather than from
 * document progress, so each one's internal choreography is independent of
 * where it happens to sit in the timeline.
 *
 * NO BLEED. An earlier version let a hold begin before its segment and end
 * after it, so the sheet was still travelling while the *neighbouring* story
 * segment ran — the tree grew and the camera swung behind a surface that was
 * half way up. The whole point of a hold is that nothing else is moving, so
 * the hold now owns its own entrance and exit: the segments below are sized to
 * contain the rise, the reading and the fall, and everything outside them is
 * story that nothing is covering.
 */
export function holdProgress(doc, id) {
  const hold = HOLDS.find((h) => h.id === id)
  if (!hold) return -1
  if (doc < hold.start || doc > hold.end) return -1
  return clamp01((doc - hold.start) / Math.max(hold.end - hold.start, 1e-6))
}

/**
 * How much of the screen an editorial sheet is covering, 0..1, for a given
 * hold-local progress.
 *
 * This is the SAME curve the stylesheet uses for `--sheet`, and it has to be:
 * the 3D reads it to decide how far to stand back, and a camera that pulled
 * away on a different schedule from the surface that caused it would read as
 * two unrelated things happening at once. Defined here so there is one place
 * that knows when the sheet is moving.
 */
export const SHEET_RISE = 0.04
export const SHEET_FULL = 0.28
export const SHEET_FALL = 0.72
export const SHEET_GONE = 0.96

export function sheetCover(local) {
  if (local < 0) return 0
  return clamp01(
    Math.min(
      (local - SHEET_RISE) / (SHEET_FULL - SHEET_RISE),
      (SHEET_GONE - local) / (SHEET_GONE - SHEET_FALL),
    ),
  )
}

/** The inverse, for the navigation: story position → where to scroll. */
export function docForStory(story) {
  const target = clamp01(story)
  for (const s of SPANS) {
    if (s.kind === 'hold') continue
    if (target >= s.from && target <= s.to) {
      const local = (target - s.from) / Math.max(s.to - s.from, 1e-6)
      return s.start + (s.end - s.start) * local
    }
  }
  return target
}

export { clamp01 }
