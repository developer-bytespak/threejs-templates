import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { DISCIPLINES } from './chapters.js'
import {
  setEmphasis,
  setGlow,
  setGrowthHeight,
  setNear,
  setOpacity,
  setReveal,
} from './revealMaterial.js'

/** Which stage weight drives each part of the tree. */
const DRIVER = {
  roots: 'rootGrowth',
  trunk: 'trunkGrowth',
  secondary_branches: 'branchGrowth',
}
const OWNER = {}
DISCIPLINES.forEach((discipline, index) => {
  DRIVER[discipline.branch] = 'branchGrowth'
  DRIVER[discipline.leaves] = 'leafReveal'
  OWNER[discipline.branch] = { id: discipline.id, index }
  OWNER[discipline.leaves] = { id: discipline.id, index }
})

/** How much each discipline lags the one before it, as a share of the window. */
const STAGGER = 0.09

/**
 * Focus balance, as brightness ratios.
 *
 * Every branch belongs to one tree, so hovering a discipline has to read as
 * attention rather than as the other four being switched off. The focused
 * branch comes up a little and its veins respond; the rest keep every fragment
 * they had and step back by a quarter — plainly still lit, still coloured,
 * still part of the canopy. This used to be a dithered fade at 0.55, which
 * discarded nearly half of each unfocused branch and read as the discipline
 * dying rather than as the other one being chosen.
 */
const ACTIVE_BRANCH = 1.06
const INACTIVE_BRANCH = 0.75
const SPAN = Math.max(0.05, 1 - STAGGER * (DISCIPLINES.length - 1))

/**
 * The tree, growing.
 *
 * Nothing here moves a vertex. Each group's materials carry a reveal front
 * (see revealMaterial.js) and this drives how far that front has travelled, so
 * geometry is uncovered along its own length — roots spreading outward, trunk
 * rising, branches pushing away from where they meet it. The five disciplines
 * are staggered so the canopy fills in rather than arriving at once.
 *
 * Everything mutable is built on first frame and kept behind a ref: these are
 * per-frame writes into three.js objects, and values that came out of a hook
 * are not ours to modify.
 */
