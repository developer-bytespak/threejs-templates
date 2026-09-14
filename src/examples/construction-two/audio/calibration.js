/**
 * GENERATED — do not edit by hand.
 *
 *   node tools/calibrate_audio.mjs
 *
 * Per-sound gain corrections that make the `peak` figures in AudioManager's
 * mix table true at the speaker. Each one was measured by rendering that sound
 * offline through the real bus/master/compressor graph 10 times and taking the
 * median peak, because the voices randomise themselves and a single render is
 * not an answer.
 *
 * Regenerate after changing any voice's synthesis or any target level.
 */
export const CALIBRATION = {
  'hero.chapter': 0.4981,
  'hero.chapter.alt': 1.2468,
  'hero.camera': 0.5462,
  'hero.air': 1.7413,
  'card.place': 0.5000,
  'pen.down': 1.1608,
  'pen.stroke': 1.0072,
  'pen.corner': 2.2429,
  'build.foundation': 0.5767,
  'build.structure': 0.4846,
  'build.envelope': 0.3743,
  'build.completion': 1.7834,
  'piece.foundation': 0.5498,
  'piece.structure': 0.5582,
  'piece.envelope': 0.3824,
  'piece.completion': 2.3873,
  'piece.lift': 2.2455,
  'build.complete': 0.3423,
  'scroll.mark': 2.2593,
  'work.enter': 1.2004,
  'work.change': 1.6248,
  'work.change.body': 0.4520,
  'work.hover': 2.3106,
  'stat.resolve': 1.7524,
  'stat.hover': 2.2854,
  'process.plan': 1.0058,
  'process.coordinate': 1.6494,
  'process.build': 0.4912,
  'process.deliver': 0.3302,
  'draw.segment': 2.1926,
  'frame.datum': 2.1926,
  'frame.columns': 0.5049,
  'frame.beams': 0.5889,
  'frame.envelope': 0.3761,
  'frame.done': 0.3368,
  'plan.done': 0.3368,
  'ui.click': 1.7037,
  'ui.hover': 2.4285,
}

export const AMBIENCE_TRIM = 0.7280

export const ASSEMBLY_TRIM = 0.7853
