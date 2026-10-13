import * as THREE from 'three'

/**
 * Removes ground rather than fading it.
 *
 * Fading the setout out would say "this string became transparent", which
 * is not what happens on a site. This discards fragments behind a front that
 * travels across the aperture, so the earth is gone from one side first and
 * the cut face behind it is revealed in place — the ground opens.
 *
 * The front is quantised to a grid in world space before it is jittered. A
 * per-fragment hash breaks the boundary up beautifully in the abstract, but on
 * a moving camera it crawls across the surface, because the pattern is keyed
 * to pixels rather than to anything the geometry owns. Snapping it to a grid
 * the ground sits still in means a patch of earth is either there or it is
 * not, the edge still breaks up into clods, and nothing shimmers.
 *
 * Driving several materials from one front is deliberate: the same call drives
 * the stakes and the string lines, so the setout is taken away by exactly the
 * ground it was standing on rather than fading on a timer of its own.
 */
export function attachDissolve(material, options = {}) {
  if (material.userData.dissolve) return material.userData.dissolve

  const uniforms = {
    // Starts past everything, so an undriven material is simply fully drawn.
    uFront: { value: 1e6 },
    // Width of the ragged zone either side of the front, in metres.
    uBand: { value: options.band ?? 2.0 },
    // Cells per metre for the coarse lattice. Coarse enough that a clod reads
    // as a clod: too fine and the edge dissolves into sand, too coarse and it
    // steps like masonry.
    uCell: { value: options.cell ?? 0.6 },
    // Darkens the last stretch of earth before the front reaches it, so the
    // boundary reads as freshly broken rather than cleanly sliced.
    uScorch: { value: options.scorch ?? 0.46 },
  }

  material.userData.dissolve = uniforms
  material.customProgramCacheKey = () => 'construction-dissolve'

  const previous = material.onBeforeCompile?.bind(material)
  material.onBeforeCompile = (shader, renderer) => {
    previous?.(shader, renderer)
    Object.assign(shader.uniforms, uniforms)

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vCutWorld;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vCutWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vCutWorld;
         uniform float uFront;
         uniform float uBand;
         uniform float uCell;
         uniform float uScorch;

         float cutHash(vec2 c) {
           return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453);
         }

         // The lattice is turned thirty degrees off the world axes before it
         // is used. An axis-aligned grid on a rectangular pit produces an
         // edge that breaks along the same lines as the excavation itself,
         // and the result reads as a low-resolution image rather than as
         // ground coming apart. Off-axis, the same cells read as clods.
         const mat2 CUT_LATTICE = mat2(0.866, 0.5, -0.5, 0.866);`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>

         // One value per cell of ground, not per pixel: the clod either goes
         // or it stays, and it does not change its mind as the camera moves.
         // Two octaves, because one leaves every clod the same size, and real
         // ground comes away in a big piece with smaller ones around it.
         vec2 cut = CUT_LATTICE * vCutWorld.xz;
         float jitter =
           cutHash(floor(cut * uCell)) * 0.72 +
           cutHash(floor(cut * uCell * 2.7)) * 0.28;
         float edge = uFront + (jitter - 0.5) * uBand;

         // The front sweeps from high x to low x, so earth ahead of it is
         // still there and earth behind it has been taken away.
         if (vCutWorld.x > edge) discard;

         // A short darker run just inside the edge. Cheap, and it stops the
         // boundary looking like a clean cut through a solid.
         float lip = 1.0 - smoothstep(0.0, uBand * 1.6, edge - vCutWorld.x);
         gl_FragColor.rgb *= 1.0 - lip * uScorch;`,
      )
  }

  material.needsUpdate = true
  return uniforms
}

/**
 * Point every dissolve in a list at the same place.
 *
 * `t` is 0 with the ground whole and 1 with it fully removed; `from` and `to`
 * are the world x the front travels between. They sit a little outside the
 * aperture at both ends so the sweep starts and finishes off the edge of the
 * hole instead of visibly parking on it.
 */
export function setFront(uniformList, t, from, to) {
  const x = from + (to - from) * t
  for (const u of uniformList) u.uFront.value = x
}

/**
 * Give a subtree its own copy of every material it uses.
 *
 * glTF hands out one material instance per material in the file, shared by
 * every mesh that references it. That is the right default and completely
 * wrong here: the stakes share timber with the pallets by the site office, so
 * dissolving the setout would quietly dissolve half the yard with it. Cloning
 * per group costs a few materials and removes the entire class of bug.
 */
export function isolateMaterials(root) {
  const clones = new Map()
  const owned = []
  root.traverse((object) => {
    if (!object.isMesh) return
    const swap = (material) => {
      let clone = clones.get(material)
      if (!clone) {
        clone = material.clone()
        clones.set(material, clone)
        owned.push(clone)
      }
      return clone
    }
    object.material = Array.isArray(object.material)
      ? object.material.map(swap)
      : swap(object.material)
  })
  return owned
}

/** Fade a group that owns its materials. Safe to call every frame. */
export function setOpacity(materials, value) {
  const opaque = value >= 0.999
  for (const material of materials) {
    material.opacity = value
    material.transparent = !opaque
    material.depthWrite = opaque
  }
}

/**
 * Recess liners face inward on purpose; they need both sides drawn.
 *
 * `shadowSide` has to be set with it, and that is not a detail. three picks a
 * shadow side from `side` when it is left alone, and for a DoubleSide
 * material it picks DoubleSide — so both faces of a zero-thickness wall shell
 * get written into the shadow map, a few millimetres apart, and every surface
 * lit through it comes out stippled with dashed lines where the two layers
 * trade places. Pinning it to BackSide restores what three does for an
 * ordinary material: one depth layer, from the face turned away from the
 * camera, which is the one actually between the sun and the floor.
 */
export function makeDoubleSided(object) {
  object.traverse((child) => {
    if (!child.isMesh) return
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    for (const material of materials) {
      material.side = THREE.DoubleSide
      material.shadowSide = THREE.BackSide
      material.needsUpdate = true
    }
  })
}
