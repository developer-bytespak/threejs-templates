import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import * as THREE from 'three'
import Room from './Room.jsx'
import Building from './Building.jsx'
import DrawingSequence from './DrawingSequence.jsx'
import CinematicCamera from './CinematicCamera.jsx'
import ConstructionAnnotations from './ConstructionAnnotations.jsx'
import ConstructionStoryUI from './ConstructionStoryUI.jsx'
import ConstructionProgress from './ConstructionProgress.jsx'
import { STORY_CHAPTERS, TRACK_VH, chapterAt } from './story.js'
import './RoomViewer.css'

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

// How quickly the scene catches up with the scroll bar. ~0.3s to settle: long
// enough that a wheel flick becomes a glide, short enough that the page never
// feels like it is lagging behind the cursor.
const SCROLL_DAMPING = 3.2

/**
 * The wheel is a step function; the scene should not be.
 *
 * Raw scroll goes into `input.current.raw`, and this damps it into
 * `input.current.progress` — the value the camera, the drawing and the building
 * all read. One notch of the wheel becomes a short glide rather than a jump,
 * and the plotter keeps drawing for a beat after the page has stopped moving.
 *
 * It converges exactly on the raw value, so nothing downstream loses its
 * determinism: scrolling back to a position still reproduces that position.
 * Mounted ahead of everything else in the canvas so it runs first each frame.
 */
function ScrollEase({ input, reducedMotion }) {
  const started = useRef(false)

  useFrame((_, delta) => {
    const raw = input.current.raw

    // The first frame snaps, so a deep link opens on its chapter instead of
    // flying to it from the top of the page.
    if (reducedMotion || !started.current) {
      started.current = true
      input.current.progress = raw
      return
    }

    const next = THREE.MathUtils.damp(
      input.current.progress,
      raw,
      SCROLL_DAMPING,
      Math.min(delta, 0.1),
    )
    input.current.progress = Math.abs(next - raw) < 1e-5 ? raw : next
  })

  return null
}

function LoadingOverlay() {
  const { active, progress } = useProgress()
  if (!active && progress === 100) return null

  return (
    <div className="viewer-overlay">
      <p className="viewer-overlay__label">Preconstruction studio</p>
      <div className="viewer-overlay__track">
        <div className="viewer-overlay__bar" style={{ width: `${progress}%` }} />
      </div>
      <p className="viewer-overlay__value">{Math.round(progress)}%</p>
    </div>
  )
}

function RoomViewer() {
  const reducedMotion = usePrefersReducedMotion()
  const [chapter, setChapter] = useState(STORY_CHAPTERS[0])
  const [progress, setProgress] = useState(0)

  // Scroll and pointer feed the scene through a ref, not state: they change
  // every frame and re-rendering the scene tree on each one would be wasteful.
  // `buildPhase` is written back into the same ref by Building.jsx.
  const input = useRef({
    raw: 0,
    progress: 0,
    pointerX: 0,
    pointerY: 0,
    buildPhase: -1,
  })

  const scrollToProgress = useCallback((p, behavior) => {
    const scrollable = document.body.scrollHeight - innerHeight
    scrollTo({ top: p * scrollable, behavior })
  }, [])

  const jumpToChapter = useCallback(
    (target) => {
      // Land a little inside the chapter rather than exactly on its seam, so
      // the mode has actually changed by the time the scroll settles.
      const p = target.from + (target.to - target.from) * 0.18
      scrollToProgress(p, reducedMotion ? 'auto' : 'smooth')
    },
    [reducedMotion, scrollToProgress],
  )

  // Deep links: /#documentation opens on that chapter. Runs before paint so the
  // page never shows the opening and then jumps.
  useLayoutEffect(() => {
    history.scrollRestoration = 'manual'
    const found = STORY_CHAPTERS.find((c) => c.id === location.hash.slice(1))
    if (found && found.index > 1) {
      const p = found.from + (found.to - found.from) * 0.18
      scrollToProgress(p, 'auto')
    }
  }, [scrollToProgress])

  useEffect(() => {
    // The scene runs off the ref; React only hears about scroll when something
    // it renders would actually change. Progress is quantised to ~0.2% — about
    // 500 updates across a 1050vh page instead of one per scroll pixel — and
    // the chapter changes six times in total.
    //
    // Deliberately not rAF-queued: a hidden or backgrounded tab stops firing
    // rAF, which would freeze the DOM layer at whatever chapter it was on while
    // the scroll position kept moving underneath it.
    let lastStep = -1

    const onScroll = () => {
      const scrollable = document.body.scrollHeight - innerHeight
      const p = scrollable > 0 ? scrollY / scrollable : 0
      input.current.raw = p

      const step = Math.round(p * 500)
      if (step === lastStep) return
      lastStep = step

      setProgress(p)
      setChapter((was) => {
        const next = chapterAt(p)
        return next.id === was.id ? was : next
      })
    }

    const onPointerMove = (event) => {
      input.current.pointerX = (event.clientX / innerWidth) * 2 - 1
      input.current.pointerY = -((event.clientY / innerHeight) * 2 - 1)
    }

    onScroll()
    addEventListener('scroll', onScroll, { passive: true })
    addEventListener('resize', onScroll)
    addEventListener('pointermove', onPointerMove)
    return () => {
      removeEventListener('scroll', onScroll)
      removeEventListener('resize', onScroll)
      removeEventListener('pointermove', onPointerMove)
    }
  }, [])

  // Keep the URL in step with the chapter without stacking history entries.
  useEffect(() => {
    const hash = `#${chapter.id}`
    if (location.hash !== hash) history.replaceState(null, '', hash)
  }, [chapter])

  return (
    <>
      <div className="stage">
        <Canvas
          shadows="percentage"
          dpr={[1, 2]}
          camera={{ fov: 40, position: [2, 1.6, 2] }}
          gl={{ antialias: true }}
          onCreated={({ gl }) => {
            // The toon shader emits finished colours. Any tone mapping on top
            // would bend the palette away from the Blender render.
            gl.toneMapping = THREE.NoToneMapping
          }}
        >
          <color attach="background" args={['#0A1740']} />

          <ScrollEase input={input} reducedMotion={reducedMotion} />

          <Suspense fallback={null}>
            <Room />
            <DrawingSequence input={input} reducedMotion={reducedMotion} />
            <Building input={input} reducedMotion={reducedMotion} />
            <ConstructionAnnotations chapter={chapter} progress={progress} />
            <CinematicCamera input={input} reducedMotion={reducedMotion} />
          </Suspense>
        </Canvas>

        <div className="vignette" />

        <ConstructionStoryUI
          input={input}
          chapter={chapter}
          progress={progress}
          reducedMotion={reducedMotion}
        />

        <ConstructionProgress active={chapter} onJump={jumpToChapter} />

        <div className="hint" data-visible={progress < 0.02}>
          <span>Scroll</span>
          <i />
        </div>
      </div>

      {/* The scroll track. The scene is fixed behind it; this only exists to
          give the page a length for the camera to travel along. Its height is
          chosen, not derived from a shot count, so chapters can be weighted. */}
      <div
        className="track"
        style={{ height: `${TRACK_VH}vh` }}
        aria-hidden="true"
      />

      <LoadingOverlay />
    </>
  )
}

export default RoomViewer
