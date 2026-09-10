import * as THREE from 'three'

/**
 * Makes a material grow.
 *
 * Scaling a branch up from zero reads as a balloon inflating, not as a plant
 * growing — the silhouette is wrong the whole way. Instead this leaves every
 * vertex exactly where Blender put it and discards the fragments that have
 * not been reached yet, so the geometry is revealed in place along a moving
 * front. The front carries a thin emissive band, which is what sells it as
 * something advancing rather than something being uncovered.
 *
 * Everything that removes fragments here is quantised to a fixed grid in world
 * space (see `eduCell`). A per-fragment hash breaks the boundary up nicely on
 * paper, but on a canopy of small leaves it dissolves each leaf into a cloud of
 * dots, and because the hash is evaluated per pixel the pattern crawls across
 * the surface as the camera moves. Snapping it to a grid the geometry sits
 * still in means a leaf is either revealed or it is not, the front still breaks
 * up organically, and nothing shimmers.
 *
 * Three metrics, because the parts of a tree do not grow the same way:
 *
 *   'up'    — world height. The trunk rises.
 *   'out'   — radial distance from the trunk axis. The roots spread.
 *   'point' — distance from an origin. Branches and leaves push outward from
 *             where they meet the trunk.
 */
const METRIC = {
  up: 'vEduWorld.y',
  out: 'length(vEduWorld.xz)',
  point: 'length(vEduWorld - uRevealOrigin)',
}

