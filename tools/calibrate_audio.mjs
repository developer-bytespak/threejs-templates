/**
 * Measure every sound on /construction-two and write the calibration table.
 *
 *   node tools/calibrate_audio.mjs
 *
 * WHY THIS EXISTS
 *
 * The mix table in AudioManager.js states each sound's target peak in dBFS at
 * the speaker. For that number to be true rather than aspirational, something
 * has to know how loud each voice actually is — and a voice's loudness depends
 * on the options it is called with, not just which voice it is. A click at
 * weight 0.55 carries an extra partial and lands 8 dB above the same click at
 * weight 0.1. Normalising per voice leaves that error in; normalising per
 * sound id removes it.
 *
 * So this renders every id offline through the real graph — same buses, same
 * master, same compressor — measures the peak over several runs (the voices
 * randomise themselves, so one run is not an answer), and writes the
 * correction factors to audio/calibration.js.
 *
 * Re-run it whenever a voice's synthesis changes or a target moves. It is
 * deterministic to within the voices' own jitter, and it reports the residual
 * error so you can see whether it converged.
 *
 * Needs: npm i --no-save node-web-audio-api
 */
import { writeFileSync } from 'node:fs'
import { OfflineAudioContext } from 'node-web-audio-api'
import { VOICES } from '../src/examples/construction-two/audio/voices.js'
import { __mix, createChain } from '../src/examples/construction-two/audio/AudioManager.js'

const { SOUNDS, BUS_LEVELS, MASTER, AMBIENCE_PEAK, ASSEMBLY_PEAK, dbToGain } = __mix
const SR = 48000
const RUNS = 10
const db = (v) => 20 * Math.log10(v || 1e-9)

// The real graph, imported rather than re-created — see createChain's note.
const graph = (ctx) => createChain(ctx).buses

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
    const ctx = new OfflineAudioContext(1, SR * 3, SR)
    const buses = graph(ctx)
    const rate = 1 + (Math.random() * 2 - 1) * (spec.vary || 0)
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

async function measureAmbience(trim) {
  const runs = []
  for (let r = 0; r < 3; r += 1) {
    const ctx = new OfflineAudioContext(1, SR * 8, SR)
    const buses = graph(ctx)
    VOICES.roomTone(ctx, buses.ambience, 0, {
      gain: (dbToGain(AMBIENCE_PEAK) / (BUS_LEVELS.ambience * MASTER)) * trim,
    })
    runs.push(peakOf(await ctx.startRendering()))
  }
  return median(runs)
}

/**
 * The assembly bed, held at full density. Measured over the settled part of
 * the render only — its level ramps in over a 0.25s time constant, so the
 * first second is not representative of anything.
 */
async function measureAssembly(trim) {
  const runs = []
  for (let r = 0; r < 3; r += 1) {
    const ctx = new OfflineAudioContext(1, SR * 6, SR)
    const buses = graph(ctx)
    const bed = VOICES.assembly(ctx, buses.construction, 0, {
      gain: (dbToGain(ASSEMBLY_PEAK) / (BUS_LEVELS.construction * MASTER)) * trim,
    })
    bed.level(1, 0)
    const d = (await ctx.startRendering()).getChannelData(0)
    let p = 0
    for (let i = SR * 2; i < d.length; i += 1) p = Math.max(p, Math.abs(d[i]))
    runs.push(p)
  }
  return median(runs)
}

const ids = Object.keys(SOUNDS)
const trims = Object.fromEntries(ids.map((id) => [id, 1]))
let ambienceTrim = 1
let assemblyTrim = 1

// Two passes. The voices are linear in gain so one would do, but a second
// pass costs a few seconds and proves it converged rather than assuming so.
for (let pass = 1; pass <= 2; pass += 1) {
  for (const id of ids) {
    const peak = await measure(id, trims[id])
    trims[id] *= dbToGain(SOUNDS[id].peak) / peak
  }
  const a = await measureAmbience(ambienceTrim)
  ambienceTrim *= dbToGain(AMBIENCE_PEAK) / a
  const b = await measureAssembly(assemblyTrim)
  assemblyTrim *= dbToGain(ASSEMBLY_PEAK) / b
  process.stdout.write(`pass ${pass} done\n`)
}

// Report the residual.
console.log('\nid                    target   measured   err')
let worst = 0
for (const id of ids) {
  const peak = await measure(id, trims[id])
  const err = db(peak) - SOUNDS[id].peak
  worst = Math.max(worst, Math.abs(err))
  console.log(
    `${id.padEnd(20)} ${String(SOUNDS[id].peak).padStart(6)}  ` +
    `${db(peak).toFixed(1).padStart(8)}  ${err >= 0 ? '+' : ''}${err.toFixed(1)}`,
  )
}
const ambPeak = await measureAmbience(ambienceTrim)
console.log(`${'(ambience)'.padEnd(20)} ${String(AMBIENCE_PEAK).padStart(6)}  ` +
            `${db(ambPeak).toFixed(1).padStart(8)}  ${(db(ambPeak) - AMBIENCE_PEAK).toFixed(1)}`)
const asmPeak = await measureAssembly(assemblyTrim)
console.log(`${'(assembly bed)'.padEnd(20)} ${String(ASSEMBLY_PEAK).padStart(6)}  ` +
            `${db(asmPeak).toFixed(1).padStart(8)}  ${(db(asmPeak) - ASSEMBLY_PEAK).toFixed(1)}`)
console.log(`\nworst residual: ${worst.toFixed(1)} dB (voice jitter alone is ~1-2 dB)`)

const body = `/**
 * GENERATED — do not edit by hand.
 *
 *   node tools/calibrate_audio.mjs
 *
 * Per-sound gain corrections that make the \`peak\` figures in AudioManager's
 * mix table true at the speaker. Each one was measured by rendering that sound
 * offline through the real bus/master/compressor graph ${RUNS} times and taking the
 * median peak, because the voices randomise themselves and a single render is
 * not an answer.
 *
 * Regenerate after changing any voice's synthesis or any target level.
 */
export const CALIBRATION = {
${ids.map((id) => `  '${id}': ${trims[id].toFixed(4)},`).join('\n')}
}

export const AMBIENCE_TRIM = ${ambienceTrim.toFixed(4)}

export const ASSEMBLY_TRIM = ${assemblyTrim.toFixed(4)}
`
writeFileSync(
  new URL('../src/examples/construction-two/audio/calibration.js', import.meta.url),
  body,
)
console.log('\nwrote src/examples/construction-two/audio/calibration.js')
