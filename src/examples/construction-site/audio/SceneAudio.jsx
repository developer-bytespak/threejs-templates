import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { earthLevel, sound } from './AudioManager.js'
import { makeCounter, makeThresholds } from './useAudio.js'

/**
 * The sequence, heard.
 *
 * A null component inside the Canvas, and that placement is the whole
 * performance story: it reads the stage weights the scene has already
 * computed this frame, on the frame loop that is already running. No second
 * requestAnimationFrame, no polling, no React state, nothing allocated per
 * frame. An audio layer that costs the thing it decorates its frame rate is
 * an unusually silly way to lose frames.
 *
 * WHY IT READS STAGE WEIGHTS RATHER THAN SCROLL
 *
 * The visuals derive everything from one number and hold no animation state,
 * which is what makes reversing correct by construction. Audio follows the
 * same rule by listening to the same derived weights — `arrive`, `open`, and
 * the counts of stakes, lines and heaps the scene has actually placed. A
 * sound therefore cannot disagree with what is on screen, because it is
 * triggered by the number that put it there. A separate audio timeline would
 * be a second opinion about where the page is, and second opinions drift.
 */

/**
 * Milestones, at points where something visible has actually happened rather
 * than at arbitrary scroll percentages. `back` is where each re-arms, always
 * well below `at`, so the two never chatter against each other.
 */
const MARKS = [
  // The instrument going up.
  { key: 'arrive', at: 0.22, back: 0.08, id: 'kit.set' },

  // The footprint complete, before anything disturbs it.
  { key: 'setout', at: 0.99, back: 0.9, id: 'setout.done' },

  // The ground giving way, then the earth coming off it. The break is one
  // event; the rest is spread across the sweep so that scrolling slowly gives
  // separate falls of earth and scrolling fast gives a continuous crumble —
  // which is exactly what the picture is doing in each case.
  { key: 'open', at: 0.02, back: 0.005, id: 'ground.break' },
  { key: 'open', at: 0.10, back: 0.05, id: 'ground.work' },
  { key: 'open', at: 0.19, back: 0.13, id: 'ground.work' },
  { key: 'open', at: 0.28, back: 0.22, id: 'ground.work' },
  { key: 'open', at: 0.37, back: 0.31, id: 'ground.work' },
  { key: 'open', at: 0.46, back: 0.40, id: 'ground.work' },
  { key: 'open', at: 0.55, back: 0.49, id: 'ground.work' },
  { key: 'open', at: 0.64, back: 0.58, id: 'ground.work' },
  { key: 'open', at: 0.73, back: 0.67, id: 'ground.work' },
  { key: 'open', at: 0.82, back: 0.76, id: 'ground.work' },
  { key: 'open', at: 0.91, back: 0.85, id: 'ground.work' },

  // Spoil landing. Keyed to how much earth is actually on the heaps, so it
  // runs underneath the ground coming away rather than beside it — the same
  // event, heard from the other end.
  { key: 'spoil', at: 0.08, back: 0.03, id: 'spoil.fall' },
  { key: 'spoil', at: 0.20, back: 0.14, id: 'spoil.fall' },
  { key: 'spoil', at: 0.32, back: 0.26, id: 'spoil.fall' },
  { key: 'spoil', at: 0.44, back: 0.38, id: 'spoil.fall' },
  { key: 'spoil', at: 0.56, back: 0.50, id: 'spoil.fall' },
  { key: 'spoil', at: 0.68, back: 0.62, id: 'spoil.fall' },
  { key: 'spoil', at: 0.80, back: 0.74, id: 'spoil.fall' },
  { key: 'spoil', at: 0.92, back: 0.86, id: 'spoil.fall' },

  // The end of the page.
  { key: 'progress', at: 0.985, back: 0.94, id: 'site.settle' },
]

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

/**
 * How fast something is changing, smoothed. The bed's whole idea.
 *
 * Earth sounds while it is *moving*, and "not moving" includes both ends —
 * before the cut starts and after it is finished. So the level is the
 * derivative of how much ground has gone, not the amount itself and not a
 * floor under it. Three behaviours fall out for free, which is how you know
 * it is the right quantity rather than a clever one: stop scrolling mid-cut
 * and the site goes quiet even with a half-open hole on screen; scroll faster
 * and more earth is moving per second, so it gets louder; scroll backwards
 * and it sounds again, because filling a hole in is also earth moving.
 */
function activity(store, value, step) {
  const previous = store.value
  store.value = value
  if (previous === undefined || step <= 0) return store.smoothed
  const delta = Math.abs(value - previous) / step
  store.smoothed += (delta - store.smoothed) * Math.min(1, step * 6)
  return store.smoothed
}

function SceneAudio({ stage }) {
  // One checker per weight, built once. Grouping by key means each frame does
  // a handful of numeric comparisons over a fixed array and touches nothing
  // else.
  const checks = useMemo(() => {
    const byKey = new Map()
    for (const mark of MARKS) {
      if (!byKey.has(mark.key)) byKey.set(mark.key, [])
      byKey.get(mark.key).push(mark)
    }
    return [...byKey.entries()].map(([key, marks]) => ({
      key,
      check: makeThresholds(marks),
    }))
  }, [])

  const stakes = useMemo(() => makeCounter(() => sound('stake.drive')), [])
  const lines = useMemo(() => makeCounter(() => sound('line.pull')), [])

  const cut = useRef({ value: undefined, smoothed: 0 })
  const bed = useRef(-1)

  useFrame((state, delta) => {
    const s = stage.current
    if (!s) return
    const step = Math.min(delta, 0.1)

    for (let i = 0; i < checks.length; i += 1) {
      const value = s[checks[i].key]
      if (typeof value === 'number') checks[i].check(value)
    }

    stakes(s.stakesIn)
    lines(s.linesIn)

    // The bed under all of it. Scaled up because `open` covers seventy metres
    // of ground in one weight, so the same scroll speed has to mean roughly
    // the same effort.
    const level = clamp01(activity(cut.current, s.open, step) * 2.4)
    if (Math.abs(level - bed.current) > 0.015) {
      bed.current = level
      earthLevel(level)
    }
  })

  return null
}

export default SceneAudio
