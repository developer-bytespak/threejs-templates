/**
 * The building, described as data.
 *
 * Every animated value in this example is derived from the model's *own*
 * measured transforms rather than from numbers copied out of Blender. The
 * exploded offsets below are therefore relative rules ("lift this system by
 * 24m, fan its parts 42% wider") that a revised GLB re-measures on load
 * instead of literal coordinates that would silently break.
 */

export const MODEL_URL = '/models/construction/building_exploded_assembly.glb'

/** The eight systems, ordered bottom-to-top as they read when exploded. */
export const LAYERS = [
  'foundation',
  'columns',
  'beams',
  'slabs',
  'walls',
  'windows',
  'facade',
  'rooftop',
]

/**
 * How each system leaves the building.
 *
 * `lift`     metres the system's centre rises at full explosion.
 * `spacing`  scales the gaps *between* a system's own parts about its centre.
 *            Above 1 fans them apart (the slab stack), below 1 draws a tall
 *            shell into a compact band so it reads as one layer.
 * `radial`   metres an off-axis part moves away from the building's vertical
 *            axis — columns, facade corners and fins.
 * `shell`    fraction a ring-shaped part grows in X/Z. Bands and glazing
 *            strips are centred on the axis, so they can only open outward by
 *            growing, not by translating.
 * `levelStep`/`indexStep` extra lift per storey, so higher parts travel
 *            slightly further and the system fans instead of sliding rigidly.
 * `anchor`   'bottom' expands a system from its lowest part rather than its
 *            centre, which is what keeps the ground slab still.
 *
 * These are the tuned values — see the note in ConstructionScene on why the
 * composition is kept near 1.8x the building's height rather than the much
 * larger separations used to verify the model in Blender.
 */
export const LAYOUT = {
  foundation: { lift: 0, spacing: 1, radial: 0, shell: 0 },
  columns: { lift: 0, spacing: 1, radial: 1.8, shell: 0 },
  beams: { lift: 2, spacing: 1, radial: 3.2, shell: 0, levelStep: 0.45 },
  slabs: { lift: 2.5, spacing: 1.26, radial: 0, shell: 0, anchor: 'bottom' },
  walls: { lift: 13, spacing: 1, radial: 7, shell: 0.3 },
  windows: { lift: 15, spacing: 0.82, radial: 0, shell: 0.5, indexStep: 0.3 },
  facade: { lift: 22, spacing: 0.82, radial: 10, shell: 0.7 },
  rooftop: { lift: 24, spacing: 1, radial: 0, shell: 0 },
}

/**
 * A part's storey, read from the name the model ships with rather than from
 * child order — glTF gives no ordering guarantee, and the exporter has
 * reordered these before.
 */
const LEVEL_PATTERNS = [
  /beam_level_(\d+)/, // beam_level_02_X1 … beam_level_09_YE
  /slab_(\d+)/, // slab_01 … slab_09
  /window_strip_(\d+)/, // window_strip_01 … window_strip_08
  /facade_band_(\d+)/, // facade_band_00 … facade_band_08
]

export function levelOf(name) {
  for (const pattern of LEVEL_PATTERNS) {
    const match = pattern.exec(name)
    if (match) return Number(match[1])
  }
  return null
}

/** Parts closer to the axis than this can only open outward by growing. */
export const AXIS_EPSILON = 0.6
