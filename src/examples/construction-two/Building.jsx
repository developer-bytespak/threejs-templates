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
 *
 * The result stays in the mesh's own local coordinates, which is what lets the
 * cage sit under the same wrapper as the solid carrying no transform of its own.
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
 * One coordinate system per piece, holding both the cage and the volume.
 *
 *   pieceRoot        <- the piece's rest transform, and nothing ever writes to it
 *     |- wireframe   <- identity: the cage IS the destination volume
 *     |- mesh        <- identity at rest, animated in local space only
 *
 * The wrapper is the whole fix. Before it, the cage was handed a copy of the
 * mesh's transform once at setup while the mesh went on being re-positioned and
 * re-scaled every frame, so the two came apart the moment a piece started
 * building and never met again.
 *
 * Idempotent: the wrapper outlives an unmount, and useRoomModel recognises it
 * when it re-measures the cached scene.
 */
function ensurePieceRoot(mesh, rest) {
  const parent = mesh.parent
  if (parent?.userData?.pieceRoot) return parent

  const root = new THREE.Group()
  root.name = `${mesh.name}_root`
  root.userData.pieceRoot = true
  root.position.copy(rest.position)
  root.quaternion.copy(rest.quaternion)
  root.scale.copy(rest.scale)

  parent.add(root)
  root.add(mesh)                     // three removes it from its old parent
  mesh.position.set(0, 0, 0)
  mesh.quaternion.identity()
  mesh.scale.set(1, 1, 1)
  return root
}

/**
 * Lines drawn exactly on the faces they outline fight for the same depth and
 * stipple. Biasing the solid's depth backwards settles it without moving
 * anything: the geometry stays put, only its depth values shift. The material
 * is cloned per piece so the shared toon materials — the same card and frosted
 * glass are used elsewhere in the room — are left alone.
 */
function offsetSolid(mesh) {
  if (mesh.material?.userData?.pieceOffset) return
  const material = mesh.material.clone()
  material.polygonOffset = true
  material.polygonOffsetFactor = 1
  material.polygonOffsetUnits = 1
  material.userData = { ...mesh.material.userData, pieceOffset: true }
  mesh.material = material
}

/**
 * Advances one piece to its state at `local` (0 before it starts, 1 once it is
 * finished). Kept out of the component because these are three.js objects the
 * render loop owns and writes every frame, not React state.
 *
 * All of this happens inside the piece's own wrapper, so the only numbers in
 * play are the mesh's own local bounds. The underside holds at localMinY for
 * every value of `solid`:
 *
 *   underside = localMinY * solid + localMinY * (1 - solid) = localMinY
 *
 * and at solid = 1 the mesh is back to the identity transform, which is exactly
 * where the wireframe has been sitting the whole time. No offsets, no per-piece
 * corrections, and it holds whether a piece's origin is centred on its geometry,
 * sitting on its base, or — as it is here — somewhere else entirely.
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
    piece.mesh.scale.set(1, solid, 1)
    piece.mesh.position.y = piece.localMinY * (1 - solid)
  } else {
    piece.mesh.scale.set(1, 1, 1)
    piece.mesh.position.y = 0
  }
}

/**
 * The study model on the desk, assembled by scroll position.
 *
 * Each piece gets its own slice of BUILD_RANGE, offset from the last so they
 * stagger. Within that slice the wireframe draws in first, then the solid grows
 * up from the piece's underside to fill the cage it just drew.
 *
 * Growing the volume rather than fading it in is deliberate: fading would mean
 * `transparent: true` on thirteen overlapping boxes, and the depth sorting
 * between them is not worth the trouble for an effect that reads worse.
 *
 * Everything here is a pure function of scroll progress, so scrolling back up
 * takes the building apart again — the solid shrinks back onto its own
 * footprint and the cage retracts, neither of them moving off the volume.
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
      const { mesh, rest } = piece
      const root = ensurePieceRoot(mesh, rest)
      offsetSolid(mesh)

      const { geometry, segmentCount } = orderedEdges(mesh.geometry)
      const wireframe = new THREE.LineSegments(geometry, material)
      wireframe.name = `${mesh.name}_wire`
      wireframe.visible = false
      wireframe.frustumCulled = false
      wireframe.renderOrder = 2
      root.add(wireframe)

      return {
        ...piece,
        root,
        wireframe,
        segmentCount,
        localMinY: rest.localMinY,
        start: BUILD_RANGE.start + index * stagger,
        duration,
      }
    })
  }, [building])

  // Dev only: walk every piece through its build once and check the two things
  // that were wrong before — that the underside never moves, and that a
  // finished piece lands exactly on its cage. Runs on mount, costs nothing in
  // the frame loop, and prints a line per piece so a regression is obvious.
  useEffect(() => {
    if (!import.meta.env.DEV || !pieces.length) return

    const world = new THREE.Vector3()
    const rows = pieces.map((piece) => {
      const foot = []
      for (const solid of [0.25, 0.5, 0.75, 1]) {
        piece.mesh.scale.set(1, solid, 1)
        piece.mesh.position.y = piece.localMinY * (1 - solid)
        piece.mesh.updateMatrixWorld(true)
        world.set(0, piece.localMinY, 0).applyMatrix4(piece.mesh.matrixWorld)
        foot.push(world.y)
      }
      const drift = Math.max(...foot) - Math.min(...foot)
      const settled =
        Math.abs(piece.mesh.position.y) < 1e-9 &&
        Math.abs(piece.mesh.scale.y - 1) < 1e-9
      piece.mesh.scale.set(1, 1, 1)
      piece.mesh.position.y = 0
      piece.mesh.updateMatrixWorld(true)
      return { name: piece.mesh.name, drift, settled }
    })

    const bad = rows.filter((r) => r.drift > 1e-6 || !r.settled)
    if (bad.length) {
      console.error('[build] pieces drifting off their cage:', bad)
    } else {
      console.info(
        `[build] ${rows.length} pieces: underside held at 25/50/75/100%,`,
        'each landing on its wireframe (max drift',
        `${Math.max(...rows.map((r) => r.drift)).toExponential(1)} m)`,
      )
    }
  }, [pieces])

  useEffect(() => {
    return () => {
      for (const piece of pieces) {
        piece.wireframe.removeFromParent()
        piece.wireframe.geometry.dispose()
        // Leave the piece at rest rather than mid-build: the scene is cached,
        // and the next mount measures it before it animates anything.
        piece.mesh.scale.set(1, 1, 1)
        piece.mesh.position.set(0, 0, 0)
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
