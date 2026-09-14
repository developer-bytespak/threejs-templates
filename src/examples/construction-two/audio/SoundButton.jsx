import { useEffect, useState } from 'react'
import { subscribe, toggleEnabled } from './AudioManager.js'

/**
 * The only way sound starts on this page.
 *
 * Four bars and a word. Off, the bars are flat — a level meter reading
 * nothing, which is exactly what is happening. On, they step up into a
 * silhouette. The state is in the glyph rather than in the word, so it is
 * legible at a glance and the label never has to change length and reflow.
 *
 * It lives in the navbar, and that is the third place it has been.
 *
 * Floating over the hero did not work, at any corner. The hero is a full-bleed
 * 3D scene with the headline upper-left, the drafting card across the bottom
 * and the chapter indicator under that; on a narrow screen every position
 * collided with one of them or landed on the pinboard, where 10px type is
 * illegible. The navbar is the one strip on this page guaranteed to be empty,
 * on every section and at every width — which is what chrome is for.
 *
 * Below the nav's collapse breakpoint the word drops and the bars stand alone
 * beside MENU, so it costs almost no width where width is scarce.
 */
const BARS = [0, 1, 2, 3]

function SoundButton() {
  const [state, setState] = useState({ enabled: false, unlocked: false, failed: false })

  useEffect(() => subscribe(setState), [])

  // No AudioContext at all — an old browser, or one that refuses to make one.
  // Offering a control that cannot do anything is worse than offering none.
  if (state.failed) return null

  return (
    <button
      className="c2snd"
      type="button"
      data-on={state.enabled}
      onClick={toggleEnabled}
      aria-pressed={state.enabled}
      aria-label={state.enabled ? 'Turn sound off' : 'Turn sound on'}
    >
      <span className="c2snd__bars" aria-hidden="true">
        {BARS.map((i) => (
          <i key={i} />
        ))}
      </span>
      <span className="c2snd__label">Sound</span>
    </button>
  )
}

export default SoundButton
