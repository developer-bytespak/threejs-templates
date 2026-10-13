import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { POUR_TO, POUR_REST } from './concrete.js'

/**
 * The concrete pour, mounted.
 *
 * A clock and a hold, in that order, and nothing else. No dust field, no
 * shake, no particles — the concrete is the effect.
 *
 * The hold is here for the same reason it is on the excavation: the pour is
 * ONE event that happens to take four, and three and a half seconds is three
 * screens of scrolling. Without it a reader can be past the foundation before
 * the beams have filled, having watched none of it. With it the window travels
 * from the trigger to the far side of the pour in step with the concrete, and
 * the wheel comes back the moment the last event lands.
 *
 * `delta` is the only thing passed into the clock. There is no scroll value in
 * this file, which is what makes "cross the trigger, let go, and it still
 * finishes" a property of the wiring rather than a behaviour somebody has to
 * remember to preserve.
 *
 * The hold is shared with the excavation, which owns it for its own four
 * seconds much earlier in the page. The two spans cannot overlap — one is at
 * 23% and the other at 88% — but this only ever drives it while its own chain
 * is running, and only ever lets go of what it took, so neither can end up
 * holding a wheel the other is using.
 */
function ConcreteEventManager({ events, input, reducedMotion = false }) {
  const holding = useRef(false)

  useEffect(() => {
    if (!events) return
    events.setAnimated(!reducedMotion)
    // Reduced motion switched on mid-pour: land on the state the scene is
    // already asking for rather than watching the rest of it.
    if (reducedMotion) events.finish()
  }, [events, reducedMotion])

  // Released on unmount as well, so a route change during a pour cannot leave
  // the document with its wheel blocked.
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
      hold.begin(events.runDirection() > 0 ? POUR_TO : POUR_REST)
    }
    if (!holding.current) return
    if (running) hold.set(events.runProgress())
    else { hold.end(); holding.current = false }
    hold.tick(step)
  })

  return null
}

export default ConcreteEventManager
