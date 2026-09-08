import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createStageState, deriveStage } from './stages.js'
import { buildFieldData } from './fieldTargets.js'
import { buildArcs, buildNeighbourLines, pickPairs } from './arcs.js'
import { GLOBE_RADIUS, SPHERE_RADIUS } from './layout.js'
import { CITIES, CITY_ROUTES, latLonToVector } from './worldMask.js'
import { THEME } from './theme.js'
import NetworkField from './NetworkField.jsx'
import NetworkLines from './NetworkLines.jsx'
import ArcField from './ArcField.jsx'
import Blocks from './Blocks.jsx'
import GlobeLayer from './GlobeLayer.jsx'
import CryptoCamera from './CryptoCamera.jsx'

function CryptoScene({ input, quality, reducedMotion }) {
  // Scene state lives here, and only this component writes it. Children
  // receive it read-only, which keeps a single source of truth for what the
  // scene is currently showing.
  const stage = useRef(createStageState())

  // Priority -1 runs this before every default-priority frame callback, so
  // the rest of the scene reads values computed this frame rather than last.
  // Only a positive priority would take over R3F's render loop.
  useFrame((state, delta) => {
    const step = Math.min(delta, 0.1)
    const s = stage.current

    // Damp the raw scroll: a flung scrollbar should move the camera quickly,
    // never teleport it, and this is what stops fast scrolling from popping.
    s.smoothed = THREE.MathUtils.damp(
      s.smoothed,
      input.current.progress,
      reducedMotion ? 30 : 5.5,
      step,
    )
    deriveStage(s.smoothed, s)

    if (reducedMotion) {
      s.spinSphere = 0.6
      s.spinGlobe = 0.2
    } else {
      s.spinSphere += step * 0.11 * s.spinRate
      s.spinGlobe += step * 0.075
    }
  }, -1)

  // Everything below is built once per quality tier and never rebuilt while
  // scrolling: the scene changes by writing uniforms, not geometry.
  const fieldData = useMemo(
    () => buildFieldData({ count: quality.particles, nodeCount: quality.nodes }),
    [quality.particles, quality.nodes],
  )

  const neighbourLines = useMemo(
    () =>
      buildNeighbourLines({
        positions: fieldData.nodes,
        nodeCount: quality.nodes,
        maxDistance: SPHERE_RADIUS * 0.46,
        perNode: 2,
      }),
    [fieldData.nodes, quality.nodes],
  )

  const sphereArcs = useMemo(() => {
    const pairs = pickPairs({
      positions: fieldData.nodes,
      nodeCount: quality.nodes,
      wanted: quality.transactionArcs,
    })
    return buildArcs({
      endpoints: fieldData.nodes,
      pairs,
      radius: SPHERE_RADIUS,
      bulge: 0.3,
      samples: quality.arcSamples,
    })
  }, [fieldData.nodes, quality.nodes, quality.transactionArcs, quality.arcSamples])

  const globeArcs = useMemo(() => {
    const v = new THREE.Vector3()
    const endpoints = new Float32Array(CITIES.length * 3)
    CITIES.forEach((city, i) => {
      latLonToVector(city.lat, city.lon, GLOBE_RADIUS, v)
      endpoints[i * 3] = v.x
      endpoints[i * 3 + 1] = v.y
      endpoints[i * 3 + 2] = v.z
    })
    const routes = CITY_ROUTES.slice(0, quality.globeArcs)
    return buildArcs({
      endpoints,
      pairs: routes,
      radius: GLOBE_RADIUS,
      bulge: 0.42,
      samples: quality.arcSamples,
      seed: 23,
    })
  }, [quality.globeArcs, quality.arcSamples])

  // Getters, not values: each is called inside a frame loop, so the ref is
  // read at that point rather than during render. This component re-renders
  // only when the quality tier changes, so the identities are stable enough.
  const sphereSpin = () => stage.current.spinSphere
  const globeSpin = () => stage.current.spinGlobe
  const networkIntensity = () => stage.current.network * 0.62
  const networkOpen = () => stage.current.scatter
  const transactionIntensity = () => stage.current.transactions
  const globeArcIntensity = () => stage.current.arcs * 0.9

  return (
    <>
      <CryptoCamera
        stage={stage}
        input={input}
        reducedMotion={reducedMotion}
      />

      <fog attach="fog" args={[THEME.background, 9, 26]} />

      {/* Only the block meshes are lit; everything else is emissive. */}
      <ambientLight intensity={0.35} color="#8fb0e0" />
      <directionalLight position={[4, 6, 5]} intensity={1.5} color="#cfe4ff" />
      <directionalLight position={[-6, -2, -4]} intensity={0.7} color="#6f7dff" />

      <NetworkField
        stage={stage}
        input={input}
        quality={quality}
        reducedMotion={reducedMotion}
        fieldData={fieldData}
      />

      <NetworkLines
        positions={neighbourLines}
        colour={THEME.line}
        intensity={networkIntensity}
        spin={sphereSpin}
        open={networkOpen}
      />

      <ArcField
        arcs={sphereArcs}
        colour={THEME.arc}
        intensity={transactionIntensity}
        spin={sphereSpin}
        pulsesPerArc={quality.pulsesPerArc}
        pulseSize={0.022}
      />

      <Blocks stage={stage} reducedMotion={reducedMotion} />

      <ArcField
        arcs={globeArcs}
        colour={THEME.arc}
        intensity={globeArcIntensity}
        spin={globeSpin}
        pulsesPerArc={quality.pulsesPerArc}
        pulseSize={0.026}
      />

      <GlobeLayer stage={stage} />
    </>
  )
}

export default CryptoScene
