import { BRAND, CAMPUS_FACTS, DISCIPLINES, RAIL_WORDS } from './chapters.js'

/**
 * Every word on the page, composed differently in every chapter.
 *
 * Two things make this read as one piece with the 3D rather than as a layer
 * sitting on top of it:
 *
 *   - Layers are split between `behind` and `front`. The canvas is
 *     transparent and sits between them in z-order, so anything marked
 *     `behind` is genuinely occluded by geometry — the seed passes in front of
 *     the opening headline, the tree passes between the two words in chapter
 *     five. That is real depth rather than a shadow imitating it. The wrapper
 *     is `display: contents` precisely so it cannot create a stacking context
 *     and trap the two groups on the same side of the canvas.
 *   - No chapter repeats another's composition: edge-set verticals, a moving
 *     rail, a panel out of the left margin, rotated type, type that bleeds off
 *     frame, numerals parked in a corner.
 *
 * Continuous motion is driven by the `--p` custom property the scroll handler
 * writes, so none of this re-renders while scrolling.
 */

const CHAPTER = {
  seed: 0,
  growth: 1,
  branches: 2,
  museum: 3,
  connection: 4,
  glimpse: 5,
  reveal: 6,
  future: 7,
}

function Seed({ active }) {
  return (
    <>
      <div className="edu-layer edu-layer--behind" data-active={active}>
        {/* Oversized and off-centre: the last word runs past the right edge,
            and the seed sits in front of the middle one. */}
        <h1 className="edu-seed__type">
          <span className="edu-seed__line edu-seed__line--a">Knowledge</span>
          <span className="edu-seed__line edu-seed__line--b">starts</span>
          <span className="edu-seed__line edu-seed__line--c">small.</span>
        </h1>
      </div>

      <div className="edu-layer edu-layer--front" data-active={active}>
        <p className="edu-stamp">
          <span>{BRAND.name}</span>
          <span className="edu-stamp__rule" />
          <span>{BRAND.established}</span>
        </p>
        <p className="edu-seed__note">{BRAND.positioning}</p>
      </div>
    </>
  )
}

function Growth({ active }) {
  // Doubled so the strip can travel a full set and still cover the frame.
  const words = [...RAIL_WORDS, ...RAIL_WORDS]
  return (
    <div className="edu-layer edu-layer--front" data-active={active}>
      <div className="edu-rail" aria-label="What the college is built on">
        <div className="edu-rail__strip">
          {words.map((word, index) => (
            <span key={`${word}-${index}`} className="edu-rail__word">
              {word}
              <i className="edu-rail__dot" />
            </span>
          ))}
        </div>
      </div>
      <p className="edu-growth__aside">
        A curriculum grown from one idea,
        <br />
        not assembled from parts.
      </p>
    </div>
  )
}

function Branches({ active, hoveredDiscipline, onHover }) {
  return (
    <div className="edu-layer edu-layer--front" data-active={active}>
      {/* The one moment the disciplines become a menu — pinned to the left
          margin, not floated in the middle as a grid of cards. */}
      <nav className="edu-disciplines" aria-label="Disciplines">
        {DISCIPLINES.map((discipline) => (
          <button
            key={discipline.id}
            type="button"
            className="edu-disciplines__item"
            data-on={hoveredDiscipline === discipline.id}
            data-off={Boolean(hoveredDiscipline) && hoveredDiscipline !== discipline.id}
            style={{ '--accent': discipline.accent }}
            onPointerEnter={() => onHover(discipline.id)}
            onPointerLeave={() => onHover(null)}
            onFocus={() => onHover(discipline.id)}
            onBlur={() => onHover(null)}
          >
            <span className="edu-disciplines__num">{discipline.number}</span>
            <span className="edu-disciplines__name">{discipline.name}</span>
          </button>
        ))}
      </nav>

      <div className="edu-count">
        <span className="edu-count__value">05</span>
        <span className="edu-count__label">
          Schools
          <br />
          of study
        </span>
      </div>
    </div>
  )
}

