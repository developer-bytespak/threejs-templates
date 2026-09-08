import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import CryptoScene from './CryptoScene.jsx'
import CryptoSections from './CryptoSections.jsx'
import { SECTIONS } from './sections.js'
import { STAGE_RANGES } from './stages.js'
import { resolveComposition, resolveQuality } from './quality.js'
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

const RANGE_LIST = Object.values(STAGE_RANGES)

function sectionIndexFor(progress) {
  for (let i = RANGE_LIST.length - 1; i >= 0; i -= 1) {
    if (progress >= RANGE_LIST[i][0]) return i
  }
  return 0
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
  const [active, setActive] = useState(0)
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
      setActive(sectionIndexFor(progress))
    }

    const onResize = () => {
      const next = measure()
      // Re-render only when the tier or the composition would actually
      // change. Rebuilding the particle buffers on every resize frame would
      // stall the main thread, and the camera framing would jump with it.
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

  const scrollToSection = (index) => {
    const scrollable = document.documentElement.scrollHeight - innerHeight
    scrollTo({
      top: RANGE_LIST[index][0] * scrollable,
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }

  return (
    <div className="crypto" data-layout={SECTIONS[active].layout}>
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
              composition={composition}
              reducedMotion={reducedMotion}
            />
          </Suspense>
        </Canvas>
      </div>

      <div className="crypto__loader" data-hidden={ready} aria-hidden="true">
        <span />
      </div>

      <CryptoSections
        active={active}
        quality={quality}
        onNavigate={scrollToSection}
      />

      <nav className="crypto__rail" aria-label="Sections">
        {SECTIONS.map((section, index) => (
          <button
            key={section.id}
            type="button"
            className="crypto__dot"
            data-active={index === active}
            aria-label={section.eyebrow}
            aria-current={index === active}
            onClick={() => scrollToSection(index)}
          />
        ))}
      </nav>
    </div>
  )
}

export default CryptoExperience
