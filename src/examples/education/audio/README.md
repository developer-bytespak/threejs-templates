# Sound — /education

Twenty-two synthesised voices, twenty-seven named moments, seven sustained layers,
and one AudioContext shared with every other route that has sound.

## The engine is not here

`src/audio/engine.js` holds the context, the buses, the ceiling, cooldowns, the
preference and the unlock. It was built for `/construction-two` and lifted out
unchanged when this route needed sound. What lives in this folder is everything
true of the knowledge tree and nothing else: the palette, the mix table, and
the thing that decides when a moment has happened.

The sound control is shared too — `src/audio/SoundButton.jsx`, with its styles
in `src/audio/sound-button.css`. This route supplies five colour tokens and
nothing more, so the control is the same object on both pages rather than two
objects that resemble each other.

**One preference for the whole site.** Both routes store under `bytes:sound`,
and a visitor who answered while `/construction-two` was still writing
`c2:sound` has that answer migrated on first read. Being asked the same
question twice because a key was renamed underneath you is not a small bug.

## Audio is derived, never scheduled

The page derives every visual weight from one number and holds no animation
state, which is what makes scrolling backwards correct by construction. The
audio follows the same rule by listening to the same weights — `seedOpen`,
`trunkGrowth`, `campusReveal` and the rest — rather than to scroll position
directly.

That is the whole design. A sound cannot disagree with what is on screen,
because it is fired by the number that put it there. A separate audio timeline
would be a second opinion about where the page is, and second opinions drift.

Two kinds of event, and the difference matters:

| | |
|---|---|
| **Marks** | One-shot moments. Forward-only with hysteresis — crossing fires once, reversing re-arms without firing, jiggling on the boundary does nothing. |
| **Beds** | Sustained layers, levelled every frame. Everything the reader *watches happen* is one of these. |

## Four things come into existence, and they are layers

Wood and branches, leaves, props, the college. The first version fired one-shot
creaks and rustles at milestones, and it was wrong in a way that only listening
reveals: the tree built itself in silence between four isolated noises, the
canopy got a single rustle after it had already filled in, and a short decaying
sine under a noise transient turned out to be, unmistakably, a drum.

A formation is a process. Each of the four now has a levelled layer:

| | driven by | |
|---|---|---|
| `woodForm` | trunk + branch growth | sparse grains through three tight resonators — fibres letting go, not a wash. Denser as it forms faster. No LFO anywhere: that was the ocean. |
| `leafForm` | leaf reveal | dense small-grain noise with amplitude flicker, so it sounds like *many* small things |
| `tung` ×5 | artifact reveal | a struck body per group, five pitches climbing — a phrase, not five thuds |
| `campusForm` | campus materialising **and** resolving | low body, broad still air, two room modes at irrational ratios. No chord — a major triad swelling under a reveal is a fanfare. |

**Each level is the rate of change, and nothing else.** Not the amount, and not
a floor under it. A formation sounds while it is *happening* and is silent when
it is not — and "not happening" includes both ends: nothing started, and
finished.

Three behaviours fall out of that for free, which is how you know it is the
right quantity rather than a clever one:

- stop scrolling mid-growth and the wood stops, even though a half-built tree
  is on screen — nothing is forming any more
- scroll faster and it gets louder, because more is forming per second
- scroll backwards and it sounds again, because coming apart is also something
  happening

The rate is an **absolute** value for exactly that last reason. An earlier
version took only the rising direction and left the page silent on the way back
up while the tree visibly un-built itself.

Each layer's scale is not a taste knob — it normalises for how much scroll its
weight is spread over. `leafReveal` runs 0 to 1 across ten per cent of the page
while the wood takes twenty-four, so at the same scroll speed the leaves change
nearly two and a half times faster and would sit pinned at full while the wood
was still finding its level. Measured end to end: a 60-second crawl peaks at
0.22 / 0.25 / 0.34, a 25-second read at 0.53 / 0.59 / 0.73, and anything brisker
saturates.

