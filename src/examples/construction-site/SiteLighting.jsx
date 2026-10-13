import { Environment, Lightformer } from '@react-three/drei'

/**
 * Late afternoon on a construction site.
 *
 * The sun is deliberately low and to the south-west. A high sun would light
 * the excavation floor evenly and the cut would read as a shallow tray; a low
 * one puts one wall in light and the opposite one in shadow, and it is that
 * difference across the four faces that makes a hole look three metres deep.
 * It is also what makes the spoil heaps read as heaps rather than as blobs —
 * their shadows do more work than their silhouettes.
 *
 * NOTHING HERE MOVES. That is the whole design, and it is a correction.
 *
 * The sun used to drift with the pointer and re-aim as the ground opened, and
 * the intensity used to breathe with how much was going on. Every one of
 * those is a change the viewer cannot attribute to anything: the sun is
 * ninety-three million miles away and it does not follow a mouse, so when the
 * light shifts and nothing on screen caused it, the scene stops looking lit
 * and starts looking buggy. A fixed sun also means the shadow map is fixed,
 * which is half of why the edges stopped crawling.
 *
 * The reflections come from lightformers baked into a small environment map
 * rather than a downloaded HDRI, so the route builds and runs with no network,
 * and a few soft rectangles are closer to open sky than most HDRIs anyway.
 */
function SiteLighting({ quality }) {
  return (
    <>
      {/* Sky and ground bounce. Cool from above, near-black from below, which
          is what stops the earth going flat and grey in shadow. */}
      <hemisphereLight args={['#7f8ea8', '#0a0b0e', 0.34]} />

      <directionalLight
        position={[-44, 30, 46]}
        intensity={2.45}
        color="#ffd9b0"
        castShadow={quality.shadows}
        shadow-mapSize-width={quality.shadowMap}
        shadow-mapSize-height={quality.shadowMap}
        // Tight, because every metre of slack here is depth precision thrown
        // away and paid for in acne. The frustum holds the fenced site plus
        // the spoil north of the aperture and nothing else, and near/far
        // bracket the light's own distance from the middle of it rather than
        // spanning 1 to 220 as they did — that alone nearly halves the depth
        // range the map has to resolve.
        shadow-camera-left={-46}
        shadow-camera-right={46}
        shadow-camera-top={46}
        shadow-camera-bottom={-46}
        shadow-camera-near={12}
        shadow-camera-far={136}
        shadow-bias={-0.0005}
        // Well above one shadow texel (92 m across 2048 is 4.5 cm), which is
        // what it has to clear to stop near-horizontal surfaces — the benches
        // especially — stippling themselves.
        shadow-normalBias={0.14}
      >
        {/* Attached, not parented: R3F assigns this as `light.target` instead
            of adding it to the scene, so its world matrix stays identity and
            the light aims at the world origin. Writing any other position
            here would be a lie — it would never be applied. */}
        <object3D attach="target" position={[0, 0, 0]} />
      </directionalLight>

      {/* Cool rim from the north, opposite the key. It catches the top edge of
          the cut and the crests of the spoil heaps, which is the difference
          between a heap reading as a heap and reading as a stain. */}
      <directionalLight position={[40, 20, -44]} intensity={0.85} color="#9dbcff" />

      {/* Low front fill, just enough to keep the shadowed wall readable. */}
      <directionalLight position={[14, 10, 52]} intensity={0.32} color="#4a5a72" />

      <Environment resolution={quality.environment} frames={1}>
        <Lightformer
          form="rect"
          intensity={2.2}
          color="#dfe9ff"
          position={[0, 60, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[90, 90, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.3}
          color="#ffd9b0"
          position={[-64, 20, 26]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[60, 40, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.8}
          color="#b9ccff"
          position={[60, 18, -30]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[50, 34, 1]}
        />
      </Environment>
    </>
  )
}

export default SiteLighting
