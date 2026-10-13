import { useEffect } from 'react'
import { initAudio, sound } from './AudioManager.js'

/** Reads the environment and the stored preference. Constructs nothing. */
export function useAudioInit() {
  useEffect(() => {
    initAudio()
  }, [])
}

/**
 * Forward-only thresholds with hysteresis.
 *
 * The page is one continuous scroll the reader can run in both directions,
 * and the scene is built so that reversing is correct by construction. Audio
 * has to respect that without becoming a machine gun: a mark fires when the
 * value crosses `at` going up, and re-arms only once the value has fallen
 * back below `back`. Parking the scrollbar exactly on a boundary and jiggling
 * it therefore produces one sound, not forty.
 *
 * Reversing re-arms silently on purpose. Scrolling back up should put the
 * sounds back, not replay the page's events backwards.
 */
export function makeThresholds(marks, emit = sound) {
  const armed = marks.map(() => true)
  return function check(value) {
    for (let i = 0; i < marks.length; i += 1) {
      const mark = marks[i]
      if (armed[i] && value >= mark.at) {
        armed[i] = false
        emit(mark.id, mark.opts)
      } else if (!armed[i] && value < (mark.back ?? mark.at - 0.06)) {
        armed[i] = true
      }
    }
  }
}

/**
 * Fire once for each new item in a count that goes up and down.
 *
 * Twelve stakes and twelve lines arrive one at a time, and the scene already
 * knows how many are in — it drives them. Watching that count is better than
 * re-deriving each item's own threshold here: the sound cannot disagree with
 * the picture, because it is triggered by the number that drew it.
 *
 * Going back down is silent, for the same reason the thresholds are.
 */
export function makeCounter(emit) {
  let seen = -1
  return function check(count) {
    if (seen < 0) { seen = count; return }
    if (count > seen) {
      const fires = Math.min(count - seen, 3)
      for (let i = 0; i < fires; i += 1) emit()
    }
    seen = count
  }
}

export { sound }
