import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor, useProgress } from '@react-three/drei'
import * as THREE from 'three'
import SiteScene from './SiteScene.jsx'
import { createScrollHold } from './scrollHold.js'
import SoundButton from '../../audio/SoundButton.jsx'
import { useAudioInit } from './audio/useAudio.js'
import { SITE_URL, SURVEY_URL } from './site.js'
import { STAGE_COUNT, TRACK_VH, resolveQuality } from './quality.js'
import './SiteExperience.css'

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

/**
 * A failed model load should cost the page its 3D, not its existence. The
 * gradient backdrop and the scroll track stay behind this, so the route still
 * renders and still scrolls.
 */
class SceneBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error(
      '[construction] the 3D scene failed to start. The site models are ' +
        `expected at ${SITE_URL} and ${SURVEY_URL}.`,
      error,
    )
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

/** A single hairline that fills as the models load. No copy, by design. */
function Loader({ onReady }) {
  const { progress, errors } = useProgress()
  const done = progress >= 100 || errors.length > 0

  useEffect(() => {
    if (done) onReady()
  }, [done, onReady])

  return (
    <div className="construction__loader" data-hidden={done} aria-hidden="true">
      <span style={{ transform: `scaleX(${progress / 100})` }} />
    </div>
  )
}

/**
 * The route shell.
 *
 * Deliberately content-free: the sections below exist only to give the
 * choreography scroll distance. Each one is a normal section with an empty
 * slot inside it, so copy or a call to action can be dropped into any stage
 * later without the WebGL layer knowing or caring.
 */
function SiteExperience() {
  const reducedMotion = usePrefersReducedMotion()
  // Reads the environment and the stored preference. Constructs no
  // AudioContext and attaches no listeners: the button below is the only
  // thing on this page that ever starts sound, and it stays off until asked.
  useAudioInit()
  const [device, setDevice] = useState(measure)
  const [ready, setReady] = useState(false)
  const [throttled, setThrottled] = useState(false)

  // Scroll and pointer never enter React state: they change continuously and
  // the scene reads them straight out of this ref inside its frame loop.
  const input = useRef({
    progress: 0,
    pointerX: 0,
    pointerY: 0,
    pointerActive: false,
    // Filled in below. The scene reaches for it while the excavation is
    // running and leaves it alone the rest of the time.
    hold: null,
  })

  const bar = useRef(null)

  // The excavation is one four-second event, and for the length of it the page
  // is driven rather than scrolled — otherwise a reader can be four screens
  // past the site before the second lift has let go. Created here because it
  // belongs to the document, not to the canvas, and handed to the scene through
  // the same ref everything else about input travels in.
  const hold = useMemo(
    () => (typeof window === 'undefined' ? null : createScrollHold()),
    [],
  )
  useEffect(() => {
    input.current.hold = hold
    return () => {
      input.current.hold = null
      hold?.dispose()
    }
  }, [hold])

  const quality = useMemo(
    () => resolveQuality(device.width, device.coarse),
    [device.width, device.coarse],
  )

  const onReady = useCallback(() => setReady(true), [])

  useEffect(() => {
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - innerHeight
      const progress = scrollable > 0 ? scrollY / scrollable : 0
      input.current.progress = progress
      if (bar.current) bar.current.style.transform = `scaleY(${progress})`
    }

    const onResize = () => {
      const next = measure()
      // Re-render only when the tier would actually change. Rebuilding the
      // scene on every resize frame would stall the main thread, and the
      // camera framing would jump with it.
      setDevice((current) =>
        resolveQuality(current.width, current.coarse).tier ===
        resolveQuality(next.width, next.coarse).tier
          ? current
          : next,
      )
      onScroll()
    }

    const onPointerMove = (event) => {
      // Touch drives scrolling, not parallax: following it here would fight
      // the gesture the user is already making.
      if (event.pointerType === 'touch') return
      input.current.pointerX = (event.clientX / innerWidth) * 2 - 1
      input.current.pointerY = -((event.clientY / innerHeight) * 2 - 1)
      input.current.pointerActive = true
    }

    const onPointerLeave = () => {
      // Recentre rather than freeze, so the scene eases back instead of
      // holding whatever angle the pointer had as it left the window.
      input.current.pointerX = 0
      input.current.pointerY = 0
      input.current.pointerActive = false
    }

    // The browser may restore a scroll offset on reload. Reading it here means
    // the site derives its state from wherever the page actually is, so a
    // refresh halfway down resumes on exactly that frame instead of starting
    // over and animating to it.
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

  const stages = useMemo(
    () => Array.from({ length: STAGE_COUNT }, (_, i) => `stage-${i + 1}`),
    [],
  )

  return (
    <div className="construction">
      <div className="construction__stage">
        <div className="construction__backdrop" aria-hidden="true" />

        <Canvas
          className="construction__canvas"
          data-ready={ready}
          // 'percentage' maps to PCFShadowMap; three deprecated the softer
          // variant, and at this shadow-map size the difference is invisible.
          shadows={quality.shadows ? 'percentage' : false}
          dpr={[1, throttled ? 1 : quality.maxDpr]}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance',
          }}
          // Matches the opening framing in SiteCamera, so the first painted
          // frame is the shot rather than a lurch toward it.
          camera={{ fov: 36, position: [54, 27, 48], near: 0.5, far: 400 }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping
            gl.toneMappingExposure = 1.04
          }}
        >
          {/* Sheds resolution rather than frames if the device cannot keep up. */}
          <PerformanceMonitor
            onDecline={() => setThrottled(true)}
            onIncline={() => setThrottled(false)}
          />
          <SceneBoundary>
            <Suspense fallback={null}>
              <SiteScene
                input={input}
                quality={quality}
                reducedMotion={reducedMotion}
              />
            </Suspense>
          </SceneBoundary>
        </Canvas>

        <div className="construction__vignette" aria-hidden="true" />
      </div>

      <Loader onReady={onReady} />

      {/* The one control on the page. Shared with /construction-two and
          /education, which means one preference across the site rather than
          three pages each asking the same question. */}
      <div className="construction__sound">
        <SoundButton entered={ready} />
      </div>

      {/* The scroll track. These sections carry no copy on purpose — they are
          the distance the choreography runs over. Each has an empty slot ready
          to receive content without any of the WebGL above changing. */}
      <main className="construction__content">
        {stages.map((id) => (
          <section
            key={id}
            id={id}
            className="construction-scroll-stage"
            style={{ minHeight: `${TRACK_VH / STAGE_COUNT}vh` }}
          >
            <div className="construction-scroll-stage__slot" />
          </section>
        ))}
      </main>

      <div className="construction__progress" aria-hidden="true">
        <span className="construction__progress-fill" ref={bar} />
      </div>
    </div>
  )
}

export default SiteExperience