export function attachReveal(material, mode, settings) {
  // Defaulted defensively rather than in the signature: a caller passing null
  // would sail past a default parameter and fail on the first lookup.
  const options = settings ?? {}
  const uniforms = {
    // Starts past everything, so an un-driven material is simply fully drawn.
    uRevealEdge: { value: 1e6 },
    uRevealOrigin: { value: new THREE.Vector3(0, 0, 0) },
    uRevealBand: { value: options.band ?? 1.1 },
    uRevealJitter: { value: options.jitter ?? 0.55 },
    uRevealGlow: { value: new THREE.Color(options.glow ?? '#ff9d43') },
    uRevealGlowStrength: { value: options.glowStrength ?? 2.4 },
    // Cells per world unit for every dissolve on this material. Coarse enough
    // that one element of the mesh falls inside one cell: a leaf wants cells
    // around half a metre so it resolves whole, a building wants far finer or
    // the dissolve reads as masonry dropping off the wall.
    uEduCell: { value: options.cell ?? 5 },
    // Lets a whole group dissolve away without touching its authored colours.
    uEduFade: { value: 1 },
    // Distance from the lens within which fragments dissolve. Foliage the
    // camera is flying through otherwise fills the frame with leaves that are
    // too close to read as anything.
    uEduNear: { value: 0 },
    // World height the growth front has reached. Defaults past everything, so
    // a material nobody drives is simply fully drawn — only the tree opts in.
    uGrowthHeight: { value: 1e6 },
    uGrowthSoft: { value: 0.7 },
    // Emphasis, for focus states. Read it as a straight brightness ratio: 1 is
    // full presence, 0.75 is a group that has stepped back, above 1 brings a
    // group forward. Deliberately separate from uEduFade — fading removes
    // fragments, and using that to de-emphasise makes a branch look like it is
    // disintegrating rather than receding.
    uEduEmphasis: { value: 1 },
  }

  const metric = METRIC[mode] ?? METRIC.up

  material.userData.eduReveal = uniforms
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vEduWorld;\nvarying float vEduDepth;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n' +
          '  vEduWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n' +
          '  vEduDepth = -(modelViewMatrix * vec4(transformed, 1.0)).z;',
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vEduWorld;
        varying float vEduDepth;
        uniform float uRevealEdge;
        uniform vec3 uRevealOrigin;
        uniform float uRevealBand;
        uniform float uRevealJitter;
        uniform vec3 uRevealGlow;
        uniform float uRevealGlowStrength;
        uniform float uEduCell;
        uniform float uEduFade;
        uniform float uEduNear;
        uniform float uGrowthHeight;
        uniform float uGrowthSoft;
        uniform float uEduEmphasis;

        // One value per cell of world space, so every fragment of the same leaf
        // agrees on it and it does not move when the camera does.
        float eduCell(float scale) {
          vec3 cell = floor(vEduWorld * (uEduCell * scale));
          return fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        }`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        // The growth front, as a hard ceiling on world height. Each group also
        // has its own front travelling along its own axis, but this is what
        // guarantees the order: no geometry, of any group, can be drawn above
        // the height the tree has actually grown to. Broken up per cell so the
        // ceiling reads as bark and leaf rather than as a level plane.
        if (vEduWorld.y - eduCell(0.83) * uGrowthSoft > uGrowthHeight) discard;

        float eduMetric = ${metric};
        // Two deltas: the smooth one places the glow, the jittered one decides
        // what is drawn. Lighting the band off the jittered value instead
        // paints the cell grid straight onto the front as a checkerboard.
        float eduDeltaSmooth = eduMetric - uRevealEdge;
        // The same trick on the group's own front, so it advances element by
        // element instead of sweeping through solid geometry as a plane.
        float eduDelta = eduDeltaSmooth - (eduCell(1.0) - 0.5) * uRevealJitter;
        if (eduDelta > 0.0) discard;
        if (uEduNear > 0.0 && vEduDepth < uEduNear) {
          // Whole leaves drop out as they approach the lens. A hard near plane
          // cuts them in half mid-frame, and a per-pixel dissolve turns the
          // canopy into grain — this removes them one leaf at a time.
          float eduNearMask = smoothstep(uEduNear * 0.3, uEduNear, vEduDepth);
          if (eduCell(0.61) > eduNearMask) discard;
        }
        if (uEduFade < 0.999) {
          // Dissolve, for groups that are not on screen long enough to be worth
          // the cost of real transparency. Cell-quantised for the same reason
          // as everything else here: a screen-space dither crawls.
          if (eduCell(1.37) > uEduFade) discard;
        }`,
      )
      // Applied to the resolved lighting, just before it is written out, so a
      // de-emphasised group keeps every fragment it had — it simply sits
      // further back in the frame.
      .replace(
        '#include <opaque_fragment>',
        `if (uEduEmphasis < 0.999 || uEduEmphasis > 1.001) {
          float eduLum = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
          // Desaturated only in proportion to how far it has stepped back, so a
          // quiet branch keeps its own colour instead of turning grey.
          float eduSat = min(1.0, mix(0.6, 1.0, uEduEmphasis));
          outgoingLight = mix(vec3(eduLum), outgoingLight, eduSat) * uEduEmphasis;
        }
        #include <opaque_fragment>`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float eduFront = smoothstep(-uRevealBand, 0.0, eduDeltaSmooth);
        totalEmissiveRadiance += uRevealGlow * eduFront * uRevealGlowStrength;`,
      )
  }

  // Without this three reuses one compiled program for every material that
  // looks alike, and every group would share the first metric compiled.
  material.customProgramCacheKey = () => `edu-reveal-${mode}`
  material.needsUpdate = true
  return material
}

/** Convenience for driving a whole group of reveal materials at once. */
export function setReveal(materials, edge, origin) {
  for (let i = 0; i < materials.length; i += 1) {
    const uniforms = materials[i].userData.eduReveal
    if (!uniforms) continue
    uniforms.uRevealEdge.value = edge
    if (origin) uniforms.uRevealOrigin.value.copy(origin)
  }
}

export function setFade(materials, fade) {
  for (let i = 0; i < materials.length; i += 1) {
    const uniforms = materials[i].userData.eduReveal
    if (uniforms) uniforms.uEduFade.value = fade
  }
}

/**
 * Focus state, as a straight brightness ratio. 1 is full presence, 0.75 is a
 * group that has stepped back but is plainly still there, above 1 brings a
 * group forward.
 */
export function setEmphasis(materials, emphasis) {
  for (let i = 0; i < materials.length; i += 1) {
    const uniforms = materials[i].userData.eduReveal
    if (uniforms) uniforms.uEduEmphasis.value = emphasis
  }
}

/**
 * Real opacity, for the objects that can afford it. The dissolve above is the
 * right trade for a canopy of hundreds of leaf materials; on a hero prop it
 * removes parts of a solid object, which is the one thing these props must
 * never look like they are doing.
 */
export function setOpacity(materials, opacity) {
  for (let i = 0; i < materials.length; i += 1) {
    materials[i].opacity = opacity
  }
}

export function setGrowthHeight(materials, height) {
  for (let i = 0; i < materials.length; i += 1) {
    const uniforms = materials[i].userData.eduReveal
    if (uniforms) uniforms.uGrowthHeight.value = height
  }
}

export function setNear(materials, distance) {
  for (let i = 0; i < materials.length; i += 1) {
    const uniforms = materials[i].userData.eduReveal
    if (uniforms) uniforms.uEduNear.value = distance
  }
}

export function setGlow(materials, strength) {
  for (let i = 0; i < materials.length; i += 1) {
    const uniforms = materials[i].userData.eduReveal
    if (uniforms) uniforms.uRevealGlowStrength.value = strength
  }
}
