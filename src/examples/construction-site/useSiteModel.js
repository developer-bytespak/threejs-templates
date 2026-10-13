import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import {
  NODE, SITE_URL, SURVEY_URL, STATION,
  SURVEY_KIT, SURVEY_ACCESSORIES, SURVEY_ROD, SURVEY_PERMANENT, RIM_REMNANTS,
  LINE_ORDER, MARKER_ORDER, GROUND_MARK_COUNT,
  groundMarkName,
} from './site.js'
import { resolveExcavationRig } from './excavationRig.js'
import { resolveFoundationRig } from './foundationRig.js'
import { resolveConcreteRig } from './concreteRig.js'
import { resolveColumnRig } from './columnsRig.js'
import { attachDissolve, isolateMaterials } from './revealMaterial.js'

export { SITE_URL, SURVEY_URL }

/**
 * Turns two loaded GLBs into something a frame loop can drive.
 *
 * Nothing downstream ever invents a coordinate. Every authored transform is
 * measured once here and handed back as a rest value, so the frame loop only
 * ever evaluates a function of that rest state. Two consequences make the
 * sequence trustworthy: at weight 0 every part sits on its authored transform
 * exactly rather than approximately, so scrolling back to the top restores the
 * site losslessly; and a re-exported model re-measures on load instead of
 * quietly animating to numbers that no longer mean anything.
 *
 * Parts are looked up by name, never by child order. glTF makes no ordering
 * guarantee and this exporter has reordered nodes between versions.
 */

/**
 * Which end of a setout line is fixed, and how long it is.
 *
 * Every line is axis-aligned with an identity rotation and geometry centred on
 * its own origin, so "which way does this run" is just whichever ground axis
 * is longer. The fixed end is the one nearer the instrument, because that is
 * where the tape starts: string is pulled away from the station, not grown
 * from its own middle.
 */
function measureLine(object) {
  object.geometry.computeBoundingBox()
  const size = new THREE.Vector3()
  object.geometry.boundingBox.getSize(size)

  const axis = size.x >= size.z ? 'x' : 'z'
  const half = (axis === 'x' ? size.x : size.z) / 2
  const origin = object.position.clone()
  const toward = axis === 'x' ? STATION.x - origin.x : STATION.z - origin.z

  return {
    object,
    axis,
    half,
    origin,
    // +1 anchors the high end, -1 the low end.
    anchor: toward >= 0 ? 1 : -1,
    restScale: object.scale.clone(),
  }
}

function collect(scene, names, missing, label) {
  const found = []
  const absent = []
  for (const name of names) {
    const object = scene.getObjectByName(name)
    if (object) found.push(object)
    else absent.push(name)
  }
  if (absent.length) missing.push(`${label}: ${absent.join(', ')}`)
  return found
}

function restOf(object) {
  return {
    object,
    position: object.position.clone(),
    scale: object.scale.clone(),
  }
}