/** One composition per discipline, and no two alike. */
function Museum({ active, stop }) {
  const on = (index) => active && stop === index

  return (
    <>
      {/* Technology — one enormous verb. This is the one place the behind-the-
          canvas trick does not work: the camera is inside dense foliage here,
          with no clear background to set type against, so occluding it just
          shreds the word into fragments. Set in front instead and ghosted back,
          so the canopy reads through it rather than over it. */}
      <div className="edu-layer edu-layer--front" data-active={on(0)}>
        <p className="edu-verb">Build</p>
      </div>
      <div className="edu-layer edu-layer--front" data-active={on(0)}>
        <ul className="edu-meta edu-meta--right">
          {DISCIPLINES[0].meta.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      {/* Science — a narrow panel out of the left margin. */}
      <div className="edu-layer edu-layer--front" data-active={on(1)}>
        <aside className="edu-panel">
          <p className="edu-panel__eyebrow">Science + Research</p>
          <p className="edu-panel__num">02</p>
          <ul>
            {DISCIPLINES[1].meta.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </aside>
      </div>

      {/* Design — rotated, hung off the right edge. */}
      <div className="edu-layer edu-layer--front" data-active={on(2)}>
        <div className="edu-rotated">
          <p className="edu-rotated__word">Shape</p>
          <p className="edu-rotated__meta">{DISCIPLINES[2].meta.join(' · ')}</p>
        </div>
      </div>

      {/* Engineering — one wide line along the bottom, with a rule. */}
      <div className="edu-layer edu-layer--front" data-active={on(3)}>
        <div className="edu-strip">
          <span className="edu-strip__num">04</span>
          <span className="edu-strip__rule" />
          <p className="edu-strip__text">
            Engineering — where the idea has to hold weight.
          </p>
        </div>
      </div>

      {/* Business — small, high, and to the right. */}
      <div className="edu-layer edu-layer--front" data-active={on(4)}>
        <div className="edu-corner">
          <p className="edu-corner__word">Reach</p>
          <p className="edu-corner__text">
            Ideas move between fields, and then out of them.
          </p>
        </div>
      </div>
    </>
  )
}

function Connection({ active }) {
  return (
    <div className="edu-layer edu-layer--behind" data-active={active}>
      {/* Two words pinned to opposite edges. The camera flies between them and
          the tree passes in front — which only works because this layer sits
          behind the canvas. */}
      <p className="edu-split edu-split--left">Every discipline</p>
      <p className="edu-split edu-split--right">connects.</p>
    </div>
  )
}

function Glimpse({ active }) {
  return (
    <div className="edu-layer edu-layer--front" data-active={active}>
      <p className="edu-whisper">
        <span className="edu-whisper__rule" />
        There is something built in here.
      </p>
    </div>
  )
}

function Reveal({ active }) {
  return (
    <div className="edu-layer edu-layer--front" data-active={active}>
      {/* Facts placed around the campus at different depths rather than lined
          up as a three-column stats row. */}
      <div className="edu-fact edu-fact--one">
        <span className="edu-fact__value">{CAMPUS_FACTS[0].value}</span>
        <span className="edu-fact__label">{CAMPUS_FACTS[0].label}</span>
      </div>
      <div className="edu-fact edu-fact--two">
        <span className="edu-fact__value">{CAMPUS_FACTS[1].value}</span>
        <span className="edu-fact__label">{CAMPUS_FACTS[1].label}</span>
      </div>
      <div className="edu-fact edu-fact--three">
        <span className="edu-fact__value">{CAMPUS_FACTS[2].value}</span>
        <span className="edu-fact__label">{CAMPUS_FACTS[2].label}</span>
      </div>

      <p className="edu-reveal__line">A campus designed for discovery.</p>

      {/* A ribbon travelling along the lower edge as you scroll. */}
      <div className="edu-ribbon">
        <div className="edu-ribbon__strip">
          {[...DISCIPLINES, ...DISCIPLINES].map((discipline, index) => (
            <span key={`${discipline.id}-${index}`}>
              <i>{discipline.number}</i>
              {discipline.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function Future({ active, onNavigate }) {
  const actions = [
    { label: 'Explore programmes', target: 'branches' },
    { label: 'Apply', target: 'future' },
    { label: 'Visit campus', target: 'reveal' },
  ]

  // One column, in front of the scene rather than behind it. The closing shot
  // is the campus filling the frame edge to edge, so a headline sitting behind
  // it gets eaten: the previous three-line phrase survived as "You" and "ch".
  // Two lines and a quiet supporting line fit the space that is actually
  // available, and the actions belong to the same column so they read as the
  // end of one thought rather than as furniture in the corner.
  return (
    <div className="edu-layer edu-layer--front" data-active={active}>
      <div className="edu-final__veil" aria-hidden="true" />

      <div className="edu-final">
        <p className="edu-final__type">
          <span>Your next</span>
          <span>chapter</span>
        </p>
        <p className="edu-final__sub">Starts here.</p>

        <div className="edu-actions">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className="edu-action"
              onClick={() => onNavigate(action.target)}
            >
              <span className="edu-action__label">{action.label}</span>
              <span className="edu-action__arrow" aria-hidden="true">
                <svg viewBox="0 0 20 20">
                  <path
                    d="M5 10h9M10.5 5.5 15 10l-4.5 4.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function EducationEditorial({
  chapter,
  museumStop,
  hoveredDiscipline,
  onHover,
  onNavigate,
}) {
  return (
    <div className="edu-editorial">
      <Seed active={chapter === CHAPTER.seed} />
      <Growth active={chapter === CHAPTER.growth} />
      <Branches
        active={chapter === CHAPTER.branches}
        hoveredDiscipline={hoveredDiscipline}
        onHover={onHover}
      />
      <Museum active={chapter === CHAPTER.museum} stop={museumStop} />
      <Connection active={chapter === CHAPTER.connection} />
      <Glimpse active={chapter === CHAPTER.glimpse} />
      <Reveal active={chapter === CHAPTER.reveal} />
      <Future active={chapter === CHAPTER.future} onNavigate={onNavigate} />
    </div>
  )
}

export default EducationEditorial
