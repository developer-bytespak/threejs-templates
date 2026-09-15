/**
 * Policy tests for the /construction-two audio layer.
 *
 *   node tools/test_audio_policy.mjs
 *
 * These cover the rules that are invisible when they work and embarrassing
 * when they do not: never sounding before a gesture, never repeating faster
 * than its cooldown, going properly quiet on mute and on reduced motion, and
 * leaving nothing attached on teardown.
 *
 * A real OfflineAudioContext from node-web-audio-api stands in for the
 * browser's, wrapped in just enough of a shim to have the `state` and
 * `resume()` an unlock depends on — so the voices genuinely render rather
 * than being mocked away.
 *
 * Needs: npm i --no-save node-web-audio-api
 */
import { OfflineAudioContext } from 'node-web-audio-api'

/* ---------------------------------------------------------------- harness */
const listeners = new Map()
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
}
globalThis.addEventListener = (type, fn) => {
  if (!listeners.has(type)) listeners.set(type, new Set())
  listeners.get(type).add(fn)
}
globalThis.removeEventListener = (type, fn) => listeners.get(type)?.delete(fn)
globalThis.fetch = async () => ({ ok: false })

// Whatever the manager decides to listen for — asserting the exact list here
// just means editing two files every time it changes.
const GESTURE_TYPES = [
  'pointerdown', 'mousedown', 'touchstart', 'touchend',
  'keydown', 'keyup', 'wheel', 'scroll',
]
const gestureCount = () =>
  GESTURE_TYPES.reduce((n, t) => n + (listeners.get(t)?.size ?? 0), 0)

async function gesture() {
  const fns = [...(listeners.get('pointerdown') ?? [])]
  for (const fn of fns) fn()
  await new Promise((r) => setTimeout(r, 20))    // let resume() settle
}

/* ------------------------------------------------------------------ tests */
let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  if (ok) { pass += 1; console.log(`  ok    ${name}`) }
  else { fail += 1; console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`) }
}

const mod = await import('../src/examples/construction-two/audio/AudioManager.js')
const { initAudio, sound, setEnabled, audioState, teardownAudio } = mod

/**
 * A clean page load with sound off, which is how every real visit starts.
 * `toggleEnabled` toggles — so without resetting the stored preference first,
 * a block that means "turn it on" can just as easily turn it off, depending on
 * what the block before it left behind.
 */
async function freshStart() {
  teardownAudio()
  globalThis.localStorage.setItem('bytes:sound', 'off')
  initAudio()
  mod.toggleEnabled()
  await new Promise((r) => setTimeout(r, 20))
}

console.log('\nautoplay policy')
initAudio()
check('starts muted — nothing plays unasked', audioState().enabled === false)
check('no AudioContext is constructed on load', audioState().unlocked === false)
check('nothing is listening for stray gestures', gestureCount() === 0)
check('sound() is silent before the button is pressed', sound('ui.click') === false)
check('  ...and stays silent however many times it is asked',
  [...Array(20)].every(() => sound('build.structure') === false))

console.log('\nthe button')
mod.toggleEnabled()
await new Promise((r) => setTimeout(r, 20))
check('pressing it starts the context', audioState().unlocked === true)
check('  ...and reports itself on', audioState().enabled === true)
// The confirmation click is fired from inside the resume() callback, so it
// lands after unlock rather than being dropped for firing too early. Proof:
// the id is on cooldown the instant the press returns.
check('  ...and the press confirms itself audibly', sound('ui.click') === false)
now += 5000
check('sound plays once it is on', sound('ui.click') === true)

console.log('\ncooldowns — the rapid-scroll case')
now = 1000
check('first call plays', sound('scroll.mark') === true)
let blocked = 0
for (let i = 0; i < 60; i += 1) { now += 5; if (!sound('scroll.mark')) blocked += 1 }
check('300ms of frames after it are all suppressed', blocked === 60, `${blocked}/60`)
now += 500
check('it plays again once the 450ms cooldown has passed', sound('scroll.mark') === true)

// Rather than asserting a number that changes every time a level is tuned,
// assert the contract: each id lets through about one play per cooldown, and
// no more, however hard it is hammered.
const { __mix } = mod
for (const id of ['scroll.mark', 'work.change', 'ui.click', 'piece.structure']) {
  const cooldown = __mix.SOUNDS[id].cooldown
  now += 10000
  let played = 0
  const span = 2000
  const start = now
  while (now < start + span) { now += 4; if (sound(id)) played += 1 }
  const expected = Math.ceil(span / Math.max(cooldown, 4))
  check(
    `${id} honours its ${cooldown}ms cooldown under 2s of hammering`,
    played <= expected + 1 && played >= expected - 1,
    `${played} plays, expected ~${expected}`,
  )
}

console.log('\nmute')
setEnabled(true)
setEnabled(false)
check('nothing plays while muted',
  [...Array(10)].every(() => { now += 500; return sound('ui.click') === false }))
check('state reports muted', audioState().enabled === false)
setEnabled(true)
now += 500
check('plays again when unmuted', sound('ui.click') === true)
check('preference persisted', globalThis.localStorage.getItem('bytes:sound') === 'on')

console.log('\nthe preference survives a reload')
check('pressing again mutes', mod.toggleEnabled() === false)
check('  ...and that is what is stored', globalThis.localStorage.getItem('bytes:sound') === 'off')
teardownAudio()
initAudio()
check('a reload comes back muted', audioState().enabled === false)
mod.toggleEnabled()
await new Promise((r) => setTimeout(r, 20))
check('  ...and on again after one press', audioState().enabled === true)

console.log('\na reload with sound already on')
// The regression that shipped: 'on' was saved, so the control reported itself
// on, while the page was silent because no gesture had unlocked anything yet.
teardownAudio()
globalThis.localStorage.setItem('bytes:sound', 'on')
initAudio()
check('the preference survives', audioState().enabled === true)
check('  ...but nothing is unlocked', audioState().unlocked === false)
check('  ...so nothing is audible', mod.isAudible() === false)
now += 5000
check('  ...and sound() still refuses', sound('ui.click') === false)
check('one press starts it rather than muting it', mod.toggleEnabled() === true)
await new Promise((r) => setTimeout(r, 20))
check('  ...now it is audible', mod.isAudible() === true)
check('  ...and the preference is untouched',
  globalThis.localStorage.getItem('bytes:sound') === 'on')
now += 5000
check('  ...and sound plays', sound('ui.click') === true)
check('a second press mutes, as normal', mod.toggleEnabled() === false)
check('  ...and that is stored', globalThis.localStorage.getItem('bytes:sound') === 'off')

console.log('\nreduced motion')
globalThis.__media = { '(prefers-reduced-motion: reduce)': true }
await freshStart()
now += 2000
check('decorative sound is dropped', sound('build.structure') === false)
check('a deliberate press still responds', sound('ui.click') === true)

console.log('\ncoarse pointer (touch)')
globalThis.__media = { '(hover: none)': true }
await freshStart()
now += 2000
check('hover sounds are dropped', sound('stat.hover') === false)
check('transitions still play', sound('work.change') === true)

console.log('\nteardown')
teardownAudio()
check('silent again after teardown', sound('ui.click') === false)

console.log('\nno AudioContext at all (an old or locked-down browser)')
delete globalThis.AudioContext
globalThis.__media = {}
globalThis.localStorage.setItem('bytes:sound', 'off')
initAudio()
mod.toggleEnabled()
check('marks itself failed instead of throwing', audioState().failed === true)
check('every call is a silent no-op', sound('ui.click') === false)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
