import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor, useProgress } from '@react-three/drei'
import EducationScene from './EducationScene.jsx'
import EducationEditorial from './EducationEditorial.jsx'
import EducationChrome from './EducationChrome.jsx'
import { CHAPTERS } from './chapters.js'
import { RUNOUT_VH, TRACK_VH, resolveComposition, resolveQuality } from './quality.js'
import { scrollToY, useScrollFrame, useSmoothScroll } from './scroll.js'
import { EducationFooter } from './EducationOutro.jsx'
import { sound } from './audio/AudioManager.js'
import { useAudioInit, useSoundOnChange } from './audio/useAudio.js'
import { DISCIPLINE_BY_ID } from './chapters.js'
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

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** The chapter whose sound is a composed moment rather than a threshold. */
const CHAPTER_CONNECTION = 4

/**
 * What a pointer landing on something sounds like.
 *
 * One family for the whole page, and chosen by what the thing is made of
 * rather than by which component owns it: a paper artifact sounds like paper
 * wherever it is. Every id here is marked `hover`, so a coarse pointer drops
 * all of them — on a phone the only sounds left are the ones the journey makes
 * by itself.
 */
const ARTIFACT_TEXTURE = {
  tech_laptop: 'artifact.tech',
  tech_microchip: 'artifact.tech',
  science_dna: 'artifact.glass',
  science_molecule: 'artifact.glass',
  design_ribbon: 'artifact.paper',
  engineering_gear: 'artifact.tech',
  business_globe: 'artifact.glass',
}

