import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GLOBE_RADIUS } from './layout.js'
import { CITIES, latLonToVector } from './worldMask.js'
import { THEME } from './theme.js'

const nodeVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSpin;
  uniform float uProjScale;
  uniform float uIntensity;

  attribute float aSeed;

  varying float vAlpha;

  vec3 rotateY(vec3 p, float a) {
    float s = sin(a);
    float c = cos(a);
    return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  }

  void main() {
    vec3 p = rotateY(position, uSpin);
    vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * viewPosition;

    // Hubs on the far side dim out, so the globe keeps a front and a back.
    vec3 normalView = normalize(mat3(modelViewMatrix) * normalize(p));
    vec3 toEye = normalize(-viewPosition.xyz);
    float facing = smoothstep(-0.1, 0.45, dot(normalView, toEye));
    float breathe = 0.65 + 0.35 * sin(uTime * 1.3 + aSeed * 8.0);
    vAlpha = uIntensity * breathe * facing;
    gl_PointSize = clamp((0.03 + breathe * 0.022) * uProjScale / max(-viewPosition.z, 0.6), 1.0, 22.0);
  }
`

const nodeFragment = /* glsl */ `
  uniform vec3 uColour;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5 || vAlpha <= 0.002) discard;
    float core = smoothstep(0.5, 0.0, d);
    // A bright centre inside a soft halo, so hubs read as points of light.
    float alpha = (pow(core, 4.0) * 0.8 + pow(core, 1.6) * 0.35) * vAlpha;
    gl_FragColor = vec4(uColour, alpha);
  }
`

const atmosphereVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`

const atmosphereFragment = /* glsl */ `
  uniform vec3 uColour;
  uniform float uIntensity;

  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    // Rendered on the inside of a slightly larger sphere: the rim is where
    // the normal turns away from the eye, which is exactly where the halo is.
    float rim = 1.0 - abs(dot(normalize(vNormal), normalize(vView)));
    float alpha = pow(rim, 3.2) * uIntensity;
    if (alpha <= 0.002) discard;
    gl_FragColor = vec4(uColour, alpha);
  }
`

function buildRing(radius, segments) {
  const positions = new Float32Array((segments + 1) * 3)
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * Math.PI * 2
    positions[i * 3] = Math.cos(a) * radius
    positions[i * 3 + 1] = 0
    positions[i * 3 + 2] = Math.sin(a) * radius
  }
  return positions
}

/** Hub markers, atmosphere halo and the closing orbital rings. */
function GlobeLayer({ stage }) {
  const nodeMaterialRef = useRef(null)
  const atmosphereRef = useRef(null)
  const ringGroupRef = useRef(null)
  const ringRefs = useRef([])

  const nodes = useMemo(() => {
    const v = new THREE.Vector3()
    const positions = new Float32Array(CITIES.length * 3)
    const seeds = new Float32Array(CITIES.length)
    CITIES.forEach((city, i) => {
      latLonToVector(city.lat, city.lon, GLOBE_RADIUS * 1.012, v)
      positions[i * 3] = v.x
      positions[i * 3 + 1] = v.y
      positions[i * 3 + 2] = v.z
      seeds[i] = (i * 0.6180339887) % 1
    })
    return { positions, seeds }
  }, [])

  const ringPositions = useMemo(() => buildRing(GLOBE_RADIUS * 1.32, 128), [])
  const rings = useMemo(
    () => [
      { rotation: [0.08, 0, 0.12], scale: 1 },
      { rotation: [1.15, 0.4, 0], scale: 0.88 },
      { rotation: [-0.7, -0.9, 0.3], scale: 1.12 },
    ],
    [],
  )

  const nodeUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSpin: { value: 0 },
      uProjScale: { value: 800 },
      uIntensity: { value: 0 },
      uColour: { value: new THREE.Color(THEME.bright) },
    }),
    [],
  )

  const atmosphereUniforms = useMemo(
    () => ({
      uIntensity: { value: 0 },
      uColour: { value: new THREE.Color(THEME.accent) },
    }),
    [],
  )

  useFrame((state) => {
    const s = stage.current

    const nodeMaterial = nodeMaterialRef.current
    if (nodeMaterial) {
      nodeMaterial.uniforms.uTime.value = state.clock.elapsedTime
      nodeMaterial.uniforms.uSpin.value = s.spinGlobe
      nodeMaterial.uniforms.uProjScale.value =
        (state.size.height * state.viewport.dpr) /
        (2 * Math.tan((state.camera.fov * Math.PI) / 360))
      nodeMaterial.uniforms.uIntensity.value = s.globe
    }

    const atmosphere = atmosphereRef.current
    if (atmosphere) {
      atmosphere.visible = s.atmosphere > 0.002
      atmosphere.material.uniforms.uIntensity.value = s.atmosphere * 0.55
    }

    const ringGroup = ringGroupRef.current
    if (ringGroup) {
      ringGroup.visible = s.final > 0.002
      ringGroup.rotation.y = s.spinGlobe * 0.35
      for (let i = 0; i < ringRefs.current.length; i += 1) {
        const ring = ringRefs.current[i]
        if (ring) ring.material.opacity = s.final * 0.22
      }
    }
  })

  return (
    <group>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[nodes.positions, 3]} />
          <bufferAttribute attach="attributes-aSeed" args={[nodes.seeds, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={nodeMaterialRef}
          uniforms={nodeUniforms}
          vertexShader={nodeVertex}
          fragmentShader={nodeFragment}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      <mesh ref={atmosphereRef} visible={false}>
        <sphereGeometry args={[GLOBE_RADIUS * 1.16, 48, 32]} />
        <shaderMaterial
          uniforms={atmosphereUniforms}
          vertexShader={atmosphereVertex}
          fragmentShader={atmosphereFragment}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <group ref={ringGroupRef} visible={false}>
        {rings.map((ring, i) => (
          <line
            key={`ring-${i}`}
            ref={(el) => { ringRefs.current[i] = el }}
            rotation={ring.rotation}
            scale={ring.scale}
          >
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[ringPositions, 3]} />
            </bufferGeometry>
            <lineBasicMaterial
              color={THEME.line}
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </line>
        ))}
      </group>
    </group>
  )
}

export default GlobeLayer
