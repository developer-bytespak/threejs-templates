import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { THEME } from './theme.js'

const vertexShader = /* glsl */ `
  uniform float uScatter;
  uniform float uBlock;
  uniform float uGlobe;
  uniform float uSpin;
  uniform float uGlobeSpin;
  uniform float uTime;
  uniform float uDrift;
  uniform float uSize;
  uniform float uProjScale;
  uniform float uAspect;
  uniform vec2 uPointer;
  uniform float uPointerStrength;
  uniform float uShimmer;

  attribute vec3 aScatter;
  attribute vec3 aBlock;
  attribute vec3 aGlobe;
  attribute float aSeed;
  attribute float aSize;
  attribute float aTone;
  attribute float aGlobeTone;

  varying float vTone;
  varying float vFade;

  vec3 rotateY(vec3 p, float a) {
    float s = sin(a);
    float c = cos(a);
    return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  }

  void main() {
    // The sphere and the globe spin independently; the chain does not spin at
    // all, so rotation is applied per-target rather than to the whole object.
    vec3 spherePosition = rotateY(position, uSpin);
    vec3 globePosition = rotateY(aGlobe, uGlobeSpin);

    vec3 p = mix(spherePosition, aScatter, uScatter);
    p = mix(p, aBlock, uBlock);
    p = mix(p, globePosition, uGlobe);

    float t = uTime * 0.35 + aSeed * 6.2831853;
    p += vec3(sin(t), cos(t * 0.86), sin(t * 0.71)) * uDrift * (0.3 + aSeed * 0.7);

    vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
    vec4 clip = projectionMatrix * viewPosition;

    // Pointer repulsion is done in clip space: it stays a fixed size on
    // screen no matter how far the camera is, which keeps it subtle.
    if (uPointerStrength > 0.0) {
      vec2 ndc = clip.xy / clip.w;
      vec2 delta = ndc - uPointer;
      float d = length(delta * vec2(uAspect, 1.0));
      float push = uPointerStrength * exp(-d * d * 24.0);
      ndc += normalize(delta + vec2(1e-5)) * push;
      clip.xy = ndc * clip.w;
    }
    gl_Position = clip;

    float depth = -viewPosition.z;
    vFade = smoothstep(19.0, 4.0, depth);

    float shimmer = 1.0 + sin(uTime * 1.7 + aSeed * 24.0) * uShimmer;
    vTone = mix(aTone, aGlobeTone, uGlobe) * shimmer;

    // uSize is a radius in world units, so uProjScale converts it to device
    // pixels for this camera. The clamp stops a particle that drifts close to
    // the lens from covering a quarter of the screen.
    gl_PointSize = clamp(aSize * uSize * uProjScale / max(depth, 0.6) * shimmer, 1.0, 14.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uDeep;
  uniform vec3 uBright;
  uniform float uOpacity;

  varying float vTone;
  varying float vFade;

  void main() {
    // A radial falloff computed here is what gives the glow. It costs one
    // length() and needs no texture and no bloom pass.
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;

    float core = smoothstep(0.5, 0.0, d);
    // Kept deliberately low: thousands of additive sprites overlap, and the
    // sphere saturates to white long before each point looks bright alone.
    float alpha = pow(core, 1.75) * uOpacity * vFade * (0.2 + clamp(vTone, 0.0, 1.4) * 0.7);
    vec3 colour = mix(uDeep, uBright, clamp(vTone, 0.0, 1.0));
    gl_FragColor = vec4(colour, alpha);
  }
`

/**
 * The single Points object that carries the whole story. Every state change
 * is a uniform write, so there is no per-frame CPU work proportional to the
 * particle count and no geometry is rebuilt when the scene changes.
 */
function NetworkField({ stage, input, quality, reducedMotion, fieldData }) {
  const materialRef = useRef(null)
  const spin = useRef({ sphere: 0, globe: 0, pointerX: 0, pointerY: 0 })

  const uniforms = useMemo(
    () => ({
      uScatter: { value: 0 },
      uBlock: { value: 0 },
      uGlobe: { value: 0 },
      uSpin: { value: 0 },
      uGlobeSpin: { value: 0 },
      uTime: { value: 0 },
      uDrift: { value: 0.05 },
      uSize: { value: quality.pointSize },
      uProjScale: { value: 800 },
      uAspect: { value: 1.6 },
      uPointer: { value: new THREE.Vector2(2, 2) },
      uPointerStrength: { value: 0 },
      uShimmer: { value: 0 },
      uOpacity: { value: 1 },
      uDeep: { value: new THREE.Color(THEME.deep) },
      uBright: { value: new THREE.Color(THEME.bright) },
    }),
    [quality.pointSize],
  )

  useFrame((state, delta) => {
    const material = materialRef.current
    if (!material) return

    const step = Math.min(delta, 0.1)
    const u = material.uniforms
    const s = stage.current
    const local = spin.current

    u.uTime.value = state.clock.elapsedTime
    u.uAspect.value = state.viewport.aspect
    // Pixels per world unit at one unit of depth, for the current camera.
    u.uProjScale.value =
      (state.size.height * state.viewport.dpr) /
      (2 * Math.tan((state.camera.fov * Math.PI) / 360))

    u.uScatter.value = s.scatter
    u.uBlock.value = s.block
    u.uGlobe.value = s.globe

    if (reducedMotion) {
      u.uSpin.value = 0.6
      u.uGlobeSpin.value = 0.2
      u.uDrift.value = 0
      u.uShimmer.value = 0
      u.uPointerStrength.value = 0
    } else {
      // Pointer nudges rotation rather than setting it, and only through a
      // damped offset — the user can influence the spin, never take it over.
      local.pointerX = THREE.MathUtils.damp(local.pointerX, input.current.pointerX, 1.8, step)
      local.pointerY = THREE.MathUtils.damp(local.pointerY, input.current.pointerY, 1.8, step)

      local.sphere += step * 0.11 * s.spinRate
      local.globe += step * 0.075

      u.uSpin.value = local.sphere + local.pointerX * 0.22
      u.uGlobeSpin.value = local.globe + local.pointerX * 0.16
      u.uDrift.value = 0.035 + s.scatter * 0.11
      u.uShimmer.value = 0.06

      if (quality.pointerPush) {
        u.uPointer.value.set(input.current.pointerX, input.current.pointerY)
        // Only while the sphere is intact, and only when the pointer is over
        // the page at all.
        u.uPointerStrength.value = input.current.pointerActive
          ? 0.05 * (1 - s.block) * (1 - s.scatter * 0.6)
          : 0
      }
    }

    // Particles thin out slightly while they are in transit, which stops the
    // scattered cloud from reading as brighter than the formed sphere.
    u.uOpacity.value = 1 - 0.18 * s.scatter * (1 - s.block) - 0.1 * s.block * (1 - s.globe)
  })

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[fieldData.sphere, 3]} />
        <bufferAttribute attach="attributes-aScatter" args={[fieldData.scatter, 3]} />
        <bufferAttribute attach="attributes-aBlock" args={[fieldData.block, 3]} />
        <bufferAttribute attach="attributes-aGlobe" args={[fieldData.globe, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[fieldData.seeds, 1]} />
        <bufferAttribute attach="attributes-aSize" args={[fieldData.sizes, 1]} />
        <bufferAttribute attach="attributes-aTone" args={[fieldData.tones, 1]} />
        <bufferAttribute attach="attributes-aGlobeTone" args={[fieldData.globeTones, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

export default NetworkField
