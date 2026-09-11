import { useEffect, useRef, useState } from 'react'
import {
  BUILD_PHASES,
  DRAWING_BEGIN,
  DRAWING_END,
  STORY_CHAPTERS,
  span,
} from './story.js'

/**
 * The page's voice.
 *
 * Six chapters, six different presentation modes — a pinned working paper, then
 * labels living on the wall itself, then three words with a lot of silence
 * between them, then almost nothing at all while the plan is drawn, then a
 * phase rail beside the model, then the close.
 *
 * Every chapter's copy is in the DOM the whole time and only its visibility is
 * driven by scroll, so the page reads as a document with or without the canvas.
 */

/** A phase rail that follows the model, not the clock. */
function PhaseRail({ active }) {
  return (
    <div className="phases" aria-label="Delivery phase">
      {BUILD_PHASES.map((phase) => (
        <div
          key={phase.key}
          className="phase"
          data-state={
            active === phase.index ? 'on' : active > phase.index ? 'done' : 'off'
          }
        >
          <i className="phase__rule" aria-hidden="true" />
          <span className="phase__index">
            {String(phase.index + 1).padStart(2, '0')}
          </span>
          <span className="phase__label">{phase.label}</span>
        </div>
      ))}
    </div>
  )
}

function ConstructionStoryUI({ input, chapter, progress, reducedMotion }) {
  // Building.jsx writes the furthest phase actually reached into the shared
  // input ref every frame. Polling it here and only calling setState when the
  // number changes keeps the rail exact without a re-render per scroll pixel.
  const [phase, setPhase] = useState(-1)
  const phaseRef = useRef(-1)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const next = input.current.buildPhase ?? -1
      if (next !== phaseRef.current) {
        phaseRef.current = next
        setPhase(next)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [input])

  const mode = chapter?.mode
  const drawn = span(progress, DRAWING_BEGIN, DRAWING_END)

  return (
    <div className="story" data-mode={mode} data-reduced={reducedMotion}>
      {STORY_CHAPTERS.map((c) => {
        const on = c.id === chapter?.id
        const inner = span(progress, c.from, c.to)

        return (
          <section
            key={c.id}
            id={`chapter-${c.id}`}
            className="chapter"
            data-mode={c.mode}
            data-on={on}
            aria-hidden={!on}
          >
            {/* ---- 01 preconstruction: a pinned working paper */}
            {c.mode === 'paper' && (
              <>
                <h2 className="display display--lead">
                  {c.headline.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </h2>
                <p className="metaline">
                  {c.meta.map((m) => (
                    <span key={m}>{m}</span>
                  ))}
                </p>
                <aside className="tracing" data-on={on}>
                  <p className="tracing__tag">{c.paper.tag}</p>
                  <p className="tracing__lead">
                    {c.paper.lead.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </p>
                  <ul className="tracing__list">
                    {c.paper.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </aside>
              </>
            )}

            {/* ---- 02 coordination: the wall carries the content. Heading is
                 kept in the DOM for readers and search, but visually the
                 world-space labels are the interface. */}
            {c.mode === 'annotations' && (
              <h2 className="sr-only">{c.headline.join(' ')}</h2>
            )}

            {/* ---- 03 context: three isolated words, spread across the view */}
            {c.mode === 'context' && (
              <>
                <h2 className="sr-only">{c.headline.join(' ')}</h2>
                <div className="context" aria-hidden="true">
                  {c.words.map((word, i) => (
                    <span
                      key={word}
                      className={`context__word context__word--${i + 1}`}
                      data-on={inner > 0.10 + i * 0.22}
                    >
                      {word}
                    </span>
                  ))}
                </div>
                <p className="metaline metaline--context">
                  <span>Built for the real world</span>
                </p>
              </>
            )}

            {/* ---- 04 documentation: near silence while the plan is drawn */}
            {c.mode === 'quiet' && (
              <>
                <div className="quietblock">
                  <p className="tag">{c.meta[0]}</p>
                  <h2 className="display display--quiet">
                    {c.headline.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </h2>
                </div>
                <p className="plotmeter" aria-hidden="true">
                  <i style={{ '--v': drawn }} />
                </p>
              </>
            )}

            {/* ---- 05 build: two words on opposite sides, phase rail on the right */}
            {c.mode === 'build' && (
              <>
                <h2 className="sr-only">{c.headline.join(' ')}</h2>
                <span
                  className="pole pole--plan"
                  data-dim={inner > 0.45}
                  aria-hidden="true"
                >
                  {c.poles[0]}
                </span>
                <span
                  className="pole pole--structure"
                  data-on={inner > 0.22}
                  aria-hidden="true"
                >
                  {c.poles[1]}
                </span>
                <PhaseRail active={phase} />
              </>
            )}

            {/* ---- 06 built work: the close */}
            {c.mode === 'final' && (
              <div className="final">
                <h2 className="display display--final">
                  {c.headline.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </h2>
                <ul className="sectors">
                  {c.sectors.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
                <p className="actions">
                  {c.actions.map((a) => (
                    <a key={a.label} className="action" href={a.href}>
                      {a.label}
                      <span aria-hidden="true"> ↗</span>
                    </a>
                  ))}
                </p>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

export default ConstructionStoryUI
