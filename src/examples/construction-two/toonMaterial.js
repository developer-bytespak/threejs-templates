import * as THREE from 'three'
import {
  AMBIENT_FLOOR,
  BANDS,
  BAND_SOFTNESS,
  DEFAULT_BANDS,
  FILL_DIRECTION,
  FILL_WEIGHT,
  PALETTE,
  SUN_DIRECTION,
  SUN_WEIGHT,
  UNLIT_MATERIALS,
  paletteKeyOf,
} from './palette.js'

/**
 * Three flat values per surface with a narrow soft crossing between them.
 *
 * MeshToonMaterial cannot do this: its gradient map multiplies the base
 * colour, so its dark band is always a darker version of the same hue. Here
 * the three tones are chosen, not derived — plaster drops toward warm grey,
 * skin toward a browner shade — so the step has to happen in the shader.
 *
 * The light term is computed from two fixed directions rather than three's
 * light list, which keeps the band values in palette.js meaningful numbers
 * instead of ones that drift with light intensity. `getShadowMask()` is the
 * one piece borrowed from three: it carries the real shadow map, and that is
 * what lays the wedge of window light across the plaster.
 *
 * BAND_SOFTNESS is deliberately small. At 0 this is the old hard cel step; at
 * 0.055 a curved surface keeps a drawn edge but stops snapping between flats.
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
  uniform vec3 uMid;
  uniform vec3 uShadow;
  uniform vec3 uSunDirection;
  uniform vec3 uFillDirection;
  uniform float uSunWeight;
  uniform float uFillWeight;
  uniform float uAmbient;
  uniform float uLow;
  uniform float uHigh;
  uniform float uSoft;
  uniform float uUnlit;

  varying vec3 vWorldNormal;

  void main() {
    vec3 normal = normalize(vWorldNormal);
    // Two-sided: thin cards — paper, leaves, glazing — light from either face.
    if (!gl_FrontFacing) normal = -normal;

    // The sun is the only shadow caster; the fill is a flat wrap light.
    float sun = max(dot(normal, uSunDirection), 0.0) * getShadowMask();
    float fill = max(dot(normal, uFillDirection), 0.0);
    float light = sun * uSunWeight + fill * uFillWeight + uAmbient;

    float toMid = smoothstep(uLow - uSoft, uLow + uSoft, light);
    float toLit = smoothstep(uHigh - uSoft, uHigh + uSoft, light);
    vec3 colour = mix(mix(uShadow, uMid, toMid), uLit, toLit);
    colour = mix(colour, uLit, uUnlit);

    gl_FragColor = vec4(colour, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

/** One material instance per palette entry, shared by every mesh using it. */
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

  const lit = new THREE.Color(entry.lit)
  const shadow = new THREE.Color(entry.shadow)
  const mid = entry.mid
    ? new THREE.Color(entry.mid)
    : lit.clone().lerp(shadow, 0.45)
  const [low, high] = BANDS[key] ?? DEFAULT_BANDS

  const material = new THREE.ShaderMaterial({
    lights: true,
    vertexShader,
    fragmentShader,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.lights,
      {
        uLit: { value: new THREE.Color() },
        uMid: { value: new THREE.Color() },
        uShadow: { value: new THREE.Color() },
        uSunDirection: { value: new THREE.Vector3() },
        uFillDirection: { value: new THREE.Vector3() },
        uSunWeight: { value: SUN_WEIGHT },
        uFillWeight: { value: FILL_WEIGHT },
        uAmbient: { value: AMBIENT_FLOOR },
        uLow: { value: low },
        uHigh: { value: high },
        uSoft: { value: BAND_SOFTNESS },
        uUnlit: { value: UNLIT_MATERIALS.has(key) ? 1 : 0 },
      },
    ]),
  })

  // UniformsUtils.merge clones by value and loses Color/Vector3 instances on
  // some paths, so the non-light uniforms are re-seated afterwards.
  material.uniforms.uLit.value = lit
  material.uniforms.uMid.value = mid
  material.uniforms.uShadow.value = shadow
  material.uniforms.uSunDirection.value = new THREE.Vector3(...SUN_DIRECTION).normalize()
  material.uniforms.uFillDirection.value = new THREE.Vector3(...FILL_DIRECTION).normalize()

  material.name = `Toon_${key}`
  material.userData.toon = true
  cache.set(key, material)
  return material
}

/**
 * The ink line, kept for any model that still ships inverted-hull shells.
 * v2 does not: it exports clean primary geometry only, so nothing calls this
 * unless an "Outline" group turns up in the GLB.
 */
export function outlineMaterial() {
  const cached = cache.get('__outline')
  if (cached) return cached

  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(PALETTE.mat_wall_dark?.shadow ?? '#191B20'),
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
