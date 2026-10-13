import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import ExcavationDust from './ExcavationDust.jsx'
import { DIG_TO, DIG_REST } from './sequence.js'

/**
 * The excavation event, mounted.
 *
 * The controller upstream has already decided which stage is on screen. This is
 * where the event that gets there lives: it runs the event engine's clock and
 * carries the dust field the engine throws particles into. The camera shake is
 * the one piece it does not own, because the camera does — it is an additive
 * layer on a transform this component never sees.
 *
 * It is mounted after the controller so a stage change and the first frame of
 * its event land together, and it does nothing at all when nothing is moving:
 * both clocks return on their first line once their work is empty, which is all
 * but about five seconds of the page.
 */
function ExcavationEventManager({ events, dust, shake, input, reducedMotion = false }) {
  const holding = useRef(false)
  useEffect(() => {
    if (!events) return
    events.setAnimated(!reducedMotion)
    if (!reducedMotion) return
    // Reduced motion switched on mid-event: land on the state the controller is
    // already asking for rather than watching the rest of it.
    events.finish()
    dust?.clear()
    shake?.reset()
  }, [events, dust, shake, reducedMotion])

  // The event clock, and the only thing that drives it. `delta` is seconds
  // since the last frame and nothing else is passed in — there is no scroll
  // value anywhere in this file, which is what makes "let go of the wheel and
  // the excavation still finishes" a property of the wiring rather than a
  // behaviour somebody has to remember to preserve.
  //
  // The step is capped so a tab returning from the background does not deliver
  // a two-second frame and skip an entire event.
  //
  // The page hold lives here, immediately after that clock, and for one
  // reason: this is the only place in the tree where "is the chain running"
  // is this frame's answer rather than last frame's. Driven from the scene,
  // which runs a priority earlier, the wheel stayed blocked for a frame after
  // the dig had finished — sixteen milliseconds nobody would feel, and still
  // a hold outliving the thing it exists for.
  useFrame((state, delta) => {
    if (!events) return
    const step = Math.min(delta, 0.05)
    events.update(step)

    // Four seconds of earthwork is four screens of scrolling, so for the
    // length of the chain the page is driven rather than scrolled: the window
    // travels across the excavation in step with it and the wheel is handed
    // back the moment the last lift lands. Everything downstream is untouched
    // — the camera still reads the same scroll offset it always did and knows
    // nothing about where the scrolling is coming from.
    const hold = input?.current?.hold
    if (!hold) return
    const running = events.running()
    if (running && !holding.current) {
      holding.current = true
      hold.begin(events.runDirection() > 0 ? DIG_TO : DIG_REST)
    }
    if (holding.current) {
      if (running) hold.set(events.runProgress())
      else { hold.end(); holding.current = false }
    }
    hold.tick(step)
  })

  return <ExcavationDust field={dust} enabled={!reducedMotion} />
}

export default ExcavationEventManager
