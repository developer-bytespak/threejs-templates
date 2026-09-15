import { FOOTER } from './site.js'
import { BranchMark } from './Diagrams.jsx'

/**
 * The close: the footer, and nothing else.
 *
 * It sits BEHIND the fixed panel that holds the scene, and is revealed by that
 * panel lifting away at the end of the journey rather than by scrolling up over
 * it. That is why it takes `revealed` as a prop instead of watching itself with
 * an IntersectionObserver: a fixed element that is merely covered is still
 * intersecting the viewport, so an observer would report it visible on page
 * load and draw the whole mark while nobody could see it. What counts as
 * "arrived" here is a fact about the handoff, and the handoff is measured in
 * one place — the scroll reader.
 */

export function EducationFooter({ innerRef, revealed = false, onNavigate }) {
  const drawn = revealed
  return (
    <footer className="edu-foot" ref={innerRef} data-drawn={drawn}>
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
