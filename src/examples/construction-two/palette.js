/**
 * The studio's colour scheme, lifted from the Blender source
 * (assets/source/construction-two/office_room_v2.blend).
 *
 * Each material carries three values rather than two: a lit tone, a mid tone
 * and a shadow tone. `toonMaterial.js` steps between them with a narrow
 * smoothstep, which is what separates this from the hard two-tone prototype
 * the first room used — the terminator still reads as a drawn edge, but a
 * curved surface no longer snaps from one flat colour straight to another.
 *
 * `mid` is optional. Left out, it is mixed from the other two.
 */
export const MODEL_URL = '/office_room_v2.glb'

export const PALETTE = {
  // architecture — bone, warm grey, charcoal
  mat_wall_plaster:   { lit: '#EDE7DC', mid: '#CFC7B9', shadow: '#A79E8E' },
  mat_wall_dark:      { lit: '#33363D', mid: '#25282E', shadow: '#191B20' },
  mat_board:          { lit: '#43454C', mid: '#33353B', shadow: '#232529' },
  mat_ceiling:        { lit: '#E2DBCE', mid: '#C2BAAB', shadow: '#9C9486' },
  mat_floor:          { lit: '#87715C', mid: '#6A5646', shadow: '#463930' },
  mat_floor_inlay:    { lit: '#978F84', mid: '#7C766C', shadow: '#5C574F' },
  // timber + metals
  mat_walnut:         { lit: '#9A7654', mid: '#775A40', shadow: '#4E3B2B' },
  mat_dark_metal:     { lit: '#43464C', mid: '#31343A', shadow: '#1F2126' },
  mat_brushed_metal:  { lit: '#B6B9BD', mid: '#8E9296', shadow: '#63676B' },
  mat_black:          { lit: '#24262A', mid: '#191B1F', shadow: '#101216' },
  // the one accent
  mat_blue_accent:    { lit: '#3A5CA3', mid: '#2A4478', shadow: '#1A2C55' },
  // paper + card
  mat_paper:          { lit: '#F3EEE5', mid: '#DCD6C9', shadow: '#BDB6A7' },
  mat_model_white:    { lit: '#F6F3EC', mid: '#DED8CC', shadow: '#BAB3A4' },
  mat_model_card:     { lit: '#D8D1C3', mid: '#BDB5A5', shadow: '#9A9283' },
  // glazing
  mat_glass:          { lit: '#BCCBD5', mid: '#A5B7C3', shadow: '#8DA1B0' },
  mat_frosted_glass:  { lit: '#CEDAE3', mid: '#B3C2CE', shadow: '#97A8B6' },
  // the architect
  mat_skin:           { lit: '#E6CBB1', mid: '#CBA98B', shadow: '#A9866B' },
  mat_hair:           { lit: '#463C34', mid: '#332C26', shadow: '#211C18' },
  mat_clothing_light: { lit: '#EDE8DC', mid: '#D2CCBE', shadow: '#ADA695' },
  mat_clothing_dark:  { lit: '#3A3D45', mid: '#2A2D33', shadow: '#1C1E23' },
  // planting
  mat_plant:          { lit: '#6A7A5D', mid: '#4F5D45', shadow: '#374030' },
  mat_soil:           { lit: '#544B42', mid: '#413A33', shadow: '#2E2924' },
  // outside the glass — unshaded, atmospheric perspective does the work
  mat_city_near:      { lit: '#93A0AA', mid: '#93A0AA', shadow: '#93A0AA' },
  mat_city_far:       { lit: '#BAC5CD', mid: '#BAC5CD', shadow: '#BAC5CD' },
  mat_sky:            { lit: '#DCE4E8', mid: '#DCE4E8', shadow: '#DCE4E8' },
  // the lamp's glowing disc
  mat_emissive_warm:  { lit: '#FFE0B0', mid: '#FFE0B0', shadow: '#FFE0B0' },
}

/** Materials that ignore lighting entirely. */
export const UNLIT_MATERIALS = new Set([
  'mat_sky', 'mat_city_far', 'mat_city_near', 'mat_emissive_warm',
])

/**
 * Where each material crosses from one band to the next, measured against the
 * light term the shader computes:
 *
 *   sun only ......... 1.00      fill only ........ 0.38
 *   sun + fill ....... 1.38      neither .......... 0.14  (ambient floor)
 *
 * `[a, b]` — below a is shadow, above b is lit, between is the mid tone.
 */
export const DEFAULT_BANDS = [0.30, 0.62]

export const BANDS = {
  mat_wall_plaster:  [0.34, 0.70],   // carves the window wedge across the plaster
  mat_ceiling:       [0.30, 0.66],
  mat_floor:         [0.32, 0.68],
  mat_floor_inlay:   [0.32, 0.68],
  mat_walnut:        [0.26, 0.58],
  mat_paper:         [0.22, 0.52],
  mat_model_white:   [0.20, 0.48],   // the model sits in the desk's shaded half
  mat_model_card:    [0.20, 0.48],
  mat_frosted_glass: [0.18, 0.46],
  mat_skin:          [0.20, 0.50],
  mat_clothing_light:[0.22, 0.52],
  mat_hair:          [0.26, 0.60],
  mat_plant:         [0.28, 0.62],
  mat_brushed_metal: [0.24, 0.56],
}

/** How wide the crossing is, in the same units. 0 would be the old hard step. */
export const BAND_SOFTNESS = 0.055

/**
 * Direction toward each light, Y-up.
 *
 * The sun rakes in low through the window on -X and travels across the room,
 * which is what puts a hard wedge on the plaster and the credenza. The fill is
 * cool sky coming in over the open cutaway side.
 */
export const SUN_DIRECTION = [-0.82, 0.50, -0.28]
export const FILL_DIRECTION = [0.25, 0.62, 0.70]

export const SUN_WEIGHT = 1.0
export const FILL_WEIGHT = 0.38
export const AMBIENT_FLOOR = 0.14

/** The wireframe cage, bright enough to read against walnut and white card. */
export const WIREFRAME_COLOUR = '#8FB3E6'

/**
 * Outlines are no longer baked into the model. v2 ships clean primary geometry
 * only; this group is kept so the loader still recognises an outline shell if
 * one is ever exported again.
 */
export const OUTLINE_GROUP = 'Outline'

/** The study model on the desk, assembled piece by piece as you scroll. */
export const BUILDING_GROUP = 'Building'

/** Outside the glass, and any outline shell, take no part in shadowing. */
export const UNSHADOWED_GROUPS = new Set(['Skyline', 'Outline'])

/**
 * Groups that receive shadow but never cast it. The sun's normalBias is tuned
 * for the figure and is thicker than the model's card plates, so with casting
 * on each plate shadows itself.
 */
export const SHADOW_RECEIVERS_ONLY = new Set(['Building', 'LightingElements'])

/**
 * Maps a material name back to its palette key. The Blender export appends
 * "_EXP" when it has to bake a shader down; our own materials carry a "Toon_"
 * prefix, and the hook runs more than once.
 */
export function paletteKeyOf(materialName = '') {
  return materialName.replace(/^Toon_/, '').replace(/_EXP$/, '')
}
