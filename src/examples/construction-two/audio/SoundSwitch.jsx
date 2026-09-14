import { useEffect, useState } from 'react'
import { subscribe, toggleEnabled } from './AudioManager.js'

/**
 * Sound on / off, set in the footer's utility line beside the locations and
 * the copyright.
 *
 * It was a floating control in the corner of the viewport for a while, which
 * was wrong twice over: it was the only thing on the page not made of the
 * page's own parts, and on a narrow screen the hero has no free corner to put
 * it in — every position collided with the drafting card, the chapter
 * indicator or the pinboard.
 *
 * The footer already has a row for exactly this kind of thing. Putting it
 * there costs nothing, because it is not how the sound starts: any click,
 * key, tap or — where the browser allows it — scroll does that on its own.
 * This is only for turning it off, and something you turn off is something
 * you have already heard.
 */
function SoundSwitch() {
  const [state, setState] = useState({ enabled: true, unlocked: false, failed: false })

  useEffect(() => subscribe(setState), [])

  // Nothing to offer until there is something to silence.
  if (!state.unlocked || state.failed) return null

  return (
    <button className="c2foot__sound" type="button" onClick={toggleEnabled} aria-pressed={state.enabled}>
      Sound {state.enabled ? 'on' : 'off'}
    </button>
  )
}

export default SoundSwitch
