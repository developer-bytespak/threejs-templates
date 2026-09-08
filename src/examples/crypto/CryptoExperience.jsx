import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import CryptoScene from './CryptoScene.jsx'
import { resolveQuality, TRACK_VH } from './quality.js'
import './CryptoExperience.css'

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

function CryptoExperience() {
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

  // The progress bar is written the same way — straight to the element — so a
  // continuous scroll never costs a render.
  const bar = useRef(null)

  const quality = useMemo(
    () => resolveQuality(device.width, device.coarse),
    [device.width, device.coarse],
  )

  useEffect(() => {
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - innerHeight
      const progress = scrollable > 0 ? scrollY / scrollable : 0
      input.current.progress = progress
      if (bar.current) bar.current.style.transform = `scaleY(${progress})`
    }

    const onResize = () => {
      const next = measure()
      // Re-render only when the quality tier would actually change. Rebuilding
      // the particle buffers on every resize frame would stall the main
      // thread for no visible gain.
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
    // the scene derives its state from wherever the page actually is, so a
    // refresh halfway down resumes coherently instead of starting over.
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

  return (
    <div className="crypto">
      <div className="crypto__stage">
        <div className="crypto__glow" aria-hidden="true" />
        <Canvas
          className="crypto__canvas"
          data-ready={ready}
          dpr={[1, throttled ? 1 : quality.maxDpr]}
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
          camera={{ fov: 42, position: [0, 0.35, 8.6], near: 0.1, far: 60 }}
          onCreated={() => setReady(true)}
        >
          {/* Sheds resolution rather than frames if the device cannot keep up. */}
          <PerformanceMonitor
            onDecline={() => setThrottled(true)}
            onIncline={() => setThrottled(false)}
          />
          <Suspense fallback={null}>
            <CryptoScene
              input={input}
              quality={quality}
              reducedMotion={reducedMotion}
            />
          </Suspense>
        </Canvas>
      </div>

      <div className="crypto__loader" data-hidden={ready} aria-hidden="true">
        <span />
      </div>

      {/* Nothing but height: this is the scroll the whole scene is a function
          of, so the page is scrollable with no copy on it. */}
      <div
        className="crypto__track"
        style={{ height: `${TRACK_VH}vh` }}
        aria-hidden="true"
      />

      <div className="crypto__progress" aria-hidden="true">
        <span className="crypto__progress-fill" ref={bar} />
      </div>
    </div>
  )
}

export default CryptoExperience
