import { STAGE_RANGES } from './stages.js'

/**
 * Everything that scales with the device. Particle count, arc count and the
 * DPR cap are the three knobs that actually decide frame rate here.
 */
export function resolveQuality(width, coarsePointer) {
  if (width < 720) {
    return {
      tier: 'compact',
      particles: 8500,
      nodes: 96,
      transactionArcs: 10,
      globeArcs: 8,
      arcSamples: 24,
      pulsesPerArc: 1,
      pointSize: 0.034,
      maxDpr: 1.5,
      pointerPush: false,
    }
  }
  if (width < 1200) {
    return {
      tier: 'medium',
      particles: 11000,
      nodes: 120,
      transactionArcs: 16,
      globeArcs: 12,
      arcSamples: 30,
      pulsesPerArc: 2,
      pointSize: 0.023,
      maxDpr: 1.75,
      pointerPush: !coarsePointer,
    }
  }
  return {
    tier: 'full',
    particles: 18000,
    nodes: 150,
    transactionArcs: 24,
    globeArcs: 18,
    arcSamples: 36,
    pulsesPerArc: 2,
    pointSize: 0.021,
    maxDpr: 2,
    pointerPush: !coarsePointer,
  }
}

/**
 * How far the subject may sit from centre frame, as a fraction of the
 * half-frame. These are magnitudes only — each camera keyframe supplies the
 * signed direction, so the subject swings away from whichever side the copy
 * occupies in that section.
 *
 * Narrow screens cannot afford a side-by-side split at all, so the horizontal
 * range collapses to zero and the subject simply lifts above the copy.
 */
export function resolveComposition(width) {
  if (width >= 1180) return { x: 0.34, y: 0.3, yBase: 0 }
  if (width >= 820) return { x: 0.16, y: 0.18, yBase: 0.1 }
  return { x: 0, y: 0, yBase: 0.3 }
}

/**
 * Section heights follow their share of the scroll timeline, so a section's
 * copy is on screen for exactly the stretch its visual state occupies.
 */
export const SECTION_SPANS = Object.values(STAGE_RANGES).map(([a, b]) => b - a)
export const TRACK_VH = 800
