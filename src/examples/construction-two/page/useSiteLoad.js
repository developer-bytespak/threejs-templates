import { useEffect, useRef, useState } from 'react'
import { MODEL_URL } from '../palette.js'
import { SITE_IMAGES } from './content.js'
import { lockScroll } from './scroll.js'

/**
 * What has to be true before the page is handed over.
 *
 * The brief is literal: by the time anyone can scroll, everything they will
 * scroll past is already fetched and decoded. So this waits on three cohorts
 * rather than on the hero alone —
 *
 *   model        the GLB and anything three pulls with it
 *   photography  every project frame and every strip frame, below the fold
 *                included, warmed through the same srcset the page will ask
 *                for so the browser reuses the candidate it already has
 *   type         document.fonts, which on this page is a formality: the stack
 *                is Helvetica/Arial and resolves at once. It is measured
 *                anyway, because the day someone adds a webfont is the day
 *                they will not remember to come back here.
 *
 * Two rules keep a loader from becoming the worst part of a site:
 *
 *   MIN_MS  a floor, not a delay. On a warm cache everything here resolves in
 *           well under a second, and a panel that appears and vanishes inside
 *           that reads as a flicker rather than as an opening. So the count is
 *           also *paced* against this number: on a fast load the bar is driven
 *           by the clock rather than by the work, and arrives at 100 exactly
 *           when it is allowed to leave. The alternative — real progress
 *           slamming to 100 and then sitting there waiting out the floor — is
 *           the thing that makes a loader look broken.
 *   MAX_MS  a ceiling, so nobody is trapped. A dead CDN, a firewalled asset, a
 *           tab throttled in the background: any of them can leave a promise
 *           unresolved forever, and a loader that waits forever is a broken
 *           website. At the cap it hands the page over anyway and lets the
 *           sections fall back on their own; ProjectMedia already draws a
 *           plate when a photograph never arrives.
 *
 * Between the two, the work decides. If loading outlasts the floor the panel
 * stays up for exactly as long as it takes.
 */
const MIN_MS = 2000
const MAX_MS = 12000
const IMAGE_MS = 6000      // per image, so one stalled request cannot hold the rest
const MODEL_MS = 10000     // the model's own ceiling, inside the overall one

// What each cohort is worth on the bar. The model is most of the bytes and
// most of the wait, so it gets most of the width. A bar whose segments do not
// match the real cost is what makes loaders feel like they lie.
const WEIGHT = { model: 0.62, images: 0.28, type: 0.1 }

const STAGE = { model: 'Model', images: 'Photography', type: 'Type', ready: 'Ready' }

/**
 * Warm one photograph.
 *
 * `srcset` and `sizes` are copied from ProjectMedia rather than simplified:
 * the browser picks a candidate from those two, and warming a different
 * candidate than the page later asks for means fetching the picture twice and
 * showing the loader for nothing.
 *
 * A missing file resolves rather than rejects. The template ships without
 * photography — a 404 here is the expected case, not a failure, and the drawn
 * plate behind it is already the designed answer.
 */
function warm({ src, srcSet, sizes }) {
  return new Promise((resolve) => {
    if (!src) { resolve(); return }
    const img = new Image()
    const timer = setTimeout(resolve, IMAGE_MS)
    const finish = () => { clearTimeout(timer); resolve() }
    img.onload = finish
    img.onerror = finish
    img.decoding = 'async'
    if (sizes) img.sizes = sizes
    if (srcSet) img.srcset = srcSet
    img.src = src
  })
}

/**
 * Pull the model, and report how far along it is.
 *
 * This reads the GLB itself rather than asking three how it is getting on.
 * The obvious route was drei's useProgress, which is fed by three's
 * DefaultLoadingManager and costs no extra request — and it does not work
 * here. useGLTF.preload() runs when this route's chunk is evaluated, so on a
 * warm cache the model can be fetched and the manager finished with before
 * anything in React has mounted and subscribed. The store then reports
 * total: 0, active: false forever, which is indistinguishable from "nothing
 * has started". Measured: four seconds of a bar sitting at zero on a reload,
 * then a jump, which is precisely the behaviour a loader exists to avoid.
 *
 * A streamed fetch has no such ambiguity. It reports real bytes against
 * Content-Length on a cold load and completes immediately on a warm one,
 * and because it asks for the same URL three does, the browser serves the
 * second request out of its cache rather than off the network.
 */
