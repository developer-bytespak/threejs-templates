/**
 * Measure every sound on /education and write its calibration table.
 *
 *   node tools/calibrate_education_audio.mjs
 *
 * The same idea as calibrate_audio.mjs, against the education palette. The mix
 * table states each sound's target peak in dBFS at the speaker; for that to be
 * true rather than aspirational, something has to know how loud each voice
 * actually is with the options it is called with. A tone at step -5 and the
 * same tone at step 12 are not the same loudness, and normalising per voice
 * would leave that error in.
 *
 * Renders each id offline through the real graph — same buses, same master,
 * same compressor, imported rather than re-created — takes the median of
 * several runs because the voices randomise themselves, and writes the
 * corrections. Re-run after changing a voice or a target.
 *
 * Needs: npm i --no-save node-web-audio-api
 */
import { writeFileSync } from 'node:fs'
import { OfflineAudioContext } from 'node-web-audio-api'
import { VOICES } from '../src/examples/education/audio/voices.js'
import { __mix, createChain } from '../src/examples/education/audio/AudioManager.js'

const {
  SOUNDS, BUS_LEVELS, MASTER, dbToGain,
  AMBIENCE_PEAK, DISTANT_PEAK, GROWTH_PEAK, WOOD_PEAK, LEAF_PEAK, CAMPUS_PEAK, AIR_PEAK,
} = __mix
const SR = 48000
const RUNS = 10
const db = (v) => 20 * Math.log10(v || 1e-9)

const graph = (ctx) => createChain(ctx, MASTER, BUS_LEVELS).buses

const peakOf = (buf) => {
  const d = buf.getChannelData(0)
  let p = 0
  for (let i = 0; i < d.length; i += 1) p = Math.max(p, Math.abs(d[i]))
  return p
}

/** Median, not mean: one unlucky noise burst should not move the table. */
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

async function measure(id, trim) {
  const spec = SOUNDS[id]
  const runs = []
  for (let r = 0; r < RUNS; r += 1) {
    const ctx = new OfflineAudioContext(1, SR * 4, SR)
    const buses = graph(ctx)
    const rate = (spec.rate ?? 1) * (1 + (Math.random() * 2 - 1) * (spec.vary || 0))
    const gain = dbToGain(spec.peak) / (BUS_LEVELS[spec.bus] * MASTER)
    VOICES[spec.voice](ctx, buses[spec.bus], 0.05, {
      ...spec,
      rate,
      gain: gain * trim,
    })
    runs.push(peakOf(await ctx.startRendering()))
  }
  return median(runs)
}

/**
 * The sustained layers, held at full level and measured over the settled part
 * of the render only — they ramp in over time constants of up to a second, so
 * the first seconds are not representative of anything.
 */
async function measureBed(voice, bus, peak, trim, levelled) {
  const runs = []
  for (let r = 0; r < 3; r += 1) {
    const ctx = new OfflineAudioContext(1, SR * 10, SR)
    const buses = graph(ctx)
    const handle = VOICES[voice](ctx, buses[bus], 0, {
      gain: (dbToGain(peak) / (BUS_LEVELS[bus] * MASTER)) * trim,
    })
    if (levelled && handle && handle.level) handle.level(1)
    const d = (await ctx.startRendering()).getChannelData(0)
    let p = 0
    for (let i = SR * 5; i < d.length; i += 1) p = Math.max(p, Math.abs(d[i]))
    runs.push(p)
  }
  return median(runs)
}

const ids = Object.keys(SOUNDS)
const trims = Object.fromEntries(ids.map((id) => [id, 1]))
const beds = { AMBIENCE: 1, DISTANT: 1, GROWTH: 1, WOOD: 1, LEAF: 1, CAMPUS: 1, AIR: 1 }
const BED_SPEC = {
  AMBIENCE: ['quietSpace', 'ambience', AMBIENCE_PEAK, false],
  DISTANT: ['distantPlace', 'ambience', DISTANT_PEAK, true],
  GROWTH: ['growthBed', 'organic', GROWTH_PEAK, true],
  WOOD: ['woodForm', 'organic', WOOD_PEAK, true],
  LEAF: ['leafForm', 'organic', LEAF_PEAK, true],
  CAMPUS: ['campusForm', 'transitions', CAMPUS_PEAK, true],
  AIR: ['airMove', 'transitions', AIR_PEAK, true],
}

// Two passes. The voices are linear in gain so one would do, but a second pass
// costs seconds and proves it converged rather than assuming so.
for (let pass = 1; pass <= 2; pass += 1) {
  for (const id of ids) {
    const peak = await measure(id, trims[id])
    trims[id] *= dbToGain(SOUNDS[id].peak) / peak
  }
  for (const [name, [voice, bus, peak, levelled]] of Object.entries(BED_SPEC)) {
    const measured = await measureBed(voice, bus, peak, beds[name], levelled)
    beds[name] *= dbToGain(peak) / measured
  }
  process.stdout.write(`pass ${pass} done\n`)
}

console.log('\nid                    target   measured   err')
let worst = 0
for (const id of ids) {
  const peak = await measure(id, trims[id])
  const err = db(peak) - SOUNDS[id].peak
  worst = Math.max(worst, Math.abs(err))
  console.log(
    `${id.padEnd(20)} ${String(SOUNDS[id].peak).padStart(6)}  ${db(peak).toFixed(1).padStart(8)}  ${err >= 0 ? '+' : ''}${err.toFixed(1)}`,
  )
}
for (const [name, [voice, bus, peak, levelled]] of Object.entries(BED_SPEC)) {
  const measured = await measureBed(voice, bus, peak, beds[name], levelled)
  console.log(`${(name.toLowerCase() + ' bed').padEnd(20)} ${String(peak).padStart(6)}  ${db(measured).toFixed(1).padStart(8)}`)
}
console.log(`\nworst residual: ${worst.toFixed(2)} dB`)

const body = `/* GENERATED by tools/calibrate_education_audio.mjs — do not edit by hand.
 *
 * Per-sound corrections that make the dBFS targets in AudioManager.js true.
 * Measured through the real graph; see the tool for why this is per sound id
 * rather than per voice. Worst residual at generation: ${worst.toFixed(2)} dB.
 */
export const CALIBRATION = {
${ids.map((id) => `  '${id}': ${trims[id].toFixed(4)},`).join('\n')}
}

export const AMBIENCE_TRIM = ${beds.AMBIENCE.toFixed(4)}
export const DISTANT_TRIM = ${beds.DISTANT.toFixed(4)}
export const GROWTH_TRIM = ${beds.GROWTH.toFixed(4)}
export const WOOD_TRIM = ${beds.WOOD.toFixed(4)}
export const LEAF_TRIM = ${beds.LEAF.toFixed(4)}
export const CAMPUS_TRIM = ${beds.CAMPUS.toFixed(4)}
export const AIR_TRIM = ${beds.AIR.toFixed(4)}
`
writeFileSync(new URL('../src/examples/education/audio/calibration.js', import.meta.url), body)
console.log('\nwrote src/examples/education/audio/calibration.js')
