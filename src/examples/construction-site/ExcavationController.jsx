import { forwardRef, useImperativeHandle, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { createExcavationDriver } from './excavation.js'

/**
 * The React binding for the excavation driver.
 *
 * Deliberately thin: everything that decides anything lives in
 * `excavation.js`, and this is the part that knows about frames and refs.
 *
 * Two rules shape it. It never holds React state, because the value driving
 * it changes every frame and re-rendering a tree containing the whole site
 * would cost more than the scene it is trying to draw. And it only touches
 * the scene when the stage actually changes — between boundaries a frame is
 * one subtraction and a comparison, so the cost of having this mounted is
 * flat whether the site is moving or not.
 *
 * `progress` is 0..1, matching the rest of the module, and may be a number, a
 * ref or a getter. A ref is what the scroll-driven case wants: it lets the
 * value change sixty times a second without React hearing about it.
 */
function readProgress(source) {
  if (typeof source === 'number') return source
  if (typeof source === 'function') return source()
  if (source && typeof source.current === 'number') return source.current
  return 0
}

const ExcavationController = forwardRef(function ExcavationController(
  { rig, progress = 0, stage = null, onStageChange = null, enabled = true },
  ref,
) {
  const driver = useMemo(
    () => (rig ? createExcavationDriver(rig, onStageChange) : null),
    [rig, onStageChange],
  )

  useFrame(() => {
    if (!enabled || !driver) return
    // A forced stage wins over progress, so a timeline or a debug control can
    // take the wheel without having to fake a scroll position. `setStage`
    // returns early once it is already there, so holding it costs nothing.
    if (stage !== null) {
      driver.setStage(stage)
      return
    }
    driver.update(readProgress(progress) * 100)
  })

  useImperativeHandle(ref, () => driver, [driver])

  return null
})

export default ExcavationController
