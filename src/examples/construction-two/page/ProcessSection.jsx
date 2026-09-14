import { useCallback, useRef, useState } from 'react'
import { PROCESS } from './content.js'
import { useScrollLink } from './scroll.js'
import { sound } from '../audio/AudioManager.js'

/**
 * The approach, drawn as one route.
 *
 * The version this replaces put four steps at fixed coordinates in a tall
 * block and let the scroll reveal them independently — which is why Plan,
 * Coordinate and Build ended up on top of each other, and why four separate
 * blue segments never added up to anything.
 *
 * This is one continuous route across a pinned stage, and three decisions
 * make it hold together:
 *
 * ONE LINE, PLOTTED IN ORDER. The route is a descending staircase — landing,
 * drop, landing, drop — and it is drawn as seven measured segments, each one
 * owning its slice of the total length. Segment five cannot start until
 * segment four has finished, so the line genuinely travels rather than
 * fading in everywhere at once.
 *
 * DOM, NOT DASHES. The obvious implementation is one SVG path with
 * pathLength="1" and a dash offset — which is what the pen upstairs does, and
 * what this did at first. It is wrong here: the stage is drawn with
 * preserveAspectRatio="none" so that coordinates read as percentages, and a
 * dash pattern under non-uniform scale plus non-scaling-stroke comes apart
 * into disconnected pieces. Seven scaled elements are exact in every engine.
 *
 * NOTHING CROSSES ANYTHING. Every block sits above its own landing, the way
 * an annotation sits over a dimension line. The line therefore passes under
 * the text it belongs to and never through it, and because consecutive
 * landings step sideways as well as down, no two blocks share both a column
 * and a neighbouring band.
 */

/* The route, in a 100×100 stage box read as percentages.
   Landings at y 26, 48, 70 and 92; drops between them. Total length 270. */
const SEGMENTS = [
  { axis: 'h', x: 0, y: 26, len: 40, dir: 1, at: 0 },     //  0 →  40
  { axis: 'v', x: 40, y: 26, len: 22, dir: 1, at: 40 },   // 40 →  62
  { axis: 'h', x: 40, y: 48, len: 42, dir: 1, at: 62 },   // 62 → 104
  { axis: 'v', x: 82, y: 48, len: 22, dir: 1, at: 104 },  // 104 → 126
  { axis: 'h', x: 30, y: 70, len: 52, dir: -1, at: 126 }, // 126 → 178, drawn right to left
  { axis: 'v', x: 30, y: 70, len: 22, dir: 1, at: 178 },  // 178 → 200
  { axis: 'h', x: 30, y: 92, len: 70, dir: 1, at: 200 },  // 200 → 270
]

const TOTAL = 270

/* Where the line arrives at each step, as a fraction of the whole route, and
   where that step's block is anchored. `nx`/`ny` are the node; the block sits
   on top of the landing that ends there. */
/**
 * What each stage sounds like when the line reaches it.
 *
 * The four are a sequence, not four instances of one click: the pencil that
 * plans, the click of a connection being made, the tap of something
 * structural going in, and a quiet resolution for handover. Played in order
 * they describe the process the section is describing.
 */
const STEP_SOUND = [
  'process.plan',
  'process.coordinate',
  'process.build',
  'process.deliver',
]

/**
 * Where the route finishes a vertical drop, as a fraction of its length.
 *
 * The four landings already sound — those are the stages. These are the three
 * corners between them, and they get the quietest thing in the palette: a tick
 * at -45 dBFS, which is the difference between a line that appears and a line
 * that is being drawn by someone.
 */
const CORNERS = [62 / 270, 126 / 270, 200 / 270]

const STEPS = [
  { at: 40 / TOTAL, nx: 40, ny: 26, bx: '2%' },
  { at: 104 / TOTAL, nx: 82, ny: 48, bx: '46%' },
  { at: 178 / TOTAL, nx: 30, ny: 70, bx: '30%' },
  { at: 240 / TOTAL, nx: 70, ny: 92, bx: '58%' },
]

