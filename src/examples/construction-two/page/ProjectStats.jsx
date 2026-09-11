import { useRef, useState } from 'react'
import { STATS } from './content.js'
import { usePointerField, useScrollLink } from './scroll.js'

/**
 * Credibility set as figures rather than as cards — now with the cursor
 * allowed to pick one up.
 *
 * The scroll reveal is unchanged in principle: each figure arrives as an
 * outline and is filled by a sweep travelling up through the glyphs, with a
 * dimension string extending underneath. What is new is what happens when the
 * pointer arrives.
 *
 * One accent lives in the section and only one figure can hold it at a time.
 * At rest it sits on 3.2M; hover any other figure and the blue transfers to it
 * and 3.2M goes back to ink. That is the whole interaction idea — not four
 * things lighting up, one thing moving.
 *
 * On top of that each figure leans a few pixels toward the cursor and its
 * measurement rule runs out slightly as the cursor moves right. Both are
 * damped, both are written straight to the node as custom properties, and
 * neither exists on a touch device.
 */

// At rest the accent sits on the third figure. Hovering moves it.
const RESTING_ACCENT = 2

function Stat({ stat, index, accented, onEnter }) {
  const ref = useRef(null)
  usePointerField(ref, { damp: 0.16 })

  return (
    <div
      className="c2stat"
      ref={ref}
      style={{ '--i': index }}
      data-accent={accented}
      onMouseEnter={() => onEnter(index)}
    >
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
  )
}

function ProjectStats() {
  const ref = useRef(null)
  const [hovered, setHovered] = useState(-1)
  useScrollLink(ref, 'cross')

  const accentOn = hovered < 0 ? RESTING_ACCENT : hovered

  return (
    <section
      className="c2stats"
      data-zone="light"
      ref={ref}
      data-hovering={hovered >= 0}
      onMouseLeave={() => setHovered(-1)}
      aria-label="By the numbers"
    >
      <header className="c2stats__head">
        <p className="c2label">Record</p>
        <p className="c2stats__since">Measured at handover, not at award</p>
      </header>

      <div className="c2stats__grid">
        {STATS.map((stat, i) => (
          <Stat
            key={stat.id}
            stat={stat}
            index={i}
            accented={i === accentOn}
            onEnter={setHovered}
          />
        ))}
      </div>
    </section>
  )
}

export default ProjectStats
