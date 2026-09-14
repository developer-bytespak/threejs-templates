import { useCallback, useEffect, useRef } from 'react'
import { initAudio, sound, teardownAudio } from './AudioManager.js'

/**
 * The React surface of the audio layer.
 *
 * Three of these four hooks exist to solve the same problem in different
 * shapes: turning a value that changes continuously into an event that fires
 * once. Scroll progress is a number that moves every frame; a section becoming
 * active is a boolean that flickers at the boundary; a node index counts up
 * and, when the user scrolls back, down again. None of those are things you
 * can hand straight to a sound without getting a machine-gun.
 */

/**
 * Arm the audio system. Mounted once by the route.
 *
 * Deliberately does not create an AudioContext — it only attaches the gesture
 * listeners that will. See AudioManager for why nothing is queued in the
 * meantime.
 */
export function useAudioInit() {
  useEffect(() => {
    initAudio()
    return () => teardownAudio()
  }, [])
}

/**
 * Every hover and click sound on the page, from one listener.
 *
 * The alternative is an onClick and an onPointerEnter threaded through the
 * navbar, the footer, four project frames, four statistics and both calls to
 * action — a dozen components edited to add a sound, and a dozen places for
 * the sound to be forgotten when one of them is refactored. Delegation keeps
 * the entire interaction layer in this file, and means the visual components
 * were not touched at all.
 *
 * `pointerover` bubbles, so moving between the children of one target would
 * fire repeatedly; matching the ancestor and comparing it to the last one is
 * what makes it fire only on entering a new target, as the brief asks.
 */
const HOVER_TARGETS = [
  ['.c2stat', 'stat.hover'],
  ['.c2work__frame', 'work.hover'],
  ['.c2film__frame', 'work.hover'],
  [
    '.c2nav__cta, .c2cta__primary, .c2cta__secondary, .c2nav__links button,' +
    '.c2menu__list button, .c2foot__col a, .c2foot__col button, .c2work__view',
    'ui.hover',
  ],
]

export function useAudioDelegates(rootRef) {
  useEffect(() => {
    const root = rootRef?.current
    if (!root) return undefined

    const onClick = (event) => {
      const el = event.target.closest?.('a[href], button')
      if (el && root.contains(el)) sound('ui.click')
    }

    // A pointer that cannot hover has nothing to report, and on a touch device
    // pointerover fires on tap — which would double up with the click.
    const fine =
      typeof matchMedia !== 'function' || !matchMedia('(hover: none)').matches

    let lastTarget = null
    const onOver = (event) => {
      for (const [selector, id] of HOVER_TARGETS) {
        const el = event.target.closest?.(selector)
        if (!el) continue
        if (el === lastTarget) return
        lastTarget = el
        sound(id)
        return
      }
      lastTarget = null
    }

    root.addEventListener('click', onClick)
    if (fine) root.addEventListener('pointerover', onOver)
    return () => {
      root.removeEventListener('click', onClick)
      root.removeEventListener('pointerover', onOver)
    }
  }, [rootRef])
}

/**
 * Fire when a value changes, never on the first render.
 *
 * That exclusion is the whole point: mounting is not an event. Without it,
 * every section announces itself the instant React first renders it, which on
 * a page of eight scroll-linked sections is eight sounds at once before the
 * user has done anything.
 */
export function useSoundOnChange(value, handler) {
  const seen = useRef(false)
  const prev = useRef(value)
  const fn = useRef(handler)
  fn.current = handler

  useEffect(() => {
    if (!seen.current) {
      seen.current = true
      prev.current = value
      return
    }
    if (value === prev.current) return
    const was = prev.current
    prev.current = value
    fn.current?.(value, was)
  }, [value])
}

/**
 * Turn a 0..1 progress value into one-shot events at named marks.
 *
 * Returns a function to call with progress — from a scroll tick, a frame loop,
 * anywhere. It fires a mark only when progress crosses it going forward, and
 * arms it again once progress has fallen a little way back below it. The
 * hysteresis is what stops a value sitting exactly on a threshold, jittering
 * by a thousandth, from firing forty times a second.
 *
 * Scrolling back up deliberately re-arms without firing: reversing should not
 * replay the section's sounds in reverse, it should just put them back.
 */
export function useThresholds(marks, handler, { hysteresis = 0.02 } = {}) {
  const armed = useRef(marks.map(() => true))
  const fn = useRef(handler)
  fn.current = handler

  return useCallback(
    (p) => {
      for (let i = 0; i < marks.length; i += 1) {
        const at = marks[i]
        if (armed.current[i] && p >= at) {
          armed.current[i] = false
          fn.current?.(i, at)
        } else if (!armed.current[i] && p < at - hysteresis) {
          armed.current[i] = true
        }
      }
    },
    [marks, hysteresis],
  )
}

export { sound }
