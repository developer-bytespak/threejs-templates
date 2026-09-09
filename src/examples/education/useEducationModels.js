import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { CAMPUS_BUILDINGS, DISCIPLINES } from './chapters.js'
import { attachReveal } from './revealMaterial.js'

export const MODEL_URLS = {
  tree: '/models/education/knowledge_tree_core.glb',
  artifacts: '/models/education/knowledge_artifacts.glb',
  campus: '/models/education/knowledge_campus.glb',
}

/**
 * The artifacts the camera actually visits, and which get pointer response.
 * The rest of the objects in the file stay as environment — visiting all
 * fifteen would turn the museum into an inventory.
 */
export const HERO_ARTIFACTS = [
  { node: 'tech_laptop', discipline: 'technology', label: 'Systems' },
  { node: 'tech_microchip', discipline: 'technology', label: 'Silicon' },
  { node: 'science_dna', discipline: 'science', label: 'Life sciences' },
  { node: 'science_molecule', discipline: 'science', label: 'Matter' },
  { node: 'design_ribbon', discipline: 'design', label: 'Form' },
  { node: 'engineering_gear', discipline: 'engineering', label: 'Mechanism' },
  { node: 'business_globe', discipline: 'business', label: 'Markets' },
]

/**
 * Rigs are cached against the loaded scene rather than stored on it: useGLTF
 * hands back the same object on every visit to the route, and re-rigging it
 * would clone a fresh set of materials each time.
 */
const RIG_CACHE = new WeakMap()

function collectMeshes(root) {
  const meshes = []
  root.traverse((object) => {
    if (object.isMesh) meshes.push(object)
  })
  return meshes
}

/**
 * Clones every material under `root` and wires the reveal shader into it.
 *
 * Cloning matters: glTF shares one material instance across groups, so
 * driving the trunk's reveal would otherwise drive the branches' too.
 */
function rigGroup(root, mode, options) {
  const meshes = collectMeshes(root)
  const materials = []
  const seen = new Map()

  for (const mesh of meshes) {
    const source = mesh.material
    let clone = seen.get(source)
    if (!clone) {
      clone = source.clone()
      attachReveal(clone, mode, options)
      seen.set(source, clone)
      materials.push(clone)
    }
    mesh.material = clone
    mesh.castShadow = false
    mesh.receiveShadow = false
  }
  return { meshes, materials }
}

/** Largest value the reveal metric takes over a group, from its bounds. */
function metricRange(box, mode, origin) {
  if (mode === 'up') return [box.min.y, box.max.y]

  let max = 0
  let min = Infinity
  const corner = new THREE.Vector3()
  for (let i = 0; i < 8; i += 1) {
    corner.set(
      i & 1 ? box.max.x : box.min.x,
      i & 2 ? box.max.y : box.min.y,
      i & 4 ? box.max.z : box.min.z,
    )
    const value =
      mode === 'out'
        ? Math.hypot(corner.x, corner.z)
        : corner.distanceTo(origin)
    max = Math.max(max, value)
    min = Math.min(min, value)
  }
  return [mode === 'out' ? 0 : Math.max(0, min - 0.5), max]
}

