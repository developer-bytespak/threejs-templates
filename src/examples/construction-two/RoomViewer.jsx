import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import Room from './Room.jsx'
import Building from './Building.jsx'
import DrawingSequence from './DrawingSequence.jsx'
import CinematicCamera from './CinematicCamera.jsx'
import ConstructionAnnotations from './ConstructionAnnotations.jsx'
import ConstructionStoryUI from './ConstructionStoryUI.jsx'
import ConstructionProgress from './ConstructionProgress.jsx'
import { BUILD_PHASES, BUILD_START, STORY_CHAPTERS, chapterAt } from './story.js'
import SceneAudio from './audio/SceneAudio.jsx'
import { assemblyLevel, sound } from './audio/AudioManager.js'
import { useSoundOnChange } from './audio/useAudio.js'
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

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

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

/**
 * The opening film.
 *
 * The sequence itself is unchanged — same chapters, same camera path, same
 * drawing and the same assembly. What changed when the page grew underneath it
 * is where progress comes from: the hero used to be the document, so scroll
 * position over document height *was* the story. Now it is one section among
 * several, so progress is measured against the hero's own box instead
 * (`hostRef`), and the stage sticks inside that box rather than being fixed to
 * the window.
 *
 * That single change is what makes the hero release. Scroll past the host and
 * the stage stops sticking and leaves with it; scroll back and it re-enters at
 * exactly the progress it left at, because nothing is remembered — the value is
 * measured every tick.
 *
 * `hostRef` is optional: without it this falls back to the document, so the
 * component still runs standalone.
 */
