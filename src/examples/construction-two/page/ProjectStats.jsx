import { useRef } from 'react'
import { STATS } from './content.js'
import { useScrollLink } from './scroll.js'

/**
 * Credibility, set as figures rather than as cards.
 *
 * The numbers are the layout: they sit on a twelve-column grid at four
 * different sizes and four different heights, so the eye moves through them
 * instead of scanning a row. Each one arrives as an outline and is then filled
 * by a sweep travelling up through the glyphs, with its measurement rule
 * extending underneath — the same two moves the drawing in the hero makes.
 */
function ProjectStats() {
  const ref = useRef(null)
  useScrollLink(ref, 'cross')

  return (
    <section className="c2stats" data-zone="light" ref={ref} aria-label="By the numbers">
      <header className="c2stats__head">
        <p className="c2label">Record</p>
        <p className="c2stats__since">Measured at handover, not at award</p>
      </header>

      <div className="c2stats__grid">
        {STATS.map((stat, i) => (
          <div className="c2stat" key={stat.id} style={{ '--i': i }}>
            <p className="c2stat__value">
              <span className="c2stat__outline" aria-hidden="true">
                {stat.value}
              </span>
              <span className="c2stat__fill">{stat.value}</span>
            </p>
            <i className="c2stat__rule" aria-hidden="true" />
            <p className="c2stat__label">{stat.label}</p>
            <p className="c2stat__note">{stat.rule}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default ProjectStats
