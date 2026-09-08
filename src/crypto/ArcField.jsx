import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const arcVertex = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform float uSpin;

  attribute float aT;
  attribute float aCurve;

  varying float vAlpha;

  vec3 rotateY(vec3 p, float a) {
    float s = sin(a);
    float c = cos(a);
    return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  }

  void main() {
    // Each route runs its own slow appear/disappear cycle, staggered by index
    // so the network never flashes all at once.
    float phase = fract(uTime * 0.11 + aCurve * 0.1379);
    float life = smoothstep(0.0, 0.14, phase) * (1.0 - smoothstep(0.62, 0.98, phase));
    // Taper the ends so arcs do not terminate in a hard stub.
    float ends = sin(aT * 3.14159265);

    vAlpha = life * ends * uIntensity;

    vec4 viewPosition = modelViewMatrix * vec4(rotateY(position, uSpin), 1.0);
    gl_Position = projectionMatrix * viewPosition;
  }
`

const arcFragment = /* glsl */ `
  uniform vec3 uColour;
  varying float vAlpha;

  void main() {
    if (vAlpha <= 0.001) discard;
    gl_FragColor = vec4(uColour, vAlpha);
  }
`

const pulseVertex = /* glsl */ `
  uniform float uProjScale;
  uniform float uSize;
  uniform float uSpin;

  attribute float aAlpha;

  varying float vAlpha;

  vec3 rotateY(vec3 p, float a) {
    float s = sin(a);
    float c = cos(a);
    return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  }

  void main() {
    vAlpha = aAlpha;
    vec4 viewPosition = modelViewMatrix * vec4(rotateY(position, uSpin), 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = clamp(uSize * uProjScale / max(-viewPosition.z, 0.6), 1.0, 18.0);
  }
`

const pulseFragment = /* glsl */ `
  uniform vec3 uColour;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5 || vAlpha <= 0.001) discard;
    float core = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColour, pow(core, 2.0) * vAlpha);
  }
`

/**
 * Arcs with luminous pulses running along them. Used twice: for transactions
 * across the data sphere, and for routes across the closing globe.
 *
 * The pulses are a Points object whose positions are rewritten each frame by
 * lerping between precomputed curve samples — a few hundred vector reads,
 * which is far cheaper than re-evaluating curves or animating geometry.
 */
function ArcField({ arcs, colour, intensity, spin, pulsesPerArc = 2, pulseSize = 7 }) {
  const lineMaterialRef = useRef(null)
  const pulseMaterialRef = useRef(null)
  const pulseGeometryRef = useRef(null)

  const pulseCount = arcs.count * pulsesPerArc

  // Allocated once for the geometry to adopt. The per-frame writes below go
  // through the geometry ref rather than through these bindings: values that
  // came out of useMemo are treated as immutable by the compiler's rules.
  const pulseSeed = useMemo(
    () => ({
      positions: new Float32Array(pulseCount * 3),
      alphas: new Float32Array(pulseCount),
      offsets: Float32Array.from({ length: pulseCount }, (_, i) => (i * 0.6180339887) % 1),
    }),
    [pulseCount],
  )

  const lineUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: 0 },
      uSpin: { value: 0 },
      uColour: { value: new THREE.Color(colour) },
    }),
    [colour],
  )

  const pulseUniforms = useMemo(
    () => ({
      uProjScale: { value: 800 },
      uSize: { value: pulseSize },
      uSpin: { value: 0 },
      uColour: { value: new THREE.Color(colour) },
    }),
    [colour, pulseSize],
  )

  useFrame((state) => {
    const lineMaterial = lineMaterialRef.current
    const pulseMaterial = pulseMaterialRef.current
    const geometry = pulseGeometryRef.current
    if (!lineMaterial || !pulseMaterial || !geometry) return

    // Write straight into the attribute arrays the geometry owns.
    const positions = geometry.attributes.position.array
    const alphas = geometry.attributes.aAlpha.array
    const offsets = pulseSeed.offsets
    const time = state.clock.elapsedTime
    const strength = intensity()
    const yaw = spin()

    lineMaterial.uniforms.uTime.value = time
    lineMaterial.uniforms.uIntensity.value = strength
    lineMaterial.uniforms.uSpin.value = yaw
    pulseMaterial.uniforms.uSpin.value = yaw
    pulseMaterial.uniforms.uProjScale.value =
      (state.size.height * state.viewport.dpr) /
      (2 * Math.tan((state.camera.fov * Math.PI) / 360))

    // Skip the per-pulse work entirely when the layer is invisible.
    if (strength <= 0.002) {
      if (alphas[0] !== 0) {
        alphas.fill(0)
        geometry.attributes.aAlpha.needsUpdate = true
      }
      return
    }

    const { curveSamples, samples, speeds } = arcs
    const last = samples - 1

    for (let i = 0; i < pulseCount; i += 1) {
      const curve = i % arcs.count
      const t = (time * speeds[curve] + offsets[i]) % 1

      const f = t * last
      const s0 = Math.min(last, Math.floor(f))
      const s1 = Math.min(last, s0 + 1)
      const k = f - s0

      const a = (curve * samples + s0) * 3
      const b = (curve * samples + s1) * 3
      const o = i * 3
      positions[o] = curveSamples[a] + (curveSamples[b] - curveSamples[a]) * k
      positions[o + 1] = curveSamples[a + 1] + (curveSamples[b + 1] - curveSamples[a + 1]) * k
      positions[o + 2] = curveSamples[a + 2] + (curveSamples[b + 2] - curveSamples[a + 2]) * k

      // Fade in and out at the ends of the run, and follow the same route
      // lifecycle as the line beneath it.
      const phase = (time * 0.11 + curve * 0.1379) % 1
      const life =
        THREE.MathUtils.smoothstep(phase, 0.0, 0.14) *
        (1 - THREE.MathUtils.smoothstep(phase, 0.62, 0.98))
      alphas[i] = Math.sin(Math.PI * t) * life * strength
    }

    geometry.attributes.position.needsUpdate = true
    geometry.attributes.aAlpha.needsUpdate = true
  })

  return (
    <group>
      <lineSegments frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[arcs.linePositions, 3]} />
          <bufferAttribute attach="attributes-aT" args={[arcs.lineT, 1]} />
          <bufferAttribute attach="attributes-aCurve" args={[arcs.lineCurve, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={lineMaterialRef}
          uniforms={lineUniforms}
          vertexShader={arcVertex}
          fragmentShader={arcFragment}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      <points frustumCulled={false}>
        <bufferGeometry ref={pulseGeometryRef}>
          <bufferAttribute attach="attributes-position" args={[pulseSeed.positions, 3]} />
          <bufferAttribute attach="attributes-aAlpha" args={[pulseSeed.alphas, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={pulseMaterialRef}
          uniforms={pulseUniforms}
          vertexShader={pulseVertex}
          fragmentShader={pulseFragment}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  )
}

export default ArcField