function Route({ kind }) {
  return (
    <div className={`c2proc__route c2proc__route--${kind}`} aria-hidden="true">
      {SEGMENTS.map((s) => (
        <i
          key={`${s.axis}${s.at}`}
          data-axis={s.axis}
          data-dir={s.dir}
          style={{
            '--a': (s.at / TOTAL).toFixed(4),
            '--l': (s.len / TOTAL).toFixed(4),
            left: `${s.x}%`,
            top: `${s.y}%`,
            [s.axis === 'h' ? 'width' : 'height']: `${s.len}%`,
          }}
        />
      ))}
    </div>
  )
}

function ProcessSection() {
  const ref = useRef(null)
  const steps = useRef([])
  const nodes = useRef([])
  const [reached, setReached] = useState(-1)

  const corners = useRef(CORNERS.map(() => true))

  const onProgress = useCallback((p) => {
    // The line is drawn across the middle of the pin's travel: it starts once
    // the heading has settled and finishes before the section hands over.
    const drawn = Math.max(0, Math.min((p - 0.1) / 0.72, 1))
    const el = ref.current
    if (el) el.style.setProperty('--drawn', drawn.toFixed(4))

    for (let i = 0; i < CORNERS.length; i += 1) {
      if (corners.current[i] && drawn >= CORNERS[i]) {
        corners.current[i] = false
        sound('draw.segment')
      } else if (!corners.current[i] && drawn < CORNERS[i] - 0.02) {
        corners.current[i] = true
      }
    }

    let at = -1
    for (let i = 0; i < STEPS.length; i += 1) {
      const on = drawn >= STEPS[i].at
      if (on) at = i
      const state = on ? 'on' : 'off'
      const step = steps.current[i]
      const node = nodes.current[i]
      // The sound fires on the node switching on, which is the frame the line
      // physically reaches it — not on a timer, and not on the step becoming
      // visible. Scrolling back re-arms it silently.
      if (node && node.dataset.on !== state) {
        if (on) sound(STEP_SOUND[i])
        node.dataset.on = state
      }
      if (step && step.dataset.on !== state) step.dataset.on = state
    }
    setReached((was) => (was === at ? was : at))
  }, [])

  useScrollLink(ref, 'pin', onProgress)

  return (
    <section
      className="c2proc"
      id="process"
      data-zone="light"
      ref={ref}
      aria-label="Approach"
    >
      <div className="c2proc__pin">
        <header className="c2proc__head">
          <p className="c2label">Approach</p>
          <h2 className="c2proc__title">
            <span>Four stages,</span>
            <span>one construction set.</span>
          </h2>
        </header>

        <div className="c2proc__stage">
          <div className="c2grid" aria-hidden="true" />

          <Route kind="ghost" />
          <Route kind="ink" />

          {/* The nodes live on the route, not inside the text. */}
          <div className="c2proc__nodes" aria-hidden="true">
            {STEPS.map((step, i) => (
              <i
                className="c2proc__node"
                key={step.at}
                data-on="off"
                data-past={i < reached}
                style={{ left: `${step.nx}%`, top: `${step.ny}%` }}
                ref={(el) => {
                  nodes.current[i] = el
                }}
              />
            ))}
          </div>

          <ol className="c2proc__steps">
            {PROCESS.map((step, i) => (
              <li
                className="c2proc__step"
                key={step.id}
                data-on="off"
                data-past={i < reached}
                style={{ '--i': i, '--bx': STEPS[i].bx, '--by': `${100 - STEPS[i].ny}%` }}
                ref={(el) => {
                  steps.current[i] = el
                }}
              >
                <p className="c2proc__index">{step.index}</p>
                <h3 className="c2proc__name">
                  <span>{step.title}</span>
                </h3>
                <p className="c2proc__copy">{step.body}</p>
                <ul className="c2proc__terms">
                  {step.terms.map((term, k) => (
                    <li key={term} style={{ '--k': k }}>
                      {term}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

export default ProcessSection
