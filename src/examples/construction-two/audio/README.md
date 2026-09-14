# Sound

Fourteen synthesised voices, thirty-six named moments, one AudioContext —
and one button that is the only thing that ever starts it.

## Nothing plays until the button is pressed

There is no clever unlock. The page loads silent, constructs no AudioContext,
and attaches no listeners waiting for a stray gesture. The SOUND control in the
navbar (`SoundButton.jsx`) is the whole unlock story:

```
press  ->  toggleEnabled()  ->  setEnabled(true)  ->  start()  ->  ctx.resume()
                                                          |
                                             unlocked, ambience, ui.click
```

Two things this shape buys, both of them learned the hard way:

- **`wheel` is not an activation-triggering event.** An earlier version tried to
  unlock on first scroll and stayed mute no matter how hard you scrolled, while
  a middle-click (which *is* a `pointerdown`) unlocked it instantly. Guessing at
  the gesture list is a losing game; a button is unambiguous.
- **`resume()` is async.** The confirmation click has to be fired from inside
  the `resume()` callback — `start(after)` takes it as an argument. Firing it on
  the line after `start()` drops it, because `unlocked` is still false, and the
  press then feels like it did nothing (room tone alone is −40 dBFS, which a
  laptop speaker will not sell as "something happened").

The preference is stored in `localStorage` under `c2:sound` and **defaults to
off**, so a returning visitor who never asked for sound never gets it.

## The mental model

Sections do not make sounds. They name moments:

```js
sound('work.change')
```

What that moment *is* — which voice, how loud, on which bus, how often it may
repeat — lives in one table in `AudioManager.js`. The whole mix can be read
top to bottom in that table, and changed without opening a component.

## Why there are no audio files

Every sound is made from noise and filters at the moment it plays. A technical
click is a 20 ms noise burst through a narrow bandpass; graphite on paper is
noise with a grain envelope; a tap on concrete is a transient plus two decaying
resonances. Those are what the recordings would be anyway, and synthesising
them means:

- **no repetition** — every play differs by construction, which is what the
  "use two or three variations of each click" instruction is really asking for
- **no weight** — a few KB of code rather than megabytes, on a page already
  carrying a GLB and Three.js
- **no licence** — nothing to attribute or re-clear

If you want real recordings instead, add
`public/assets/construction-two/audio/manifest.json` mapping sound ids to
files. Any id listed there plays the file; everything else stays synthesised.
One id can be replaced without touching code.

## Loudness is measured, not guessed

Each entry in the mix table states its target peak **in dBFS at the speaker**,
after bus and master:

```js
'ui.click':   { voice: 'click', bus: 'interaction', peak: -20, cooldown: 150 },
'ui.hover':   { voice: 'click', bus: 'interaction', peak: -32, cooldown: 180 },
```

You can read down that column and see that a hover sits 12 dB under a click and
a click 5 dB under a structural hit. A bare `gain: 0.05` tells you none of
that, which is how sound design ends up either inaudible or shouting.

`calibration.js` is what makes those numbers true. It is generated:

```
npm i --no-save node-web-audio-api
node tools/calibrate_audio.mjs
```

That renders every sound offline through the real bus/master/compressor graph
ten times, takes the median peak, and writes the correction needed to hit its
target. Everything currently lands within about 1 dB, which is inside the
voices' own jitter. **Re-run it after changing any voice or any target.**

Nothing goes above −15 dBFS, and the whole palette on one frame is held under
0 dBFS by a compressor plus a `tanh` soft-clip in `createChain()`. For scale, a
normalised UI click sample at full gain peaks around −8.

**These targets are pitched for laptop speakers.** An early pass measured
correctly and was still inaudible, because 70–100% of each voice's energy sat
below 250 Hz, where a laptop speaker radiates almost nothing. Every voice now
puts its identifying content between roughly 300 Hz and 3 kHz. If you add a
voice, check it through a highpass before trusting the meter.

## Tests

```
node tools/test_audio_policy.mjs
```

Covers the rules that are invisible when they work: nothing before the button
is pressed, no listeners waiting to be surprised into unlocking, the press
confirming itself audibly, nothing faster than its cooldown, silence on mute
and on reduced motion, no hover sounds on touch, the preference surviving a
reload, and nothing left attached after teardown.

## Files

| | |
|---|---|
| `voices.js` | The fourteen synthesised voices. No policy, no state. |
| `AudioManager.js` | The context, the buses, the mix table, the button's `start`/`toggleEnabled`, cooldowns, mute. |
| `calibration.js` | Generated. Do not edit. |
| `useAudio.js` | React hooks, and the one delegated listener behind every hover and click sound on the page. |
| `SceneAudio.jsx` | The hero's audio, running on the existing r3f frame loop rather than a new one. |
| `SoundButton.jsx` | The navbar SOUND control. The only way audio ever starts. |

## Things worth knowing before changing it

**There is no second animation frame.** The hero's audio runs inside the
Canvas so it can read the shared input ref on the frame loop that is already
there. The page's audio hangs off the existing scroll driver. Adding a
`requestAnimationFrame` to poll for audio would cost the WebGL hero frames.

**Hover and click sounds touch no components.** They come from one delegated
listener with a selector table in `useAudio.js`. Adding a sound to a new
button means adding a selector there, not editing the button.

**Never put a side effect inside a React state updater.** `SoundButton` used to
call `setState(s => ({ ...s, enabled: toggleEnabled() }))`, which StrictMode
double-invokes — so the toggle toggled twice and appeared dead. It subscribes
and renders; the manager owns the state.

**Mounting is not an event.** `useSoundOnChange` deliberately skips its first
run. Without that, eight scroll-linked sections each announce themselves the
instant React first renders them.

**Scrolling backwards re-arms silently.** Every threshold fires going forward
only, with hysteresis. Reversing puts the sounds back rather than replaying
them in reverse.

**Less.** The brief this was built to ends with the right rule: if an effect
feels unnecessary, remove it. Two ids were written and cut before shipping
because nothing fired them.
