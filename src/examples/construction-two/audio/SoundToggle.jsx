import { useCallback, useEffect, useState } from 'react'
import { subscribe, toggleEnabled } from './AudioManager.js'

/**
 * Which palette is behind a given line of the viewport.
 *
 * The navbar does exactly this at its own baseline to decide whether it is
 * drawing on charcoal or on paper. The toggle sits at the other end of the
 * screen, so it has to ask the same question about a different line — a
 * control that turns white-on-white halfway down the page is worse than no
 * control.
 *
 * Same shape as the navbar's: one passive scroll listener, coalesced into a
 * single animation frame, comparing a handful of rectangles. It is not shared
 * with the navbar's copy because sharing it would mean editing the navbar.
 */
function useZoneAtBottom(offset = 40) {
  const [zone, setZone] = useState('dark')

  useEffect(() => {
    let frame = 0
    const read = () => {
      frame = 0
      const line = innerHeight - offset
      let found = 'dark'
      for (const el of document.querySelectorAll('[data-zone]')) {
        const rect = el.getBoundingClientRect()
        if (rect.top <= line && rect.bottom > line) found = el.dataset.zone
      }
      setZone((was) => (was === found ? was : found))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read)
    }
    read()
    addEventListener('scroll', onScroll, { passive: true })
    addEventListener('resize', onScroll)
    return () => {
      removeEventListener('scroll', onScroll)
      removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [offset])

  return zone
}

/**
 * SOUND ON / SOUND OFF.
 *
 * Set in the same 10px uppercase the rest of the page uses for labels, in the
 * bottom-left corner, at a third opacity until you go near it. It is a
 * control, not a feature: nothing about it should read as a player.
 *
 * It is visible from the first paint, and that is the whole point.
 *
 * An earlier version hid it until the audio system had unlocked, on the
 * reasoning that showing a mute control on a silent page is a small lie. The
 * reasoning was wrong and the bug it caused was bad: browsers do not accept
 * scrolling as user activation, so on a page you read by scrolling, the
 * gesture that starts the audio may never happen. Sound was unreachable
 * unless you happened to click something — and there was nothing on screen to
 * tell you sound existed at all.
 *
 * So before unlock it reads "Sound off", which is true from where the reader
 * is sitting, and clicking it both grants the activation and turns the sound
 * on. After that it is an ordinary mute.
 *
 * If the browser has no AudioContext, or refuses to start one, this never
 * appears and the page is simply a silent page.
 */
function SoundToggle() {
  const [state, setState] = useState({ enabled: true, unlocked: false, failed: false })
  const zone = useZoneAtBottom()

  useEffect(() => subscribe(setState), [])

  /**
   * Toggling has to happen in the handler, not inside a state updater.
   *
   * It was written as `setState(s => ({ ...s, enabled: toggleEnabled() }))`,
   * which reads fine and is wrong: React double-invokes updater functions in
   * StrictMode to surface exactly this kind of impurity. Two calls, two
   * toggles, and the control did nothing at all in development.
   *
   * `subscribe` pushes the new state back here anyway, so there is nothing to
   * set locally.
   */
  const onToggle = useCallback(() => {
    toggleEnabled()
  }, [])

  if (state.failed) return null

  // Sound is only actually on once the context is running AND unmuted; before
  // the first gesture the reader is hearing nothing, whatever the preference
  // says, so that is what the control reports.
  const on = state.enabled && state.unlocked

  return (
    <button
      type="button"
      className="c2sound"
      data-on={on}
      data-ready={state.unlocked}
      data-zone={zone}
      onClick={onToggle}
      aria-pressed={on}
      aria-label={on ? 'Turn sound off' : 'Turn sound on'}
    >
      <i aria-hidden="true" />
      <span>Sound {on ? 'on' : 'off'}</span>
    </button>
  )
}

export default SoundToggle
