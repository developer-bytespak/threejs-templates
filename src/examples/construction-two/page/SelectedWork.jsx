import { useCallback, useRef, useState } from 'react'
import Plate from './Plates.jsx'
import { PROJECTS } from './content.js'
import { useScrollLink } from './scroll.js'

/**
 * The portfolio, as one frame that four projects pass through.
 *
 * Not a grid and not four cards: the section pins for a viewport per project
 * and each one takes over the frame from the last. The frame itself moves —
 * every project has its own rectangle and its own place for the metadata — so
 * the composition is never the same twice while the grammar stays constant.
 *
 * Each project's own 0..1 is written to its node as `--t` on the scroll tick,
 * and CSS derives an enter and an exit from it. No project fades in: they wipe,
 * slide and hand the frame over, which is what stops four projects reading as
 * four of anything.
 */

// Layout, not content — which is why it lives here rather than in content.js.
// Each project gets its own rectangle, its own drift direction and its own
// place to put the sector and the metadata.
const FRAMES = [
  { fx: '18vw', fw: '48vw', fy: '24vh', fh: '54vh', drift: '-7vw', wipe: 'up',    sector: 'tl', meta: 'br' },
  { fx: '32vw', fw: '50vw', fy: '20vh', fh: '62vh', drift: '6vw',  wipe: 'right', sector: 'br', meta: 'tl' },
  { fx: '14vw', fw: '46vw', fy: '25vh', fh: '52vh', drift: '-5vw', wipe: 'up',    sector: 'bl', meta: 'tr' },
  { fx: '30vw', fw: '52vw', fy: '22vh', fh: '58vh', drift: '7vw',  wipe: 'left',  sector: 'tr', meta: 'bl' },
]

function SelectedWork() {
  const sectionRef = useRef(null)
  const itemRefs = useRef([])
  const [active, setActive] = useState(0)

  const onProgress = useCallback((p) => {
    const n = PROJECTS.length
    // The last two-thirds of a viewport is handed to the seam, so the projects
    // finish before the section does.
    const span = 1 / n
    const scaled = Math.min(p / 0.88, 1)
    for (let i = 0; i < n; i += 1) {
      const el = itemRefs.current[i]
      if (!el) continue
      const t = (scaled - i * span) / span
      el.style.setProperty('--t', Math.max(-1.2, Math.min(t, 2)).toFixed(4))
    }
    const index = Math.min(n - 1, Math.max(0, Math.floor(scaled * n - 1e-6)))
    setActive((was) => (was === index ? was : index))
  }, [])

  useScrollLink(sectionRef, 'pin', onProgress)

  return (
    <section
      className="c2work"
      id="selected-work"
      data-zone="light"
      ref={sectionRef}
      style={{ '--count': PROJECTS.length }}
      aria-label="Selected work"
    >
      <div className="c2work__pin">
        <header className="c2work__head">
          <p className="c2label">Selected work</p>
          <i className="c2work__rule" aria-hidden="true" />
          <p className="c2work__count">
            <b>{PROJECTS[active].index}</b>
            <span>/ {String(PROJECTS.length).padStart(2, '0')}</span>
          </p>
        </header>

        <div className="c2work__stage">
          {PROJECTS.map((project, i) => {
            const frame = FRAMES[i % FRAMES.length]
            return (
              <article
                className="c2work__item"
                key={project.id}
                ref={(el) => {
                  itemRefs.current[i] = el
                }}
                data-wipe={frame.wipe}
                data-sector={frame.sector}
                data-meta={frame.meta}
                style={{
                  '--fx': frame.fx,
                  '--fw': frame.fw,
                  '--fy': frame.fy,
                  '--fh': frame.fh,
                  '--drift': frame.drift,
                  zIndex: i + 1,
                }}
              >
                <p className="c2work__sector">{project.sectorShort}</p>

                <div className="c2work__frame">
                  <div className="c2work__media">
                    {project.image ? (
                      <img src={project.image} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <Plate kind={project.plate} />
                    )}
                  </div>
                  <i className="c2work__edge c2work__edge--t" aria-hidden="true" />
                  <i className="c2work__edge c2work__edge--b" aria-hidden="true" />
                  <p className="c2work__view" aria-hidden="true">
                    View
                  </p>
                </div>

                <div className="c2work__meta">
                  <h3>{project.name}</h3>
                  <dl>
                    <div>
                      <dt>Area</dt>
                      <dd>{project.area}</dd>
                    </div>
                    <div>
                      <dt>Delivery</dt>
                      <dd>{project.delivery}</dd>
                    </div>
                    <div>
                      <dt>Completed</dt>
                      <dd>{project.year}</dd>
                    </div>
                  </dl>
                  <p className="c2work__note">{project.note}</p>
                </div>
              </article>
            )
          })}
        </div>

        {/* The seam. The frame's baseline survives the section and becomes the
            measurement rule the numbers below are set against. */}
        <i className="c2work__seam" aria-hidden="true" />
      </div>

      {/* The same four projects, in the document, for anyone who never sees the
          choreography — search engines, readers, reduced-motion, no-JS. */}
      <ol className="c2work__index" aria-label="Projects">
        {PROJECTS.map((project) => (
          <li key={project.id}>
            <span>{project.index}</span>
            <h3>{project.name}</h3>
            <p>
              {project.sector} — {project.area}, {project.delivery}, {project.year}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default SelectedWork
