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
 * The boundary is jittered per-fragment by a cheap hash so it breaks into
 * bark and leaf rather than sweeping past as a clean geometric plane.
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
    // Lets a whole group dim without touching its authored colours.
    uEduFade: { value: 1 },
    // Distance from the lens within which fragments dissolve. Foliage the
    // camera is flying through otherwise fills the frame with leaves that are
    // too close to read as anything.
    uEduNear: { value: 0 },
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
        uniform float uEduFade;
        uniform float uEduNear;`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        float eduMetric = ${metric};
        float eduDelta = eduMetric - uRevealEdge;
        // Breaking the boundary up per-fragment stops it reading as a plane
        // sweeping through solid geometry.
        float eduHash = fract(sin(dot(vEduWorld.xz + vEduWorld.y, vec2(12.9898, 78.233))) * 43758.5453);
        eduDelta -= (eduHash - 0.5) * uRevealJitter;
        if (eduDelta > 0.0) discard;
        if (uEduNear > 0.0 && vEduDepth < uEduNear) {
          // Dissolve rather than clip: a hard near plane cuts leaves in half
          // mid-frame, which is far more noticeable than them thinning out.
          float eduNearMask = smoothstep(uEduNear * 0.3, uEduNear, vEduDepth);
          float eduNearNoise = fract(sin(dot(gl_FragCoord.xy, vec2(23.14, 61.7))) * 9137.13);
          if (eduNearNoise > eduNearMask) discard;
        }
        if (uEduFade < 0.999) {
          // Dithered fade: these are opaque materials, and turning the whole
          // canopy transparent to dim it would cost far more than it is worth.
          float eduDither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
          if (eduDither > uEduFade) discard;
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float eduFront = smoothstep(-uRevealBand, 0.0, eduDelta);
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
