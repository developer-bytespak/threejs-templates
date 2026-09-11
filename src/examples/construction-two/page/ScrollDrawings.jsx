/**
 * Two scroll-drawn architectural drawings.
 *
 * Both are plotted rather than revealed: every stroke carries pathLength="1",
 * so a dash offset of `1 − p` is literally the fraction of that line that has
 * been drawn. It is the same mechanism the pen uses on the sheet in the hero,
 * and using it again here is deliberate — it is the page's one motion idea,
 * restated at a different scale.
 *
 * Each group takes its own slice of the section's progress through a CSS
 * variable, so the sequence is ordered: you cannot get a slab before there is
 * a column under it.
 *
 * No JavaScript animates either of these. The section writes `--p` and CSS
 * does the rest.
 */

/* ------------------------------------------------ the structural frame
 * Beside the statement. An abstract building section that assembles in the
 * order a building actually does: datum, grid, columns, framing, envelope,
 * and finally the dimensions that say it is a drawing and not a picture.
 */
export function StructuralFrame() {
  const bays = [30, 66, 102, 138, 174]          // column centre lines
  const levels = [188, 150, 112, 74]            // slab soffits, ground up

  return (
    <svg
      className="c2draw c2draw--frame"
      viewBox="0 0 220 260"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* 1 — ground datum and setting-out grid */}
      <g className="c2draw__g" data-step="1">
        <path className="c2draw__ink" pathLength="1" d="M4 222 H216" />
        {bays.map((x) => (
          <path key={x} className="c2draw__hair" pathLength="1" d={`M${x} 222 V236`} />
        ))}
        <path className="c2draw__hair" pathLength="1" d="M14 232 H206" />
        {bays.map((x) => (
          <path key={`g${x}`} className="c2draw__hair" pathLength="1" d={`M${x} 200 V222`} />
        ))}
      </g>

      {/* 2 — columns grow up off the datum */}
      <g className="c2draw__g" data-step="2">
        {bays.map((x, i) => (
          <path
            key={x}
            className="c2draw__ink"
            pathLength="1"
            d={`M${x} 222 V${i === 2 ? 52 : i % 2 ? 74 : 64}`}
          />
        ))}
      </g>

      {/* 3 — floor plates land between them */}
      <g className="c2draw__g" data-step="3">
        {levels.map((y, i) => (
          <path
            key={y}
            className="c2draw__ink"
            pathLength="1"
            d={`M${i === 3 ? 30 : 22} ${y} H${i === 3 ? 138 : 198}`}
          />
        ))}
        {levels.slice(0, 3).map((y) => (
          <path key={`t${y}`} className="c2draw__hair" pathLength="1" d={`M22 ${y + 7} H198`} />
        ))}
      </g>

      {/* 4 — the envelope closes round it */}
      <g className="c2draw__g" data-step="4">
        <path className="c2draw__ink" pathLength="1" d="M22 222 V64 H138 V52 H174 V222" />
        <path className="c2draw__hair" pathLength="1" d="M22 64 H138" />
        <path className="c2draw__hair" pathLength="1" d="M138 52 H174" />
        <path className="c2draw__accent" pathLength="1" d="M174 222 V52" />
      </g>

      {/* 5 — dimensions and annotation close the sheet */}
      <g className="c2draw__g" data-step="5">
        <path className="c2draw__hair" pathLength="1" d="M206 222 V64" />
        <path className="c2draw__hair" pathLength="1" d="M200 222 H212" />
        <path className="c2draw__hair" pathLength="1" d="M200 64 H212" />
        <path className="c2draw__hair" pathLength="1" d="M22 246 H174" />
        <path className="c2draw__hair" pathLength="1" d="M22 240 V252" />
        <path className="c2draw__hair" pathLength="1" d="M174 240 V252" />
        <path className="c2draw__accent" pathLength="1" d="M182 112 H196" />
        <path className="c2draw__hair" pathLength="1" d="M138 40 V52" />
        <path className="c2draw__hair" pathLength="1" d="M132 40 H150" />
      </g>
    </svg>
  )
}

/* ------------------------------------------------------------ the site plan
 * Beside the closing call to action. A plot rather than a building: boundary,
 * setbacks, the footprint that fits inside them, the way in, and a survey
 * crosshair that settles last — and then follows the cursor by a few pixels.
 */
export function SitePlan() {
  return (
    <svg
      className="c2draw c2draw--site"
      viewBox="0 0 240 240"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* 1 — the site boundary, with the corner the road cuts off */}
      <g className="c2draw__g" data-step="1">
        <path className="c2draw__ink" pathLength="1" d="M20 34 H196 L220 74 V206 H20 Z" />
      </g>

      {/* 2 — dimension strings off two edges */}
      <g className="c2draw__g" data-step="2">
        <path className="c2draw__hair" pathLength="1" d="M20 18 H196" />
        <path className="c2draw__hair" pathLength="1" d="M20 12 V24" />
        <path className="c2draw__hair" pathLength="1" d="M196 12 V24" />
        <path className="c2draw__hair" pathLength="1" d="M232 74 V206" />
        <path className="c2draw__hair" pathLength="1" d="M226 74 H238" />
        <path className="c2draw__hair" pathLength="1" d="M226 206 H238" />
      </g>

      {/* 3 — the setback, held well off the boundary so the two read as two */}
      <g className="c2draw__g" data-step="3">
        <path className="c2draw__hair" pathLength="1" d="M44 58 H182 L200 88 V182 H44 Z" />
      </g>

      {/* 4 — the footprint that fits inside it */}
      <g className="c2draw__g" data-step="4">
        <path className="c2draw__ink" pathLength="1" d="M62 86 H150 V156 H62 Z" />
        <path className="c2draw__ink" pathLength="1" d="M150 110 H186 V156 H150" />
      </g>

      {/* 5 — the way in, and the yard it serves */}
      <g className="c2draw__g" data-step="5">
        <path className="c2draw__hair" pathLength="1" d="M20 182 H62 V156" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path
            key={i}
            className="c2draw__hair"
            pathLength="1"
            d={`M${76 + i * 15} 176 l12 -12`}
          />
        ))}
      </g>

      {/* 6 — the survey mark, which resolves last and then tracks the cursor */}
      <g className="c2draw__mark" data-step="6">
        <path className="c2draw__accent" pathLength="1" d="M88 121 H124" />
        <path className="c2draw__accent" pathLength="1" d="M106 103 V139" />
        <circle className="c2draw__accent" cx="106" cy="121" r="9" pathLength="1" />
      </g>
    </svg>
  )
}
