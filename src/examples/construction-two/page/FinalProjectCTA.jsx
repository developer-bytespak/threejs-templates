import { useCallback, useEffect, useRef } from 'react'
import { BRAND, CTA } from './content.js'
import { SitePlan } from './ScrollDrawings.jsx'
import { scrollToEl, usePointerField, useScrollLink, usePrefersReducedMotion } from './scroll.js'
import { sound } from '../audio/AudioManager.js'
import { useThresholds } from '../audio/useAudio.js'

/**
 * The close.
 *
 * The action is a line of type on a rule that runs the full width of the
 * block, not a pill: on a pointer device the label leans toward the cursor and
 * a short bright segment travels along the rule tracking it, so the whole band
 * is the target rather than two hundred pixels of button.
 *
 * The right half holds a site plan that draws as the section arrives —
 * boundary, dimensions, setbacks, footprint, the way in, a hatched yard, and a
 * survey crosshair that settles last. Once it has resolved the crosshair
 * follows the cursor by a few pixels and no more. It is deliberately a
 * different drawing from the structural frame above it: that one is a
 * building, this one is a plot, which is what the section is asking for.
 */
function FinalProjectCTA() {
  const ref = useRef(null)
  const zoneRef = useRef(null)
  const planRef = useRef(null)
  const reduced = usePrefersReducedMotion()

  /**
   * One sound in the whole section.
   *
   * This is the end of the page and the resolution of an hour of drawing, so
   * the temptation is to mark it. The opposite is correct: everything above
   * has been building density, and the only thing that can read as an ending
   * after that is a single quiet tone when the site plan closes — no impact,
   * no confirmation chime, nothing that sounds like a notification.
   *
   * Fired when the survey mark has settled, which is the last stroke drawn.
   */
  const onProgress = useThresholds([0.88], () => sound('plan.done'))

  useScrollLink(ref, 'cross', onProgress)
  usePointerField(planRef, { enabled: !reduced, damp: 0.1 })

  useEffect(() => {
    const zone = zoneRef.current
    if (!zone || reduced) return undefined
    if (matchMedia('(hover: none)').matches) return undefined

    let raf = 0
    let tx = 0
    let ty = 0
    let px = 0.5
    let x = 0
    let y = 0
    let cursor = 0.5

    const loop = () => {
      raf = 0
      x += (tx - x) * 0.12
      y += (ty - y) * 0.12
      cursor += (px - cursor) * 0.16
      zone.style.setProperty('--mx', x.toFixed(2))
      zone.style.setProperty('--my', y.toFixed(2))
      zone.style.setProperty('--cx', cursor.toFixed(4))
      if (
        Math.abs(tx - x) > 0.05 ||
        Math.abs(ty - y) > 0.05 ||
        Math.abs(px - cursor) > 0.001
      ) {
        raf = requestAnimationFrame(loop)
      }
    }
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(loop)
    }

    const onMove = (event) => {
      const rect = zone.getBoundingClientRect()
      px = (event.clientX - rect.left) / rect.width
      tx = (event.clientX - (rect.left + rect.width / 2)) * 0.06
      ty = (event.clientY - (rect.top + rect.height / 2)) * 0.16
      kick()
    }
    const onLeave = () => {
      tx = 0
      ty = 0
      px = 0.5
      kick()
    }

    zone.addEventListener('pointermove', onMove)
    zone.addEventListener('pointerleave', onLeave)
    return () => {
      zone.removeEventListener('pointermove', onMove)
      zone.removeEventListener('pointerleave', onLeave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [reduced])

  const go = useCallback(
    (id) => scrollToEl(document.getElementById(id), reduced),
    [reduced],
  )

  return (
    <section className="c2cta" id="start" data-zone="dark" ref={ref} aria-label="Start a project">
      <div className="c2cta__copy">
        <p className="c2label c2label--invert">New business</p>

        <h2 className="c2cta__lines">
          {CTA.lines.map((line, i) => (
            <span key={line} style={{ '--i': i }}>
              <b>{line}</b>
            </span>
          ))}
        </h2>

        <p className="c2cta__note">{CTA.note}</p>

        <div className="c2cta__zone" ref={zoneRef}>
          <i className="c2cta__rule" aria-hidden="true" />
          <a className="c2cta__primary" href={`mailto:${BRAND.email}`}>
            <span>{CTA.primary}</span>
            <i aria-hidden="true">↗</i>
          </a>
          <button className="c2cta__secondary" type="button" onClick={() => go('selected-work')}>
            {CTA.secondary}
          </button>
        </div>
      </div>

      <div className="c2cta__draw" ref={planRef}>
        <SitePlan />
        <p className="c2cta__key" aria-hidden="true">
          <span>Boundary</span>
          <span>Footprint</span>
          <span>Access</span>
        </p>
      </div>
    </section>
  )
}

export default FinalProjectCTA