function pullModel(onProgress) {
  return new Promise((resolve) => {
    const settle = () => { onProgress(1); resolve() }
    const timer = setTimeout(settle, MODEL_MS)
    const finish = () => { clearTimeout(timer); settle() }

    fetch(MODEL_URL, { credentials: 'same-origin' })
      .then((res) => {
        if (!res.ok || !res.body) { finish(); return }
        // No Content-Length (a chunked or compressed response) means no
        // denominator, so there is nothing honest to report until it lands.
        const size = Number(res.headers.get('content-length')) || 0
        const reader = res.body.getReader()
        let got = 0
        const pump = () =>
          reader.read().then(({ done, value }) => {
            if (done) { finish(); return }
            got += value.byteLength
            if (size) onProgress(Math.min(got / size, 0.98))
            pump()
          }, finish)
        pump()
      }, finish)
  })
}

/**
 * Progress, and the moment the page is ready.
 *
 * The 0..1 comes back as a ref rather than as state on purpose. The hero's
 * Canvas is warming up behind the panel and competing for the same frames, so
 * the counter is animated by writing to the DOM once a frame in Preloader
 * rather than by re-rendering React a hundred times on the way to 100.
 */
export function useSiteLoad() {
  const target = useRef(0)
  const stage = useRef(STAGE.model)
  const [ready, setReady] = useState(false)

  const images = useRef(0)
  const type = useRef(0)
  const model = useRef(0)
  const started = useRef(0)

  useEffect(() => {
    started.current = performance.now()
    lockScroll(true)

    let alive = true

    const fonts = document.fonts?.ready ?? Promise.resolve()
    const typed = () => { type.current = 1 }
    fonts.then(typed, typed)

    const shots = SITE_IMAGES
    let loaded = 0
    const photography = shots.length
      ? Promise.all(
          shots.map((shot) =>
            warm(shot).then(() => {
              loaded += 1
              images.current = loaded / shots.length
            }),
          ),
        )
      : Promise.resolve()
    if (!shots.length) images.current = 1

    pullModel((v) => { if (v > model.current) model.current = v })

    // One place where the bar is worked out, on a timer rather than on a
    // render. Two of the three cohorts advance outside React entirely — an
    // image finishing decoding does not re-render anything — so a figure
    // computed during render would sit still while the work went on.
    const measure = (done) => {
      const real =
        model.current * WEIGHT.model +
        images.current * WEIGHT.images +
        type.current * WEIGHT.type
      // Whichever is slower: the work, or the floor. On a fast connection this
      // is the clock and the count climbs evenly to 100 over MIN_MS; on a slow
      // one the clock runs out first and the figure is the real one for the
      // rest of the wait. Either way the number shown is never ahead of what
      // has actually loaded.
      const paced = (performance.now() - started.current) / MIN_MS
      const next = Math.min(real, paced)
      // Monotonic. drei resets its store between loads, and a bar that goes
      // backwards is worse than a bar that pauses.
      if (next > target.current) target.current = next
      stage.current = done
        ? STAGE.type
        : model.current < 1
          ? STAGE.model
          : images.current < 1
            ? STAGE.images
            : STAGE.type
    }

    const everything = new Promise((resolve) => {
      const poll = () => {
        if (!alive) return
        const done = model.current >= 1 && type.current >= 1 && images.current >= 1
        measure(done)
        if (done) resolve()
        else setTimeout(poll, 60)
      }
      poll()
    })

    // The cap is a race rather than a fallback after the fact: whichever comes
    // first hands over the page.
    const cap = new Promise((r) => setTimeout(r, MAX_MS))
    const floor = new Promise((r) => setTimeout(r, MIN_MS))
    const hand = () => { if (alive) setReady(true) }

    Promise.all([floor, Promise.race([everything, cap])]).then(hand, hand)
    // Referenced so a rejection inside the batch can never go unhandled.
    photography.catch(() => {})

    return () => { alive = false }
  }, [])

  // Handing over is the one transition worth forcing from render: whether it
  // came from the work finishing or from the cap, the panel should read 100
  // and say so.
  if (ready) {
    target.current = 1
    stage.current = STAGE.ready
  }

  return { target, stage, ready }
}

export default useSiteLoad
