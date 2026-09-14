import { useEffect, useRef, useState } from 'react'
import { hasPref, subscribe, toggleEnabled } from './AudioManager.js'
import { onEntered } from '../page/entrance.js'

/**
 * The only way sound starts on this page.
 *
 * An icon button, because it is chrome: a 32px disc with a hairline ring and a
 * speaker inside it, sitting last in the navbar past the call to action. The
 * previous version was four small bars and the word SOUND, and at nav scale
 * that read as a second wordmark rather than as a control — a mark is
 * something you look at, a control is something you press.
 *
 * Off is a speaker with a stroke through it; on is a speaker with two arcs and
 * the ring picking up the accent. Both are the conventional glyph, which is
 * the point — this is the one element on the page that should cost nobody a
 * moment's thought.
 *
 * THE INVITATION. Sound is off until asked, so the page has to ask. On a first
 * visit the ring sends out three slow pulses once the opening has settled, and
 * the label unfurls beside it for a few seconds before folding away. It runs
 * once, it never runs for anyone who has already answered — `hasPref` is false
 * only until the first press — and any press or hover ends it immediately. An
 * invitation that repeats is nagging.
 */
const HINT_AFTER = 900    // measured from the entrance, not from mount
const HINT_FOR = 5200     // then stop, whatever the answer

function SoundButton() {
  const [state, setState] = useState({ enabled: false, unlocked: false, failed: false })
  const [hint, setHint] = useState(false)
  const [entered, setEntered] = useState(false)
  const asked = useRef(false)

  useEffect(() => subscribe(setState), [])
  useEffect(() => onEntered(setEntered), [])

  // Counted from the moment the page became visible. Started at mount, the
  // whole invitation played out behind the loading panel.
  // Offered whenever sound is not playing and the visitor has not said no:
  // a first visit, and equally a return visit with 'on' saved, where the
  // preference survived but the audio cannot start itself.
  useEffect(() => {
    const audible = state.enabled && state.unlocked
    const declined = hasPref() && !state.enabled
    if (!entered || audible || declined) return undefined
    const on = setTimeout(() => { if (!asked.current) setHint(true) }, HINT_AFTER)
    const off = setTimeout(() => setHint(false), HINT_AFTER + HINT_FOR)
    return () => { clearTimeout(on); clearTimeout(off) }
  }, [entered, state.enabled, state.unlocked])

  const stop = () => { asked.current = true; setHint(false) }

  // No AudioContext at all — an old browser, or one that refuses to make one.
  // Offering a control that cannot do anything is worse than offering none.
  if (state.failed) return null

  // What the icon reports is whether sound is COMING OUT, not what was saved.
  // Every reload starts locked — no page may make noise before a gesture — so
  // a visitor returning with 'on' stored has the preference and silence. Drawn
  // from `enabled` alone, the control sat there lit up over a mute page.
  const on = state.enabled && state.unlocked
  const label = on ? 'Turn sound off' : 'Turn sound on'
  // `on` drives the glyph, the label and aria-pressed together. Leaving any one
  // of the three on `enabled` puts that surface back into the same lie — the
  // first version of this fix left aria-pressed behind, and it announced itself
  // as pressed over a page making no sound.

  return (
    <span className="c2snd" data-on={on} data-hint={hint}>
      <button
        className="c2snd__btn"
        type="button"
        onClick={() => { stop(); toggleEnabled() }}
        onPointerEnter={stop}
        onFocus={stop}
        aria-pressed={on}
        aria-label={label}
        title={label}
      >
        <svg className="c2snd__ico" viewBox="0 0 24 24" aria-hidden="true">
          {/* One cone, drawn once. Only the arcs and the bar change. */}
          <path
            className="c2snd__cone"
            d="M4 9.5h3.4L12 5.6v12.8L7.4 14.5H4z"
          />
          <g className="c2snd__wave">
            <path d="M15.2 9.4a3.6 3.6 0 0 1 0 5.2" />
            <path d="M17.6 7.2a6.8 6.8 0 0 1 0 9.6" />
          </g>
          {/* Long enough to read at 16px. The first version spanned four and a
              half pixels on screen and looked like a tick, not a negation. */}
          <path className="c2snd__mute" d="M15 8.9l6.2 6.2" />
        </svg>
        <i className="c2snd__ring" aria-hidden="true" />
      </button>
      <span className="c2snd__tip" aria-hidden="true">Sound</span>
    </span>
  )
}

export default SoundButton
