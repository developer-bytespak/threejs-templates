import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uProjScale;
  uniform float uRise;

  attribute float aSeed;
  attribute float aSize;

  varying float vAlpha;

  void main() {
    vec3 p = position;
    // A slow upward drift that wraps, so the column never empties out.
    float lift = fract(aSeed + uTime * 0.012 * uRise);
    p.y += lift * 24.0 - 6.0;
    p.x += sin(uTime * 0.18 + aSeed * 40.0) * 0.7;
    p.z += cos(uTime * 0.15 + aSeed * 33.0) * 0.7;

    vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * viewPosition;

    float depth = -viewPosition.z;
    // Fade at both ends of the depth range: motes that pop in at the far
    // plane or smear across the lens both read as dirt on the screen.
    vAlpha = uOpacity * smoothstep(70.0, 34.0, depth) * smoothstep(0.6, 4.0, depth);
    gl_PointSize = clamp(aSize * uProjScale / max(depth, 0.6), 1.0, 7.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColour;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5 || vAlpha <= 0.002) discard;
    float core = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColour, pow(core, 2.0) * vAlpha);
  }
`

/** Deterministic, so the drift pattern is identical on every load. */
function makeRandom(seed) {
  let a = seed >>> 0
  return function random() {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Airborne dust through the whole journey — sparse at the seed, thicker in the
 * canopy, warm and pollen-like over the campus. One draw call; the drift is
 * done in the vertex shader so nothing touches the buffer after it is built.
 */
function Motes({ stage, quality, bounds }) {
  const materialRef = useRef(null)

  const data = useMemo(() => {
    const random = makeRandom(20260910)
    const count = quality.motes
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    const sizes = new Float32Array(count)
    const radius = bounds.radius

    for (let i = 0; i < count; i += 1) {
      // Distributed through a column around the tree rather than a box, so
      // density stays even from any angle the camera takes.
      const angle = random() * Math.PI * 2
      const r = Math.sqrt(random()) * radius
      positions[i * 3] = Math.cos(angle) * r
      positions[i * 3 + 1] = random() * bounds.height
      positions[i * 3 + 2] = Math.sin(angle) * r
      seeds[i] = random()
      sizes[i] = 0.012 + random() * 0.03
    }
    return { positions, seeds, sizes }
  }, [quality.motes, bounds.radius, bounds.height])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uProjScale: { value: 900 },
      uRise: { value: 1 },
      uColour: { value: new THREE.Color('#ffd9a8') },
    }),
    [],
  )

  useFrame((state) => {
    const material = materialRef.current
    if (!material) return
    const s = stage.current

    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uProjScale.value =
      (state.size.height * state.viewport.dpr) /
      (2 * Math.tan((state.camera.fov * Math.PI) / 360))

    // Thin at the seed, densest in the canopy, and warmer once the clearing
    // opens so the same particles read as pollen instead of dust.
    const canopy = s.leafReveal * (1 - s.warmth * 0.3)
    material.uniforms.uOpacity.value =
      s.motes * (0.22 + canopy * 0.5 + s.warmth * 0.45)
    material.uniforms.uColour.value.setHSL(
      0.09 - s.warmth * 0.02,
      0.35 + s.warmth * 0.25,
      0.72 + s.warmth * 0.08,
    )
  })

  return (
    <points frustumCulled={false} position={[0, 0, 0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[data.seeds, 1]} />
        <bufferAttribute attach="attributes-aSize" args={[data.sizes, 1]} />
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

export default Motes
