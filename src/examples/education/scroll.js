import { useEffect, useRef } from 'react'
import Lenis from 'lenis'

/**
 * The page's smoothing, and the one loop that reads scroll.
 *
 * WHY THIS IS A MODULE AND NOT A HOOK CALL IN THE ROUTE
 *
 * This page already has exactly one place that turns scroll into everything
 * else: the reader in EducationExperience, which writes story progress into a
 * ref, a handful of custom properties onto the DOM, and nothing else. Adding
 * Lenis must not add a second engine alongside that. So there is one
 * requestAnimationFrame here and it does two things in order:
 *
 *   1. advances Lenis — created with `autoRaf: false` precisely so it does not
 *      start a loop of its own
 *   2. runs the registered readers, which therefore see the position Lenis
 *      just moved to, in the same frame it moved to it
 *
 * The order matters. Reading on the native `scroll` event instead would put
 * every derived value one frame behind the page, which on a smoothed page is
 * visible: the sheet and the camera would trail the scrollbar.
 *
 * While Lenis is mounted the loop runs continuously, and it has to. Lenis owns
 * the wheel — it preventDefaults, stores a target, and moves nothing until
 * someone calls `raf()`. If the loop were only woken by scroll events the page
 * would deadlock: wheel fires, nothing moves, no scroll event, nothing wakes
 * the loop, nothing ever calls `raf()`.
 *
 * Under prefers-reduced-motion no instance is created at all. The page scrolls
 * natively, real scroll events arrive, and the loop goes back to being woken
 * by them and sleeping in between — which costs nothing on a page at rest.
 */

const readers = new Set()

let lenis = null
let frame = 0
let bound = false

function tick(now) {
  frame = 0
  if (lenis) lenis.raf(now)
  for (const read of readers) read()
  if (lenis) request()
}

function request() {
  if (!frame) frame = requestAnimationFrame(tick)
}

function bind() {
  if (bound) return
  bound = true
  addEventListener('scroll', request, { passive: true })
  addEventListener('resize', request)
}

function unbind() {
  if (!bound || readers.size) return
  bound = false
  removeEventListener('scroll', request)
  removeEventListener('resize', request)
  // Never cancel the frame out from under a live Lenis: it is the only thing
  // moving the page, and stopping it would leave the document frozen.
  if (frame && !lenis) {
    cancelAnimationFrame(frame)
    frame = 0
  }
}

/**
 * Mount the smoothing. Light on purpose: the scene damps its own progress
 * before the camera reads it, so anything heavy here smooths an already
 * smoothed signal and the journey starts to feel like it is dragging a weight.
 */
export function useSmoothScroll(reduced) {
  useEffect(() => {
    if (reduced) return undefined

    lenis = new Lenis({
      lerp: 0.1,
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
      // Phones already have momentum scrolling; a second one on top is what
      // makes a smooth-scroll page feel broken rather than pleasant.
      syncTouch: false,
      autoRaf: false,
      anchors: false,
    })

    request()

    return () => {
      lenis.destroy()
      lenis = null
      // Hand the loop back to the event-driven path, and take one more frame
      // so anything mid-move resolves instead of freezing part-way.
      request()
    }
  }, [reduced])
}

/**
 * Register a per-frame reader. The callback is held in a ref, so it can close
 * over fresh values every render without re-registering.
 */
export function useScrollFrame(read) {
  const held = useRef(read)
  held.current = read

  useEffect(() => {
    const run = () => held.current()
    readers.add(run)
    bind()
    request()
    return () => {
      readers.delete(run)
      unbind()
    }
  }, [])
}

/** Jump or glide to an absolute document position. */
export function scrollToY(y, immediate = false) {
  if (lenis) lenis.scrollTo(y, { immediate, lock: false })
  else scrollTo({ top: y, behavior: immediate ? 'auto' : 'smooth' })
}
