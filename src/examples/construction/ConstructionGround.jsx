import { ContactShadows } from '@react-three/drei'

/** Where the foundation raft bottoms out, and therefore where the floor goes. */
export const GROUND_Y = -1.5

/**
 * Ground, not environment.
 *
 * A dark plane and a soft contact shadow are enough to say the building is
 * standing on something. Anything more — a site, a horizon, a skyline —
 * would make this a scene rather than the reusable studio the template is
 * meant to be.
 *
 * It matters most during the explosion: the foundation stays welded to this
 * floor while everything else climbs away from it, and that fixed point is
 * what makes the movement read as weight rather than as drift.
 */
function ConstructionGround({ quality }) {
  return (
    <group position={[0, GROUND_Y, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow={quality.shadows}>
        <planeGeometry args={[600, 600]} />
        {/* Very dark and very rough: it catches the key light as a broad,
            faint pool and otherwise stays out of the way. */}
        <meshStandardMaterial
          color="#0a0c10"
          metalness={0}
          roughness={1}
          // Kept out of the environment map, or the overhead lightformer turns
          // the whole floor into a softbox and the building loses its ground.
          envMapIntensity={0.12}
        />
      </mesh>

      <ContactShadows
        position={[0, 0.02, 0]}
        scale={78}
        resolution={quality.contactShadow}
        frames={quality.contactFrames}
        blur={2.8}
        opacity={0.8}
        far={26}
        color="#000000"
      />
    </group>
  )
}

export default ConstructionGround
