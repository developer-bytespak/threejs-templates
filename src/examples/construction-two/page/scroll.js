import { useEffect, useRef, useState } from 'react'

/**
 * One scroll driver for the whole page.
 *
 * Everything below the hero is scroll-linked, and the cheapest way to get that
 * wrong is to give each section its own listener and its own React state. So
 * there is exactly one passive listener and one rAF here; on each tick it
 * measures every registered element and writes its progress straight onto the
 * node as the CSS custom property `--p`.
 *
 * Writing a variable rather than calling setState is the whole point: the
 * section's motion then lives in CSS, React never re-renders while you scroll,
 * and the page keeps its frame budget for the WebGL hero it is sitting on.
 * Components that genuinely need a JS decision (which project is active, which
 * process step has been reached) pass an `onProgress` callback and touch the
 * DOM directly in it.
 *
 * Two measurements, because sections want different things:
 *
 *   'pin'    0 when the element's top hits the top of the viewport, 1 when its
 *            bottom does. For tall sticky sections — the pinned ones.
 *   'cross'  0 as the element's top enters from below, 1 as its bottom leaves
 *            through the top. For ordinary sections that want to know how far
 *            through the viewport they are.
 */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

const items = new Set()
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

function tick() {
  frame = 0
  const vh = innerHeight
  const now = performance.now()
  const dt = Math.max(now - lastT, 1)
  lastT = now

  // Scroll velocity in viewport-heights per second, smoothed. The film strip
  // is the only consumer; it reads the module value rather than subscribing.
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
  if (frame) cancelAnimationFrame(frame)
  frame = 0
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
