import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const vertexShader = /* glsl */ `
  uniform float uSpin;
  uniform float uOpen;

  varying float vDepth;

  vec3 rotateY(vec3 p, float a) {
    float s = sin(a);
    float c = cos(a);
    return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  }

  void main() {
    // As the sphere comes apart the lines let go outward with it, so the mesh
    // dissolves rather than simply switching off.
    vec3 p = rotateY(position * (1.0 + uOpen * 0.55), uSpin);
    vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
    vDepth = -viewPosition.z;
    gl_Position = projectionMatrix * viewPosition;
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColour;
  uniform float uIntensity;

  varying float vDepth;

  void main() {
    // Depth fade keeps the far side of the sphere from cluttering the near
    // side — without it the network reads as a flat tangle.
    float depthFade = smoothstep(11.5, 5.0, vDepth);
    float alpha = uIntensity * depthFade;
    if (alpha <= 0.002) discard;
    gl_FragColor = vec4(uColour, alpha);
  }
`

/** Thin connections between neighbouring nodes on the intact data sphere. */
function NetworkLines({ positions, colour, intensity, spin, open }) {
  const materialRef = useRef(null)

  const uniforms = useMemo(
    () => ({
      uSpin: { value: 0 },
      uOpen: { value: 0 },
      uIntensity: { value: 0 },
      uColour: { value: new THREE.Color(colour) },
    }),
    [colour],
  )

  useFrame(() => {
    const material = materialRef.current
    if (!material) return
    material.uniforms.uSpin.value = spin()
    material.uniforms.uOpen.value = open()
    material.uniforms.uIntensity.value = intensity()
  })

  return (
    <lineSegments frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
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
    </lineSegments>
  )
}

export default NetworkLines
