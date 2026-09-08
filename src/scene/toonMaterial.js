import * as THREE from 'three'
import {
  AMBIENT_FLOOR,
  DEFAULT_THRESHOLD,
  FILL_DIRECTION,
  FILL_WEIGHT,
  PALETTE,
  SUN_DIRECTION,
  SUN_WEIGHT,
  THRESHOLDS,
  paletteKeyOf,
} from './palette.js'

/**
 * Rebuilds the Blender look: one flat colour where light lands, another where
 * it does not, with a hard edge between them.
 *
 * MeshToonMaterial cannot do this. Its gradient map multiplies the base
 * colour, so its dark band is always a darker version of the same hue — but
 * here cream skin drops to blue, not to dark cream. The two colours are
 * unrelated, so the step has to be chosen in the shader.
 *
 * The light term is computed directly from two fixed directions rather than
 * from three's light list, which keeps the thresholds in palette.js meaningful
 * numbers instead of values that drift with light intensity. `getShadowMask()`
 * is the one piece borrowed from three: it carries the real shadow map, which
 * is what puts the wedge of window light on the back wall.
 */

const vertexShader = /* glsl */ `
  #include <common>
  #include <shadowmap_pars_vertex>

  varying vec3 vWorldNormal;

  void main() {
    #include <beginnormal_vertex>
    #include <defaultnormal_vertex>
    #include <begin_vertex>
    #include <project_vertex>
    #include <worldpos_vertex>
    #include <shadowmap_vertex>

    vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
  }
`

const fragmentShader = /* glsl */ `
  #include <common>
  #include <packing>
  #include <lights_pars_begin>
  #include <shadowmap_pars_fragment>
  #include <shadowmask_pars_fragment>

  uniform vec3 uLit;
  uniform vec3 uShadow;
  uniform vec3 uSunDirection;
  uniform vec3 uFillDirection;
  uniform float uSunWeight;
  uniform float uFillWeight;
  uniform float uAmbient;
  uniform float uThreshold;

  varying vec3 vWorldNormal;

  void main() {
    vec3 normal = normalize(vWorldNormal);
    // Two-sided: thin cards (paper, leaves) should light from either face.
    if (!gl_FrontFacing) normal = -normal;

    // The sun is the only shadow caster, so the mask applies to it alone —
    // the fill is a flat wrap light exactly as it was in Blender.
    float sun = max(dot(normal, uSunDirection), 0.0) * getShadowMask();
    float fill = max(dot(normal, uFillDirection), 0.0);
    float light = sun * uSunWeight + fill * uFillWeight + uAmbient;

    vec3 colour = light > uThreshold ? uLit : uShadow;

    gl_FragColor = vec4(colour, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

/**
 * One material instance per palette entry, shared by every mesh using it.
 * Built lazily and cached, because the GLB has 167 meshes across 20 materials.
 */
const cache = new Map()

export function toonMaterialFor(materialName) {
  const key = paletteKeyOf(materialName)
  const cached = cache.get(key)
  if (cached) return cached

  const entry = PALETTE[key]
  if (!entry) {
    if (import.meta.env.DEV) {
      console.warn(`No palette entry for material "${materialName}"`)
    }
    return null
  }

  const material = new THREE.ShaderMaterial({
    lights: true,
    vertexShader,
    fragmentShader,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.lights,
      {
        uLit: { value: new THREE.Color(entry.lit) },
        uShadow: { value: new THREE.Color(entry.shadow) },
        uSunDirection: { value: new THREE.Vector3(...SUN_DIRECTION).normalize() },
        uFillDirection: { value: new THREE.Vector3(...FILL_DIRECTION).normalize() },
        uSunWeight: { value: SUN_WEIGHT },
        uFillWeight: { value: FILL_WEIGHT },
        uAmbient: { value: AMBIENT_FLOOR },
        uThreshold: { value: THRESHOLDS[key] ?? DEFAULT_THRESHOLD },
      },
    ]),
  })

  // UniformsUtils.merge clones by value and loses Color/Vector3 instances on
  // some paths, so the non-light uniforms are re-seated afterwards.
  material.uniforms.uLit.value = new THREE.Color(entry.lit)
  material.uniforms.uShadow.value = new THREE.Color(entry.shadow)
  material.uniforms.uSunDirection.value = new THREE.Vector3(...SUN_DIRECTION).normalize()
  material.uniforms.uFillDirection.value = new THREE.Vector3(...FILL_DIRECTION).normalize()

  material.name = `Toon_${key}`
  material.userData.toon = true
  cache.set(key, material)
  return material
}

/**
 * The ink line. These meshes are inverted hulls exported from Blender — a
 * slightly inflated copy of each object with its normals flipped — so leaving
 * the default front-face culling on hides the near shell and leaves only the
 * rim showing past the silhouette.
 */
export function outlineMaterial() {
  const cached = cache.get('__outline')
  if (cached) return cached

  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(PALETTE.NPR_Outline.lit),
    side: THREE.FrontSide,
    toneMapped: false,
  })
  material.name = 'Toon_Outline'
  material.userData.toon = true
  cache.set('__outline', material)
  return material
}

export function disposeToonMaterials() {
  for (const material of cache.values()) material.dispose()
  cache.clear()
}
