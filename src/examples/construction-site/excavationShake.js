/**
 * The camera's reaction to a lot of soil moving nearby.
 *
 * An additive layer and nothing else: it produces an offset, the camera adds
 * it after everything else it does, and when there is no excavation the offset
 * is exactly zero. It never touches the camera's own path, which is why there
 * is no drift to correct for — there is nothing to accumulate into.
 *
 * The shape is an envelope and some noise. The envelope rises over about a
 * sixth of a second and then decays, because a heavy load does not hit hardest
 * at the instant it starts to move; the noise is a handful of sines at
 * unrelated frequencies, which is cheap, smooth, deterministic, and — crucially
 * — has no period a viewer can hear. Random per frame would be a rattle. This
 * is a building being leaned on.
 *
 * Vertical is weighted twice the horizontal and the roll is a tenth of a
 * degree. That ratio is most of the difference between "a digger is working
 * over there" and "the camera operator is being jostled".
 */

/**
 * An impact, not a wobble.
 *
 * The first version rose over a sixth of a second and decayed over more than a
 * second, which at the scale of this camera is a gentle sway lasting longer
 * than the excavation that caused it — and a sway that outlives its cause reads
 * as a camera problem rather than as ground movement. A load landing is a hit
 * and then nothing: up in a twentieth of a second, most of it gone in a third.
 */
const ATTACK = 0.05
const DECAY = 0.34
const POSITION = 0.11       // metres at full strength
const ROTATION = 0.0055     // radians at full strength — a third of a degree

export function createCameraShake(options = {}) {
  const positionGain = options.position ?? POSITION
  const rotationGain = options.rotation ?? ROTATION
  const attack = options.attack ?? ATTACK
  const decay = options.decay ?? DECAY

  let energy = 0
  let elapsed = 0
  let enabled = true

  const out = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0, level: 0 }

  return {
    /** Non-zero while the camera is still moving. */
    active: () => energy > 0.001,

    setEnabled(value) {
      enabled = value
      if (!value) { energy = 0; elapsed = 0 }
    },

    /**
     * A load has just started to move. Strength is 0..1.
     *
     * Impulses add rather than replace, so four chunks coming away one after
     * another build instead of restarting, but the total is capped: two
     * stages arriving on top of each other should not shake twice as hard as
     * anything the page ever does on purpose.
     */
    impulse(strength) {
      if (!enabled) return
      energy = Math.min(1, energy + Math.max(0, strength))
      elapsed = 0
    },

    /**
     * Advance and read the offset.
     *
     * Returns the same object every call — nothing here allocates, because
     * this runs inside the camera's frame callback.
     */
    sample(time, delta) {
      if (energy <= 0.001 || !enabled) {
        out.x = out.y = out.z = out.pitch = out.yaw = out.roll = out.level = 0
        return out
      }
      elapsed += delta
      // Exponential, so it is genuinely over rather than asymptotically small.
      energy = Math.max(0, energy * Math.exp(-delta / decay) - delta * 0.12)
      const rise = elapsed < attack ? elapsed / attack : 1
      const level = energy * rise * rise
      out.level = level

      // Unrelated frequencies, so the sum never repeats on any interval short
      // enough to read as a wobble.
      const t = time
      const nx = Math.sin(t * 11.7) * 0.6 + Math.sin(t * 19.3 + 1.7) * 0.4
      const ny = Math.sin(t * 14.1 + 0.6) * 0.65 + Math.sin(t * 23.9 + 2.4) * 0.35
      const nz = Math.sin(t * 9.4 + 2.1) * 0.55 + Math.sin(t * 17.1 + 0.3) * 0.45

      out.x = nx * positionGain * level * 0.55
      out.y = ny * positionGain * level
      out.z = nz * positionGain * level * 0.45
      out.pitch = ny * rotationGain * level
      out.yaw = nx * rotationGain * level * 0.8
      out.roll = nz * rotationGain * level * 0.5
      return out
    },

    /** Stop dead. Used when reduced motion comes on mid-page. */
    reset() {
      energy = 0
      elapsed = 0
      out.x = out.y = out.z = out.pitch = out.yaw = out.roll = out.level = 0
    },
  }
}
