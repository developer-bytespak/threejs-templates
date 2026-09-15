import { useEffect, useRef } from 'react'
import { initAudio, sound } from './AudioManager.js'

/** Reads the environment and the stored preference. Constructs nothing. */
export function useAudioInit() {
  useEffect(() => {
    initAudio()
  }, [])
}

/**
 * Play something when a value changes — and never on the first render.
 *
 * Without the skip, every chapter-driven sound announces itself the instant
 * React first renders the page, which on a route whose chapter is derived from
 * restored scroll position means a handful of sounds firing at once before
 * anyone has moved.
 */
export function useSoundOnChange(value, fn) {
  const previous = useRef(value)
  const first = useRef(true)
  useEffect(() => {
    const was = previous.current
    previous.current = value
    if (first.current) {
      first.current = false
      return
    }
    if (was !== value) fn(value, was)
  }, [value, fn])
}

/**
 * Forward-only thresholds with hysteresis.
 *
 * The page is one continuous scroll that the reader can run in both
 * directions, and the scene is designed so that reversing is correct by
 * construction. Audio has to respect that without becoming a machine gun: a
 * mark fires when the value crosses `at` going up, and re-arms only once the
 * value has fallen back below `back`. Parking the scrollbar exactly on a
 * boundary and jiggling it therefore produces one sound, not forty.
 *
 * Marks are evaluated against the same damped progress the visuals use, so a
 * scrollbar thrown from 0 to 1 passes every intermediate mark in a frame or
 * two. That is what `cooldown` on each id is for: the crossings all happen,
 * and the mix collapses them into the one or two that still make sense.
 */
export function makeThresholds(marks, emit = sound) {
  const armed = marks.map(() => true)
  return function check(value) {
    for (let i = 0; i < marks.length; i += 1) {
      const mark = marks[i]
      if (armed[i] && value >= mark.at) {
        armed[i] = false
        emit(mark.id, mark.opts)
      } else if (!armed[i] && value < (mark.back ?? mark.at - 0.08)) {
        armed[i] = true
      }
    }
  }
}
