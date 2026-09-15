/**
 * Policy tests for the /education audio layer.
 *
 *   node tools/test_education_audio.mjs
 *
 * These cover the rules that are invisible when they work and embarrassing
 * when they do not: never sounding before a gesture, never repeating faster
 * than its cooldown, never firing again when the reader scrolls back over a
 * boundary, going quiet on mute and on reduced motion, and leaving nothing
 * running on teardown. Plus the two that only matter on this route: that a
 * scrollbar thrown from one end to the other does not play the whole journey,
 * and that the preference is the same answer /construction-two stored.
 *
 * A real OfflineAudioContext stands in for the browser's, wrapped in enough of
 * a shim to have the `state` and `resume()` an unlock depends on — so the
 * voices genuinely render rather than being mocked away.
 *
 * Needs: npm i --no-save node-web-audio-api
 */
import { OfflineAudioContext } from 'node-web-audio-api'

/* ---------------------------------------------------------------- harness */
let now = 0

class TestContext extends OfflineAudioContext {
  constructor() {
    super(1, 48000 * 30, 48000)
    this._state = 'suspended'
  }
  get state() { return this._state }
  async resume() { this._state = 'running' }
  async close() { this._state = 'closed' }
}

globalThis.AudioContext = TestContext
globalThis.performance = { now: () => now }
globalThis.matchMedia = (q) => ({
  matches: globalThis.__media?.[q] ?? false,
  addEventListener() {}, removeEventListener() {},
})
globalThis.localStorage = {
  _v: {},
  getItem(k) { return this._v[k] ?? null },
  setItem(k, v) { this._v[k] = v },
  removeItem(k) { delete this._v[k] },
}
globalThis.addEventListener = () => {}
globalThis.removeEventListener = () => {}
globalThis.fetch = async () => ({ ok: false })

