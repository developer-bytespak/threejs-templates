import { DISCIPLINES } from './chapters.js'

/**
 * The editorial diagrams.
 *
 * HOW THEY DRAW
 *
 * Every stroke here carries `pathLength="1"`, so its dash array is in units of
 * "fraction of this path" regardless of its real length. Drawing is then one
 * declaration — `stroke-dashoffset: calc(1 - var(--d))` — and `--d` is a
 * number CSS derives from the section's own progress. No JavaScript runs per
 * frame, no library measures anything, and because it is a pure function of
 * scroll it un-draws correctly on the way back up.
 *
 * Each element declares `--i`, its position in the construction order. The
 * stylesheet turns that into a staggered window of the section's progress, so
 * the diagram assembles part by part rather than every stroke growing at once.
 *
 * WHAT THEY ARE NOT
 *
 * Not illustrations of the 3D scene. A second literal tree next to the real
 * one would only invite comparison it cannot win. These are technical
 * drawings — the diagram an architect makes of a thing, not a picture of it.
 */

/* ------------------------------------------------------------------ intro */
/**
 * One root, five branches, five nodes. The structure of the whole page stated
 * once, as a diagram, before any of it has happened.
 */
export function KnowledgeDiagram() {
  // A symmetric fan from one junction, which is what the caption claims: one
  // root, five branches, five nodes. The first attempt spread the branches
  // across a wide arc with near-horizontal control points, and it read as a
  // spray of unrelated curves rather than as a structure — the eye could not
  // find the junction they all came from.
  const JUNCTION = { x: 200, y: 208 }
  const REACH = 116
  const nodes = DISCIPLINES.map((discipline, i) => {
    const angle = (i - 2) * 0.42 // radians from vertical, even fan
    return {
      discipline,
      i,
      x: JUNCTION.x + Math.sin(angle) * REACH,
      y: JUNCTION.y - Math.cos(angle) * REACH,
    }
  })

  return (
    <svg className="edu-dia" viewBox="0 0 400 340" fill="none" aria-hidden="true">
      {/* the measure: a technical drawing is drawn against something */}
      <g className="edu-dia__rule" style={{ '--i': 0 }}>
        <path d="M60 314h280" pathLength="1" />
        <path d="M60 308v12M340 308v12M200 310v8" pathLength="1" />
      </g>

      <path
        className="edu-dia__stem"
        style={{ '--i': 0.6 }}
        d={`M200 306V${JUNCTION.y}`}
        pathLength="1"
      />
      <circle
        className="edu-dia__seed"
        style={{ '--i': 0.6, '--nr': 4.5 }}
        cx="200"
        cy="306"
        r="4.5"
      />

      {nodes.map(({ discipline, x, y, i }) => (
        <g key={discipline.id}>
          {/* leaves the junction vertically, then bends to its tip */}
          <path
            className="edu-dia__branch"
            style={{ '--i': 1.6 + i * 0.55 }}
            d={`M${JUNCTION.x} ${JUNCTION.y} C ${JUNCTION.x} ${JUNCTION.y - 44}, ${x} ${y + 50}, ${x} ${y}`}
            pathLength="1"
          />
          <circle
            className="edu-dia__node"
            style={{ '--i': 4.6 + i * 0.45, '--accent': discipline.accent, '--nr': 5 }}
            cx={x}
            cy={y}
            r="5"
          />
          <text className="edu-dia__num" style={{ '--i': 5 + i * 0.45 }} x={x} y={y - 15}>
            {discipline.number}
          </text>
        </g>
      ))}
    </svg>
  )
}

/* ------------------------------------------------------------- connection */
/**
 * The five disciplines as a network that resolves into one centre.
 *
 * Deliberately not a "tech network" of scattered dots: the nodes sit on a
 * measured ring, the connections are straight technical runs, and the centre
 * is a drawn construction rather than a glow. It should read as a plan, not
 * as a screensaver.
 */
export function ConnectionDiagram() {
  const R = 118
  const nodes = DISCIPLINES.map((discipline, i) => {
    const angle = -Math.PI / 2 + (i / DISCIPLINES.length) * Math.PI * 2
    return {
      discipline,
      i,
      x: 200 + Math.cos(angle) * R,
      y: 180 + Math.sin(angle) * R,
    }
  })

  const chords = []
  for (let a = 0; a < nodes.length; a += 1) {
    for (let b = a + 1; b < nodes.length; b += 1) {
      chords.push({ a: nodes[a], b: nodes[b], k: chords.length })
    }
  }

  return (
    <svg className="edu-dia edu-dia--net" viewBox="0 0 400 360" fill="none" aria-hidden="true">
      <circle className="edu-dia__ring" style={{ '--i': 0 }} cx="200" cy="180" r={R} pathLength="1" />

      {chords.map(({ a, b, k }) => (
        <path
          key={`${a.discipline.id}-${b.discipline.id}`}
          className="edu-dia__chord"
          style={{ '--i': 5 + k * 0.35 }}
          d={`M${a.x} ${a.y}L${b.x} ${b.y}`}
          pathLength="1"
        />
      ))}

      {nodes.map(({ discipline, x, y, i }) => (
        <g key={discipline.id}>
          <path
            className="edu-dia__spoke"
            style={{ '--i': 1 + i * 0.6 }}
            d={`M200 180L${x} ${y}`}
            pathLength="1"
          />
          <circle
            className="edu-dia__node"
            style={{ '--i': 1.4 + i * 0.6, '--accent': discipline.accent, '--nr': 6 }}
            cx={x}
            cy={y}
            r="6"
          />
          <text
            className="edu-dia__word"
            style={{ '--i': 1.8 + i * 0.6 }}
            x={x}
            y={y + (y < 180 ? -18 : 26)}
          >
            {discipline.word}
          </text>
        </g>
      ))}

      {/* the centre, drawn last: the point of the whole diagram */}
      <g className="edu-dia__core" style={{ '--i': 9 }}>
        <circle cx="200" cy="180" r="15" pathLength="1" />
        <path d="M185 180h30M200 165v30" pathLength="1" />
      </g>
    </svg>
  )
}