## Air comes from the camera, not from transitions

`airMove` is levelled by the camera's own velocity, measured in the frame loop:
position delta plus rotation delta, with rotation weighted up because a pan
sweeps the whole frame while a dolly of the same magnitude barely changes it.

That makes it a property of movement rather than a cue attached to a moment. A
still camera is silent, a slow dolly is almost nothing, a flung scrollbar
rushes — and because it is derived it cannot fire at the wrong time. The
smoothing is asymmetric: air arrives with the movement and falls away behind
it, which is how motion actually sounds.

`SceneAudio.jsx` lives *inside* the Canvas and reads the stage on the frame
loop that is already running. No second `requestAnimationFrame`, no polling, no
React state, nothing allocated per frame.

## The story, as a mix

The peak column reads down in the order of the journey:

```
quiet       seed        −34 … −26   the quietest chapter on the page
growing     growth      −30 … −27   four milestones, never a stream
discovery   museum      −34 … −27   densest and most tactile
connection  connection  −31 … −29   two panned tones, then one that is neither
mystery     glimpse     −33         quieter than everything except the seed
revelation  reveal      −31 … −19   one event, the loudest by 3 dB
future      future      −30         back to almost nothing
```

`reveal.campus` at −19 dBFS is the largest thing that happens, and it is still
quiet. What makes it feel large is that it is the only voice with a long tail
and a real low end, and that it has no transient at the front at all — it opens
rather than lands. A cinematic impact here would undo the whole page.

## Loudness is measured, not guessed

Each entry states its target peak **in dBFS at the speaker**, after bus and
master. `calibration.js` is generated:

```
npm i --no-save node-web-audio-api
node tools/calibrate_education_audio.mjs
```

That renders every id offline through the real graph — same buses, same master,
same compressor — takes the median peak over ten runs, and writes the
correction. Worst residual at last generation: **0.85 dB**. Re-run it after
changing a voice or a target.

Measured ceiling: the entire palette plus all seven beds at full on one frame
peaks at **−12.3 dBFS**, settling to −19.3. The realistic worst case — mid
growth, scrolling hard, every formation layer up — is **−22.1 dBFS**.

## Why there are no audio files

Every sound is made from noise and filters at the moment it plays. A page turn
is a bandpass swept across a third of a second; graphite is noise with a grain
envelope; a seed opening is a transient plus two decaying resonances. Those are
what the recordings would be anyway, and synthesising them means no repetition
(every play differs by construction — which is what "two or three variations"
is really asking for), no weight on a page already carrying 2.24 MB of
geometry, and nothing to licence.

If you want real recordings, add
`public/assets/education/audio/manifest.json` mapping sound ids to files. Any
id listed there plays the file; everything else stays synthesised, so one sound
can be replaced without touching code.

## Tests

```
node tools/test_education_audio.mjs
```

42 checks. The ones worth knowing about: nothing before a gesture; the shared
preference migrating; a mark firing once on the way up and never on the way
back down; parking on a boundary and jiggling forty times producing one sound;
holding past a mark for 120 frames producing one sound; a scrollbar flung from
0 to 1 being bounded by cooldowns rather than playing the journey; hover ids
dropped on a coarse pointer, including the five discipline textures; everything
except a deliberate press dropped under reduced motion.

## Things worth knowing before changing it

**The band is deliberate.** Every voice puts its identifying content between
roughly 300 Hz and 3.5 kHz. A mix measured correctly and still inaudible is the
failure this palette was tuned to avoid: laptop speakers radiate almost nothing
below 250 Hz, so lows are for body, never for information.

**The disciplines are one family.** Five different voices, but the same band,
envelope length and level — which is what stops them sounding like five
different apps. They are hover-driven, so a coarse pointer drops all five.

**Not a forest.** This is a conceptual, educational space. The organic voices
are dry, close and small — a seed opening in a quiet room, not a woodland.

**Less.** If a sound is noticeable every time it happens, it is too loud.
