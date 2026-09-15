import { DISCIPLINES } from './chapters.js'
import { CAMPUS_INFO, CONNECTION, DISCIPLINE_SECTION, INTRO } from './site.js'
import { CampusDiagram, ConnectionDiagram, KnowledgeDiagram } from './Diagrams.jsx'

/**
 * The editorial chapters, which sit *inside* the 3D timeline rather than after
 * it.
 *
 * Each one occupies a `hold` in timeline.js: a stretch of scroll where the
 * story stands still and a paper surface rises over the scene. That is what
 * makes them read as part of one journey instead of as a webpage bolted under
 * a WebGL header — the reader never leaves the experience, the experience
 * changes register.
 *
 * ALL MOTION IS ONE NUMBER. Each section is handed `--s`, its own 0..1, and
 * every reveal in the stylesheet is a clamp of it. Nothing animates on a
 * timer, nothing listens to scroll itself, and nothing re-renders while the
 * reader moves: the scroll handler writes one custom property per section and
 * CSS does the rest. Reversing is therefore correct for free, the same way it
 * is for the 3D.
 */

function Interlude({ id, tone = 'paper', innerRef, children }) {
  return (
    <section
      className="edu-int"
      ref={innerRef}
      data-int={id}
      data-tone={tone}
      data-live="false"
      data-open="false"
      aria-labelledby={`${id}-h`}
    >
      {/* The copy lives INSIDE the sheet, which clips it.
          It used to be a sibling, and that is the whole reason a half-risen
          sheet showed a headline floating on the scene above its own top edge:
          the surface was travelling and the type was not attached to it. Now
          the sheet is an `overflow: hidden` window and `__hold` counter-moves
          by exactly the sheet's own travel, so the copy stays locked to the
          viewport while the surface wipes across it. Nothing can be read
          outside the paper it is printed on. */}
      <div className="edu-int__sheet">
        <div className="edu-int__hold">
          <div className="edu-int__inner">{children}</div>
        </div>
      </div>
    </section>
  )
}

/** A headline whose lines rise out of their own mask, one after the other. */
function Lines({ id, lines, className = 'edu-int__head' }) {
  return (
    <h2 className={className} id={id}>
      {lines.map((line, i) => (
        <span key={line} className="edu-int__line" style={{ '--i': i }}>
          <span>{line}</span>
        </span>
      ))}
    </h2>
  )
}

/* ------------------------------------------------------------------ intro */
export function IntroInterlude({ innerRef }) {
  return (
    <Interlude id="intro" innerRef={innerRef}>
      <div className="edu-int__col">
        <p className="edu-int__eyebrow">
          <i aria-hidden="true" />
          {INTRO.eyebrow}
        </p>
        <Lines id="intro-h" lines={INTRO.headline} />
        <div className="edu-int__body">
          {INTRO.body.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <p className="edu-int__note">{INTRO.note}</p>
      </div>

      <div className="edu-int__figure">
        <KnowledgeDiagram />
        <p className="edu-int__caption">Fig. 01 — One root, five disciplines</p>
      </div>
    </Interlude>
  )
}

/* ------------------------------------------------------------ disciplines */
/**
 * The five, as a list rather than as cards.
 *
 * Hovering one reaches all the way into the 3D scene: `onHover` is the same
 * setter the branches themselves call, so the list and the tree are two ways
 * of asking the same question and resolve to one focus. Nothing about the
 * camera moves — inspecting a system should not fling you around it.
 */
export function DisciplinesInterlude({ hovered, onHover, innerRef }) {
  return (
    <Interlude id="disciplines" innerRef={innerRef}>
      <div className="edu-int__col edu-int__col--wide">
        <p className="edu-int__eyebrow">
          <i aria-hidden="true" />
          {DISCIPLINE_SECTION.eyebrow}
        </p>
        <Lines id="disciplines-h" lines={DISCIPLINE_SECTION.headline} />

        <ul className="edu-list" onMouseLeave={() => onHover(null)}>
          {DISCIPLINES.map((discipline, i) => (
            <li
              key={discipline.id}
              className="edu-list__row"
              style={{ '--i': i, '--accent': discipline.accent }}
              data-on={hovered === discipline.id}
              data-dim={Boolean(hovered) && hovered !== discipline.id}
            >
              <button
                type="button"
                onMouseEnter={() => onHover(discipline.id)}
                onFocus={() => onHover(discipline.id)}
                onBlur={() => onHover(null)}
                onClick={() => onHover(hovered === discipline.id ? null : discipline.id)}
              >
                <span className="edu-list__num">{discipline.number}</span>
                <span className="edu-list__word">{discipline.word}</span>
                <span className="edu-list__name">{discipline.name}</span>
                <span className="edu-list__meta">{discipline.meta.slice(0, 2).join(' · ')}</span>
                <i className="edu-list__line" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>

        {/* A touch device has no hover to offer, so it is told what it does
            have. One line of copy rather than a second interaction model. */}
        <p className="edu-int__note edu-int__note--hover">{DISCIPLINE_SECTION.note}</p>
        <p className="edu-int__note edu-int__note--tap">{DISCIPLINE_SECTION.noteTouch}</p>
      </div>
    </Interlude>
  )
}

/* ------------------------------------------------------------- connection */
export function ConnectionInterlude({ innerRef }) {
  return (
    <Interlude id="connection" tone="dark" innerRef={innerRef}>
      <div className="edu-int__col">
        <p className="edu-int__eyebrow">
          <i aria-hidden="true" />
          {CONNECTION.eyebrow}
        </p>
        <Lines id="connection-h" lines={CONNECTION.headline} />
        <p className="edu-int__pull">
          {CONNECTION.body.map((line, i) => (
            <span key={line} className="edu-int__line" style={{ '--i': 3 + i }}>
              <span>{line}</span>
            </span>
          ))}
        </p>
      </div>

      <div className="edu-int__figure">
        <ConnectionDiagram />
        <p className="edu-int__caption">Fig. 02 — Every discipline, every other</p>
      </div>
    </Interlude>
  )
}

/* ----------------------------------------------------------------- campus */
/**
 * The figures, choreographed rather than laid out.
 *
 * Each takes the lead in turn and then steps back into a row — `--s` drives
 * which one is dominant, so the composition rearranges itself as the reader
 * moves instead of three numbers fading up together.
 */
export function CampusInterlude({ innerRef }) {
  return (
    <Interlude id="campus" innerRef={innerRef}>
      <div className="edu-int__col">
        <p className="edu-int__eyebrow">
          <i aria-hidden="true" />
          {CAMPUS_INFO.eyebrow}
        </p>
        <Lines id="campus-h" lines={[CAMPUS_INFO.headline]} className="edu-int__head edu-int__head--sm" />

        <ol className="edu-stats">
          {CAMPUS_INFO.stats.map((stat, i) => (
            <li key={stat.label} className="edu-stats__item" style={{ '--i': i }}>
              <span className="edu-stats__value">{stat.value}</span>
              <span className="edu-stats__label">{stat.label}</span>
              <span className="edu-stats__note">{stat.note}</span>
              <i className="edu-stats__rule" aria-hidden="true" />
            </li>
          ))}
        </ol>
      </div>

      <div className="edu-int__figure">
        <CampusDiagram />
        <p className="edu-int__caption">Fig. 03 — Site plan, indicative</p>
      </div>
    </Interlude>
  )
}
