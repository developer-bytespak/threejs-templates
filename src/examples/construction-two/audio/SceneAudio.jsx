import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BUILD_END, BUILD_START, DRAWING_BEGIN } from '../story.js'
import { assemblyLevel, sound } from './AudioManager.js'

/**
 * The hero's audio, driven from inside the Canvas.
 *
 * This renders nothing. It lives in the scene graph for one reason: the
 * signals it needs — scroll progress after damping, and how far the building
 * has assembled — are written into a ref by the frame loop, and the only way
 * to read a ref every frame without adding a second requestAnimationFrame to
 * a page that is already running WebGL is to be inside the first one.
 *
 * So there is no new loop here. r3f calls this alongside the camera and the
 * drawing, it compares a handful of numbers, and in the overwhelming majority
 * of frames it does nothing at all.
 *
 * What it watches:
 *
 *   THE ASSEMBLY BED. Building.jsx writes how much of the building is actually
 *   standing — a sum of per-piece progress, not the scroll position — and that
 *   drives the level of one low, quiet voice underneath the pieces landing.
 *   It is what makes thirteen taps read as a structure going up instead of as
 *   thirteen taps. It clears once the building is up, so the moment of
 *   completion is the moment the room goes quiet again.
 *
 *   The pieces themselves are not handled here: they are reported by
 *   Building.jsx as they land, and voiced in RoomViewer.
 *
 *   SCROLL MARKS. Six positions through the hero. Not one per frame, not one
 *   per wheel notch: six, with a cooldown, and re-armed only after scrolling
 *   back below them. Two of the six are placed where the film changes state
 *   rather than at round numbers, so they read as punctuation.
 */

// Where the hero marks time. Chosen against the film, not spaced evenly:
// 0.408 is the pen reaching the sheet, 0.668 is the first piece of building.
const MARKS = [0.16, 0.3, DRAWING_BEGIN, 0.54, BUILD_START, 0.94]

function SceneAudio({ input, enabled = true }) {
  const armed = useRef(MARKS.map(() => true))
  const settled = useRef(false)

  useFrame(() => {
    if (!enabled) return
    const state = input.current
    const p = state.progress

    // --- the bed under the assembly
    //
    // Rises with the structure, then clears across the last fifth so the
    // building finishing is a room going quiet rather than a sound stopping.
    const density = state.buildDensity || 0
    const out = p > BUILD_END - 0.04
      ? Math.max(0, 1 - (p - (BUILD_END - 0.04)) / 0.05)
      : 1
    assemblyLevel(density * out)

    // The building is up. One quiet resolution, once, and then never again
    // until the user has gone properly back into the drawing.
    if (!settled.current && p > BUILD_END - 0.01) {
      settled.current = true
      sound('build.complete')
    } else if (settled.current && p < BUILD_START) {
      settled.current = false
    }

    // --- scroll marks
    for (let i = 0; i < MARKS.length; i += 1) {
      const at = MARKS[i]
      if (armed.current[i] && p >= at) {
        armed.current[i] = false
        sound('scroll.mark')
      } else if (!armed.current[i] && p < at - 0.025) {
        armed.current[i] = true
      }
    }
  })

  return null
}

export default SceneAudio
