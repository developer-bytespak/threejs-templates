import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'

/**
 * The foundation event, mounted.
 *
 * All this component does is run a clock. There is no dust field to carry, no
 * shake to feed and no page hold to arm: the foundation is five short events
 * spread over the last third of the page, and a reader scrolling through them
 * is watching the site from a camera that is already going where they are
 * going. Holding the wheel for two thirds of a second, five times, would be
 * five little jolts in a scroll that is otherwise theirs.
 *
 * `delta` is the only thing passed in. There is no scroll value anywhere in
 * this file, which is what makes "cross the trigger, let go, and it still
 * finishes" a property of the wiring rather than a behaviour somebody has to
 * remember to preserve.
 *
 * The step is capped so a tab returning from the background does not deliver a
 * two-second frame and skip an entire event.
 */
function FoundationEventManager({ events, reducedMotion = false }) {
  useEffect(() => {
    if (!events) return
    events.setAnimated(!reducedMotion)
    // Reduced motion switched on mid-event: land on the state the scene is
    // already asking for rather than watching the rest of it.
    if (reducedMotion) events.finish()
  }, [events, reducedMotion])

  useFrame((state, delta) => {
    if (!events) return
    events.update(Math.min(delta, 0.05))
  })

  return null
}

export default FoundationEventManager
