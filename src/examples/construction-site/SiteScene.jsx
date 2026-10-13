import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import SiteCamera from './SiteCamera.jsx'
import SiteLighting from './SiteLighting.jsx'
import ExcavationController from './ExcavationController.jsx'
import ExcavationEventManager from './ExcavationEventManager.jsx'
import FoundationEventManager from './FoundationEventManager.jsx'
import ConcreteEventManager from './ConcreteEventManager.jsx'
import ColumnsEventManager from './ColumnsEventManager.jsx'
import { createExcavationEvents } from './excavationEvent.js'
import { createFoundationEvents } from './foundationEvent.js'
import { createConcreteEvents } from './concreteEvent.js'
import { createColumnEvents } from './columnsEvent.js'
import { foundationWanted, LAST_FOUNDATION_STAGE } from './foundation.js'
import { pourIsOn, pourWanted, LAST_CONCRETE_STAGE } from './concrete.js'
import { riseIsOn, riseWanted, LAST_COLUMN_STAGE } from './columns.js'
import { createDustField } from './excavationDust.js'
import { createCameraShake } from './excavationShake.js'
import SceneAudio from './audio/SceneAudio.jsx'
import { useSiteModel } from './useSiteModel.js'
import { setFront, setOpacity } from './revealMaterial.js'
import { createStageState, deriveStage, digIsOn, digWanted, settle, stagger } from './sequence.js'
import { FLAT_GROUND, OPEN_FROM, OPEN_TO } from './site.js'

/**
 * How fast the scene catches up with the page.
 *
 * Fast enough that the scene feels attached to the wheel, slow enough that a
 * wheel notch — which arrives as a single discrete jump — comes out as a
 * movement rather than a flinch.
 */
const SCROLL_DAMPING = 5.5

/**
 * Nothing is ever scaled to exactly zero: a zero matrix is not invertible, and
 * a stake squashed to no height still draws the disc on the end of it — a
 * scatter of bright dots across an empty site, which is exactly the giveaway
 * this sequence cannot afford in its opening frame. Anything at zero weight is
 * switched off instead of merely made small.
 */
const MIN = 1e-3
const OFF = 1e-3

/**
 * Drives the whole site from one number.
 *
 * Everything below is a function of `stage.current`, which is itself a pure
 * function of scroll. No part of this keeps its own clock or its own idea of
 * where it has got to, which is why scrolling backwards is correct rather
 * than merely tolerable: the frame you get at 62% is the frame at 62%,
 * whether you arrived from 60% or from 90% or from a page refresh.
 *
 * The stage is derived here at priority -1 so it is settled before any child
 * reads it in the same frame. Children that need it take the ref, not a prop
 * value — scroll changes continuously and must never touch React state, or
 * every frame would re-render a tree containing the entire scene.
 */