function RoomViewer({ hostRef = null, standalone = false }) {
  const reducedMotion = usePrefersReducedMotion()
  const [chapter, setChapter] = useState(STORY_CHAPTERS[0])
  const [progress, setProgress] = useState(0)
  // WebGL is the most expensive thing on the page and it is only worth paying
  // for while the hero is on screen. One state change per boundary crossing.
  const [live, setLive] = useState(true)

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

  /**
   * The film's audio.
   *
   * A chapter change is a cut, and a cut in this film is a sheet being moved
   * on a desk and the camera finding its next position. Both of those, two
   * hundred milliseconds apart, and nothing else — no sound is attached to
   * camera movement itself, only to the moment it starts.
   *
   * Each chapter gets its own colour rather than the same sample six times:
   * the paper alternates between being placed and being slid, and the rate
   * walks up a little through the film so the last chapter does not sound
   * like the first.
   */
  useSoundOnChange(chapter.index, (index) => {
    const rate = 1 + (index - 3) * 0.035
    sound(index === 1 ? 'card.place' : index % 2 ? 'hero.chapter' : 'hero.chapter.alt', { rate })
    sound('hero.camera', { delay: 0.05, rate })
    sound('hero.air', { delay: 0.12, rate })
  })

  /**
   * The pen. DrawingSequence reports the nib landing, crossing to a new line,
   * and lifting; this turns that into graphite.
   *
   * Short strokes get a tick rather than a stroke sound — in a drawing this
   * dense the short ones are dimension ticks and arrowheads, and they should
   * sound like the pen being set down and lifted, not like a line being
   * pulled. Everything else gets a grain of pencil whose length follows the
   * length of the line being drawn.
   *
   * The pen lifting is silent on purpose. The gap between strokes is what
   * makes the rest read as drawing rather than as texture.
   */
  const onPen = useCallback(({ ord, was, length }) => {
    if (ord < 0) return
    if (was < 0) {
      sound('pen.down')
      return
    }
    if (length < 0.02) sound('pen.corner')
    else sound('pen.stroke', { dur: Math.min(0.06 + length * 1.6, 0.22) })
  }, [])

  /**
   * The building going up.
   *
   * Every piece that lands makes a sound, in the material of its own phase —
   * mass for the foundation, a tap for the structure, metal for the envelope,
   * a small tick for the last fittings. Thirteen of them across a fifth of the
   * film, on a 70ms cooldown so a fast scroll thickens the texture instead of
   * machine-gunning it.
   *
   * The first piece of each phase is the accent, 7 dB above the rest, which
   * gives the run its punctuation without anything having to be loud.
   * Everything after it in that phase is quiet — density, not volume.
   *
   * Scrolling back reports the same pieces leaving, and those get their own
   * voice rather than the landing played backwards. See `release` in
   * voices.js for why that distinction is worth a separate voice.
   */
  const phaseSeen = useRef(new Set())
  const onPiece = useCallback((phase, landing) => {
    const key = BUILD_PHASES[phase]?.key
    if (!key) return

    // Coming apart. One sound for every phase, pitched by which phase it is
    // so fourteen releases are not fourteen identical ticks, and no accents —
    // scrolling back is undoing, not a second performance.
    if (!landing) {
      sound('piece.lift', { rate: 1.14 - phase * 0.07 })
      return
    }

    if (phaseSeen.current.has(phase)) {
      sound(`piece.${key}`)
    } else {
      phaseSeen.current.add(phase)
      sound(`build.${key}`)
    }
  }, [])

  const measure = useCallback(() => {
    const host = hostRef?.current
    if (!host) {
      const scrollable = document.body.scrollHeight - innerHeight
      return scrollable > 0 ? clamp01(scrollY / scrollable) : 0
    }
    const rect = host.getBoundingClientRect()
    return clamp01(-rect.top / Math.max(rect.height - innerHeight, 1))
  }, [hostRef])

  const scrollToProgress = useCallback(
    (p, behavior) => {
      const host = hostRef?.current
      if (!host) {
        const scrollable = document.body.scrollHeight - innerHeight
        scrollTo({ top: p * scrollable, behavior })
        return
      }
      const rect = host.getBoundingClientRect()
      const span = Math.max(rect.height - innerHeight, 1)
      scrollTo({ top: rect.top + scrollY + p * span, behavior })
    },
    [hostRef],
  )

  // Deep links into a chapter, for the standalone build only. On the full page
  // the hash belongs to the page's own sections.
  useLayoutEffect(() => {
    if (!standalone) return
    history.scrollRestoration = 'manual'
    const found = STORY_CHAPTERS.find((c) => c.id === location.hash.slice(1))
    if (found && found.index > 1) {
      const p = found.from + (found.to - found.from) * 0.18
      scrollToProgress(p, 'auto')
    }
  }, [standalone, scrollToProgress])

  useEffect(() => {
    // The scene runs off the ref; React only hears about scroll when something
    // it renders would actually change. Progress is quantised to ~0.2% — about
    // 500 updates across the hero instead of one per scroll pixel — and the
    // chapter changes six times in total.
    //
    // Deliberately not rAF-queued: a hidden or backgrounded tab stops firing
    // rAF, which would freeze the DOM layer at whatever chapter it was on while
    // the scroll position kept moving underneath it.
    let lastStep = -1

    const onScroll = () => {
      const p = measure()
      input.current.raw = p

      const step = Math.round(p * 500)
      if (step === lastStep) return
      lastStep = step

      // Scrolling back out of the build re-arms the phase accents, so coming
      // forward again sounds like the first time rather than like a rerun.
      if (p < BUILD_START && phaseSeen.current.size) phaseSeen.current.clear()

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
  }, [measure])

  /**
   * The hero leaving takes the assembly bed with it.
   *
   * The bed is driven from inside the Canvas, and the Canvas stops rendering
   * when the hero is off screen — so scrolling out of the film part-way
   * through the build would leave a low sustained voice holding its last
   * level over the rest of the page, with nothing left running to turn it
   * down. It comes back on its own when the frame loop does.
   */
  useEffect(() => {
    if (!live) assemblyLevel(0)
  }, [live])

  // Stop drawing once the hero is well clear of the viewport, and start again
  // before it comes back. The scene is never unmounted, so the GLB is parsed
  // once and re-entry is instant.
  useEffect(() => {
    const host = hostRef?.current
    if (!host || typeof IntersectionObserver !== 'function') return undefined
    const io = new IntersectionObserver(
      ([entry]) => setLive(entry.isIntersecting),
      { rootMargin: '25% 0px' },
    )
    io.observe(host)
    return () => io.disconnect()
  }, [hostRef])

  // Keep the URL in step with the chapter, standalone only.
  useEffect(() => {
    if (!standalone) return
    const hash = `#${chapter.id}`
    if (location.hash !== hash) history.replaceState(null, '', hash)
  }, [standalone, chapter])

  return (
    <>
      <div className="stage" data-live={live}>
        <Canvas
          shadows="percentage"
          dpr={[1, 2]}
          camera={{ fov: 40, position: [2, 1.6, 2] }}
          gl={{ antialias: true }}
          frameloop={live ? 'always' : 'demand'}
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
            <DrawingSequence input={input} reducedMotion={reducedMotion} onPen={onPen} />
            <Building input={input} reducedMotion={reducedMotion} onPiece={onPiece} />
            <ConstructionAnnotations chapter={chapter} progress={progress} />
            <CinematicCamera input={input} reducedMotion={reducedMotion} />
            <SceneAudio input={input} enabled={live} />
          </Suspense>
        </Canvas>

        <div className="vignette" />

        <ConstructionStoryUI
          input={input}
          chapter={chapter}
          progress={progress}
          reducedMotion={reducedMotion}
        />

        <ConstructionProgress active={chapter} progress={progress} />
      </div>

    </>
  )
}

export default RoomViewer
