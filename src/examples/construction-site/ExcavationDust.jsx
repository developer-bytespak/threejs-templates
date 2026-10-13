import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

/**
 * Mounts the dust pool and runs its clock.
 *
 * That is the whole component. It never decides when dust should appear —
 * that arrives from the transition layer, which is the only thing that knows
 * when a body has let go — and it does nothing at all when the pool is empty,
 * which is all but a few seconds of the page.
 */
function ExcavationDust({ field, enabled = true }) {
  const gl = useThree((state) => state.gl)
  const size = useThree((state) => state.size)
  const dpr = useThree((state) => state.viewport.dpr)

  useEffect(() => {
    if (!field) return
    // Point size is in device pixels, so a particle tuned on a desktop is grit
    // on a phone unless it is scaled by the drawing buffer.
    field.resize(gl.domElement.height)
  }, [field, gl, size, dpr])

  useEffect(() => {
    if (!field || enabled) return
    // Reduced motion turned on with dust in the air: take it out now rather
    // than letting the last burst play out.
    field.clear()
  }, [field, enabled])

  useFrame((state, delta) => {
    if (!field || !enabled) return
    field.update(Math.min(delta, 0.1))
  })

  if (!field) return null
  return <primitive object={field.object} />
}

export default ExcavationDust
