import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RISE_TO, RISE_REST } from './columns.js'

/**
 * The frame going up, mounted.
 *
 * A clock and a hold, in that order, and nothing else. No dust, no shake, no
 * particles, no sound hooks — the columns are the effect.
 *
 * The hold is here for the same reason it is on the excavation and the pour:
 * this is ONE event that happens to take four, and three seconds is three
 * screens of scrolling. Without it a reader can be past the building before
 * level two has arrived, having watched none of it. With it the window travels
 * from the trigger to the far side of the rise in step with the frame, and the
 * wheel comes back the moment the last level lands.
 *
 * `delta` is the only thing passed into the clock. There is no scroll value in
 * this file, which is what makes "cross the trigger, let go, and it still
 * finishes" a property of the wiring rather than a behaviour somebody has to
 * remember to preserve.
 *
 * The hold is shared with the excavation and the pour, which own it for their
 * own seconds earlier in the page. The three spans cannot overlap — 18%, 66%
 * and 78% — but this only ever drives it while its own chain is running, and
 * only ever lets go of what it took, so none of them can end up holding a
 * wheel another is using.
 */
function ColumnsEventManager({ events, input, reducedMotion = false }) {
  const holding = useRef(false)

  useEffect(() => {
    if (!events) return
    events.setAnimated(!reducedMotion)
    // Reduced motion switched on mid-rise: land on the state the scene is
    // already asking for rather than watching the rest of it.
    if (reducedMotion) events.finish()
  }, [events, reducedMotion])

  // Released on unmount as well, so a route change while the frame is going up
  // cannot leave the document with its wheel blocked.
  useEffect(() => () => {
    if (holding.current) {
      input?.current?.hold?.end(true)
      holding.current = false
    }
  }, [input])

  useFrame((state, delta) => {
    if (!events) return
    const step = Math.min(delta, 0.05)
    events.update(step)

    const hold = input?.current?.hold
    if (!hold) return
    const running = events.running()
    if (running && !holding.current) {
      holding.current = true
      hold.begin(events.runDirection() > 0 ? RISE_TO : RISE_REST)
    }
    if (!holding.current) return
    if (running) hold.set(events.runProgress())
    else { hold.end(); holding.current = false }
    hold.tick(step)
  })

  return null
}

export default ColumnsEventManager
