import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor, useProgress } from '@react-three/drei'
import * as THREE from 'three'
import ConstructionScene from './ConstructionScene.jsx'
import { STAGE_COUNT, TRACK_VH, resolveQuality } from './quality.js'
import './ConstructionExperience.css'

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
      '[construction] the 3D scene failed to start. The building model is ' +
        `expected at ${'/models/construction/building_exploded_assembly.glb'}.`,
      error,
    )
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

/** A single hairline that fills as the model loads. No copy, by design. */
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
 * Deliberately content-free: the eight sections below exist only to give the
 * choreography scroll distance. Each one is a normal section with an empty
 * slot inside it, so copy, imagery or a call to action can be dropped into any
 * stage later without the WebGL layer knowing or caring.
 */
function ConstructionExperience() {
  const reducedMotion = usePrefersReducedMotion()
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
  })

  const stageRef = useRef(null)
  const bar = useRef(null)

  const quality = useMemo(
    () => resolveQuality(device.width, device.coarse),
    [device.width, device.coarse],
  )

  const onHoverChange = useCallback((layer) => {
    // Written straight to the DOM rather than through state: a hover must not
    // re-render a tree that contains the whole scene.
    if (stageRef.current) stageRef.current.dataset.hover = layer ? 'true' : 'false'
  }, [])

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
    // the building derives its state from wherever the page actually is, so a
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
      <div className="construction__stage" ref={stageRef} data-hover="false">
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
          camera={{ fov: 38, position: [46, 26, 52], near: 1, far: 400 }}
          onCreated={({ gl }) => {
            // Filmic tone mapping is the single biggest thing standing between
            // a lit box and something that looks photographed.
            gl.toneMapping = THREE.ACESFilmicToneMapping
            gl.toneMappingExposure = 1.06
          }}
        >
          {/* Sheds resolution rather than frames if the device cannot keep up. */}
          <PerformanceMonitor
            onDecline={() => setThrottled(true)}
            onIncline={() => setThrottled(false)}
          />
          <SceneBoundary>
            <Suspense fallback={null}>
              <ConstructionScene
                input={input}
                quality={quality}
                reducedMotion={reducedMotion}
                onHoverChange={onHoverChange}
              />
            </Suspense>
          </SceneBoundary>
        </Canvas>

        <div className="construction__vignette" aria-hidden="true" />
      </div>

      <Loader onReady={onReady} />

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

export default ConstructionExperience
