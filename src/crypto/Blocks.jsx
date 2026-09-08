import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BLOCK_COUNT, BLOCK_SIZE, blockPosition } from './layout.js'
import { THEME } from './theme.js'

/**
 * The chain itself: seven blocks, each an outer glass shell over a dark core
 * with a lit edge cage, joined by connectors that carry a validation sweep.
 *
 * The particle field supplies the block surfaces and the data inside them —
 * these meshes give the structure its solidity and its reflections, and fade
 * in only once the particles have arrived.
 */
function Blocks({ stage, reducedMotion }) {
  const groupRef = useRef(null)
  const shellRefs = useRef([])
  const coreRefs = useRef([])
  const edgeRefs = useRef([])
  const linkRefs = useRef([])

  const layout = useMemo(() => {
    const v = new THREE.Vector3()
    const blocks = []
    for (let i = 0; i < BLOCK_COUNT; i += 1) {
      blockPosition(i, v)
      blocks.push([v.x, v.y, v.z])
    }

    // A connector spans each consecutive pair: positioned at the midpoint and
    // rotated onto the line between them, so the staggered layout still reads
    // as one continuous chain.
    const links = []
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    const direction = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    for (let i = 0; i < BLOCK_COUNT - 1; i += 1) {
      a.fromArray(blocks[i])
      b.fromArray(blocks[i + 1])
      direction.subVectors(b, a)
      const length = direction.length()
      quaternion.setFromUnitVectors(up, direction.clone().normalize())
      const euler = new THREE.Euler().setFromQuaternion(quaternion)
      links.push({
        position: [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2],
        rotation: [euler.x, euler.y, euler.z],
        length: length - BLOCK_SIZE.x * 0.62,
      })
    }
    return { blocks, links }
  }, [])

  const edgeGeometry = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(BLOCK_SIZE.x, BLOCK_SIZE.y, BLOCK_SIZE.z)),
    [],
  )

  useFrame((state) => {
    const group = groupRef.current
    if (!group) return

    const s = stage.current
    const visible = s.blockShell > 0.002
    group.visible = visible
    if (!visible) return

    const time = reducedMotion ? 0 : state.clock.elapsedTime

    // The validation head walks the chain as you scroll, with a slow idle
    // cycle on top so the structure keeps a pulse once you stop.
    const head = s.validation * (BLOCK_COUNT - 1) + (reducedMotion ? 0 : time * 0.55)

    for (let i = 0; i < BLOCK_COUNT; i += 1) {
      // Distance from the sweep, wrapped so the pulse loops along the chain.
      const raw = Math.abs(((head - i) % (BLOCK_COUNT + 2)) )
      const nearness = Math.max(0, 1 - raw * 0.9)
      const lit = nearness * nearness

      const shell = shellRefs.current[i]
      if (shell) {
        shell.material.opacity = s.blockShell * (0.16 + lit * 0.2)
      }
      const core = coreRefs.current[i]
      if (core) {
        core.material.emissiveIntensity = 0.05 + lit * 0.85
        core.material.opacity = s.blockShell
      }
      const edge = edgeRefs.current[i]
      if (edge) {
        edge.material.opacity = s.blockShell * (0.34 + lit * 0.66)
      }
    }

    for (let i = 0; i < layout.links.length; i += 1) {
      const link = linkRefs.current[i]
      if (!link) continue
      // A connector lights just after the block behind it is validated.
      const raw = Math.abs((head - i - 0.5) % (BLOCK_COUNT + 2))
      const lit = Math.max(0, 1 - raw * 1.1)
      link.material.opacity = s.blockShell * (0.18 + lit * lit * 0.8)
    }
  })

  return (
    <group ref={groupRef}>
      {layout.blocks.map((position, i) => (
        <group key={`block-${i}`} position={position}>
          <mesh ref={(el) => { shellRefs.current[i] = el }}>
            <boxGeometry args={[BLOCK_SIZE.x, BLOCK_SIZE.y, BLOCK_SIZE.z]} />
            <meshPhysicalMaterial
              color={THEME.blockShell}
              transparent
              opacity={0}
              roughness={0.16}
              metalness={0.2}
              reflectivity={0.4}
              depthWrite={false}
            />
          </mesh>

          <mesh ref={(el) => { coreRefs.current[i] = el }} scale={0.46}>
            <boxGeometry args={[BLOCK_SIZE.x, BLOCK_SIZE.y, BLOCK_SIZE.z]} />
            <meshStandardMaterial
              color={THEME.blockCore}
              emissive={THEME.accent}
              emissiveIntensity={0.05}
              roughness={0.28}
              metalness={0.85}
              transparent
              opacity={0}
            />
          </mesh>

          <lineSegments ref={(el) => { edgeRefs.current[i] = el }} geometry={edgeGeometry}>
            <lineBasicMaterial
              color={THEME.accent}
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </lineSegments>
        </group>
      ))}

      {layout.links.map((link, i) => (
        <mesh
          key={`link-${i}`}
          ref={(el) => { linkRefs.current[i] = el }}
          position={link.position}
          rotation={link.rotation}
        >
          <cylinderGeometry args={[0.012, 0.012, link.length, 6]} />
          <meshBasicMaterial
            color={THEME.arc}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  )
}

export default Blocks
