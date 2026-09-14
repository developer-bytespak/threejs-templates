import { useCallback, useRef, useState } from 'react'
import ProjectMedia from './ProjectMedia.jsx'
import { PROJECTS } from './content.js'
import { useScrollLink } from './scroll.js'
import { sound } from '../audio/AudioManager.js'
import { useSoundOnChange } from '../audio/useAudio.js'

/**
 * The portfolio: four projects through one frame, each one physically taking
 * the frame from the last.
 *
 * Three things were wrong with the version this replaces, and each is answered
 * here by a specific decision.
 *
 * DEAD SCROLL. The section used to open on an empty stage and wait for the
 * pin to engage. Now project 01 is simply already there — fully set, fully
 * framed, from the first pixel of the section — because the hero has just
 * handed the page over and a half-arrived title at that moment reads as a
 * page still loading, not as a reveal. Its motion is the crop opening under
 * the reader. Nothing is ever waiting and nothing is ever caught mid-entrance.
 *
 * DISCONNECTED PROJECTS. Every slot's exit overlaps the next slot's entry by
 * 30%, so for a third of a viewport both projects are on screen and moving —
 * the outgoing one contracting and drifting away, the incoming one expanding
 * over it. There is no fade-out-wait-fade-in anywhere in the section.
 *
 * WEAK COMPOSITION. The text block does not move. It sits in the left column
 * and its lines clip over between projects while the photograph — the thing
 * worth looking at — does the travelling. That is how a printed portfolio
 * behaves, and it also means no two pieces of type can ever collide.
 *
 * All of it is written to the DOM as custom properties on the scroll tick.
 * React re-renders four times in the whole section, once per dominant project.
 */

// Enter early, hold, hand over. Expressed as fractions of a project's own slot.
const ENTER = 0.3  // an incoming project starts this far before its slot
const EXIT = 0.7   // an outgoing project starts leaving this far through

function SelectedWork() {
  const sectionRef = useRef(null)
  const itemRefs = useRef([])
  const indexRef = useRef(null)
  const [active, setActive] = useState(0)

  const entered = useRef(false)

  const onProgress = useCallback((p) => {
    // The character changes here: the studio is behind us and this is the
    // portfolio. One sheet moved, once, on the way in.
    if (!entered.current && p > 0.01) {
      entered.current = true
      sound('work.enter')
    } else if (entered.current && p <= 0.002) {
      entered.current = false
    }

    const n = PROJECTS.length
    // The last 12% is the run-out into the stats rule, so the projects finish
    // before the section does.
    const scaled = Math.min(p / 0.88, 1) * n

    for (let i = 0; i < n; i += 1) {
      const el = itemRefs.current[i]
      if (!el) continue
      const t = scaled - i
      el.style.setProperty('--t', Math.max(-1.5, Math.min(t, 2.5)).toFixed(4))
    }

    // The counter runs on a continuous value so the digits slide rather than
    // switch, and lands exactly on each integer.
    indexRef.current?.style.setProperty(
      '--i',
      Math.max(0, Math.min(scaled - 0.5, n - 1)).toFixed(4),
    )

    const next = Math.min(n - 1, Math.max(0, Math.round(scaled - 0.5)))
    setActive((was) => (was === next ? was : next))
  }, [])

  useScrollLink(sectionRef, 'pin', onProgress)

  /**
   * A project handing over to the next one.
   *
   * Two layers, forty milliseconds apart: air for the frame travelling, and a
   * single soft structural tap underneath it for the frame arriving. That is
   * deliberately not a whoosh — a whoosh says "transition", and what this
   * should say is that something physical was moved and set down, the way a
   * page in a portfolio is turned rather than swiped.
   *
   * The first project does not announce itself. It is already on screen when
   * the section begins, so a sound for it would be a sound for nothing.
   */
  useSoundOnChange(active, (index, was) => {
    sound('work.change', { rate: 1 + (index - was) * 0.04 })
    sound('work.change.body', { delay: 0.04 })
  })

  return (
    <section
      className="c2work"
      id="selected-work"
      data-zone="light"
      ref={sectionRef}
      style={{
        '--count': PROJECTS.length,
        '--enter': ENTER,
        '--exit': EXIT,
      }}
      aria-label="Selected work"
    >
      <div className="c2work__pin">
        <header className="c2work__head">
          <p className="c2label">Selected work</p>
          <i className="c2work__rule" aria-hidden="true" />
          <p className="c2work__count" aria-hidden="true">
            <span className="c2work__odometer">
              <span ref={indexRef}>
                {PROJECTS.map((project) => (
                  <b key={project.id}>{project.index}</b>
                ))}
              </span>
            </span>
            <em>/ {String(PROJECTS.length).padStart(2, '0')}</em>
          </p>
        </header>

        <div className="c2work__stage">
          {PROJECTS.map((project, i) => (
            <article
              className="c2work__item"
              key={project.id}
              ref={(el) => {
                itemRefs.current[i] = el
              }}
              data-first={i === 0}
              data-move={['up', 'right', 'diag', 'up'][i % 4]}
              style={{ zIndex: i + 1 }}
            >
              <div className="c2work__text">
                <p className="c2work__sector">
                  <span>{project.sectorShort}</span>
                </p>
                <h3 className="c2work__name">
                  <span>{project.name}</span>
                </h3>
                <dl className="c2work__meta">
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
                    <dd>
                      {project.year} — {project.place}
                    </dd>
                  </div>
                </dl>
                <i className="c2work__underline" aria-hidden="true" />
                <p className="c2work__note">{project.note}</p>
              </div>

              <div className="c2work__frame">
                <div className="c2work__media">
                  <ProjectMedia
                    src={project.image}
                    small={project.imageSmall}
                    plate={project.plate}
                    eager={i === 0}
                    alt=""
                  />
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="c2work__ticks" aria-hidden="true">
          {PROJECTS.map((project, i) => (
            <i key={project.id} data-state={i === active ? 'on' : i < active ? 'done' : 'off'} />
          ))}
        </div>
      </div>

      {/* The same four projects in the document, for search, for readers and
          for reduced motion — where this list becomes the section. */}
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
