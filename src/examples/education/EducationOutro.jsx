import { useEffect, useRef, useState } from 'react'
import { FOOTER } from './site.js'
import { BranchMark } from './Diagrams.jsx'

/**
 * The close: the footer, and nothing else.
 *
 * This is the only part of the page in ordinary document flow. Everything
 * above is a fixed stage with a scroll track in front of it, which is the
 * right shape for a journey and the wrong shape for a footer — a footer should
 * arrive because you reached the end of the page, not because a progress value
 * crossed a threshold.
 *
 * So the 3D stage releases once the story is finished and this scrolls up over
 * it normally. The handoff is the campus settling while the typography takes
 * the frame.
 *
 * Its mark draws on an IntersectionObserver rather than on scroll progress,
 * because it is not pinned: one observer, fired once, and the drawing itself
 * is a CSS transition. Nothing here runs per frame.
 */

function useDrawn(threshold = 0.3) {
  const ref = useRef(null)
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || drawn) return undefined
    if (typeof IntersectionObserver !== 'function') {
      setDrawn(true)
      return undefined
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        // Intersecting is the normal case. The second clause is for arriving
        // from somewhere other than a scroll: a jump to the bottom of the page,
        // a restored offset on reload, a nav click. The observer's first report
        // then says "not intersecting", because the section is already above
        // the viewport — and without this the drawing would wait forever for a
        // moment that has already passed, leaving the headline clipped to
        // nothing and the diagram blank. Already past counts as arrived.
        if (entry.isIntersecting || entry.boundingClientRect.bottom <= 0) {
          setDrawn(true)
        }
      },
      { threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [drawn, threshold])

  return [ref, drawn]
}

export function EducationFooter({ onNavigate }) {
  const [ref, drawn] = useDrawn(0.25)

  return (
    <footer className="edu-foot" ref={ref} data-drawn={drawn}>
      <div className="edu-foot__cta">
        <p className="edu-foot__ask">{FOOTER.cta.headline}</p>
        <button type="button" className="edu-link edu-link--lead" onClick={() => onNavigate('seed')}>
          <span>{FOOTER.cta.action}</span>
          <i aria-hidden="true">↗</i>
        </button>
      </div>

      <i className="edu-foot__rule" aria-hidden="true" />

      <div className="edu-foot__grid">
        <div className="edu-foot__identity">
          <p className="edu-foot__mark">
            {FOOTER.mark.map((word) => (
              <span key={word}>{word}</span>
            ))}
          </p>
          <p className="edu-foot__line">{FOOTER.line}</p>
          <BranchMark drawn={drawn} />
        </div>

        <nav className="edu-foot__nav" aria-label="Footer">
          {FOOTER.columns.map((column) => (
            <div key={column.title} className="edu-foot__col">
              <p className="edu-foot__title">{column.title}</p>
              <ul>
                {column.links.map((link) => (
                  <li key={link}>
                    <a href="#top" onClick={(e) => { e.preventDefault(); onNavigate('seed') }}>
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <i className="edu-foot__rule edu-foot__rule--thin" aria-hidden="true" />

      <div className="edu-foot__bottom">
        <p>{FOOTER.legal}</p>
        <ul>
          {FOOTER.policies.map((policy) => (
            <li key={policy}>
              <a href="#top" onClick={(e) => e.preventDefault()}>
                {policy}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  )
}
