import * as THREE from 'three'

/**
 * Material work, in two parts.
 *
 * The GLB ships eight materials, but they do not map one-to-one onto the eight
 * systems: `mat_facade_charcoal` dresses the facade *and* the rooftop canopy,
 * louvres and posts. Highlighting a hovered system by touching the shared
 * material would light both, so every system gets its own clones — around ten
 * material instances in total, which is nothing, and in exchange each system
 * becomes independently tunable and independently hoverable.
 *
 * The exported values are a good starting point rather than something to throw
 * away, so this adjusts them instead of replacing them: the concretes keep
 * their authored colours and only gain the roughness spread that stops eight
 * grey systems reading as one grey mass.
 */

/** Per-system finish. Only the fields that differ from the export are set. */
const FINISH = {
  // Darkest of the concretes on purpose. It is a large horizontal plane
  // pointed straight at the key, so at equal albedo it reads as a lightbox
  // and drags the eye to the bottom of the frame.
  foundation: { roughness: 0.92, metalness: 0, envMapIntensity: 0.22, tone: 0.13 },
  // Frame darker than the plates it carries. Nine slabs fanning out of a
  // column grid is only legible if the two read as different values —
  // matched, they collapse into one white mass from any high camera angle.
  columns: { roughness: 0.72, metalness: 0, envMapIntensity: 0.35, tone: 0.15 },
  beams: { roughness: 0.78, metalness: 0, envMapIntensity: 0.32, tone: 0.15 },
  // Slab soffits catch the key across their whole area during the fan, so
  // they stay slightly smoother than the frame they sit on.
  slabs: { roughness: 0.68, metalness: 0, envMapIntensity: 0.3, tone: 0.12 },
  walls: { roughness: 0.8, metalness: 0, envMapIntensity: 0.3, tone: 0.18 },
  // Restrained metalness: enough for the envelope to pick up the studio
  // lightformers along its edges, not enough to turn it into a mirror. Held
  // below the authored 0.8 because at that value there is almost no diffuse
  // term left and a charcoal facade simply goes black.
  facade: { roughness: 0.34, metalness: 0.42, envMapIntensity: 1.2, tone: 2.4 },
  rooftop: { roughness: 0.54, metalness: 0.3, envMapIntensity: 0.8, tone: 1.8 },
}



/** How each system answers the pointer. Kept deliberately quiet. */
const HOVER = {
  foundation: { emissive: '#2b3038', strength: 0.5 },
  columns: { emissive: '#5b7fae', strength: 1 },
  beams: { emissive: '#53749f', strength: 0.9 },
  slabs: { emissive: '#6d7f93', strength: 0.85 },
  walls: { emissive: '#6a6459', strength: 0.7 },
  facade: { emissive: '#41505f', strength: 0.9 },
  rooftop: { emissive: '#44515f', strength: 0.8 },
  windows: { emissive: '#2f4d72', strength: 1 },
}

const isGlass = (material) => /glass/i.test(material.name ?? '')

/**
 * Builds the glazing.
 *
 * Transmission gives the most convincing architectural glass, but it costs an
 * extra pass over the scene every frame, so only the full tier pays for it.
 * Either way the glass stays dark blue-grey: attenuation on the physical
 * version and a low opacity on the standard one both hold the tint that makes
 * it read as a facade rather than as a window pane.
 */
function buildGlass(source, useTransmission) {
  if (!useTransmission) {
    const material = new THREE.MeshStandardMaterial({
      name: `${source.name}__standard`,
      color: source.color.clone(),
      metalness: 0.62,
      roughness: 0.12,
      transparent: true,
      opacity: 0.82,
      // The eight strips are concentric rings seen through one another. Not
      // writing depth is what stops them fighting over who is in front.
      depthWrite: false,
      side: THREE.FrontSide,
      envMapIntensity: 1.1,
    })
    return material
  }

  const material = new THREE.MeshPhysicalMaterial({
    name: `${source.name}__physical`,
    color: source.color.clone(),
    metalness: 0,
    roughness: 0.14,
    transmission: 0.38,
    thickness: 1.1,
    ior: 1.45,
    // Transmission carries its own opacity, so the material stays opaque to
    // the sorter and the strips depth-test against each other normally.
    transparent: false,
    attenuationColor: new THREE.Color('#16283c'),
    attenuationDistance: 2.4,
    side: THREE.FrontSide,
    envMapIntensity: 1.25,
  })
  return material
}

/**
 * Gives `layer` its own materials and records what "unlit" looks like, so the
 * hover response can be written and unwritten every frame without ever
 * needing to re-read the authored values.
 */
export function enhanceLayer(layer, meshes, { transmission }) {
  const clones = new Map()
  const owned = []

  for (const mesh of meshes) {
    const source = mesh.material
    if (!source) continue

    let clone = clones.get(source.uuid)
    if (!clone) {
      clone = isGlass(source)
        ? buildGlass(source, transmission)
        : source.clone()

      if (!isGlass(source)) {
        const finish = FINISH[layer]
        if (finish) {
          clone.roughness = finish.roughness
          clone.metalness = finish.metalness
          clone.envMapIntensity = finish.envMapIntensity
          // The export's albedos span 0.2 to 0.72, which is too wide a range
          // to light evenly: the pale concretes clip before the charcoal
          // envelope is out of the dark. `tone` closes that gap.
          if (finish.tone) clone.color.multiplyScalar(finish.tone)
        }
        clone.name = `${source.name}__${layer}`
        // Every part in this model is a closed box, so back faces are never
        // visible. Dropping them halves the fragment work and, more usefully,
        // stops shadow acne on the thin slabs and glazing strips.
        clone.side = THREE.FrontSide
      }

      const tint = HOVER[layer]
      clone.emissive = new THREE.Color('#000000')
      clone.userData.base = {
        emissive: new THREE.Color('#000000'),
        color: clone.color.clone(),
        envMapIntensity: clone.envMapIntensity ?? 1,
        hover: new THREE.Color(tint?.emissive ?? '#404040'),
        strength: tint?.strength ?? 0.8,
      }

      clones.set(source.uuid, clone)
      owned.push(clone)
    }

    mesh.material = clone
  }

  return owned
}

const scratch = new THREE.Color()

/**
 * Applies the pointer response. `hover` lifts the system the cursor is over,
 * `dim` settles everything else back so the highlight reads as a choice
 * rather than as the whole model brightening.
 */
export function applyHover(materials, hover, dim) {
  for (const material of materials) {
    const base = material.userData.base
    if (!base) continue

    const lift = hover * base.strength
    scratch.copy(base.hover).multiplyScalar(lift * 0.42)
    material.emissive.copy(scratch)

    // A touch of extra reflectivity on the hovered system, and a touch less
    // on the rest, does more for the sense of focus than brightness alone.
    material.envMapIntensity = base.envMapIntensity * (1 + lift * 0.45 - dim * 0.3)

    if (dim > 0) {
      scratch.copy(base.color).multiplyScalar(1 - dim * 0.28)
      material.color.copy(scratch)
    } else {
      material.color.copy(base.color)
    }
  }
}

/** Frees everything this module created. */
export function disposeMaterials(materials) {
  for (const material of materials) material.dispose()
}
