import { useRef } from 'react'
import { STATEMENT } from './content.js'
import { StructuralFrame } from './ScrollDrawings.jsx'
import { useScrollLink } from './scroll.js'
import { sound } from '../audio/AudioManager.js'
import { useThresholds } from '../audio/useAudio.js'

/**
 * The page stops talking about itself for a moment.
 *
 * Four lines, four treatments — a mask, a slide out from under a rule that
 * draws first, an outline that fills, and a settle — because a statement whose
 * lines all arrive the same way is a paragraph with a font size.
 *
 * The right half was empty, and is now the other half of the argument: a
 * structural frame that builds itself while the sentence is being read, in the
 * order a building actually goes up. The words are about what happens after
 * the drawing leaves the desk; the drawing beside them is what leaves.
 */
/**
 * The frame going up, in sound.
 *
 * The marks sit a little past the middle of each group's draw slice — the
 * groups are declared in page.css at 0.06, 0.20, 0.34, 0.48 and 0.62, each
 * taking about 0.16 to complete — because a line is most convincing when it
 * has visibly arrived rather than when it has started.
 *
 * The material changes as the building does, which is the whole idea: a light
 * tick for setting out, a structural tap for columns, mass for the plates,
 * metal for the envelope, then the dimensions as another light tick, and one
 * quiet resolution when the sheet is finished. It gets denser, not louder.
 */
const FRAME_MARKS = [0.16, 0.30, 0.44, 0.58, 0.73, 0.84]
const FRAME_SOUND = [
  'frame.datum',
  'frame.columns',
  'frame.beams',
  'frame.envelope',
  'frame.datum',
  'frame.done',
]

function EditorialStatement() {
  const ref = useRef(null)
  const onProgress = useThresholds(FRAME_MARKS, (i) => sound(FRAME_SOUND[i]))
  useScrollLink(ref, 'cross', onProgress)

  return (
    <section className="c2say" id="statement" data-zone="dark" ref={ref} aria-label="Statement">
      <div className="c2say__copy">
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
      </div>

      <div className="c2say__draw">
        <StructuralFrame />
        <p className="c2say__key" aria-hidden="true">
          <span>Datum</span>
          <span>Frame</span>
          <span>Envelope</span>
        </p>
      </div>
    </section>
  )
}

export default EditorialStatement
