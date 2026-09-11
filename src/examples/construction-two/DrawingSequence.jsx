import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useRoomModel } from './useRoomModel.js'
import {
  BUILD_END,
  BUILD_START,
  DRAWING_BEGIN,
  DRAWING_END,
  DRAWING_STAGES,
  clamp01,
  span,
} from './story.js'
import {
  drawStroke,
  extractStrokes,
  orderStrokes,
  restoreStrokes,
} from './drawingStrokes.js'

/**
 * A plotter working through the plan.
 *
 * The pen draws one stroke at a time, each one growing from its start point to
 * its end point along its own axis, then lifts and moves to the next. Nothing
 * fades, nothing pops, and no line ever arrives whole.
 *
 * Two things make it read as a real plotter rather than a reveal:
 *
 * Every stroke gets a slice of the scroll proportional to its own LENGTH, so
 * the pen travels at a roughly constant speed. A 94 cm grid line takes about
 * forty times the scroll of a 2 cm tick, which is what a pen moving at one
 * speed actually does — and it is the difference between a drawing being made
 * and a list of objects being switched on.
 *
 * And the order is a pen path, not model order: greedy nearest-neighbour from
 * wherever the pen already is (see orderStrokes), starting at the pencil lying
 * on the sheet. The pen finishes a line, lifts, and crosses to the nearest line
 * it has not drawn yet.
 *
 * Everything is a pure function of scroll progress, so reversing the scroll
 * un-draws the plan in exactly the reverse order with no special-casing.
 */

// Each stage gets a floor plus a share of what is left weighted by how much
// line it contains, so the 38 m grid takes real time while the 3 m core still
// gets a beat of its own instead of flashing past.
const STAGE_FLOOR = 0.06

// Stroke windows overlap slightly. Enough that the pen never visibly stops
// between lines; not so much that two lines are obviously growing at once.
const STROKE_OVERLAP = 1.35

// The pen's lead-in from the pencil tip, as a share of the drawing span.
const LEAD_IN = 0.035

// Line weight hierarchy, applied to the stage's own material. The model's
// colours are kept — graphite and restrained architectural blue on warm paper
// is already the language this room is drawn in.
const STAGE_OPACITY = {
  1: 0.55, // grid — setting out, sits back
  2: 1.0,  // perimeter — the primary outline
  3: 0.88, // structure
  4: 0.92, // core
  5: 0.62, // dimensions
  6: 0.7,  // annotation
  7: 1.0,  // footprint
}

// How far the plan fades back once the building is standing on it. It stays
// clearly readable underneath — that relationship is the whole point.
const UNDER_BUILDING = 0.52