function buildRig(site, survey) {
  const missing = []

  // ---- the excavation file's own setout ------------------------------------
  // Most of it duplicates the survey layer, so it is hidden per child rather
  // than by hiding the parent: the corner stakes re-pegged at the pit rim are
  // under the same node and do have to be shown, and three.js visibility is
  // inherited, so a hidden parent would take them with it.
  const remains = site.getObjectByName(NODE.remains)
  const rim = []
  if (remains) {
    const keep = new Set(RIM_REMNANTS)
    for (const child of remains.children) {
      if (keep.has(child.name)) rim.push(child)
      else child.visible = false
    }
  } else {
    missing.push('SURVEY_REMAINS')
  }
  const rimMaterials = rim.flatMap((root) => isolateMaterials(root))

  // ---- the soil mass -------------------------------------------------------
  // Resolved by GROUP, not by chunk, and measured once. The work is in
  // `excavationRig.js` because it is the half of this file that has nothing to
  // do with React or with the survey kit: given a loaded scene it returns the
  // bodies and their rest state, which is exactly what a test wants to hold
  // and exactly what the animation layer is handed.
  const excavation = resolveExcavationRig(site, isolateMaterials)

  // ---- the foundation ------------------------------------------------------
  // Same shape and the same reasoning: resolved by GROUP, measured once, and
  // in its own file because it has nothing to do with React or the survey
  // kit. It takes no material isolation — nothing about the foundation fades,
  // so the two shared materials it arrives with are left exactly as loaded.
  const foundation = resolveFoundationRig(site)

  // ---- the concrete --------------------------------------------------------
  // Hangs off the same FOUNDATION node in the export and is resolved the same
  // way, by group. It measures one thing more than the foundation does —
  // whether a piece stands on its own origin, and so has a fill level as well
  // as a leading edge — because a pour has a surface and a bar does not.
  const concrete = resolveConcreteRig(site)

  // ---- the columns ---------------------------------------------------------
  // The first layer that is not under the FOUNDATION node, because it is not
  // part of the foundation: it is what stands on it. Resolved the same way as
  // everything before it — by group, measured once, in its own file — and it
  // asks one narrower question than the concrete does. A pour needs to know
  // that it has a fill level; a column needs to know that it stands on its own
  // foot, which is a stronger claim and the only one this phase depends on.
  const columns = resolveColumnRig(site)

  // ---- the setout ----------------------------------------------------------
  const lines = collect(survey, LINE_ORDER, missing, 'setout lines').map(measureLine)
  const markers = collect(survey, MARKER_ORDER, missing, 'markers').map(restOf)
  const groundMarks = collect(
    survey,
    Array.from({ length: GROUND_MARK_COUNT }, (_, i) => groundMarkName(i)),
    missing,
    'ground marks',
  ).map(restOf)

  const rodRoot = survey.getObjectByName(SURVEY_ROD)
  if (!rodRoot) missing.push(SURVEY_ROD)
  const rod = rodRoot ? restOf(rodRoot) : null

  // ---- what the excavation consumes, and what it does not ------------------
  // The control baseline and its two stations sit at z = 13, outside the
  // aperture, so the earth under them is never removed and neither are they.
  const permanent = new Set(SURVEY_PERMANENT)
  const consumed = [
    ...lines.filter((line) => !permanent.has(line.object.name)).map((line) => line.object),
    ...markers.filter((m) => !permanent.has(m.object.name)).map((m) => m.object),
    ...groundMarks.map((m) => m.object),
    ...(rodRoot ? [rodRoot] : []),
  ]

  // The setout dissolves on the same front as the ground, because it is
  // standing on the ground being removed. Isolate first: these stakes share
  // timber with the pallets by the site office.
  //
  // And none of it casts a shadow, for exactly the reason the ground patch
  // does not. The dissolve is a discard in the fragment shader; the shadow
  // pass runs three's depth material instead and never sees it. So string
  // lines and stakes that have visibly gone keep casting — and once the pit
  // is open beneath them, a 25 mm string 0.25 m above grade throws its shadow
  // seven metres down the cut face. The result is the entire setout, grid and
  // core and all, printed across the excavation walls in dotted lines, long
  // after the setout itself was carried away with the earth.
  //
  // The alternative is a matching custom depth material carrying the same
  // discard, which is more correct and buys back the stakes' own shadows.
  // Those are 0.34 m pegs casting 0.7 m smudges on flat ground, which is not
  // worth putting hand-written GLSL into the shadow pass of every light in
  // the scene — if that injection ever fails to compile, nothing in the frame
  // has a shadow at all.
  const setoutUniforms = []
  for (const root of consumed) {
    for (const material of isolateMaterials(root)) {
      setoutUniforms.push(attachDissolve(material))
    }
    root.traverse((child) => { child.castShadow = false })
  }

  // ---- survey kit that stays ----------------------------------------------
  const kitRoots = collect(survey, SURVEY_KIT, missing, 'survey kit')
  // Accessories are set dressing; their absence is not worth an error.
  for (const name of SURVEY_ACCESSORIES) {
    const object = survey.getObjectByName(name)
    if (object) kitRoots.push(object)
  }
  const kit = kitRoots.map(restOf)
  const kitMaterials = kitRoots.flatMap((root) => isolateMaterials(root))

  // The permanent baseline fades up with the rest of the setout but is never
  // handed to the dissolve, so it needs its own materials too.
  const permanentRoots = [
    ...lines.filter((l) => permanent.has(l.object.name)).map((l) => l.object),
    ...markers.filter((m) => permanent.has(m.object.name)).map((m) => m.object),
  ]
  const permanentMaterials = permanentRoots.flatMap((root) => isolateMaterials(root))

  if (missing.length) {
    console.error(
      '[construction] the site model is missing parts the sequence drives:\n  ' +
        missing.join('\n  ') +
        '\nCheck the exported node names against site.js.',
    )
  }

  return {
    site,
    survey,
    excavation,
    foundation,
    concrete,
    columns,
    lines,
    markers,
    groundMarks,
    rod,
    consumed,
    setoutUniforms,
    permanentMaterials,
    rim,
    rimMaterials,
    kit,
    kitMaterials,
  }
}

/**
 * useGLTF caches each scene by URL, so the rig is cached against that pair of
 * scenes. Without this, StrictMode's double mount — and any future second
 * caller — would clone a second set of materials over the top of the first,
 * leak the originals, and attach the dissolve twice.
 */
const RIGS = new WeakMap()

export function useSiteModel() {
  const site = useGLTF(SITE_URL).scene
  const survey = useGLTF(SURVEY_URL).scene

  return useMemo(() => {
    const cached = RIGS.get(site)
    if (cached && cached.survey === survey) return cached
    const rig = buildRig(site, survey)
    RIGS.set(site, rig)
    return rig
  }, [site, survey])
}

useGLTF.preload(SITE_URL)
useGLTF.preload(SURVEY_URL)
