import { useEffect, useRef, useState } from 'react'
import Lenis from 'lenis'

/**
 * One scroll driver for the whole page — and now one smoothing engine too.
 *
 * Everything below the hero is scroll-linked, and the cheapest way to get that
 * wrong is to give each section its own listener, its own state and its own
 * animation frame. So there is exactly ONE requestAnimationFrame in this
 * module, and it does three things in order:
 *
 *   1. advances Lenis (created with autoRaf: false, precisely so it does not
 *      start a second loop of its own)
 *   2. updates the smoothed scroll velocity
 *   3. measures every registered element and writes its progress onto the node
 *      as the CSS custom property `--p`
 *
 * Writing a variable rather than calling setState is the point: a section's
 * motion then lives in CSS, React never re-renders while you scroll, and the
 * page keeps its frame budget for the WebGL hero it is sitting on. Components
 * that genuinely need a JS decision (which project is dominant, which process
 * node the line has reached) pass `onProgress` and touch the DOM directly.
 *
 * The loop runs every frame while Lenis is mounted, because Lenis with
 * autoRaf disabled cannot move the page unless someone calls raf() for it.
 * Under prefers-reduced-motion there is no Lenis, the page scrolls natively,
 * and the loop goes back to being woken by scroll events and sleeping in
 * between — which costs nothing on a page at rest.
 *
 * Two measurements, because sections want different things:
 *
 *   'pin'    0 when the element's top hits the top of the viewport, 1 when its
 *            bottom does. For the tall sticky sections.
 *   'cross'  0 as the element's top enters from below, 1 as its bottom leaves
 *            through the top. For ordinary sections.
 */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

const items = new Set()
let lenis = null
let frame = 0
let bound = false
let lastY = 0
let velocity = 0
let lastT = 0

function measure(item, vh) {
  const rect = item.el.getBoundingClientRect()
  if (item.mode === 'pin') {
    return clamp01(-rect.top / Math.max(rect.height - vh, 1))
  }
  return clamp01((vh - rect.top) / Math.max(vh + rect.height, 1))
}

function tick(now) {
  frame = 0

  // Lenis first: it moves the page, then everything below reads the new position
  // in the same frame. Driving it from here rather than letting it run its own
  // loop is what keeps this to a single rAF for the entire page.
  if (lenis) lenis.raf(now)

  const vh = innerHeight
  const dt = Math.max(now - lastT, 1)
  lastT = now

  // Scroll velocity in viewport-heights per second, smoothed. The film strip is
  // the only consumer; it reads the module value rather than subscribing.
  const dy = scrollY - lastY
  lastY = scrollY
  velocity += ((dy / vh) * (1000 / dt) - velocity) * Math.min(dt / 120, 1)

  for (const item of items) {
    if (!item.el) continue
    const p = measure(item, vh)
    if (Math.abs(p - item.last) < 0.0004) continue
    item.last = p
    item.el.style.setProperty('--p', p.toFixed(4))
    if (item.onProgress) item.onProgress(p)
  }

  // While Lenis is mounted the loop runs every frame, and it has to.
  //
  // Lenis owns the wheel: it calls preventDefault, stores a target, and moves
  // nothing until someone calls raf(). With autoRaf disabled that someone is
  // this function — so if the loop is only woken by a scroll event, the page
  // deadlocks the moment smoothing is on. The wheel fires, the window never
  // moves, no scroll event is emitted, nothing wakes the loop, and nothing
  // ever calls raf() to move the page. Turning the wheel does nothing at all.
  //
  // Running continuously is what Lenis does for itself under autoRaf: true;
  // the only thing this module adds to the frame is one getBoundingClientRect
  // per registered section, and each one early-outs unless its progress has
  // actually changed. Without Lenis (reduced motion) the page scrolls
  // natively, real scroll events arrive, and the loop can stay asleep.
  if (lenis) request()
}

function request() {
  if (!frame) frame = requestAnimationFrame(tick)
}

function bind() {
  if (bound) return
  bound = true
  lastY = scrollY
  lastT = performance.now()
  addEventListener('scroll', request, { passive: true })
  addEventListener('resize', request)
}

