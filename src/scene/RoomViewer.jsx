import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import * as THREE from 'three'
import Room from './Room.jsx'
import Building from './Building.jsx'
import CinematicCamera from './CinematicCamera.jsx'
import { SHOTS } from './shots.js'
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

function LoadingOverlay() {
  const { active, progress } = useProgress()
  if (!active && progress === 100) return null

  return (
    <div className="viewer-overlay">
      <p className="viewer-overlay__label">Loading the office</p>
      <div className="viewer-overlay__track">
        <div className="viewer-overlay__bar" style={{ width: `${progress}%` }} />
      </div>
      <p className="viewer-overlay__value">{Math.round(progress)}%</p>
    </div>
  )
}

function RoomViewer() {
  const reducedMotion = usePrefersReducedMotion()
  const [active, setActive] = useState(0)

  // Scroll and pointer feed the camera through a ref, not state: they change
  // every frame and re-rendering the scene tree on each one would be wasteful.
  const input = useRef({ progress: 0, pointerX: 0, pointerY: 0 })

  const scrollToIndex = (index, behavior) => {
    const scrollable = document.body.scrollHeight - innerHeight
    scrollTo({
      top: (index / (SHOTS.length - 1)) * scrollable,
      behavior,
    })
  }

  // Deep links: /#radio opens on that scene. Runs before paint so the page
  // never shows the opening shot and then jumps.
  useLayoutEffect(() => {
    history.scrollRestoration = 'manual'
    const index = SHOTS.findIndex((shot) => shot.id === location.hash.slice(1))
    if (index > 0) scrollToIndex(index, 'auto')
  }, [])

  useEffect(() => {
    const onScroll = () => {
      const scrollable = document.body.scrollHeight - innerHeight
      const progress = scrollable > 0 ? scrollY / scrollable : 0
      input.current.progress = progress
      setActive(Math.round(progress * (SHOTS.length - 1)))
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

  // Keep the URL in step with the scene without stacking history entries.
  useEffect(() => {
    const hash = `#${SHOTS[active].id}`
    if (location.hash !== hash) history.replaceState(null, '', hash)
  }, [active])

  return (
    <>
      <div className="stage">
        <Canvas
          shadows="percentage"
          dpr={[1, 2]}
          camera={{ fov: SHOTS[0].fov, position: [2, 1.6, 2] }}
          gl={{ antialias: true }}
          onCreated={({ gl }) => {
            // The toon shader emits finished colours. Any tone mapping on top
            // would bend the palette away from the Blender render.
            gl.toneMapping = THREE.NoToneMapping
          }}
        >
          <color attach="background" args={['#0A1740']} />

          <Suspense fallback={null}>
            <Room />
            <Building input={input} reducedMotion={reducedMotion} />
            <CinematicCamera input={input} reducedMotion={reducedMotion} />
          </Suspense>
        </Canvas>

        <div className="vignette" />

        <div className="captions">
          {SHOTS.map((shot, index) => (
            <article
              key={shot.id}
              className="caption"
              data-active={index === active}
              aria-hidden={index !== active}
            >
              <p className="caption__eyebrow">{shot.eyebrow}</p>
              <h2 className="caption__title">{shot.title}</h2>
              <p className="caption__body">{shot.body}</p>
            </article>
          ))}
        </div>

        <nav className="rail" aria-label="Scenes">
          {SHOTS.map((shot, index) => (
            <button
              key={shot.id}
              type="button"
              className="rail__dot"
              data-active={index === active}
              aria-label={shot.title}
              aria-current={index === active}
              onClick={() => scrollToIndex(index, reducedMotion ? 'auto' : 'smooth')}
            />
          ))}
        </nav>

        <div className="hint" data-visible={active === 0}>
          <span>Scroll</span>
          <i />
        </div>
      </div>

      {/* The scroll track. The scene is fixed behind it; this only exists to
          give the page a length for the camera to travel along. */}
      <div
        className="track"
        style={{ height: `${SHOTS.length * 100}vh` }}
        aria-hidden="true"
      />

      <LoadingOverlay />
    </>
  )
}

export default RoomViewer
