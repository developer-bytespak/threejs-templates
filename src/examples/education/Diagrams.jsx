import { DISCIPLINES } from './chapters.js'

/**
 * The footer's mark.
 *
 * HOW IT DRAWS
 *
 * Every stroke carries `pathLength="1"`, so its dash array is in units of
 * "fraction of this path" regardless of its real length. Drawing is then one
 * declaration — `stroke-dashoffset: calc(1 - var(--d))` — and `--d` is a
 * registered number the stylesheet transitions when the footer arrives. No
 * JavaScript runs per frame and no library measures anything.
 *
 * `--i` is each element's place in the construction order; the stylesheet
 * turns that into a delay, so the mark assembles part by part rather than
 * every stroke growing at once.
 *
 * It is not an illustration of the 3D scene. A second literal tree under the
 * real one would only invite a comparison it cannot win — this is a wordmark
 * that happens to be built the way the tree is: one line, five branches.
 */
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
