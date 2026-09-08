/**
 * A coarse land/ocean test, so the closing globe reads as Earth without
 * shipping a texture or pulling in a mapping library.
 *
 * Continents are approximated as unions of lat/lon boxes, with a second list
 * subtracted for the seas that would otherwise weld landmasses together (the
 * Mediterranean in particular, which is what separates Europe from Africa).
 * Box edges are deliberately not smoothed here — the sampler dithers the
 * coordinate before testing, which softens coastlines at particle density.
 *
 * Boxes are [latMin, latMax, lonMin, lonMax] in degrees.
 */

const LAND = [
  // North America
  [55, 71, -168, -141], // Alaska
  [49, 70, -141, -95], // western Canada
  [45, 68, -95, -57], // eastern Canada
  [68, 79, -110, -72], // Arctic islands
  [25, 49, -125, -70], // United States
  [24, 31, -83, -80], // Florida
  [15, 30, -115, -87], // Mexico
  [8, 18, -92, -77], // Central America
  [60, 83, -52, -20], // Greenland
  [70, 80, -62, -45],

  // South America
  [-5, 12, -79, -50],
  [-15, 2, -70, -35],
  [-25, -5, -72, -40],
  [-40, -22, -72, -53],
  [-55, -39, -75, -64],

  // Europe
  [36, 44, -10, 3], // Iberia
  [43, 55, -5, 20], // France and central Europe
  [55, 71, 5, 31], // Scandinavia
  [45, 60, 20, 45], // eastern Europe
  [37, 46, 8, 18], // Italy
  [36, 47, 15, 30], // Balkans
  [50, 59, -8, 2], // British Isles

  // Africa
  [15, 37, -17, 35], // north
  [4, 20, -17, 48], // Sahel and Horn
  [-12, 8, 8, 42], // central
  [-35, -12, 12, 40], // south
  [-25, -12, 43, 51], // Madagascar

  // Asia
  [12, 32, 35, 60], // Arabia
  [50, 72, 30, 90], // western Russia
  [50, 75, 90, 180], // Siberia
  [35, 55, 50, 90], // central Asia
  [8, 32, 68, 90], // India
  [20, 50, 90, 125], // China
  [8, 24, 95, 110], // mainland south-east Asia
  [31, 46, 132, 146], // Japan
  [33, 43, 124, 131], // Korea

  // Oceania
  [-10, 7, 95, 119], // Sumatra, Java, Borneo
  [-11, 0, 118, 151], // Sulawesi and New Guinea
  [5, 19, 118, 127], // Philippines
  [-39, -11, 113, 154], // Australia
  [-47, -34, 166, 179], // New Zealand

  // Antarctica
  [-90, -66, -180, 180],
]

const SEA = [
  [31, 40, -3, 28], // Mediterranean
  [41, 47, 28, 42], // Black Sea
  [37, 47, 47, 54], // Caspian
  [51, 64, -95, -78], // Hudson Bay
  [18, 30, -97, -82], // Gulf of Mexico
  [13, 29, 33, 43], // Red Sea
  [23, 31, 48, 57], // Persian Gulf
  [54, 66, 15, 26], // Baltic
  [5, 21, 80, 94], // Bay of Bengal
  [34, 44, 127, 132], // Sea of Japan
  [-8, 6, 105, 117], // Java Sea
  [50, 60, -140, -128], // Gulf of Alaska
]

function inBoxes(boxes, lat, lon) {
  for (let i = 0; i < boxes.length; i += 1) {
    const b = boxes[i]
    if (lat >= b[0] && lat <= b[1] && lon >= b[2] && lon <= b[3]) return true
  }
  return false
}

export function isLand(lat, lon) {
  return inBoxes(LAND, lat, lon) && !inBoxes(SEA, lat, lon)
}

/** Converts degrees to a point on a sphere of the given radius (Y up). */
export function latLonToVector(lat, lon, radius, target) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  target.set(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
  return target
}

/** Hubs used for the globe's node markers and arcs. */
export const CITIES = [
  { name: 'New York', lat: 40.7, lon: -74.0 },
  { name: 'London', lat: 51.5, lon: -0.1 },
  { name: 'Frankfurt', lat: 50.1, lon: 8.7 },
  { name: 'Zurich', lat: 47.4, lon: 8.5 },
  { name: 'Dubai', lat: 25.2, lon: 55.3 },
  { name: 'Singapore', lat: 1.35, lon: 103.8 },
  { name: 'Hong Kong', lat: 22.3, lon: 114.2 },
  { name: 'Tokyo', lat: 35.7, lon: 139.7 },
  { name: 'Sydney', lat: -33.9, lon: 151.2 },
  { name: 'Mumbai', lat: 19.1, lon: 72.9 },
  { name: 'São Paulo', lat: -23.5, lon: -46.6 },
  { name: 'Toronto', lat: 43.7, lon: -79.4 },
  { name: 'San Francisco', lat: 37.8, lon: -122.4 },
  { name: 'Lagos', lat: 6.5, lon: 3.4 },
  { name: 'Johannesburg', lat: -26.2, lon: 28.0 },
  { name: 'Seoul', lat: 37.6, lon: 127.0 },
]

/** Pairs drawn as arcs — deliberately chosen so the routes span the globe. */
export const CITY_ROUTES = [
  [0, 1], [1, 2], [2, 4], [4, 5], [5, 7], [7, 12], [12, 0],
  [1, 11], [3, 4], [9, 5], [6, 8], [10, 0], [13, 1], [14, 4],
  [15, 8], [11, 10], [6, 15], [9, 14],
]
