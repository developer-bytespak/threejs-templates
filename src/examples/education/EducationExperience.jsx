import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor, useProgress } from '@react-three/drei'
import EducationScene from './EducationScene.jsx'
import EducationEditorial from './EducationEditorial.jsx'
import EducationChrome from './EducationChrome.jsx'
import { CHAPTERS } from './chapters.js'
import { TRACK_VH, resolveComposition, resolveQuality } from './quality.js'
import {
  HOLDS,
  clamp01,
  docForStory,
  holdProgress,
  sheetCover,
  storyProgress,
} from './timeline.js'
import { scrollToY, useScrollFrame, useSmoothScroll } from './scroll.js'
import {
  CampusInterlude,
  ConnectionInterlude,
  DisciplinesInterlude,
  IntroInterlude,
} from './EducationInterludes.jsx'
import { EducationFooter, FinalCTA } from './EducationOutro.jsx'
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

/** Which surface each editorial chapter puts in front of the scene. */
const SHEET_TONE = {
  intro: 'paper',
  disciplines: 'paper',
  connection: 'dark',
  campus: 'paper',
}

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
  // True once the reader is past the journey and into the close.
  const [offstage, setOffstage] = useState(false)

  // Scroll and pointer never enter React state: they change continuously and
  // the scene reads them straight out of this ref inside its frame loop.
  const input = useRef({ progress: 0, pointerX: 0, pointerY: 0, cover: 0 })
  const rootRef = useRef(null)
  const cursorRef = useRef(null)
  const trackRef = useRef(null)
  const holdRefs = useRef({})

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
    // Measured against the TRACK, not the document. The page continues past
    // the journey into a call to action and a footer, and measuring against
    // total height would let adding a footer compress the story — the tree
    // would grow faster because there are more links at the bottom.
    const track = trackRef.current
    const top = track ? track.offsetTop : 0
    const span = track ? track.offsetHeight - innerHeight : 1
    const doc = span > 0 ? clamp01((scrollY - top) / span) : 0

    // The 3D reads story progress, which holds still while an editorial
    // chapter has the screen. Everything downstream — camera, chapters,
    // stage weights, audio — is unchanged and unaware.
    const story = storyProgress(doc)
    input.current.progress = story

    // Continuous motion in the HTML (the rail, the ribbon) reads this custom
    // property, so scrolling never re-renders the editorial layers.
    const root = rootRef.current
    let cover = 0
    if (root) {
      root.style.setProperty('--p', story.toFixed(5))
      root.style.setProperty('--doc', doc.toFixed(5))
      // One property per editorial section, written straight to the DOM.
      // This is the whole animation system for those sections: no timers, no
      // observers, no React work while the reader moves.
      let surface = 'none'
      for (const hold of HOLDS) {
        const el = holdRefs.current[hold.id]
        if (!el) continue
        const local = holdProgress(doc, hold.id)
        const live = local >= 0
        el.style.setProperty('--s', live ? local.toFixed(4) : '0')
        // The visibility gate sits OUTSIDE the sheet's own travel — the sheet
        // is at zero for the first and last hundredth of the hold — so a
        // section is only ever taken off the compositor while there is
        // genuinely nothing of it on screen. Cutting it at a point where the
        // sheet was still a third of the way up is what made these vanish.
        el.dataset.live = live && local > 0.01 && local < 0.99 ? 'true' : 'false'
        // Pointer interaction belongs to the settled middle, not to the
        // travel: a transparent full-screen section must not swallow a click
        // meant for the scene behind it.
        el.dataset.open = live && local > 0.26 && local < 0.74 ? 'true' : 'false'
        if (live) cover = Math.max(cover, sheetCover(local))
        // Once a sheet is more than half up it owns the surface, and the
        // header has to take its palette from that rather than staying set
        // for a dark scene it can no longer see.
        if (live && local > 0.2 && local < 0.8) surface = SHEET_TONE[hold.id]
      }
      root.dataset.sheet = surface
    }

    // Handed to the scene so the camera can stand back while a sheet is over
    // it. This is the only thing the 3D is told about the editorial layer.
    input.current.cover = cover

    // Past the end of the track the scene has nothing left to show, so it
    // releases the page to the close and stops rendering entirely.
    const past = scrollY > top + span + innerHeight * 0.2
    setOffstage((was) => (was === past ? was : past))

    setChapter(chapterFor(story))
    setMuseumStop(museumStopFor(story))
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
    // Chapter ranges are in story space; the page scrolls in document space.
    const doc = docForStory(CHAPTERS[found].range[0])
    scrollToY(
      track.offsetTop + doc * (track.offsetHeight - innerHeight),
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

  // One ref per editorial section, so the scroll handler can write its `--s`
  // straight to the DOM without a render.
  const bindHold = (id) => ({
    innerRef: (el) => {
      holdRefs.current[id] = el
    },
  })

  // The list and the branches are two ways of asking the same question, so
  // they resolve to one focus — and the list sounds like the branch it points
  // at, using the discipline textures the audio layer already has.
  const handleDisciplineFocus = useCallback((id) => {
    setHoveredDiscipline(id)
    if (id && DISCIPLINE_BY_ID[id]) sound(`disc.${id}`)
  }, [])

  const handleHoverChange = (next) => {
    setHover(next)
    setHoveredDiscipline(next.kind === 'discipline' ? next.id : null)
    soundForHover(next)
  }

  const interactive = Boolean(hover.kind) || Boolean(hoveredDiscipline)

  return (
    <div className="edu" ref={rootRef} data-chapter={chapter} data-past={offstage} data-sheet="none">
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
          // Nothing to show once the reader is into the close, and a WebGL
          // scene nobody can see is the most expensive thing on a page.
          frameloop={offstage ? 'never' : 'always'}
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

      {/* The editorial chapters. They sit inside the journey rather than after
          it: each occupies a hold in timeline.js where the story stands still
          and a paper surface rises over the scene. */}
      <IntroInterlude {...bindHold('intro')} />
      <DisciplinesInterlude
        {...bindHold('disciplines')}
        hovered={hoveredDiscipline}
        onHover={handleDisciplineFocus}
      />
      <ConnectionInterlude {...bindHold('connection')} />
      <CampusInterlude {...bindHold('campus')} />

      {/* The scroll track. The scene is fixed behind it; this only exists to
          give the page a length for the journey to travel along. */}
      <div
        className="edu__track"
        ref={trackRef}
        style={{ height: `${TRACK_VH}vh` }}
        aria-hidden="true"
      />

      {/* And the close, in ordinary document flow. */}
      <FinalCTA onNavigate={scrollToChapter} />
      <EducationFooter onNavigate={scrollToChapter} />
    </div>
  )
}

export default EducationExperience