function unbind() {
  if (!bound || items.size) return
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

/* ------------------------------------------------------------------ lenis */
/**
 * The page's smoothing, mounted once by the route.
 *
 * Deliberately light. The hero already damps its own progress before the
 * camera reads it, so anything heavy here would smooth an already-smoothed
 * signal and the film would feel like it was dragging a weight. A lerp of 0.1
 * takes the step out of the wheel without putting the page behind the cursor.
 *
 * Under prefers-reduced-motion no instance is created at all — the page falls
 * back to native scrolling, and every scrollTo below becomes an instant jump.
 */
export function useLenis(reduced) {
  useEffect(() => {
    if (reduced) return undefined

    lenis = new Lenis({
      lerp: 0.1,
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
      // Touch devices already have momentum scrolling of their own; adding a
      // second one on top is what makes a smooth-scroll page feel broken on a
      // phone rather than pleasant.
      syncTouch: false,
      autoRaf: false,
      anchors: false,
    })

    // This effect can run before any section has registered, so seed the
    // frame clock here too — otherwise the first tick sees dt measured from
    // zero and reports a velocity spike that never happened.
    lastY = scrollY
    lastT = performance.now()

    // Start the loop immediately rather than waiting for an event: from here
    // on it is the thing that drives Lenis, not the other way round.
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

/** Jump or glide to an absolute document position. */
export function scrollToY(y, immediate = false) {
  if (lenis) lenis.scrollTo(y, { immediate, lock: false })
  else scrollTo({ top: y, behavior: immediate ? 'auto' : 'smooth' })
}

/** Jump or glide so an element's top meets the top of the viewport. */
export function scrollToEl(el, immediate = false) {
  if (!el) return
  if (lenis) lenis.scrollTo(el, { immediate, lock: false })
  else el.scrollIntoView({ behavior: immediate ? 'auto' : 'smooth', block: 'start' })
}

/** Read-only, for anything that wants to be pushed along by the scroll. */
export function scrollVelocity() {
  return velocity
}

/**
 * Link an element's scroll position to its own `--p`.
 * `onProgress` runs on the same tick for the rare case that needs JS.
 */
export function useScrollLink(ref, mode = 'cross', onProgress) {
  const handler = useRef(onProgress)
  handler.current = onProgress

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined

    const item = {
      el,
      mode,
      last: -1,
      onProgress: (p) => handler.current?.(p),
    }
    items.add(item)
    bind()
    request()

    return () => {
      items.delete(item)
      unbind()
    }
  }, [ref, mode])
}

/**
 * A damped pointer position in an element's own space, written as `--mx` /
 * `--my` (-1..1) and `--near` (0 at rest, 1 while the pointer is inside).
 *
 * Refs and direct style writes, never state: this fires on every mouse move.
 * The loop only exists while the pointer is actually over the element, and
 * touch and reduced motion never start it at all.
 */
export function usePointerField(ref, { enabled = true, damp = 0.14 } = {}) {
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return undefined
    if (typeof matchMedia === 'function' && matchMedia('(hover: none)').matches) {
      return undefined
    }

    let raf = 0
    let tx = 0
    let ty = 0
    let tn = 0
    let x = 0
    let y = 0
    let n = 0

    const loop = () => {
      raf = 0
      x += (tx - x) * damp
      y += (ty - y) * damp
      n += (tn - n) * damp
      el.style.setProperty('--mx', x.toFixed(3))
      el.style.setProperty('--my', y.toFixed(3))
      el.style.setProperty('--near', n.toFixed(3))
      if (
        Math.abs(tx - x) > 0.002 ||
        Math.abs(ty - y) > 0.002 ||
        Math.abs(tn - n) > 0.002
      ) {
        raf = requestAnimationFrame(loop)
      }
    }
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(loop)
    }

    const onMove = (event) => {
      const rect = el.getBoundingClientRect()
      tx = ((event.clientX - rect.left) / rect.width) * 2 - 1
      ty = ((event.clientY - rect.top) / rect.height) * 2 - 1
      tn = 1
      kick()
    }
    const onLeave = () => {
      tx = 0
      ty = 0
      tn = 0
      kick()
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [ref, enabled, damp])
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    if (typeof matchMedia !== 'function') return undefined
    const query = matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}

export { clamp01 }
