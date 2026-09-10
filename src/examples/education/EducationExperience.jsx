import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor, useProgress } from '@react-three/drei'
import EducationScene from './EducationScene.jsx'
import EducationEditorial from './EducationEditorial.jsx'
import EducationChrome from './EducationChrome.jsx'
import { CHAPTERS } from './chapters.js'
import { TRACK_VH, resolveComposition, resolveQuality } from './quality.js'
import './EducationExperience.css'

/** Camera stops inside the museum chapter, and the copy that goes with each. */
const MUSEUM_STOPS = [0.446, 0.492, 0.53, 0.563]

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}

function measure() {
  return {
    width: window.innerWidth,
    coarse: matchMedia('(pointer: coarse)').matches,
  }
}

function chapterFor(progress) {
  for (let i = CHAPTERS.length - 1; i >= 0; i -= 1) {
    if (progress >= CHAPTERS[i].range[0]) return i
  }
  return 0
}

function museumStopFor(progress) {
  let stop = 0
  while (stop < MUSEUM_STOPS.length && progress > MUSEUM_STOPS[stop]) stop += 1
  return stop
}

/** A thin growing line, not a percentage counter. */
function Loader({ done }) {
  const { progress } = useProgress()
  return (
    <div className="edu-loader" data-done={done} aria-hidden={done}>
      <div className="edu-loader__seed" />
      <div className="edu-loader__track">
        <div
          className="edu-loader__fill"
          style={{ transform: `scaleX(${Math.max(0.04, progress / 100)})` }}
        />
      </div>
      <p className="edu-loader__word">Bytes College</p>
    </div>
  )
}

function EducationExperience() {
  const reducedMotion = usePrefersReducedMotion()
  const [device, setDevice] = useState(measure)
  const [chapter, setChapter] = useState(0)
  const [museumStop, setMuseumStop] = useState(0)
  const [ready, setReady] = useState(false)
  const [throttled, setThrottled] = useState(false)
  const [hover, setHover] = useState({ kind: null })
  const [hoveredDiscipline, setHoveredDiscipline] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)

  // Scroll and pointer never enter React state: they change continuously and
  // the scene reads them straight out of this ref inside its frame loop.
  const input = useRef({ progress: 0, pointerX: 0, pointerY: 0 })
  const rootRef = useRef(null)
  const cursorRef = useRef(null)

  const quality = useMemo(
    () => resolveQuality(device.width, device.coarse),
    [device.width, device.coarse],
  )
  const composition = useMemo(
    () => resolveComposition(device.width),
    [device.width],
  )

  useEffect(() => {
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - innerHeight
      const progress = scrollable > 0 ? scrollY / scrollable : 0
      input.current.progress = progress

      // Continuous motion in the HTML (the rail, the ribbon) reads this custom
      // property, so scrolling never re-renders the editorial layers.
      rootRef.current?.style.setProperty('--p', progress.toFixed(5))

      setChapter(chapterFor(progress))
      setMuseumStop(museumStopFor(progress))
    }

    const onResize = () => {
      const next = measure()
      setDevice((current) => {
        const sameTier =
          resolveQuality(current.width, current.coarse).tier ===
          resolveQuality(next.width, next.coarse).tier
        const sameShift =
          resolveComposition(current.width).x === resolveComposition(next.width).x
        return sameTier && sameShift ? current : next
      })
      onScroll()
    }

    const onPointerMove = (event) => {
      // Touch drives scrolling, not parallax: following it here would fight
      // the gesture the user is already making.
      if (event.pointerType === 'touch') return
      input.current.pointerX = (event.clientX / innerWidth) * 2 - 1
      input.current.pointerY = -((event.clientY / innerHeight) * 2 - 1)
      if (cursorRef.current) {
        cursorRef.current.style.transform =
          `translate3d(${event.clientX}px, ${event.clientY}px, 0)`
      }
    }

    const onPointerLeave = () => {
      // Recentre rather than freeze, so the scene eases back instead of
      // holding whatever angle the pointer had as it left the window.
      input.current.pointerX = 0
      input.current.pointerY = 0
    }

    // The browser may restore a scroll offset on reload; reading it here means
    // the scene derives its state from wherever the page actually is, so a
    // refresh halfway through resumes coherently instead of starting over.
    onScroll()
    addEventListener('scroll', onScroll, { passive: true })
    addEventListener('resize', onResize)
    addEventListener('pointermove', onPointerMove, { passive: true })
    document.addEventListener('pointerleave', onPointerLeave)
    return () => {
      removeEventListener('scroll', onScroll)
      removeEventListener('resize', onResize)
      removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [])

  const scrollToChapter = (id) => {
    const found = CHAPTERS.findIndex((item) => item.id === id)
    if (found < 0) return
    const scrollable = document.documentElement.scrollHeight - innerHeight
    scrollTo({
      top: CHAPTERS[found].range[0] * scrollable,
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }

  const handleHoverChange = (next) => {
    setHover(next)
    setHoveredDiscipline(next.kind === 'discipline' ? next.id : null)
  }

  const interactive = Boolean(hover.kind) || Boolean(hoveredDiscipline)

  return (
    <div className="edu" ref={rootRef} data-chapter={chapter}>
      {/* Painted in CSS rather than as a scene background: the canvas has to
          stay transparent so the behind-layer typography can be occluded by
          geometry rather than covered by a clear colour. */}
      <div className="edu__ground" aria-hidden="true" />

      <div className="edu__stage">
        <Canvas
          className="edu__canvas"
          data-ready={ready}
          dpr={[1, throttled ? 1 : quality.maxDpr]}
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
          camera={{ fov: 34, position: [1.05, 0.72, 3.95], near: 0.08, far: 220 }}
          onCreated={() => setReady(true)}
        >
          <PerformanceMonitor
            onDecline={() => setThrottled(true)}
            onIncline={() => setThrottled(false)}
          />
          <Suspense fallback={null}>
            <EducationScene
              input={input}
              quality={quality}
              composition={composition}
              reducedMotion={reducedMotion}
              chapter={chapter}
              focusDiscipline={hoveredDiscipline}
              onHoverChange={handleHoverChange}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Sits between the canvas and the typography. On a narrow frame the
          copy shares space with lit architecture, and it needs ground. */}
      <div className="edu__scrim" aria-hidden="true" />

      <EducationEditorial
        chapter={chapter}
        museumStop={museumStop}
        hoveredDiscipline={hoveredDiscipline}
        onHover={setHoveredDiscipline}
        onNavigate={scrollToChapter}
      />

      <EducationChrome
        chapter={chapter}
        hover={hover}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((open) => !open)}
        onNavigate={scrollToChapter}
      />

      <Loader done={ready} />

      {quality.hover && !reducedMotion ? (
        <div className="edu-cursor" ref={cursorRef} data-on={interactive} aria-hidden="true">
          <span />
        </div>
      ) : null}

      {/* The scroll track. The scene is fixed behind it; this only exists to
          give the page a length for the journey to travel along. */}
      <div className="edu__track" style={{ height: `${TRACK_VH}vh` }} aria-hidden="true" />
    </div>
  )
}

export default EducationExperience
