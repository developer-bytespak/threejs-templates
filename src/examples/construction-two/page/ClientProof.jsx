import { useRef } from 'react'
import { CLIENTS, FACTS } from './content.js'
import { useScrollLink } from './scroll.js'

/**
 * The client rail, interrupted.
 *
 * A logo rail on its own is filler, so the facts are set *into* the rail rather
 * than beside it: the strip runs, and every few names a figure comes past at
 * four times the size and takes the line over. Two rails run in opposite
 * directions so the band never resolves into one readable row, and both are
 * CSS animations — no JS, because nothing here needs to know where the page is.
 *
 * The names are placeholders and are labelled as such in content.js.
 */
function Rail({ direction, items }) {
  const run = [...items, ...items]
  return (
    <div className="c2proof__rail" data-dir={direction} aria-hidden="true">
      <div className="c2proof__run">
        {run.map((item, i) =>
          item.fact ? (
            <span className="c2proof__fact" key={`f-${item.id}-${i}`}>
              <b>{item.value}</b>
              <em>{item.label}</em>
            </span>
          ) : (
            <span className="c2proof__name" key={`n-${item.id}-${i}`}>
              {item.id}
            </span>
          ),
        )}
      </div>
    </div>
  )
}

/** Names with a fact dropped in after every third one. */
function weave(names, facts, offset) {
  const out = []
  let f = offset
  names.forEach((name, i) => {
    out.push({ id: name })
    if (i % 3 === 2) {
      out.push({ ...facts[f % facts.length], fact: true })
      f += 1
    }
  })
  return out
}

function ClientProof() {
  const ref = useRef(null)
  useScrollLink(ref, 'cross')

  return (
    <section className="c2proof" data-zone="dark" ref={ref} aria-label="Clients">
      <p className="c2label c2label--invert c2proof__label">Trusted to build for</p>

      <div className="c2proof__band">
        <Rail direction="left" items={weave(CLIENTS, FACTS, 0)} />
        <Rail direction="right" items={weave([...CLIENTS].reverse(), FACTS, 1)} />
      </div>

      <p className="c2proof__note">
        Placeholder names and figures — replace in <code>content.js</code>.
      </p>

      {/* The readable version of the rail. */}
      <p className="sr-only">
        Clients: {CLIENTS.join(', ')}.{' '}
        {FACTS.map((f) => `${f.value} ${f.label}`).join('. ')}.
      </p>
    </section>
  )
}

export default ClientProof