function DrawingSequence({ input, reducedMotion }) {
  const { drawing } = useRoomModel()
  const penRef = useRef()

  const rig = useMemo(() => {
    if (!drawing?.stages?.size) return null

    // The pen starts where the pencil is lying. Drawing_System's mesh children
    // carry an identity transform, so the sheet's local space and the stroke
    // coordinates are the same space — the anchor just needs bringing into it.
    const penHome = new THREE.Vector3(0, 0.004, 0)
    if (drawing.pencil) {
      drawing.system.updateWorldMatrix(true, false)
      penHome.copy(drawing.system.worldToLocal(drawing.pencil.position.clone()))
    }

    const stages = []
    let totalLength = 0

    for (const stage of DRAWING_STAGES) {
      const mesh = drawing.stages.get(stage.stage)
      if (!mesh) continue

      const payload = extractStrokes(mesh)
      if (!payload) continue

      const length = payload.strokes.reduce(
        (sum, s) => sum + Math.max(s.length, 0.004),
        0,
      )
      totalLength += length
      stages.push({ ...stage, mesh, payload, length })
    }

    if (!stages.length) return null

    // Materials are cloned because mat_dark_metal is shared with the desk
    // frame, mat_brushed_metal with the chair base and mat_blue_accent with the
    // credenza books — the hierarchy below must not reach any of them.
    const pen = penHome.clone()
    let cursor = DRAWING_BEGIN + (DRAWING_END - DRAWING_BEGIN) * LEAD_IN
    const drawSpan = DRAWING_END - cursor

    for (const stage of stages) {
      const original = stage.mesh.material
      const material = original.clone()
      material.transparent = true
      // Depth writing stays ON. The seven stages sit 0.25 mm apart on the
      // sheet, and that separation is what keeps them in a stable order once
      // they are blending; without it the sort between near-coplanar layers
      // flickers as the camera moves.
      material.depthWrite = true
      const opacity = STAGE_OPACITY[stage.stage] ?? 1
      material.opacity = opacity
      if (material.uniforms?.uOpacity) material.uniforms.uOpacity.value = opacity
      material.userData = { ...original.userData, drawingStage: true }
      stage.mesh.material = material
      stage.originalMaterial = original
      stage.material = material
      stage.baseOpacity = opacity

      const share =
        STAGE_FLOOR + (1 - STAGE_FLOOR * stages.length) * (stage.length / totalLength)
      const from = cursor
      const to = cursor + drawSpan * share
      cursor = to

      // Walk the strokes in pen order and hand each one a slot proportional to
      // its length.
      const path = orderStrokes(stage.payload.strokes, pen)
      const slotTotal = path.reduce((sum, s) => sum + Math.max(s.length, 0.004), 0)
      let run = 0
      for (const s of path) {
        const weight = Math.max(s.length, 0.004)
        const a = from + ((to - from) * run) / slotTotal
        run += weight
        const b = from + ((to - from) * run) / slotTotal
        s.from = a
        s.to = Math.min(a + (b - a) * STROKE_OVERLAP, DRAWING_END)
      }
      stage.path = path
      if (path.length) pen.copy(path[path.length - 1].end)

      stage.mesh.visible = true
    }

    return { stages, penHome, firstStroke: stages[0]?.path?.[0] ?? null }
  }, [drawing])

  useEffect(() => {
    if (!rig) return undefined
    return () => {
      for (const stage of rig.stages) {
        restoreStrokes(stage.payload)
        stage.mesh.material = stage.originalMaterial
        stage.mesh.visible = true
        stage.material.dispose()
      }
    }
  }, [rig])

  useFrame(() => {
    if (!rig) return
    const progress = input.current.progress

    // Once the building stands on it, the plan steps back — still legible
    // underneath, never switched off.
    const built = span(progress, BUILD_START, BUILD_END)
    const fade = 1 - (1 - UNDER_BUILDING) * built

    let penStroke = null
    let penFraction = 0

    for (const stage of rig.stages) {
      const { payload, path, material } = stage
      let touched = false

      for (const s of path) {
        const f = reducedMotion
          ? progress >= s.from
            ? 1
            : 0
          : clamp01((progress - s.from) / Math.max(s.to - s.from, 1e-6))

        if (drawStroke(s, f, payload.position, payload.original)) touched = true

        // The pen sits on the furthest stroke that is still going. Strokes
        // overlap a little, so "furthest" rather than "first".
        if (f > 0 && f < 1) {
          penStroke = s
          penFraction = f
        }
      }

      if (touched) payload.position.needsUpdate = true

      const o = stage.baseOpacity * fade
      material.opacity = o
      if (material.uniforms?.uOpacity) material.uniforms.uOpacity.value = o
    }

    // --- the drawing head
    const head = penRef.current
    if (!head) return

    const drawingLive =
      progress > DRAWING_BEGIN && progress < DRAWING_END + 0.004 && !reducedMotion

    if (!drawingLive) {
      head.visible = false
      return
    }

    if (penStroke) {
      head.visible = true
      SCRATCH.lerpVectors(penStroke.start, penStroke.end, penFraction)
      placeHead(head, SCRATCH, drawing.system)
    } else if (rig.firstStroke && progress < rig.firstStroke.from) {
      // The lead-in: the head leaves the pencil and crosses to the first line.
      const t = span(progress, DRAWING_BEGIN, rig.firstStroke.from)
      head.visible = t > 0.08
      SCRATCH.lerpVectors(rig.penHome, rig.firstStroke.start, t)
      placeHead(head, SCRATCH, drawing.system)
    } else {
      // Between strokes the pen is up. It does not draw a connector, and it
      // does not linger where it just finished.
      head.visible = false
    }
  })

  if (!rig) return null

  // The head is a plain world-space mesh rather than a child of Drawing_System:
  // that node already lives in the room scene, and re-parenting it here would
  // pull the whole sheet out from under the rest of the model.
  return (
    <mesh ref={penRef} renderOrder={3} visible={false}>
      <sphereGeometry args={[0.0034, 10, 8]} />
      <meshBasicMaterial color="#2f5fbd" toneMapped={false} />
    </mesh>
  )
}

const SCRATCH = new THREE.Vector3()

/** Stroke coordinates are in the sheet's space; the head lives in the world. */
function placeHead(head, local, system) {
  SCRATCH.copy(local)
  SCRATCH.y += 0.0012      // a hair proud of the ink so it reads as the nib
  head.position.copy(SCRATCH).applyMatrix4(system.matrixWorld)
}

export default DrawingSequence