function soundForHover(next) {
  if (!next || !next.kind) return
  if (next.kind === 'discipline') {
    const discipline = DISCIPLINE_BY_ID[next.id]
    if (discipline) sound(`disc.${discipline.id}`)
    return
  }
  if (next.kind === 'artifact') {
    sound(ARTIFACT_TEXTURE[next.id] ?? 'artifact.paper')
    return
  }
  if (next.kind === 'building') sound('ui.building')
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
  // True once the footer has completely covered the stage.
  const [offstage, setOffstage] = useState(false)
  // And whether the scene has finished catching up with the scroll. The two
  // together decide when it is safe to stop rendering — see the Canvas below.
  const [settled, setSettled] = useState(true)

  // Scroll and pointer never enter React state: they change continuously and
  // the scene reads them straight out of this ref inside its frame loop.
  const input = useRef({ progress: 0, pointerX: 0, pointerY: 0, exposure: 1 })
  const rootRef = useRef(null)
  const cursorRef = useRef(null)
  const trackRef = useRef(null)

  const quality = useMemo(
    () => resolveQuality(device.width, device.coarse),
    [device.width, device.coarse],
  )
  const composition = useMemo(
    () => resolveComposition(device.width),
    [device.width],
  )

  // Smoothing first: it owns the wheel, and the reader below runs inside the
  // same frame it moves the page in.
  useSmoothScroll(reducedMotion)

  // The page's one reader. It runs on the scroll loop rather than on the
  // `scroll` event, because with smoothing on, the event arrives a frame after
  // the position it describes and everything derived from it would trail the
  // scrollbar by that frame.
  const readScroll = useCallback(() => {
    const track = trackRef.current
    const top = track ? track.offsetTop : 0
    const height = track ? track.offsetHeight : innerHeight
    const span = Math.max(height - innerHeight, 1)

    // THE STORY IS SHORTER THAN THE TRACK.
    //
    // Progress is measured against the track minus a run-out, so it reaches 1
    // while the footer is still a good half-screen below the fold. That gap is
    // the whole point: the scene damps its own progress before the camera
    // reads it, so the number always arrives at the end slightly before the
    // picture does. Measuring against the full track meant the footer began
    // covering the scene at the exact frame progress hit 1 — with the tree
    // still visibly finishing, and further behind the faster you scrolled.
    const usable = Math.max(span - innerHeight * RUNOUT_VH, 1)
    const progress = clamp01((scrollY - top) / usable)
    input.current.progress = progress

    // How much of the footer has risen into the frame, 0..1 of a viewport.
    // The footer is in ordinary flow, so this is just where its top edge is.
    const rise = clamp01((scrollY + innerHeight - (top + height)) / innerHeight)

    const root = rootRef.current
    if (root) {
      // Continuous motion in the HTML (the rail, the ribbon) reads this custom
      // property, so scrolling never re-renders the editorial layers.
      root.style.setProperty('--p', progress.toFixed(5))
      // And the handoff: the fixed layers drift up against the rising footer.
      root.style.setProperty('--exit', rise.toFixed(4))
    }

    // How much of the world is still on screen. The scene's ambience follows
    // it down, so the place stops being audible as it stops being visible
    // rather than droning on behind an opaque footer.
    input.current.exposure = 1 - rise

    // Covered means covered: the footer has risen a full viewport and there is
    // nothing of the stage left to see. Note this is NOT the same question as
    // "has the story finished" — that was the old test, and it is what let the
    // renderer stop while the scene was still mid-formation.
    const covered = rise >= 1
    setOffstage((was) => (was === covered ? was : covered))

    setChapter(chapterFor(progress))
    setMuseumStop(museumStopFor(progress))
  }, [])

  useScrollFrame(readScroll)

  useEffect(() => {
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

    addEventListener('resize', onResize)
    addEventListener('pointermove', onPointerMove, { passive: true })
    document.addEventListener('pointerleave', onPointerLeave)
    return () => {
      removeEventListener('resize', onResize)
      removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [])

  const scrollToChapter = (id) => {
    const found = CHAPTERS.findIndex((item) => item.id === id)
    if (found < 0) return
    const track = trackRef.current
    if (!track) return
    scrollToY(
      track.offsetTop +
        CHAPTERS[found].range[0] * (track.offsetHeight - innerHeight),
      reducedMotion,
    )
  }

  // Arms the audio system: reads the stored preference and the motion query,
  // and constructs nothing. No AudioContext exists, and nothing can make a
  // sound, until the control in the header is pressed.
  useAudioInit()

  // Chapters and museum stops are already the page's own state, changing a
  // handful of times across the whole journey. Sounding them here means audio
  // is driven by the same transitions the visuals are, rather than by a second
  // reading of scroll position that could disagree with them.
  useSoundOnChange(chapter, useCallback((now, was) => {
    // Only forward. The scene is built so that reversing is correct, and a
    // chapter announcing itself again on the way back up is the one thing that
    // would make scrolling backwards feel wrong.
    if (now <= was) return
    if (now === CHAPTER_CONNECTION) {
      // Two ideas arriving from opposite places, then one that is neither.
      sound('connect.left')
      sound('connect.right', { delay: 0.22 })
      sound('connect.join', { delay: 0.7 })
    }
  }, []))

  useSoundOnChange(museumStop, useCallback((now, was) => {
    if (now <= was) return
    sound('museum.stop', { rate: 1 + now * 0.05 })
  }, []))

  // Reported from inside the frame loop, and only when it flips.
  const handleSettled = useCallback((value) => {
    setSettled((was) => (was === value ? was : value))
  }, [])

  const handleHoverChange = (next) => {
    setHover(next)
    setHoveredDiscipline(next.kind === 'discipline' ? next.id : null)
    soundForHover(next)
  }

  const interactive = Boolean(hover.kind) || Boolean(hoveredDiscipline)

  return (
    <div className="edu" ref={rootRef} data-chapter={chapter} data-past={offstage}>
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
          // Stop only when the footer has covered the stage AND the scene has
          // caught up with the scroll. Stopping on coverage alone froze the
          // loop mid-formation whenever the reader arrived faster than the
          // scene's own damping — leaves half-built, and stuck there on the
          // way back up. Now it finishes behind the footer and stops after.
          frameloop={offstage && settled ? 'never' : 'always'}
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
              covered={offstage}
              onSettled={handleSettled}
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
      <div
        className="edu__track"
        ref={trackRef}
        style={{ height: `${TRACK_VH}vh` }}
        aria-hidden="true"
      />

      {/* And the close, in ordinary document flow. */}
      <EducationFooter onNavigate={scrollToChapter} />
    </div>
  )
}

export default EducationExperience