function SiteScene({ input, quality, reducedMotion }) {
  const rig = useSiteModel()
  const stage = useRef(createStageState())

  // The excavation's position on the timeline, written into a ref inside the
  // frame callback below. That callback runs at priority -1, so the value is
  // settled before the controller reads it in the same frame.
  const excavation = useRef(0)
  const controller = useRef(null)

  // ---- the excavation, in four layers -------------------------------------
  // The controller decides WHICH stage is on screen; the event engine decides
  // what happens on the way there; the dust and the shake are what that event
  // is worth seeing and feeling. They are wired together here and nowhere
  // else, and the wiring is one-way: the engine calls out and has no idea
  // whether anything is listening. That is what lets either of the last two be
  // switched off — or replaced — without the soil noticing.
  const dust = useMemo(() => createDustField(), [])
  const shake = useMemo(() => createCameraShake(), [])
  useEffect(() => () => dust.dispose(), [dust])

  // Created once per model: it measures each body's rest transform, pivot and
  // size on construction, so it must not be rebuilt while an event is running.
  const events = useMemo(
    () => createExcavationEvents(rig.excavation, {
      onCut: (regions) => dust.burst(regions),
      onImpact: (strength) => shake.impulse(strength),
    }),
    [rig, dust, shake],
  )

  // The foundation. Its own rig, its own table, its own clock, and no wiring
  // between the two engines at all — the only thing they share is the frame
  // callback below deciding, once, that a foundation cannot exist in a hole
  // that has not been dug. It takes no callbacks because there is nothing to
  // call: no dust, no shake, no particles. Excavation is impact; foundation is
  // precision.
  const foundationEvents = useMemo(
    () => createFoundationEvents(rig.foundation),
    [rig],
  )

  // The concrete. A third engine, a third clock, and the same one-way wiring:
  // it is handed three callbacks and has no idea whether anything is listening
  // to them. They exist so sound can be hung on the pour later without the
  // animation growing an opinion about audio — the scene records them on the
  // stage state, which is where the audio layer already reads everything else.
  const concreteEvents = useMemo(
    () => createConcreteEvents(rig.concrete, {
      onStart: (chain) => { stage.current.concreteStart = chain },
      onStage: (change) => { stage.current.concreteStage = change },
      onFinish: () => { stage.current.concreteDone = true },
    }),
    [rig],
  )

  // The columns. A fourth engine and a fourth clock, and the plainest of the
  // four: no callbacks, no dust, no shake, nothing to call out to. A frame
  // going up is the whole effect, and anything hung off it would be an
  // addition to it rather than a part of it.
  const columnEvents = useMemo(() => createColumnEvents(rig.columns), [rig])

  // Reduced motion is honoured at the source: the event engine snaps, so it
  // never calls out, so there is nothing to suppress downstream. The manager
  // deals with the one remaining case, somebody turning it on mid-event.
  useEffect(() => { shake.setEnabled(!reducedMotion) }, [reducedMotion, shake])

  // Development only, and not shipped: Vite strips the branch from a
  // production build. It is what lets the capture rig — and the browser
  // console — watch the event machine run without the scene having to publish
  // anything, and without a single line of instrumentation living inside the
  // animation itself.
  useEffect(() => {
    if (!import.meta.env?.DEV || typeof window === 'undefined') return undefined
    window.__excavation = { events, dust, shake, stage, rig, input }
    window.__foundation = { events: foundationEvents, stage, rig }
    window.__concrete = { events: concreteEvents, stage, rig }
    window.__columns = { events: columnEvents, stage, rig }
    return () => {
      delete window.__excavation
      delete window.__foundation
      delete window.__concrete
      delete window.__columns
    }
  }, [events, foundationEvents, concreteEvents, columnEvents, dust, shake, stage, rig, input])

  // Shadow flags are a property of the asset, not of a frame, so they are set
  // once. The environment receives and the things standing on it cast: a
  // fence that casts but does not receive is free, and a site where the spoil
  // heaps float because nothing receives their shadow is not.
  useEffect(() => {
    const on = quality.shadows
    for (const root of [rig.site, rig.survey]) {
      root.traverse((child) => {
        if (!child.isMesh) return
        child.castShadow = on
        child.receiveShadow = on
      })
    }
    // ...except the things that must never cast, which is why this runs after
    // the sweep above rather than inside it — the sweep would otherwise put
    // every one of them back.
    //
    // Everything the dissolve touches is on this list, and for one reason:
    // the dissolve is a discard in the fragment shader and the shadow pass
    // does not run it, so anything driven by it goes on casting at full
    // strength after it has visibly gone — the string lines and stakes did it
    // in dotted lines across the cut faces. The soil bodies are not on this
    // list and should not be: they are hidden outright rather than dissolved,
    // and three drops a hidden object from the shadow pass along with
    // everything else. The flat sheets are here for a different reason — the
    // only shadow a ground plane can cast is onto itself.
    for (const root of rig.consumed) root.traverse((child) => { child.castShadow = false })
    for (const name of FLAT_GROUND) {
      const sheet = rig.site.getObjectByName(name)
      if (sheet) sheet.traverse((child) => { child.castShadow = false })
    }
  }, [rig, quality.shadows])

  const scratch = useMemo(
    () => ({ kitOpacity: -1, rimOpacity: -1, kitCasts: null, rimCasts: null }),
    [],
  )

  useFrame((state, delta) => {
    const step = Math.min(delta, 0.1)
    const s = stage.current
    // Whether the excavation chain is mid-run. Read once, used once, below.
    const running = events.running()

    s.smoothed = THREE.MathUtils.damp(
      s.smoothed, input.current.progress, SCROLL_DAMPING, step,
    )
    deriveStage(s.smoothed, s)

    // The excavation trigger: one bit, latched, off the RAW scroll offset
    // rather than the damped one the camera rides on. Damping is what makes
    // the camera feel attached to the wheel and it is exactly wrong for a
    // trigger, where it would put a fifth of a second between the reader
    // crossing the line and the earthwork starting.
    //
    // Frozen while the chain runs. Nothing the reader does to the page during
    // those four seconds can cancel it, redirect it or start it again — which
    // is the whole of "one scroll runs the whole dig", stated as one `if`.
    if (!running) s.dig = digWanted(input.current.progress, s.dig)
    s.excavation = digIsOn(s.dig) ? 1 : 0

    // ---- the foundation trigger --------------------------------------------
    // Five thresholds rather than the excavation's one, off the same raw
    // scroll offset and for the same reason. They are TRIGGERS: crossing one
    // asks for a stage and returns, and the event layer owns everything after
    // that. Nothing here is a weight, a phase or a position, so there is no
    // value a reader can park on and scrub.
    //
    // The one rule that crosses the two systems is this `if`, and it is not an
    // optimisation: the earthwork owns the ground. While the dig is running —
    // which, going backwards, means the pit is filling in — nothing may be
    // under construction inside it. What is already built goes at once rather
    // than unbuilding politely under returning soil, which is the one case
    // where a snap is more honest than an animation.
    if (running) {
      if (s.foundation !== 0 || foundationEvents.running()) {
        s.foundation = 0
        foundationEvents.setTarget(0)
        foundationEvents.finish()
      }
    } else {
      s.foundation = s.excavation === 1
        ? foundationWanted(input.current.progress, s.foundation)
        : 0
      foundationEvents.setTarget(s.foundation)
    }

    // ---- the concrete trigger ----------------------------------------------
    // One latch for the whole pour, off the same raw scroll offset, and
    // frozen for the three and a half seconds the chain runs — which is the
    // whole of "one scroll pours the foundation", stated as one `if`.
    //
    // Two conditions gate it, and they are the same rule twice: concrete goes
    // into finished formwork and nothing else. The foundation has to be
    // complete AND standing still, so a reader who crosses the trigger while
    // the last shutter is still going up gets the pour a moment later rather
    // than through the boards. And if the foundation ever comes back out, the
    // concrete goes with it at once — there is no honest animation for
    // concrete left hanging in the air where its formwork used to be.
    const pouring = concreteEvents.running()
    const formwork = s.foundation === LAST_FOUNDATION_STAGE && !foundationEvents.running()
    if (!pouring) s.pour = formwork ? pourWanted(input.current.progress, s.pour) : 0
    s.concrete = pourIsOn(s.pour) ? LAST_CONCRETE_STAGE : 0
    if (!formwork && !pouring && concreteEvents.state().shown > 0) {
      concreteEvents.setTarget(0)
      concreteEvents.finish()
    } else {
      concreteEvents.setTarget(s.concrete)
    }

    // ---- the column trigger -------------------------------------------------
    // One latch for the whole frame, off the same raw scroll offset, and
    // frozen for the three seconds the chain runs — which is the whole of
    // "one scroll raises the building", stated as one `if`.
    //
    // The same two conditions as the pour, one level up, and they are the
    // same rule twice: a column is cast on a finished floor and nothing else.
    // The concrete has to be complete AND standing still, so a reader who
    // crosses the trigger while the slab is still coming up gets the frame a
    // moment later rather than through the floor. And if the concrete ever
    // goes back out, the building goes with it at once — there is no honest
    // animation for a column left standing on a foundation that has ceased to
    // exist, and unbuilding it politely while the slab drains away underneath
    // would be four seconds spent on a lie.
    const rising = columnEvents.running()
    const poured = s.concrete === LAST_CONCRETE_STAGE && !concreteEvents.running()
    if (!rising) s.rise = poured ? riseWanted(input.current.progress, s.rise) : 0
    s.columns = riseIsOn(s.rise) ? LAST_COLUMN_STAGE : 0
    if (!poured && !rising && columnEvents.state().shown > 0) {
      columnEvents.setTarget(0)
      columnEvents.finish()
    } else {
      columnEvents.setTarget(s.columns)
    }

    // ---- the kit arrives ---------------------------------------------------
    // Instrument, surveyor and case rise the last two thirds of a metre into
    // place rather than appearing at it. It is a small thing, but a tripod
    // that fades in at full height reads as a texture change, and a tripod
    // that arrives reads as someone setting it up.
    const lift = (1 - s.arrive) * 0.7
    const kitHere = s.arrive > OFF
    for (const part of rig.kit) {
      part.object.visible = kitHere
      part.object.position.y = part.position.y - lift
    }
    if (Math.abs(s.arrive - scratch.kitOpacity) > 0.002) {
      setOpacity(rig.kitMaterials, s.arrive)
      scratch.kitOpacity = s.arrive
    }
    // A shadow does not fade with opacity — three's depth pass ignores it
    // entirely — so a tripod fading up from nothing would otherwise lay a
    // hard, full-strength shadow on the ground before there is anything
    // standing there to cast it. Switched at the half-way point, where the
    // object is solid enough that nobody reads the change as a change.
    const kitCasts = s.arrive > 0.5
    if (kitCasts !== scratch.kitCasts) {
      scratch.kitCasts = kitCasts
      for (const part of rig.kit) part.object.traverse((c) => { c.castShadow = kitCasts })
    }
    if (rig.rod) {
      rig.rod.object.visible = kitHere
      rig.rod.object.scale.y = rig.rod.scale.y * Math.max(s.arrive, MIN)
    }

    // ---- the stakes go in --------------------------------------------------
    // Staggered in the order a surveyor would actually work: the two control
    // stations first, then the footprint corners, then everything measured
    // from them. `settle` gives each one a small overshoot, so they read as
    // struck rather than inflated.
    // The count is published on the stage for the audio layer, which fires a
    // sound per stake. Counting here rather than re-deriving the same stagger
    // in the sound code means the two cannot disagree: what you hear is
    // triggered by the number that drew what you see.
    const markers = rig.markers
    let stakesIn = 0
    for (let i = 0; i < markers.length; i += 1) {
      const part = markers[i]
      const t = settle(stagger(s.stakes, i, markers.length))
      part.object.visible = t > OFF
      part.object.scale.y = part.scale.y * Math.max(t, MIN)
      if (t > 0.55) stakesIn += 1
    }
    s.stakesIn = stakesIn

    // The paint spots spread under the stakes rather than growing upward.
    const marks = rig.groundMarks
    for (let i = 0; i < marks.length; i += 1) {
      const part = marks[i]
      const t = stagger(s.stakes, i, marks.length)
      part.object.visible = t > OFF
      const spread = Math.max(t, MIN)
      part.object.scale.set(part.scale.x * spread, part.scale.y, part.scale.z * spread)
    }

    // ---- the string lines are pulled ---------------------------------------
    // Each line grows from the end nearer the instrument, because that is
    // where the tape starts. Geometry is centred on its own origin, so
    // holding one end fixed means moving the centre by exactly the half
    // length that has not been drawn yet.
    const lines = rig.lines
    let linesIn = 0
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]
      const t = stagger(s.setout, i, lines.length)
      line.object.visible = t > OFF
      const drawn = Math.max(t, MIN)
      line.object.scale[line.axis] = line.restScale[line.axis] * drawn
      line.object.position[line.axis] =
        line.origin[line.axis] + line.anchor * line.half * (1 - drawn)
      // A line counts once it is pulled taut, not when it starts: the sound
      // is a length of string going on, and that is the end of the pull.
      if (t > 0.85) linesIn += 1
    }
    s.linesIn = linesIn

    // ---- the ground opens ---------------------------------------------------
    // Two consumers, one weight. The soil bodies are taken away in lifts by
    // the controller below; the setout is standing on that ground, so it goes
    // with it, on the same weight rather than on a timer of its own that
    // would drift out of step.
    //
    // The setout still dissolves rather than switching off, because a string
    // line is a continuous thing being consumed along its length — the front
    // sweeping east to west matches the direction the dig advances in the
    // asset. The earth itself does not dissolve: it is solid, and an object
    // that is gone is gone.
    // The excavation trigger. One bit, not a position: 0 is an untouched site
    // and 1 is "run the whole dig". `deriveStage` latched it above from the
    // RAW scroll offset rather than the damped one the camera rides on —
    // damping is what makes the camera feel attached to the wheel, and it is
    // exactly wrong for a trigger, where it would put a fifth of a second
    // between the reader crossing the line and the earthwork starting.
    excavation.current = s.excavation
    setFront(rig.setoutUniforms, s.consumed, OPEN_FROM, OPEN_TO)

    const cutOpen = s.open > OFF

    // The corner pegs re-established clear of the works, at the pit rim.
    if (Math.abs(s.open - scratch.rimOpacity) > 0.002) {
      setOpacity(rig.rimMaterials, s.open)
      scratch.rimOpacity = s.open
    }
    const rimCasts = s.open > 0.5
    if (rimCasts !== scratch.rimCasts) {
      scratch.rimCasts = rimCasts
      for (const part of rig.rim) part.traverse((c) => { c.castShadow = rimCasts })
    }
    for (const part of rig.rim) {
      part.visible = cutOpen
      part.scale.y = Math.max(settle(s.open), MIN)
    }

    // The earth it came out of piles up beside it — but that is the
    // controller's table, not a second animation with its own opinion about
    // when a heap should exist. `s.spoil` and `s.spoilIn` are written by
    // `onStage` below, from the stage that decided what is on screen, so what
    // you hear cannot disagree with what you see.

  }, -1)

  // Only fires when the stage actually changes, which is five times over the
  // whole page. It is a TRIGGER, not a frame of animation: it tells the event
  // layer which stage the page is now asking for and returns. Everything the
  // reader then sees is driven by that layer's own clock, so stopping the
  // wheel one pixel past a boundary still gets the whole event.
  const onStage = useCallback((next) => {
    events.setTarget(next.index)
    const s = stage.current
    s.spoil = next.fraction
    s.spoilIn = next.spoilShown
    s.excavationStage = next.key
  }, [events])

  return (
    <>
      <ExcavationController
        ref={controller}
        rig={rig.excavation}
        progress={excavation}
        onStageChange={onStage}
      />
      {/* Mounted after the controller so a stage change and the first frame
          of its animation land together. */}
      <ExcavationEventManager
        events={events}
        dust={dust}
        shake={shake}
        input={input}
        reducedMotion={reducedMotion}
      />
      {/* Nothing but a clock. It runs after the excavation's so that, on the
          frame the dig snaps the foundation away, the foundation's own update
          sees the state it was just put into rather than the one before it. */}
      <FoundationEventManager
        events={foundationEvents}
        reducedMotion={reducedMotion}
      />
      {/* Last, so that on the frame the formwork is taken back out the pour
          has already been told and has already gone. */}
      <ConcreteEventManager
        events={concreteEvents}
        input={input}
        reducedMotion={reducedMotion}
      />
      {/* Last of the four, so that on the frame the concrete is taken back
          out the building has already been told and has already gone. */}
      <ColumnsEventManager
        events={columnEvents}
        input={input}
        reducedMotion={reducedMotion}
      />
      <SiteCamera
        stage={stage}
        input={input}
        quality={quality}
        reducedMotion={reducedMotion}
        shake={shake}
      />
      <SiteLighting quality={quality} />
      <primitive object={rig.site} />
      <primitive object={rig.survey} />
      <SceneAudio stage={stage} />
    </>
  )
}

export default SiteScene
