/**
 * Everything that scales with the device.
 *
 * The model is small (9,312 triangles, no textures), so the knobs that
 * actually decide frame rate here are resolution, shadow map size and whether
 * the glazing uses transmission — which costs an extra scene render per frame.
 */
export function resolveQuality(width, coarsePointer) {
  if (width < 720) {
    return {
      tier: 'compact',
      maxDpr: 1.5,
      shadows: false,
      shadowMap: 0,
      contactShadow: 256,
      contactFrames: 1,
      transmission: false,
      environment: 64,
      // Phones see the composition on a narrow, tall frame. Drawing the
      // systems closer together keeps the whole exploded diagram on screen
      // instead of running off the top of it.
      explodeScale: 0.68,
      pointer: false,
      hover: false,
    }
  }
  if (width < 1200) {
    return {
      tier: 'medium',
      maxDpr: 1.75,
      shadows: true,
      shadowMap: 1024,
      contactShadow: 512,
      contactFrames: Infinity,
      transmission: false,
      environment: 128,
      explodeScale: 0.85,
      pointer: !coarsePointer,
      hover: !coarsePointer,
    }
  }
  return {
    tier: 'full',
    maxDpr: 2,
    shadows: true,
    shadowMap: 2048,
    contactShadow: 512,
    contactFrames: Infinity,
    transmission: true,
    environment: 256,
    explodeScale: 1,
    pointer: !coarsePointer,
    hover: !coarsePointer,
  }
}

/**
 * Eight empty stages give the choreography room to breathe without the page
 * feeling like a chore to scroll. Content can be dropped into any of them
 * later without touching a line of the WebGL.
 */
export const STAGE_COUNT = 8
export const TRACK_VH = 760
