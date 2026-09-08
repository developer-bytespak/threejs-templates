import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useRoomModel } from './useRoomModel.js'
import { BUILD_RANGE } from './shots.js'
import { WIREFRAME_COLOUR } from './palette.js'

// How much of each piece's own window is spent drawing its wireframe before
// the solid starts filling in. They overlap, so the cage is still completing
// as the volume begins to rise inside it.
const WIRE_END = 0.6
const SOLID_START = 0.45

// Share of the whole build range one piece takes. The rest is spread between
// pieces as the stagger, so a larger value means more overlap.
const PIECE_SHARE = 0.42

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Rebuilds each piece's edges as a line list ordered bottom-up, so revealing
 * it with setDrawRange reads as the outline being drawn upward rather than
 * segments appearing at random.
 */
function orderedEdges(geometry) {
  const edges = new THREE.EdgesGeometry(geometry, 25)
  const source = edges.getAttribute('position')
  const count = source.count / 2

  const segments = []
  for (let i = 0; i < count; i += 1) {
    const ax = source.getX(i * 2), ay = source.getY(i * 2), az = source.getZ(i * 2)
    const bx = source.getX(i * 2 + 1), by = source.getY(i * 2 + 1), bz = source.getZ(i * 2 + 1)
    segments.push({ key: Math.min(ay, by), a: [ax, ay, az], b: [bx, by, bz] })
  }
  segments.sort((p, q) => p.key - q.key)

  const ordered = new Float32Array(count * 6)
  segments.forEach((segment, i) => {
    ordered.set(segment.a, i * 6)
    ordered.set(segment.b, i * 6 + 3)
  })

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(ordered, 3))
  edges.dispose()
  return { geometry: geo, segmentCount: count }
}

/**
 * Advances one piece to its state at `local` (0 before it starts, 1 once it is
 * finished). Kept out of the component because these are three.js objects the
 * render loop owns and writes every frame, not React state.
 */
function stepPiece(piece, local, reducedMotion) {
  // Reduced motion gets the finished model rather than a moving one.
  const wire = reducedMotion ? (local > 0 ? 1 : 0) : clamp01(local / WIRE_END)
  const solid = reducedMotion
    ? local > 0
      ? 1
      : 0
    : easeOutCubic(clamp01((local - SOLID_START) / (1 - SOLID_START)))

  piece.wireframe.visible = wire > 0
  if (wire > 0) {
    // Two vertices per segment, and the count has to stay even.
    const shown = Math.max(1, Math.round(piece.segmentCount * wire))
    piece.wireframe.geometry.setDrawRange(0, shown * 2)
  }

  piece.mesh.visible = solid > 0
  if (solid > 0) {
    piece.mesh.scale.y = solid
    // Pin the underside in place so the volume rises out of the piece below it
    // instead of expanding around its own centre.
    piece.mesh.position.y = piece.footY + (piece.height * solid) / 2
  } else {
    piece.mesh.scale.y = 1
    piece.mesh.position.y = piece.restY
  }
}

/**
 * The study model on the desk, assembled by scroll position.
 *
 * Each piece gets its own slice of BUILD_RANGE, offset from the last so they
 * stagger. Within that slice the wireframe draws in first, then the solid
 * grows up from the piece's underside to fill the cage it just drew.
 *
 * Growing the volume rather than fading it in is deliberate: fading would mean
 * `transparent: true` on thirteen overlapping boxes, and the depth sorting
 * between them is not worth the trouble for an effect that reads worse.
 *
 * Everything here is a pure function of scroll progress, so scrolling back up
 * takes the building apart again.
 */
function Building({ input, reducedMotion }) {
  const { building } = useRoomModel()

  const pieces = useMemo(() => {
    if (!building.length) return []

    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(WIREFRAME_COLOUR),
      toneMapped: false,
      transparent: false,
    })

    const span = Math.max(BUILD_RANGE.end - BUILD_RANGE.start, 1e-4)
    const duration = span * PIECE_SHARE
    const stagger = building.length > 1 ? (span - duration) / (building.length - 1) : 0

    return building.map((piece, index) => {
      const { geometry, segmentCount } = orderedEdges(piece.mesh.geometry)
      const wireframe = new THREE.LineSegments(geometry, material)
      wireframe.name = `${piece.mesh.name}_wire`
      wireframe.position.copy(piece.mesh.position)
      wireframe.quaternion.copy(piece.mesh.quaternion)
      wireframe.scale.copy(piece.mesh.scale)
      wireframe.visible = false
      wireframe.frustumCulled = false
      piece.mesh.parent.add(wireframe)

      return {
        ...piece,
        wireframe,
        segmentCount,
        start: BUILD_RANGE.start + index * stagger,
        duration,
      }
    })
  }, [building])

  useEffect(() => {
    return () => {
      for (const piece of pieces) {
        piece.wireframe.removeFromParent()
        piece.wireframe.geometry.dispose()
      }
      if (pieces.length) pieces[0].wireframe.material.dispose()
    }
  }, [pieces])

  useFrame(() => {
    const progress = input.current.progress

    for (const piece of pieces) {
      stepPiece(
        piece,
        clamp01((progress - piece.start) / piece.duration),
        reducedMotion,
      )
    }
  })

  return null
}

export default Building