function KnowledgeTree({ rig, stage, quality, interactive, onHoverDiscipline }) {
  const local = useRef(null)

  const ensure = () => {
    if (local.current) return local.current

    const drivers = rig.growers.map((grower) => ({
      materials: grower.materials,
      origin: grower.origin,
      mode: grower.mode,
      key: DRIVER[grower.name] ?? 'trunkGrowth',
      owner: OWNER[grower.name] ?? null,
      veins: grower.materials.filter((material) => /vein/i.test(material.name)),
      // The front runs a little past each end so it leaves the geometry
      // entirely rather than parking on the last few fragments.
      from: grower.min - 1.2,
      to: grower.max + 1.4,
      fade: 1,
    }))

    const shell = rig.seed?.children.find((child) => /shell/i.test(child.name)) ?? null
    const core = rig.seed?.children.find((child) => /core|glow|light/i.test(child.name))

    local.current = {
      drivers,
      shell,
      shellPosition: shell ? shell.position.clone() : null,
      shellQuaternion: shell ? shell.quaternion.clone() : null,
      coreMaterials: core
        ? rig.seedMaterials.filter((material) => material.emissive)
        : rig.seedMaterials,
      hovered: null,
      // Held here rather than reached through `rig` each frame: these get
      // written every frame, and a prop is not ours to modify.
      moteGroup: rig.moteGroup ?? null,
      moteMaterials: rig.moteMaterials,
    }
    return local.current
  }

  const handleMove = (event) => {
    if (!interactive || !quality.hover) return
    const store = ensure()
    // Walk up from the hit mesh until we reach a group we recognise, so one
    // handler on the whole tree resolves to a discipline without needing a
    // wrapper object around every branch.
    let node = event.object
    while (node) {
      const owner = OWNER[node.name]
      if (owner) {
        if (store.hovered !== owner.id) {
          store.hovered = owner.id
          onHoverDiscipline(owner.id)
        }
        return
      }
      node = node.parent
    }
    if (store.hovered !== null) {
      store.hovered = null
      onHoverDiscipline(null)
    }
  }

  const handleOut = () => {
    const store = ensure()
    if (store.hovered === null) return
    store.hovered = null
    onHoverDiscipline(null)
  }

  useFrame((state, delta) => {
    const store = ensure()
    const s = stage.current
    const step = Math.min(delta, 0.1)
    const time = state.clock.elapsedTime
    const focus = s.hoveredDiscipline

    for (let i = 0; i < store.drivers.length; i += 1) {
      const driver = store.drivers[i]
      const raw = s[driver.key] ?? 0

      // Every part of the tree is gated on the growth front's height, so
      // nothing can be drawn above where the tree has actually grown to.
      setGrowthHeight(driver.materials, s.growthHeight)

      // Spread the five systems across the window so the canopy fills in.
      const lead = driver.owner ? driver.owner.index * STAGGER : 0
      let weight = THREE.MathUtils.clamp((raw - lead) / SPAN, 0, 1)

      // Once the camera is through the foliage, the outermost leaves recede by
      // running their own reveal front backwards. Dimming them instead leaves
      // a heavy dither speckle across the canopy that reads as screen noise;
      // retracting removes whole leaves and keeps the inner ones framing the
      // shot, which is what the branches are there for.
      if (driver.key === 'leafReveal') weight *= 1 - s.canopyClear * 0.45

      // The trunk's own metric is world height, so its front simply *is* the
      // growth front — driving it from anything else would let the two
      // disagree and put a seam in the one place it would be most obvious.
      const edge =
        driver.mode === 'up'
          ? s.growthHeight
          : THREE.MathUtils.lerp(driver.from, driver.to, weight)

      setReveal(driver.materials, edge, driver.origin)

      if (driver.veins.length) {
        // Veins pulse along their length while the tree is still growing, then
        // settle to a steady ember once it has.
        const flow = s.veinFlow * (0.55 + 0.45 * Math.sin(time * 0.9 + i * 1.3))
        const lift = focus
          ? focus === driver.owner?.id
            ? 1.8
            : 0.85
          : 1
        for (const material of driver.veins) {
          material.emissiveIntensity = (0.5 + flow * 1.6) * lift
        }
      }

      // Hovering one discipline lowers the emphasis of the others rather than
      // spotlighting the hovered one — the canopy stays legible either way.
      if (driver.owner) {
        const wanted = focus
          ? focus === driver.owner.id
            ? ACTIVE_BRANCH
            : INACTIVE_BRANCH
          : 1
        driver.fade = THREE.MathUtils.damp(driver.fade, wanted, 5, step)
        setEmphasis(driver.materials, driver.fade)

        // The front only glows while it is travelling. Retracting the leaves
        // parks it mid-canopy, and a stationary emissive band across hundreds
        // of leaves reads as gold confetti rather than as growth.
        const leaf = driver.key === 'leafReveal'
        const lit = focus === driver.owner.id
        const settle = leaf ? 1 - s.canopyClear : 1
        setGlow(driver.materials, (lit ? (leaf ? 1.2 : 2.9) : leaf ? 0.9 : 2.4) * settle)

        // Leaves within a few metres of the lens dissolve. Inside the canopy
        // the camera is constantly pushing through foliage, and without this
        // the hero artifacts and the typography behind them are both lost in
        // leaves that are too close to be read as leaves.
        if (leaf) setNear(driver.materials, s.leafNear)
      }
    }

    // --- the seed ----------------------------------------------------------
    if (store.shell && store.shellPosition) {
      const open = s.seedOpen
      store.shell.position.copy(store.shellPosition)
      store.shell.position.y += open * 0.55
      store.shell.position.z += open * 0.28
      store.shell.quaternion.copy(store.shellQuaternion)
      store.shell.rotateX(open * 1.1)
      store.shell.rotateZ(open * 0.5)
    }

    for (const material of store.coreMaterials) {
      // The core is the only light in the room at the start, and it keeps a
      // slow heartbeat the whole way through.
      material.emissiveIntensity =
        (0.8 + s.seedGlow * 3.4) * (0.85 + 0.15 * Math.sin(time * 1.6))
    }


    if (store.moteGroup) {
      store.moteGroup.visible = s.treeMotes > 0.01
      // Real opacity, not a dissolve: these are a handful of small specks, and
      // discarding fragments to fade them makes them flicker in and out.
      setOpacity(store.moteMaterials, s.treeMotes)
      // These are scattered up to y = 16.7 in the GLB, so without the gate a
      // handful of lit specks hang in empty air above the growth front.
      setGrowthHeight(store.moteMaterials, s.growthHeight)
    }
  })

  return (
    <primitive
      object={rig.tree}
      onPointerMove={handleMove}
      onPointerOut={handleOut}
    />
  )
}

export default KnowledgeTree