let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  if (ok) { pass += 1; console.log(`  ok    ${name}`) }
  else { fail += 1; console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`) }
}

const mod = await import('../src/examples/education/audio/AudioManager.js')
const { initAudio, sound, setEnabled, audioState, teardownAudio } = mod
const { makeThresholds } = await import('../src/examples/education/audio/useAudio.js')

async function freshStart() {
  teardownAudio()
  globalThis.localStorage._v = {}
  globalThis.localStorage.setItem('bytes:sound', 'off')
  initAudio()
  mod.toggleEnabled()
  await new Promise((r) => setTimeout(r, 20))
}

/* ------------------------------------------------------------------ tests */
console.log('\nautoplay policy')
globalThis.localStorage._v = {}
initAudio()
check('starts muted — nothing plays unasked', audioState().enabled === false)
check('no AudioContext is constructed on load', audioState().unlocked === false)
check('sound() is silent before the control is pressed', sound('seed.open') === false)
check('  ...and stays silent however many times it is asked',
  [...Array(20)].every(() => sound('reveal.campus') === false))

console.log('\nthe control')
mod.toggleEnabled()
await new Promise((r) => setTimeout(r, 20))
check('pressing it starts the context', audioState().unlocked === true)
check('  ...and reports itself on', audioState().enabled === true)
check('  ...and the press confirms itself audibly', sound('ui.click') === false)
now += 5000
check('sound plays once it is on', sound('seed.open') === true)

console.log('\none preference for the whole site')
teardownAudio()
globalThis.localStorage._v = {}
globalThis.localStorage.setItem('c2:sound', 'on')
initAudio()
check('an answer given on /construction-two carries over', audioState().enabled === true)
check('  ...and is migrated to the shared key',
  globalThis.localStorage.getItem('bytes:sound') === 'on')
check('  ...but nothing is audible until a gesture', mod.isAudible() === false)
check('one press starts it rather than muting it', mod.toggleEnabled() === true)
await new Promise((r) => setTimeout(r, 20))
check('  ...now it is audible', mod.isAudible() === true)
check('  ...and the preference is untouched',
  globalThis.localStorage.getItem('bytes:sound') === 'on')

console.log('\ncooldowns — the fast-scroll case')
await freshStart()
now = 1000
check('first call plays', sound('grow.roots') === true)
let blocked = 0
for (let i = 0; i < 60; i += 1) { now += 5; if (!sound('grow.roots')) blocked += 1 }
check('300ms of frames after it are all suppressed', blocked === 60, `${blocked}/60`)
now += 1400
check('it plays again once the 1200ms cooldown has passed', sound('grow.roots') === true)

const { __mix } = mod
for (const id of ['museum.stop', 'reveal.campus', 'ui.click', 'artifact.paper']) {
  const cooldown = __mix.SOUNDS[id].cooldown
  now += 20000
  let played = 0
  const span = 4000
  const start = now
  while (now < start + span) { now += 4; if (sound(id)) played += 1 }
  const expected = Math.ceil(span / Math.max(cooldown, 4))
  check(
    `${id} honours its ${cooldown}ms cooldown under 4s of hammering`,
    played <= expected + 1 && played >= expected - 1,
    `${played} plays, expected ~${expected}`,
  )
}

console.log('\nthresholds — forwards, backwards and on the spot')
{
  // The checker emits through an injected function, so a test can count
  // crossings exactly rather than inferring them from whether audio happened.
  const log = []
  const emit = (id) => log.push(id)

  const climb = makeThresholds(
    [
      { at: 0.3, back: 0.15, id: 'grow.roots' },
      { at: 0.8, back: 0.6, id: 'prop.tung' },
    ],
    emit,
  )

  for (const v of [0, 0.1, 0.2, 0.31, 0.5, 0.7, 0.81, 0.95]) climb(v)
  check('rising through two marks fires each once',
    log.join() === 'grow.roots,prop.tung', log.join() || '(nothing)')

  const afterClimb = log.length
  for (const v of [0.9, 0.7, 0.5, 0.3, 0.1, 0.0]) climb(v)
  check('scrolling all the way back down fires nothing',
    log.length === afterClimb, `${log.length - afterClimb} extra`)

  for (const v of [0.31, 0.81]) climb(v)
  check('  ...and the marks are re-armed for a second pass',
    log.length === afterClimb + 2, `${log.length - afterClimb} fired`)

  // Jiggling on a boundary. The hysteresis gap is the whole defence: without
  // it this is forty sounds.
  const jiggle = []
  const spot = makeThresholds([{ at: 0.5, back: 0.3, id: 'grow.roots' }], (id) =>
    jiggle.push(id),
  )
  for (let i = 0; i < 40; i += 1) spot(0.5 + (i % 2 ? 0.01 : -0.01))
  check('parking on a boundary and jiggling fires once, not forty times',
    jiggle.length === 1, `${jiggle.length} fired`)

  // The same value arriving every frame, which is what a still scrollbar does.
  const held = []
  const hold = makeThresholds([{ at: 0.5, back: 0.3, id: 'grow.roots' }], (id) =>
    held.push(id),
  )
  for (let i = 0; i < 120; i += 1) hold(0.9)
  check('holding past a mark for 120 frames fires once',
    held.length === 1, `${held.length} fired`)
}

console.log('\na scrollbar thrown from one end to the other')
{
  await freshStart()
  now += 20000
  const log = []
  const marks = Object.keys(__mix.SOUNDS)
    .filter((id) => id.startsWith('grow.') || id.startsWith('reveal.') || id.startsWith('museum.'))
    .map((id, i) => ({ at: 0.05 * i, back: 0.05 * i - 0.02, id }))
  const jump = makeThresholds(marks, (id) => {
    log.push(id)
    sound(id)
  })

  // One frame. Every mark is crossed at once, exactly as a fling does.
  jump(1)
  check('every crossed mark is seen', log.length === marks.length,
    `${log.length}/${marks.length}`)

  // But two ids in that set are the same sound at different rates, and the
  // cooldown collapses the duplicate — which is the behaviour that matters:
  // the sweep cannot become a burst of one sound repeated.
  const unique = new Set(log)
  check('  ...and no id is asked for twice in the sweep',
    unique.size === log.length, `${log.length - unique.size} duplicated`)

  // Re-flinging immediately plays nothing: the marks are all spent and the
  // cooldowns have not elapsed.
  const before = log.length
  now += 4
  jump(1)
  check('flinging again immediately adds nothing', log.length === before,
    `${log.length - before} extra`)
}

console.log('\nmute')
await freshStart()
setEnabled(false)
check('nothing plays while muted',
  [...Array(10)].every(() => { now += 5000; return sound('reveal.campus') === false }))
check('state reports muted', audioState().enabled === false)
setEnabled(true)
now += 5000
check('plays again when unmuted', sound('reveal.campus') === true)

console.log('\nsustained beds')
await freshStart()
check('a bed can be levelled without throwing', (() => {
  try { mod.growthLevel(0.5); mod.distantLevel(0.3); mod.growthLevel(0); return true }
  catch { return false }
})())
setEnabled(false)
check('and levelling a bed while muted is a no-op', (() => {
  try { mod.growthLevel(1); return true } catch { return false }
})())

console.log('\nreduced motion')
globalThis.__media = { '(prefers-reduced-motion: reduce)': true }
await freshStart()
now += 20000
check('decorative sound is dropped', sound('reveal.campus') === false)
check('a deliberate press still responds', sound('ui.click') === true)
globalThis.__media = {}

console.log('\ncoarse pointer (touch)')
globalThis.__media = { '(hover: none)': true }
await freshStart()
now += 20000
check('hover sounds are dropped', sound('artifact.paper') === false)
check('  ...including the discipline textures', sound('disc.science') === false)
check('the journey still sounds', sound('reveal.campus') === true)
globalThis.__media = {}

console.log('\nteardown')
await freshStart()
teardownAudio()
now += 20000
check('silent again after teardown', sound('ui.click') === false)

console.log('\nno AudioContext at all (an old or locked-down browser)')
{
  teardownAudio()
  const saved = globalThis.AudioContext
  globalThis.AudioContext = undefined
  globalThis.localStorage._v = {}
  initAudio()
  mod.toggleEnabled()
  await new Promise((r) => setTimeout(r, 20))
  check('marks itself failed instead of throwing', audioState().failed === true)
  check('every call is a silent no-op', sound('ui.click') === false)
  globalThis.AudioContext = saved
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
