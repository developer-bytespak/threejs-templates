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
 * Total scroll length of the experience. Every visual state is a function of
 * where the page is inside this track, so the number here is the only thing
 * deciding how much scrolling each act gets.
 */
export const TRACK_VH = 800
