import { useEffect, useRef, useState } from 'react'
import Plate from './Plates.jsx'
import { FILM_FRAMES } from './content.js'
import { scrollVelocity, usePrefersReducedMotion } from './scroll.js'

/**
 * A strip of site frames that is already moving when you arrive.
 *
 * It runs at a constant crawl rather than being driven by scroll, because a
 * strip that only moves while you move reads as a widget. Scroll adds to it —
 * push the page down and the strip runs with you — and the pointer's distance
 * from the middle of the viewport leans it either way. Hovering a frame slows
 * the whole strip and opens that frame, which is the only way to read the
 * metadata, so the interaction has a reason to exist.
 *
 * The transform is written straight to the node from one rAF; React sees none
 * of it. The loop stops entirely when the strip is off screen.
 */

const BASE = 26            // px per second at rest
const SCROLL_PUSH = 210    // px per second per viewport-height per second
const MAX_STEP = 1 / 20    // clamp a backgrounded tab's first frame

function ProjectFilmStrip() {
  const reduced = usePrefersReducedMotion()
  const sectionRef = useRef(null)
  const trackRef = useRef(null)
  const [hover, setHover] = useState(-1)
  const hoverRef = useRef(-1)
  hoverRef.current = hover

  useEffect(() => {
    const section = sectionRef.current
    const track = trackRef.current
    if (!section || !track) return undefined
    if (reduced) {
      track.style.transform = 'translate3d(0,0,0)'
      return undefined
    }

    let offset = 0
    let raf = 0
    let last = 0
    let live = false
    let lean = 0
    let pointer = 0
    // One copy of the frames; the track holds two, so wrapping at half the
    // scroll width is seamless. It is measured by a ResizeObserver rather than
    // read each frame: `scrollWidth` on a max-content flex row forces a layout,
    // and doing that sixty times a second on a page this long is how a strip
    // that looks free costs more than the WebGL above it.
    let width = 0
    const ro = new ResizeObserver(([entry]) => {
      width = entry.target.scrollWidth / 2
    })
    ro.observe(track)

    const step = (now) => {
      raf = live ? requestAnimationFrame(step) : 0
      const dt = Math.min((now - last) / 1000, MAX_STEP)
      last = now
      if (width < 1) return

      lean += (pointer - lean) * Math.min(dt * 3, 1)
      const slow = hoverRef.current >= 0 ? 0.18 : 1
      const speed = (BASE + scrollVelocity() * SCROLL_PUSH + lean * 70) * slow

      offset += speed * dt
      offset = ((offset % width) + width) % width
      track.style.transform = `translate3d(${-offset}px,0,0)`
    }

    const onPointer = (event) => {
      pointer = (event.clientX / innerWidth) * 2 - 1
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        live = entry.isIntersecting
        if (live && !raf) {
          last = performance.now()
          raf = requestAnimationFrame(step)
        }
      },
      { rootMargin: '120px 0px' },
    )
    io.observe(section)
    addEventListener('pointermove', onPointer)

    return () => {
      io.disconnect()
      ro.disconnect()
      removeEventListener('pointermove', onPointer)
      live = false
      if (raf) cancelAnimationFrame(raf)
    }
  }, [reduced])

  const frames = [...FILM_FRAMES, ...FILM_FRAMES]

  return (
    <section className="c2film" data-zone="dark" ref={sectionRef} aria-label="On site">
      <header className="c2film__head">
        <p className="c2label c2label--invert">On site</p>
        <p className="c2film__legend">
          {FILM_FRAMES.map((f) => f.label).join(' / ')}
        </p>
      </header>

      <div className="c2film__window">
        <div
          className="c2film__track"
          ref={trackRef}
          data-hovering={hover >= 0}
          onMouseLeave={() => setHover(-1)}
        >
          {frames.map((frame, i) => (
            <figure
              className="c2film__frame"
              key={`${frame.id}-${i}`}
              data-open={hover === i}
              data-dim={hover >= 0 && hover !== i}
              onMouseEnter={() => setHover(i)}
            >
              <Plate kind={frame.plate} />
              <figcaption>
                <span className="c2film__label">{frame.label}</span>
                <span className="c2film__meta">
                  <b>{frame.year}</b>
                  <b>{frame.sector}</b>
                  <b>{frame.place}</b>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      {/* The strip's baseline leaves the section and becomes the first segment
          of the process line below it. */}
      <i className="c2film__base" aria-hidden="true" />
    </section>
  )
}

export default ProjectFilmStrip
