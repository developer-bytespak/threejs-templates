/**
 * Everything the route needs to know about the site, in one place.
 *
 * The numbers here are not design decisions made in JavaScript — they are
 * measurements of what is actually in the exported GLBs. The building was set
 * out at x +/-15, z +/-10 in the survey scene, and the excavation was cut so
 * its floor lands on exactly that rectangle. Anything below reads those facts
 * back out so the choreography can talk about "the pit" without guessing.
 *
 * glTF is Y-up and Blender is Z-up, so the exporter has already rotated the
 * scene: Blender's +Y (site north) arrives here as -Z. Every number below is
 * written in the coordinates this code actually sees.
 *
 * Node names are flat, with one exception. Blender collections do not survive
 * glTF export as nodes, so EMPTY_SITE and SPOIL exist in the .blend and not in
 * the file this loads; SOIL_MASS does survive, because it is an empty rather
 * than a collection. Either way the parts are listed individually. That is
 * checked, not assumed: `useSiteModel` reports any name it cannot find.
 *
 * The excavation's own node names and stage table live in `excavation.js` —
 * they are a set of states rather than a set of measurements, and keeping them
 * apart means the stage mapping can be read without wading through geometry.
 */

export const SITE_URL = '/models/construction/excavation_site.glb'
export const SURVEY_URL = '/models/construction/survey_layer.glb'

/** Roots that exist as single nodes in the excavation file. */
export const NODE = {
  environment: 'empty_site',
  remains: 'SURVEY_REMAINS',
}

/**
 * The cut is not listed here any more, because there is no longer anything to
 * list: the asset has no pre-built pit in it.
 *
 * What replaced it is a solid body of soil — GROUND_BASE plus four lifts and
 * the foundation cuts — and the excavation is those bodies being taken away.
 * So the parts that used to be named here (EXCAVATION_FLOOR, the trenches,
 * the pockets) do not exist in the export, and nothing hides GROUND_PATCH
 * to reveal them, because GROUND_PATCH does not exist either. The lifts' own
 * top caps are the site surface until they are removed.
 *
 * See `excavation.js` for the node names and the stage table.
 */

/**
 * Survey kit that stands clear of the works, and so survives the excavation.
 *
 * The instrument is set up at (19.5, 15.5) — outside the site fence line and
 * well outside the aperture — which is exactly why a surveyor puts it there.
 * It has no reason to move, so it does not.
 */
export const SURVEY_KIT = ['TOTAL_STATION', 'SURVEYOR', 'EQUIPMENT_CASE']
export const SURVEY_ACCESSORIES = [
  'accessory_paint_can',
  'accessory_clipboard',
  'accessory_stake_bundle',
]
export const SURVEY_ROD = 'SURVEY_ROD'

/**
 * The control baseline and its two stations, which also survive.
 *
 * They sit at z = 13, outside the aperture's +/-12.6, so the cut cannot reach
 * them. They are excluded from the dissolve for that reason rather than for a
 * compositional one — the earth they stand on is never removed.
 */
export const SURVEY_PERMANENT = ['LINE_08', 'MARKER_11', 'MARKER_12']

/**
 * Corner stakes re-established at the pit rim once the ground is open.
 *
 * These live in the excavation file, not the survey layer, and they are not
 * duplicates: the survey layer's corner markers stand on the footprint itself
 * at z = +/-10 and are dug out, while these sit at z = +/-13.4, clear of the
 * excavation. On a real site that is a re-peg — the setout is transferred off
 * the works before the works destroy it — so they fade up as the hole opens.
 */
export const RIM_REMNANTS = ['MARKER_01', 'MARKER_02', 'MARKER_03', 'MARKER_04', 'GROUND_MARKINGS']

/**
 * Flat sheets that are never allowed to cast a shadow.
 *
 * A ground plane cannot cast a useful shadow — there is nothing under it —
 * but it can absolutely cast a useless one onto itself, which is what shadow
 * acne is: a surface failing a depth test against its own entry in the shadow
 * map. On a 72 by 52 metre sheet lit by a low sun that shows up as dashed
 * lines wandering across the site. Taking these out of the shadow pass costs
 * nothing visible and removes the largest single source of them.
 *
 * Anything with height — kerbs, fences, the office, the heaps — still casts.
 */
