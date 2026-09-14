import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BRAND } from './content.js'
import { lockScroll, usePrefersReducedMotion } from './scroll.js'

/**
 * The title block.
 *
 * A drawing announces itself in the corner — sheet, revision, scale — and this
 * is the same object: the wordmark sits at exactly the navbar's coordinates so
 * that when the panel lifts, the bar it leaves behind is already in place, and
 * the count is set as a dimension against the rule it measures. There is no
 * spinner and no logo animation, because neither of those is in this page's
 * vocabulary.
 *
 * Nothing here re-renders while it counts. The Canvas behind the panel is
 * compiling shaders and uploading a GLB on the same thread, so the numeral and
 * the rule are written straight to the DOM once a frame instead of through
 * React — a loading screen that costs the thing it is waiting for is an
 * unusually silly way to lose frames.
 */
const EXIT_MS = 1000

function Preloader({ target, stage, ready }) {
  const reduced = usePrefersReducedMotion()
  const rootRef = useRef(null)
  const numRef = useRef(null)
  const stageRef = useRef(null)
  const shown = useRef(0)
  const [phase, setPhase] = useState('load')

  // The count. `shown` chases `target` and never overtakes it, so the number
  // on screen is always one the site can stand behind — it just arrives
  // smoothly rather than in the three jumps the underlying cohorts make.
  useLayoutEffect(() => {
    if (phase === 'gone') return undefined
    let frame = 0
    let last = -1
    let clock = 0

    const draw = (now) => {
      frame = requestAnimationFrame(draw)

      // Seconds, not frames. The first version eased by a fixed fraction per
      // frame, which quietly made the counter's speed a function of the
      // frame rate — and the frame rate here is whatever is left over after a
      // WebGL scene finishes compiling. On a slow machine the count crawled to
      // 100 long after the page was ready to show. This converges in the same
      // wall-clock time on any device.
      const dt = clock ? Math.min((now - clock) / 1000, 0.1) : 0.016
      clock = now
      const to = ready ? 1 : target.current
      const rate = ready ? 9 : 3.5
      // Forward only. Clamping down to the target as well as up meant that any
      // dip in the figure behind it — and there was one — showed as the count
      // running backwards, which is the single thing a progress number must
      // never do. If the target falls, this waits for it to catch up instead.
      if (to > shown.current) {
        shown.current += (to - shown.current) * (1 - Math.exp(-rate * dt))
      }
      if (ready && 1 - shown.current < 0.004) shown.current = 1

      const v = shown.current
      rootRef.current?.style.setProperty('--v', v.toFixed(4))
      const n = Math.floor(v * 100)
      if (n !== last) {
        last = n
        if (numRef.current) numRef.current.textContent = String(n).padStart(2, '0')
      }
      if (stageRef.current && stageRef.current.textContent !== stage.current) {
        stageRef.current.textContent = stage.current
      }

      // The panel does not leave the instant the work finishes — it leaves
      // when the number has caught up with it. Otherwise the last thing anyone
      // sees is a loader wiping away at 91%.
      if (ready && shown.current >= 1) {
        cancelAnimationFrame(frame)
        frame = 0
        setPhase('leave')
      }
    }

    draw(performance.now())
    return () => { if (frame) cancelAnimationFrame(frame) }
  }, [ready, phase, target, stage])

  // Scroll comes back only once the panel is off the page. Released at the
  // start of the wipe, a trackpad already in motion would throw the reader
  // into the middle of the hero before they had seen the top of it.
  useEffect(() => {
    if (phase !== 'leave') return undefined
    const t = setTimeout(() => {
      lockScroll(false)
      setPhase('gone')
    }, reduced ? 220 : EXIT_MS)
    return () => clearTimeout(t)
  }, [phase, reduced])

  if (phase === 'gone') return null

  return (
    <div
      className="c2load"
      ref={rootRef}
      data-phase={phase}
      data-reduced={reduced}
      role="progressbar"
      aria-label="Loading"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-live="polite"
    >
      <i className="c2load__grid" aria-hidden="true" />

      <div className="c2load__head">
        <p className="c2load__brand">
          <b>{BRAND.mark}</b>
          <i aria-hidden="true" />
          <span>{BRAND.name}</span>
        </p>
        <p className="c2load__state">Loading</p>
      </div>

      <div className="c2load__block">
        <p className="c2load__count" aria-hidden="true">
          <span ref={numRef}>00</span>
          <em>%</em>
        </p>

        <div className="c2load__track">
          <i className="c2load__fill" />
        </div>

        <div className="c2load__foot">
          <span ref={stageRef}>Model</span>
          <span>Preconstruction studio</span>
        </div>
      </div>
    </div>
  )
}

export default Preloader
