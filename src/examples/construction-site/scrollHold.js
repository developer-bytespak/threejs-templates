/**
 * The page taking the wheel for the length of the excavation.
 *
 * The excavation is one event now, not five: crossing its trigger runs the
 * whole dig, five lifts back to back, on a clock of its own. That raises a
 * problem this page did not have before. The dig takes about four seconds, and
 * a reader who keeps scrolling can be four screens past it before the second
 * lift has let go — they would scroll through an excavation they never saw.
 *
 * So for those four seconds the page stops being scrolled and starts being
 * driven. Input is blocked, and the window is scrolled from the trigger to the
 * far side of the dig in step with the event clock. Everything downstream is
 * untouched by this: the scene still reads its progress out of the same scroll
 * listener it always did, so the camera, the lighting, the rim pegs, the audio
 * and the progress bar all stay in step with the earthwork without knowing
 * that the scrolling is no longer coming from a hand.
 *
 * Three rules keep it from being the kind of scroll-jacking that makes a page
 * feel broken:
 *
 *   it is bounded — the hold releases when the event does, and a watchdog
 *   releases it anyway if the clock driving it ever stops arriving
 *
 *   it is skippable — reduced motion never takes the wheel at all, and Escape
 *   hands it straight back
 *
 *   it ends where it should — the reader is left at the scroll offset the
 *   scene is already showing, so releasing changes nothing on screen
 */

/** Keys that scroll. Blocked while held; everything else still works. */
const SCROLL_KEYS = new Set([
  ' ', 'Spacebar', 'PageUp', 'PageDown', 'End', 'Home',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
])

/** If the driver stops calling `set`, let go rather than trapping the reader. */
const WATCHDOG = 1.2

export function createScrollHold(options = {}) {
  const onRelease = options.onRelease ?? null
  let active = false
  let from = 0
  let to = 0
  let last = 0
  let sinceSet = 0
  /** The offset we last asked for, so our own scrolling is not fought. */
  let want = 0

  const track = () => Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)

  const swallow = (event) => {
    if (!active) return
    if (event.cancelable) event.preventDefault()
  }
  const onKey = (event) => {
    if (!active) return
    if (event.key === 'Escape') { end(true); return }
    if (SCROLL_KEYS.has(event.key) && event.cancelable) event.preventDefault()
  }
  // A backstop for anything that scrolls the page without going through an
  // event we can cancel — a scrollbar drag, a middle-click autoscroll, a
  // browser restoring a position. Put back rather than prevented, because by
  // the time this fires the scroll has already happened.
  const onScroll = () => {
    if (!active) return
    if (Math.abs(window.scrollY - want) > 1) window.scrollTo(0, want)
  }

  function place(t) {
    want = Math.round((from + (to - from) * t) * track())
    window.scrollTo(0, want)
    // Say so, synchronously. The browser dispatches its own scroll event when
    // it gets round to it, which is some time after this frame has drawn — and
    // a frame in which the page has moved but the scene has not yet been told
    // is a frame in which the camera is a step behind the ground it is
    // watching. The listener costs two divisions; running it twice is cheaper
    // than being wrong once.
    dispatchEvent(new Event('scroll'))
  }

  function end(early = false) {
    if (!active) return
    active = false
    removeEventListener('wheel', swallow)
    removeEventListener('touchmove', swallow)
    removeEventListener('keydown', onKey)
    removeEventListener('scroll', onScroll)
    document.documentElement.style.scrollBehavior = ''
    if (onRelease) onRelease(early)
  }

  return {
    /** True while the page is being driven rather than scrolled. */
    active: () => active,

    /**
     * Take the wheel and travel from the reader's current position to `target`,
     * both as 0..1 of the scroll track.
     */
    begin(target) {
      if (active) { to = target; return }
      active = true
      from = window.scrollY / track()
      to = target
      want = window.scrollY
      sinceSet = 0
      // Smooth scrolling and per-frame programmatic scrolling do not mix: the
      // browser would still be easing towards last frame's offset when this
      // frame asks for the next one.
      document.documentElement.style.scrollBehavior = 'auto'
      addEventListener('wheel', swallow, { passive: false })
      addEventListener('touchmove', swallow, { passive: false })
      addEventListener('keydown', onKey)
      addEventListener('scroll', onScroll)
    },

    /** Where along the travel we are, 0..1. Called once a frame by the driver. */
    set(t, delta = 0) {
      if (!active) return
      sinceSet = 0
      place(t < 0 ? 0 : t > 1 ? 1 : t)
      last = delta
    },

    /** Called every frame whether held or not, so a stalled driver is noticed. */
    tick(delta) {
      if (!active) return
      sinceSet += delta
      if (sinceSet > WATCHDOG) end(true)
    },

    end,

    dispose() { end(true) },
  }
}