export const FLAT_GROUND = [
  'site_ground_earth',
  'site_ground_haul_route',
  'site_ground_pad',
  'road_surface',
  'sidewalk_surface',
]

export const MARKER_COUNT = 12
export const GROUND_MARK_COUNT = 9

export const groundMarkName = (i) => `GROUND_MARK_${String(i + 1).padStart(2, '0')}`

/**
 * The setout lines in the order a site would actually establish them, which
 * is not the order they were modelled in.
 *
 * A surveyor does not draw a building outline clockwise. The control baseline
 * goes in first because everything else is measured from it, then the
 * perimeter closes, then the structural grid, and the service core last. The
 * reveal follows this list, so the footprint assembles the way it would on a
 * real site instead of sweeping round like a progress bar.
 */
export const LINE_ORDER = [
  'LINE_08', // control baseline, outside the works
  'LINE_01', // perimeter, south
  'LINE_02', // perimeter, east
  'LINE_03', // perimeter, north
  'LINE_04', // perimeter, west
  'LINE_05', // centre axis
  'LINE_06', // structural grid
  'LINE_07',
  'LINE_09', // core
  'LINE_10',
  'LINE_11',
  'LINE_12',
]

/**
 * Markers in reveal order: control stations first, then the footprint
 * corners, then mid-edges and internal grid points. Same reasoning as the
 * lines — you cannot set out a corner before you have a station to measure
 * it from.
 */
export const MARKER_ORDER = [
  'MARKER_11', 'MARKER_12',                           // control stations
  'MARKER_01', 'MARKER_02', 'MARKER_03', 'MARKER_04', // footprint corners
  'MARKER_05', 'MARKER_06', 'MARKER_07', 'MARKER_08', // mid-edges
  'MARKER_09', 'MARKER_10',                           // internal grid
]

/**
 * The pit, in glTF coordinates.
 *
 * `APERTURE` is the hole in the surrounding ground, and therefore the exact
 * extent of the soil mass that fills it; the setout dissolve is measured
 * across it.
 *
 * There is no floor level here any more. It was carried for the camera and
 * the old pit parts, both of which stopped reading it, and a depth constant
 * that nothing checks is a depth constant that will eventually be wrong — as
 * this one already was, still saying -3.2 after the asset moved to -4.05.
 */
export const APERTURE = { x: 17.6, z: 12.6 }
export const FOOTPRINT = { x: 15, z: 10 }

/** Where the instrument stands. Setout is pulled out from here. */
export const STATION = { x: 19.5, z: 15.5 }

/**
 * Where the ground starts opening and which way the front travels.
 *
 * It runs east to west — from the ramp mouth inward — because that is the
 * side machinery reaches the pit from, and a front that starts where the
 * access is reads as excavation spreading rather than a wipe crossing the
 * screen.
 *
 * The starting clearance is not cosmetic. The dissolve darkens the ground for
 * a few metres ahead of the front, so earth about to be removed looks broken
 * before it goes; if the front starts too close to the edge, that scorch is
 * already painted across the east side of an untouched site on the first
 * frame. 4.6 metres clears the darkening band and its jitter completely, so
 * the ground is clean until the sweep reaches it. The far end only has to
 * clear the jitter, since everything behind the front is gone by then.
 */
export const OPEN_FROM = APERTURE.x + 4.6
export const OPEN_TO = -(APERTURE.x + 2.0)

/**
 * Spoil timing is no longer arithmetic on a dissolve front.
 *
 * Each heap now belongs to the lift it came out of, and both are listed
 * together in `excavation.js`. The cause and effect the old numbers were
 * reconstructing is a fact of the table instead: stage 2 hides the second
 * lift and shows the second heap, so the earth cannot appear beside a hole
 * it did not come out of, whichever direction the page is scrolled.
 */
