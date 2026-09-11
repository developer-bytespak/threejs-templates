import { useCallback, useEffect, useRef } from 'react'
import { BRAND, CTA } from './content.js'
import { useScrollLink, usePrefersReducedMotion } from './scroll.js'

/**
 * The close.
 *
 * The action is a line of type with a rule under it, not a pill: the rule runs
 * the full width of the block and the label rides it. On a pointer device the
 * label leans toward the cursor and the rule's own travelling highlight tracks
 * it, so the whole width of the section is the target rather than a
 * two-hundred-pixel button. Both are damped and both switch off for touch and
 * for reduced motion, where it stays a plain, obvious link.
 */
function FinalProjectCTA() {
  const ref = useRef(null)
  const zoneRef = useRef(null)
  const reduced = usePrefersReducedMotion()
  useScrollLink(ref, 'cross')

  useEffect(() => {
    const zone = zoneRef.current
    if (!zone || reduced) return undefined
    if (matchMedia('(hover: none)').matches) return undefined

    let raf = 0
    let tx = 0
    let ty = 0
    let px = 0
    let x = 0
    let y = 0
    let cursor = 0

    const loop = () => {
      raf = 0
      x += (tx - x) * 0.12
      y += (ty - y) * 0.12
      cursor += (px - cursor) * 0.16
      zone.style.setProperty('--mx', x.toFixed(2))
      zone.style.setProperty('--my', y.toFixed(2))
      zone.style.setProperty('--cx', cursor.toFixed(4))
      if (Math.abs(tx - x) > 0.05 || Math.abs(ty - y) > 0.05 || Math.abs(px - cursor) > 0.001) {
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
    (id) => {
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    },
    [reduced],
  )

  return (
    <section className="c2cta" id="start" data-zone="dark" ref={ref} aria-label="Start a project">
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
    </section>
  )
}

export default FinalProjectCTA
