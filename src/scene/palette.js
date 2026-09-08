/**
 * The room's colour scheme, lifted straight out of the Blender file.
 *
 * Every surface there ran through a Shader-to-RGB node feeding a hard
 * two-stop colour ramp: one colour where the light lands, another where it
 * does not. That is an EEVEE-only trick with no glTF equivalent, so the GLB
 * carries the lit colour as a plain base colour and the pairs live here.
 * `toonMaterial.js` rebuilds the two-tone step from them.
 *
 * Materials whose two colours are identical (sky, skyline, ceiling) were
 * unshaded in Blender and stay unshaded here — the threshold cannot change
 * anything when both sides are the same colour.
 */
export const MODEL_URL = '/office_room.glb'

export const PALETTE = {
  NPR_Wall:     { lit: '#2E5BC8', shadow: '#1B3FA0' },
  NPR_Floor:    { lit: '#1B3FA0', shadow: '#122A73' },
  NPR_Ceiling:  { lit: '#122A73', shadow: '#122A73' },
  NPR_Wood:     { lit: '#DEDACF', shadow: '#1B3FA0' },
  NPR_Chair:    { lit: '#DEDACF', shadow: '#1B3FA0' },
  NPR_Paper:    { lit: '#DEDACF', shadow: '#C6C3BA' },
  NPR_Board:    { lit: '#C9C5B9', shadow: '#5E7BB5' },
  NPR_Metal:    { lit: '#DEDACF', shadow: '#122A73' },
  NPR_Furn:     { lit: '#2E5BC8', shadow: '#122A73' },
  NPR_Plant:    { lit: '#2E5BC8', shadow: '#122A73' },
  NPR_Model:    { lit: '#EDE9DF', shadow: '#2E5BC8' },
  NPR_Skin:     { lit: '#DEDACF', shadow: '#1B3FA0' },
  NPR_Hair:     { lit: '#1E357A', shadow: '#080F33' },
  NPR_Blouse:   { lit: '#EFECE4', shadow: '#3A63CE' },
  NPR_Trousers: { lit: '#3E63BE', shadow: '#14245E' },
  NPR_Shoes:    { lit: '#1B2E70', shadow: '#080F33' },
  NPR_Sky:      { lit: '#C4D8E3', shadow: '#C4D8E3' },
  NPR_City:     { lit: '#9DB6CC', shadow: '#9DB6CC' },
  NPR_Tower:    { lit: '#5E7BB5', shadow: '#5E7BB5' },
  NPR_Cloud:    { lit: '#DEDACF', shadow: '#DEDACF' },
  NPR_Outline:  { lit: '#0A1740', shadow: '#0A1740' },
}

/**
 * Where each material flips from its shadow colour to its lit one, measured
 * against the light term the shader computes (see toonMaterial.js):
 *
 *   sun only ......... 1.00      fill only ........ 0.35
 *   sun + fill ....... 1.35      neither .......... 0.12  (ambient floor)
 *
 * So a threshold below 0.35 means "lit by either light", and one above it
 * means "lit by the sun alone". The walls and floor sit in the second band
 * on purpose: that is what carves the hard wedge of window light across the
 * back wall instead of flooding the whole surface.
 */
export const DEFAULT_THRESHOLD = 0.3

export const THRESHOLDS = {
  NPR_Wall: 0.55,
  NPR_Floor: 0.55,
  NPR_Furn: 0.5,
  NPR_Plant: 0.5,
  NPR_Board: 0.24,
  // The model sits in the desk's shaded half, so it never sees direct sun.
  // A low threshold lets the fill alone carry it, which keeps the card reading
  // as card rather than as one flat blue block.
  NPR_Model: 0.16,
  NPR_Paper: 0.24,
  NPR_Skin: 0.2,
  NPR_Blouse: 0.2,
  NPR_Hair: 0.28,
}

/** Direction toward each light, Y-up, matching the two suns in the Blender file. */
export const SUN_DIRECTION = [-0.72, 0.52, 0.46]
export const FILL_DIRECTION = [-0.3, 0.26, 0.92]

export const SUN_WEIGHT = 1.0
export const FILL_WEIGHT = 0.35
export const AMBIENT_FLOOR = 0.12

/** The wireframe cage, bright enough to read against the desk and the card. */
export const WIREFRAME_COLOUR = '#7FA6E0'

export const OUTLINE_MATERIAL = 'NPR_Outline'
export const OUTLINE_GROUP = 'Outline'

/** The study model on the desk, assembled piece by piece as you scroll. */
export const BUILDING_GROUP = 'Building'
export const UNSHADOWED_GROUPS = new Set(['Skyline', 'Outline'])

/**
 * Groups that receive shadow but never cast it.
 *
 * The sun's normalBias is tuned for the figure, and at 7.5cm it is thicker
 * than most of the model's plates — so with casting on, each plate shadows
 * itself and the whole massing renders in its shadow colour. Losing the
 * model's own small shadow on the desk is the cheaper trade.
 */
export const SHADOW_RECEIVERS_ONLY = new Set(['Building'])

/**
 * Maps a material name back to its palette key.
 *
 * Strips the "_EXP" suffix the Blender export adds, and the "Toon_" prefix
 * our own materials carry — the hook runs more than once (StrictMode, plus
 * two components share the model) and on a second pass it is looking at
 * materials this module already swapped in.
 */
export function paletteKeyOf(materialName = '') {
  return materialName.replace(/^Toon_/, '').replace(/_EXP$/, '')
}