/* ---------------------------------------------------------------- campus */
/**
 * A site plan. Boundary, footprints, paths, then the nodes that name them —
 * the order a plan is actually drawn in, which is what makes the animation
 * read as drafting rather than as parts appearing.
 *
 * Not a survey of the real campus geometry. An editorial graphic that agrees
 * with it in character and does not pretend to be a measurement.
 */
export function CampusDiagram() {
  const buildings = [
    { x: 74, y: 96, w: 96, h: 58, i: 2 },
    { x: 196, y: 74, w: 74, h: 74, i: 2.6 },
    { x: 96, y: 186, w: 64, h: 52, i: 3.2 },
    { x: 192, y: 174, w: 104, h: 44, i: 3.8 },
    { x: 78, y: 262, w: 130, h: 40, i: 4.4 },
  ]

  return (
    <svg className="edu-dia edu-dia--plan" viewBox="0 0 400 360" fill="none" aria-hidden="true">
      <path
        className="edu-dia__site"
        style={{ '--i': 0 }}
        d="M40 52h320v260H40z"
        pathLength="1"
      />

      {buildings.map((b) => (
        <rect
          key={`${b.x}-${b.y}`}
          className="edu-dia__plot"
          style={{ '--i': b.i }}
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          pathLength="1"
        />
      ))}

      <g className="edu-dia__paths">
        <path style={{ '--i': 5.2 }} d="M40 166h34v96h22" pathLength="1" />
        <path style={{ '--i': 5.6 }} d="M170 125h26v49h96" pathLength="1" />
        <path style={{ '--i': 6 }} d="M160 212h32v50h-32" pathLength="1" />
        <path style={{ '--i': 6.4 }} d="M296 196h64v116H208" pathLength="1" />
      </g>

      <g className="edu-dia__pins">
        {buildings.map((b, k) => (
          <circle
            key={`pin-${b.x}`}
            style={{ '--i': 7 + k * 0.3, '--nr': 3.5 }}
            cx={b.x + b.w / 2}
            cy={b.y + b.h / 2}
            r="3.5"
          />
        ))}
      </g>

      <g className="edu-dia__rule" style={{ '--i': 8.6 }}>
        <path d="M40 330h320" pathLength="1" />
        <path d="M40 324v12M360 324v12M200 326v8" pathLength="1" />
      </g>
    </svg>
  )
}

/* ------------------------------------------------------------------- cta */
/**
 * The closing echo: the opening diagram's root and branches, ending in campus
 * footprints instead of discipline nodes. The journey stated in one drawing.
 */
export function JourneyDiagram() {
  return (
    <svg className="edu-dia edu-dia--journey" viewBox="0 0 360 320" fill="none" aria-hidden="true">
      <circle className="edu-dia__seed" style={{ '--i': 0, '--nr': 4 }} cx="180" cy="292" r="4" />
      <path className="edu-dia__stem" style={{ '--i': 0.4 }} d="M180 292V168" pathLength="1" />

      {[-2, -1, 0, 1, 2].map((k, i) => {
        const x = 180 + k * 68
        const y = 120 - Math.abs(k) * 12
        return (
          <g key={k}>
            <path
              className="edu-dia__branch"
              style={{ '--i': 1.4 + i * 0.4 }}
              d={`M180 ${168 - i * 2} C 180 ${140}, ${x} ${y + 34}, ${x} ${y}`}
              pathLength="1"
            />
            <rect
              className="edu-dia__plot"
              style={{ '--i': 3.6 + i * 0.35 }}
              x={x - 15}
              y={y - 13}
              width="30"
              height="20"
              pathLength="1"
            />
          </g>
        )
      })}

      <g className="edu-dia__core edu-dia__core--final" style={{ '--i': 6 }}>
        <circle cx="180" cy="168" r="11" pathLength="1" />
      </g>
    </svg>
  )
}

/* ---------------------------------------------------------------- footer */
/** The smallest possible restatement: one branch, five nodes. */
export function BranchMark({ drawn }) {
  return (
    <svg
      className="edu-dia edu-dia--mark"
      data-drawn={drawn}
      viewBox="0 0 320 90"
      fill="none"
      aria-hidden="true"
    >
      <path className="edu-dia__stem" style={{ '--i': 0 }} d="M12 74h296" pathLength="1" />
      {DISCIPLINES.map((discipline, i) => {
        const x = 46 + i * 58
        return (
          <g key={discipline.id}>
            <path
              className="edu-dia__branch"
              style={{ '--i': 1 + i * 0.5 }}
              d={`M${x} 74V${44 - (i % 2) * 14}`}
              pathLength="1"
            />
            <circle
              className="edu-dia__node"
              style={{ '--i': 1.6 + i * 0.5, '--accent': discipline.accent, '--nr': 4 }}
              cx={x}
              cy={44 - (i % 2) * 14}
              r="4"
            />
          </g>
        )
      })}
    </svg>
  )
}
