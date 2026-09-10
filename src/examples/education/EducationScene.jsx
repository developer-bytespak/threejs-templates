import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createStageState, deriveStage } from './stages.js'
import { useEducationModels } from './useEducationModels.js'
import EducationCamera from './EducationCamera.jsx'
import EducationLighting from './EducationLighting.jsx'
import KnowledgeTree from './KnowledgeTree.jsx'
import KnowledgeArtifacts from './KnowledgeArtifacts.jsx'
import KnowledgeCampus from './KnowledgeCampus.jsx'
import WorldLabels from './WorldLabels.jsx'
import Motes from './Motes.jsx'

/** Which chapters offer which pointer interactions. */
const TREE_CHAPTERS = new Set([2, 3, 4])
const CAMPUS_CHAPTERS = new Set([6, 7])

function EducationScene({
  input,
  quality,
  composition,
  reducedMotion,
  chapter,
  focusDiscipline,
  onHoverChange,
}) {
  const rig = useEducationModels()

  // Scene state lives here and only this component writes it. Children get it
  // read-only, which keeps one source of truth for what the scene is showing.
  const stage = useRef(createStageState())

  const bounds = useMemo(() => ({ radius: 16, height: 26 }), [])

  // Writers, handed down so children never mutate a prop. Hover also goes out
  // to React so the HTML layer can show a label for it, but only on change —
  // that is a user-paced event, not a per-frame one.
  const setHoveredDiscipline = (id) => {
    if (stage.current.pointerDiscipline === id) return
    stage.current.pointerDiscipline = id
    onHoverChange({ kind: 'discipline', id })
  }

  const setHoveredArtifact = (hero) => {
    stage.current.hoveredArtifact = hero ? hero.node : null
    onHoverChange(
      hero ? { kind: 'artifact', id: hero.node, label: hero.label } : { kind: null },
    )
  }

  const setHoveredBuilding = (building) => {
    if (stage.current.hoveredBuilding === (building?.node ?? null)) return
    stage.current.hoveredBuilding = building?.node ?? null
    onHoverChange(
      building
        ? { kind: 'building', id: building.node, label: building.label }
        : { kind: null },
    )
  }

  // Priority -1 runs this before every default-priority frame callback, so the
  // rest of the scene reads values computed this frame rather than last. Only
  // a positive priority would take over R3F's render loop.
  useFrame((state, delta) => {
    const step = Math.min(delta, 0.1)
    const s = stage.current

    // Damping the raw scroll is what stops a flung scrollbar tearing the
    // camera through the canopy, and it gives the growth a little inertia.
    s.smoothed = THREE.MathUtils.damp(
      s.smoothed,
      input.current.progress,
      reducedMotion ? 30 : 4.5,
      step,
    )
    deriveStage(s.smoothed, s)

    // The discipline list in the HTML and the pointer over the branches are
    // two ways of asking for the same thing, so they resolve to one focus.
    s.hoveredDiscipline = focusDiscipline ?? s.pointerDiscipline ?? null

    if (reducedMotion) {
      s.pointerX = 0
      s.pointerY = 0
    } else {
      s.pointerX = THREE.MathUtils.damp(s.pointerX, input.current.pointerX, 2.4, step)
      s.pointerY = THREE.MathUtils.damp(s.pointerY, input.current.pointerY, 2.4, step)
    }
  }, -1)

  const treeLive = TREE_CHAPTERS.has(chapter)
  const campusLive = CAMPUS_CHAPTERS.has(chapter)

  return (
    <>
      <EducationCamera
        stage={stage}
        quality={quality}
        composition={composition}
        reducedMotion={reducedMotion}
      />
      <EducationLighting stage={stage} rig={rig} />

      <KnowledgeTree
        rig={rig}
        stage={stage}
        quality={quality}
        interactive={treeLive}
        onHoverDiscipline={setHoveredDiscipline}
      />
      <KnowledgeArtifacts
        rig={rig}
        stage={stage}
        quality={quality}
        interactive={treeLive}
        onHoverArtifact={setHoveredArtifact}
      />
      <KnowledgeCampus
        rig={rig}
        stage={stage}
        quality={quality}
        interactive={campusLive}
        onHoverBuilding={setHoveredBuilding}
      />

      <WorldLabels rig={rig} stage={stage} quality={quality} />
      <Motes stage={stage} quality={quality} bounds={bounds} />
    </>
  )
}

export default EducationScene
