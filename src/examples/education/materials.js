import * as THREE from 'three'

/**
 * Material corrections applied after the GLBs load.
 *
 * The Blender export is authored for a lit render; several surfaces come
 * through with a linear albedo so low that no amount of light recovers surface
 * information from them — the bark is at 0.067, which is a 7% reflector, and
 * on screen it collapses into the background. These lifts move the darkest
 * materials into a range where the key and rim actually have something to
 * work with, while keeping them unmistakably dark.
 *
 * `lift` is a target linear luminance; the material's colour is scaled toward
 * it, preserving its hue rather than replacing it with a grey.
 */
const TUNING = {
  mat_tree_bark: { lift: 0.09, roughness: 0.78 },
  mat_tree_secondary: { lift: 0.085, roughness: 0.8 },
  // Leaves are already mid-toned; what they lack is a lit back face. Without
  // double siding, every leaf turned away from the key renders black, which is
  // most of them at any given moment.
  mat_leaves_business: { side: THREE.DoubleSide, roughness: 0.66 },
  mat_leaves_design: { side: THREE.DoubleSide, roughness: 0.66 },
  mat_leaves_engineering: { side: THREE.DoubleSide, roughness: 0.66 },
  mat_leaves_science: { side: THREE.DoubleSide, roughness: 0.66 },
  mat_leaves_technology: { side: THREE.DoubleSide, roughness: 0.66 },
  // Near-black props that would otherwise read as holes.
  mat_artifact_dark: { lift: 0.055 },
  mat_campus_dark: { lift: 0.05 },
  mat_seed_shell: { roughness: 0.5 },
}

const luminance = (colour) =>
  colour.r * 0.2126 + colour.g * 0.7152 + colour.b * 0.0722

/** Applies the table to one material, in place. Safe to call more than once. */
export function tuneMaterial(material) {
  const tuning = TUNING[material.name]
  if (!tuning) return material

  if (tuning.lift !== undefined && material.color) {
    const current = luminance(material.color)
    if (current > 0.0001 && current < tuning.lift) {
      // Scaling preserves the hue relationship the artist chose; setting a
      // flat colour would turn charcoal-brown bark into grey.
      material.color.multiplyScalar(tuning.lift / current)
    }
  }
  if (tuning.roughness !== undefined) material.roughness = tuning.roughness
  if (tuning.side !== undefined) material.side = tuning.side

  return material
}
