import { useRef } from 'react'
import { STATEMENT } from './content.js'
import { useScrollLink } from './scroll.js'

/**
 * The page stops talking about itself for a moment.
 *
 * Four lines, four different treatments — a mask, a slide under a rule that
 * draws first, an outline that fills, and a settle — because a statement whose
 * lines all arrive the same way is a paragraph with a font size, not a
 * statement. Everything is keyed off the section's own progress so the lines
 * resolve in order as it crosses the viewport, slowly.
 */
function EditorialStatement() {
  const ref = useRef(null)
  useScrollLink(ref, 'cross')

  return (
    <section className="c2say" id="statement" data-zone="dark" ref={ref} aria-label="Statement">
      <p className="c2label c2label--invert c2say__label">{STATEMENT.label}</p>

      <h2 className="c2say__lines">
        <span className="c2say__line c2say__line--mask" style={{ '--i': 0 }}>
          <b>{STATEMENT.lines[0]}</b>
        </span>
        <span className="c2say__line c2say__line--rule" style={{ '--i': 1 }}>
          <i aria-hidden="true" />
          <b>{STATEMENT.lines[1]}</b>
        </span>
        <span className="c2say__line c2say__line--fill" style={{ '--i': 2 }}>
          <b aria-hidden="true" data-ghost>
            {STATEMENT.lines[2]}
          </b>
          <b>{STATEMENT.lines[2]}</b>
        </span>
        <span className="c2say__line c2say__line--settle" style={{ '--i': 3 }}>
          <b>{STATEMENT.lines[3]}</b>
        </span>
      </h2>

      <p className="c2say__foot">{STATEMENT.footnote}</p>
    </section>
  )
}

export default EditorialStatement