function buildRig(tree, artifacts, campus) {
  const box = new THREE.Box3()
  const centre = new THREE.Vector3()

  // --- tree ---------------------------------------------------------------
  const growers = []
  const addGrower = (name, mode, originFor, options) => {
    const group = tree.getObjectByName(name)
    if (!group) return null
    const { materials } = rigGroup(group, mode, options)
    box.setFromObject(group)
    const origin = originFor ? originFor(box) : new THREE.Vector3()
    const [min, max] = metricRange(box, mode, origin)
    const entry = { name, group, materials, mode, origin, min, max }
    growers.push(entry)
    return entry
  }

  addGrower('roots', 'out', null, { band: 0.9, jitter: 0.5 })
  addGrower('trunk', 'up', null, { band: 1.2, jitter: 0.6 })

  // Branches and their leaves push outward from where they meet the trunk,
  // so the origin sits on the trunk axis at the group's base height.
  const branchOrigin = (bounds) =>
    new THREE.Vector3(0, bounds.min.y + (bounds.max.y - bounds.min.y) * 0.12, 0)

  const branches = {}
  for (const discipline of DISCIPLINES) {
    const branch = addGrower(discipline.branch, 'point', branchOrigin, {
      band: 1.4,
      jitter: 0.7,
    })
    const leaves = addGrower(discipline.leaves, 'point', branchOrigin, {
      // A narrower, less jittered front than the branches use. Leaves are
      // small and numerous, so a wide glowing boundary across all of them
      // reads as gold speckle rather than as new growth.
      band: 1.1,
      jitter: 0.55,
      glowStrength: 0.45,
    })
    if (!branch) continue
    box.setFromObject(branch.group)
    box.getCenter(centre)
    branches[discipline.id] = {
      ...discipline,
      branch,
      leaves,
      centre: centre.clone(),
      // Where the floating label hangs: out at the branch tip, lifted clear
      // of the foliage so it does not sit inside a leaf cluster.
      anchor: new THREE.Vector3(centre.x * 1.15, box.max.y + 0.6, centre.z * 1.15),
    }
  }

  addGrower('secondary_branches', 'point', branchOrigin, { band: 1.6, jitter: 0.8 })

  const seed = tree.getObjectByName('seed')
  const seedShell = seed?.getObjectByName('seed_shell') ?? null
  const seedRig = seed ? rigGroup(seed, 'up', { glowStrength: 0 }) : null
  box.setFromObject(seed ?? tree)
  const seedCentre = box.getCenter(new THREE.Vector3())

  const motes = tree.getObjectByName('ambient_details')
  const moteRig = motes ? rigGroup(motes, 'up', { glowStrength: 0 }) : null

  // --- artifacts -----------------------------------------------------------
  const artifactRoot = artifacts.getObjectByName('knowledge_artifacts') ?? artifacts
  const artifactGroups = {}
  for (const discipline of DISCIPLINES) {
    const group = artifactRoot.getObjectByName(discipline.artifacts)
    if (!group) continue
    const { materials } = rigGroup(group, 'point', { glowStrength: 0 })
    artifactGroups[discipline.id] = { group, materials }
  }

  const heroes = []
  for (const hero of HERO_ARTIFACTS) {
    const object = artifactRoot.getObjectByName(hero.node)
    if (!object) continue
    box.setFromObject(object)
    heroes.push({
      ...hero,
      object,
      // Authored transform, kept so idle motion is always an offset from the
      // artist's placement rather than a new absolute position.
      basePosition: object.position.clone(),
      baseScale: object.scale.clone(),
      worldCentre: box.getCenter(new THREE.Vector3()),
      radius: box.getSize(centre).length() * 0.5,
      phase: heroes.length * 1.7,
    })
  }

  // --- campus --------------------------------------------------------------
  const campusRoot = campus.getObjectByName('canopy_campus') ?? campus
  const { materials: campusMaterials } = rigGroup(campusRoot, 'up', {
    glowStrength: 0,
  })
  const campusEmissive = campusMaterials.filter(
    (material) => material.emissive && material.emissive.getHex() > 0,
  )
  for (const material of campusEmissive) material.emissiveIntensity = 0

  const buildings = []
  for (const item of CAMPUS_BUILDINGS) {
    const object = campusRoot.getObjectByName(item.node)
    if (!object) continue
    const meshes = collectMeshes(object)
    box.setFromObject(object)
    buildings.push({
      ...item,
      object,
      meshes,
      materials: [...new Set(meshes.map((mesh) => mesh.material))],
      basePosition: object.position.clone(),
      worldCentre: box.getCenter(new THREE.Vector3()),
      top: box.max.y,
    })
  }

  box.setFromObject(campusRoot)
  const campusCentre = box.getCenter(new THREE.Vector3())

  return {
    tree,
    artifacts,
    campus,
    growers,
    branches,
    seed,
    seedShell,
    seedMaterials: seedRig?.materials ?? [],
    seedCentre,
    moteMaterials: moteRig?.materials ?? [],
    moteGroup: motes,
    artifactGroups,
    heroes,
    campusRoot,
    campusMaterials,
    campusEmissive,
    buildings,
    campusCentre,
  }
}

/**
 * Loads the three files and turns them into one rig.
 *
 * They share a world: the artifacts sit in the branches and the campus sits
 * inside the canopy at roughly y = 14, which is what makes the concealment
 * real geometry rather than a trick. Nothing is repositioned on load.
 */
export function useEducationModels() {
  const tree = useGLTF(MODEL_URLS.tree)
  const artifacts = useGLTF(MODEL_URLS.artifacts)
  const campus = useGLTF(MODEL_URLS.campus)

  return useMemo(() => {
    const cached = RIG_CACHE.get(tree.scene)
    if (cached) return cached
    const rig = buildRig(tree.scene, artifacts.scene, campus.scene)
    RIG_CACHE.set(tree.scene, rig)
    return rig
  }, [tree.scene, artifacts.scene, campus.scene])
}

useGLTF.preload(MODEL_URLS.tree)
useGLTF.preload(MODEL_URLS.artifacts)
useGLTF.preload(MODEL_URLS.campus)
