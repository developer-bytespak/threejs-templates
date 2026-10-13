/**
 * Everything that scales with the device.
 *
 * This scene is heavier than an exploded diagram: two GLBs, roughly 140
 * objects, a shadow-casting sun over a 72 by 52 metre site, and a dissolve
 * that runs a discard in the fragment shader across the full aperture. The
 * knobs that actually decide frame rate are resolution, whether the sun casts
 * at all, and how large its map is — so those are what move between tiers.
 */
export function resolveQuality(width, coarsePointer) {
  if (width < 720) {
    return {
      tier: 'compact',
      maxDpr: 1.5,
      // A phone rendering the site twice per frame, once for the shadow map,
      // is the single thing most likely to drop it below 30fps. The lighting
      // is built so the scene still reads without it: the sun is low, so the
      // cut's own faces carry most of the depth cue on their own.
      shadows: false,
      shadowMap: 0,
      environment: 64,
      pointer: false,
    }
  }
  if (width < 1200) {
    return {
      tier: 'medium',
      maxDpr: 1.75,
      shadows: true,
      shadowMap: 1024,
      environment: 128,
      pointer: !coarsePointer,
    }
  }
  return {
    tier: 'full',
    maxDpr: 2,
    shadows: true,
    shadowMap: 2048,
    environment: 256,
    pointer: !coarsePointer,
  }
}

/**
 * Twelve empty stages, and a longer track.
 *
 * The excavation now owns three quarters of the page, and its four stages sit
 * 23% of the page apart. That gap has to be long enough that the transition
 * between two of them — about a second and a bit — finishes before the next
 * one starts, at an ordinary scrolling speed. At 1240vh a stage is nearly
 * three screens of scrolling, comfortably more than a second of wheel; at the
 * old 980 it was closer to two, and a brisk scroll could outrun the animation.
 *
 * The sections stay near one screen each, so the track reads as a page rather
 * than as a very long scrollbar.
 */
// Sixteen, not twelve: the columns needed a quarter of a page that did not
// exist, and the track grew rather than the earlier phases being squeezed.
// Each section is still 103vh, so every beat before the columns keeps the
// exact scroll distance it was composed with — see `prior()` in sequence.js.
export const STAGE_COUNT = 16
export const TRACK_VH = 1653
