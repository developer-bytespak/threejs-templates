import { useCallback, useRef } from 'react'
import { PROCESS } from './content.js'
import { useScrollLink } from './scroll.js'

/**
 * The process, drawn rather than listed.
 *
 * This is the page's deliberate callback to the hero: the line that connects
 * the four stages is not faded in, it is *plotted*. The path carries
 * `pathLength="1"`, so a dash offset of `1 - p` is exactly the fraction of the
 * line that has been drawn — the same behaviour as the pen on the sheet
 * upstairs, expressed in two CSS declarations instead of a vertex buffer.
 *
 * Each stage switches on when the pen reaches it, not when the stage scrolls
 * into view, so the copy always arrives behind the line rather than ahead of it.
 */

// Where each stage sits along the drawn path, 0..1.
const MARKS = [0.06, 0.36, 0.66, 0.95]

function ProcessSection() {
  const ref = useRef(null)
  const steps = useRef([])

  const onProgress = useCallback((p) => {
    // The path is drawn over the middle of the section's travel: it starts once
    // the heading is in and finishes before the section leaves.
    const drawn = Math.max(0, Math.min((p - 0.16) / 0.6, 1))
    ref.current?.style.setProperty('--drawn', drawn.toFixed(4))
    for (let i = 0; i < steps.current.length; i += 1) {
      const el = steps.current[i]
      if (!el) continue
      const on = drawn >= MARKS[i] ? 'true' : 'false'
      if (el.dataset.on !== on) el.dataset.on = on
    }
  }, [])

  useScrollLink(ref, 'cross', onProgress)

  return (
    <section className="c2proc" id="process" data-zone="light" ref={ref} aria-label="Approach">
      <header className="c2proc__head">
        <p className="c2label">Approach</p>
        <h2 className="c2proc__title">
          <span>Four stages,</span>
          <span>one construction set.</span>
        </h2>
      </header>

      <div className="c2proc__body">
        <div className="c2grid" aria-hidden="true" />

        <svg
          className="c2proc__path"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          {/* The route the pen takes: in from the left at the film strip's
              baseline, down through the four stages, out under the statement. */}
          <path
            className="c2proc__ghost"
            d="M0 2 L22 2 L22 26 L74 26 L74 52 L18 52 L18 78 L66 78 L66 99 L100 99"
            pathLength="1"
          />
          <path
            className="c2proc__ink"
            d="M0 2 L22 2 L22 26 L74 26 L74 52 L18 52 L18 78 L66 78 L66 99 L100 99"
            pathLength="1"
          />
        </svg>

        <ol className="c2proc__steps">
          {PROCESS.map((step, i) => (
            <li
              className="c2proc__step"
              key={step.id}
              data-on="false"
              style={{ '--i': i }}
              ref={(el) => {
                steps.current[i] = el
              }}
            >
              <p className="c2proc__index">{step.index}</p>
              <h3 className="c2proc__name">{step.title}</h3>
              <p className="c2proc__copy">{step.body}</p>
              <i className="c2proc__node" aria-hidden="true" />
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export default ProcessSection
