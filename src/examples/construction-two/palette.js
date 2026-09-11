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
  // outside the glass — unshaded. In a flat palette distance is carried by
  // value alone, so the four city bands step evenly toward the sky: the near
  // block is the darkest thing out there, the haze band is nearly the sky.
  mat_city_glass:     { lit: '#5C6974', mid: '#5C6974', shadow: '#5C6974' },
  mat_city_near:      { lit: '#8795A1', mid: '#8795A1', shadow: '#8795A1' },
  mat_city_mid:       { lit: '#9DAAB4', mid: '#9DAAB4', shadow: '#9DAAB4' },
  mat_city_far:       { lit: '#B5C1CA', mid: '#B5C1CA', shadow: '#B5C1CA' },
  mat_city_haze:      { lit: '#C8D1D8', mid: '#C8D1D8', shadow: '#C8D1D8' },
  mat_sky:            { lit: '#DCE4E8', mid: '#DCE4E8', shadow: '#DCE4E8' },
  // the reflection raking across the pane
  mat_glass_sheen:    { lit: '#EAF1F6', mid: '#EAF1F6', shadow: '#EAF1F6' },
  // the lamp's glowing disc
  mat_emissive_warm:  { lit: '#FFE0B0', mid: '#FFE0B0', shadow: '#FFE0B0' },
}

/** Materials that ignore lighting entirely. */
export const UNLIT_MATERIALS = new Set([
  'mat_sky', 'mat_city_haze', 'mat_city_far', 'mat_city_mid', 'mat_city_near',
  'mat_city_glass', 'mat_glass_sheen', 'mat_emissive_warm',
])

/**
 * Surfaces you can see through, and how solid each one is.
 *
 * The window is a sealed pane, not an opening: at 0.30 the toon shader tints
 * the city behind it instead of replacing it, which is the difference between
 * glass and a hole in the wall. The sheen is the pair of raking reflections on
 * that pane — translucency alone reads as a tinted hole, and a reflection is
 * what says there is a surface there.
 *
 * These render in three's transparent pass with depth writing off, so they
 * blend over whatever is already in the depth buffer and sort back-to-front by
 * distance. The sheen sits a few millimetres roomward of the pane, which is
 * enough to put it after the glass in that sort every time.
 *
 * Deliberately NOT listed: mat_frosted_glass. The model's frosted volumes are
 * thirteen overlapping boxes assembling on top of each other, and per-pixel
 * sorting between them costs more than it buys. They stay opaque.
 */
export const TRANSLUCENT_MATERIALS = {
  mat_glass: 0.30,
  mat_glass_sheen: 0.14,
}

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
  // The pane faces into the room, away from the sun, so on the default bands it
  // resolved to its own shadow tone and tinted the city DARKER — glass that
  // dims the view reads as smoked perspex. Dropped low enough that the fill
  // alone carries it into `lit`, so the pane lifts and cools what is behind it
  // the way glass catching sky actually does.
  mat_glass:         [0.12, 0.22],
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

/** The hero plot and everything plotted on it. */
export const DRAWING_GROUP = 'Drawing'

/**
 * Transform-only nodes the model exports for the web build to hang things off:
 * the building's spawn point, the sheet origin, the pinboard label points. They
 * carry no geometry, so they never reach the material or shadow passes — they
 * exist purely so positions come from the model rather than from guesswork.
 */
export const ANCHOR_GROUP = 'Anchors'

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
