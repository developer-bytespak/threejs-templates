# /construction-two — code-only implementation pass
### Drawing-to-building storytelling system · 2026-09-11

**No Blender, no GLB, no model changes.** The `.blend` and `office_room_v2.glb` are
untouched; every semantic node used below was read out of the shipped GLB.

---

## 1. Files modified

```
src/examples/construction-two/useRoomModel.js     anchors + non-mesh discovery
src/examples/construction-two/palette.js          DRAWING_GROUP, ANCHOR_GROUP
src/examples/construction-two/CinematicCamera.jsx keyframes at explicit progress
src/examples/construction-two/Building.jsx        timing source + phase readout
src/examples/construction-two/RoomViewer.jsx      rewired, chapter state, track
src/examples/construction-two/RoomViewer.css      rewritten
src/examples/construction-two/shots.js            retired to a compat re-export
```

`Room.jsx` and `toonMaterial.js` are untouched.

## 2. New components

```
story.js                     CAMERA_KEYFRAMES + STORY_CHAPTERS + stages + phases
DrawingSequence.jsx          the plan plotting itself onto the sheet
ConstructionAnnotations.jsx  world-space labels anchored to model nodes
ConstructionStoryUI.jsx      six chapters, six presentation modes
ConstructionProgress.jsx     six construction ticks
```

## 3. Model semantic nodes discovered

Read straight out of the GLB before writing a line of code — 136 nodes, every mesh
carrying `group` extras.

**13 anchors** (`group: "Anchors"`, transform-only):

```
Building_Spawn_Anchor   Drawing_Origin        Anchor_Drawing
Pencil_Tip_Anchor       Anchor_Preconstruction_Desk
Anchor_Pinboard_Site    Anchor_Pinboard_Structure   Anchor_Pinboard_Coordination
Anchor_Window_Context
Anchor_Building_Foundation  Anchor_Building_Structure
Anchor_Building_Envelope    Anchor_Building_Completion
```

**Drawing_System** with 10 mesh children, all at identity local transform:
`Drawing_Paper_Main`, `Drawing_Surface` (`usable_w` 0.94 / `usable_d` 0.76, has a
0..1 UV), `Drawing_Trace_Sheet`, and stages 1–7 — `Drawing_Grid`,
`Drawing_Perimeter`, `Drawing_Structure`, `Drawing_Core`, `Drawing_Dimensions`,
`Drawing_Annotations`, `Drawing_Building_Footprint`.

**7 pinboard documents** carrying a `doc` extra: `Sheet_Site`, `Sheet_Plan`,
`Sheet_Structure`, `Sheet_Section`, `Sheet_Elevation`, `Sheet_Coordination`,
`Sheet_Phasing`.

Materials already had palette entries — `mat_dark_metal`, `mat_brushed_metal`,
`mat_blue_accent`, `mat_paper`, `mat_model_white`. **No palette mappings were
needed**, so the existing toon behaviour is untouched.

## 4. Content chapter architecture

Six chapters, weighted per the pacing brief, each with a genuinely different
presentation `mode`:

| # | id | span | weight | mode | how it speaks |
|---|---|---|---:|---|---|
| 01 | `preconstruction` | 0.000–0.120 | 12% | `paper` | pinned tracing sheet + one large line |
| 02 | `coordination` | 0.120–0.270 | 15% | `annotations` | labels on the wall, no DOM block |
| 03 | `context` | 0.270–0.370 | 10% | `context` | three isolated words, spread |
| 04 | `documentation` | 0.370–0.620 | 25% | `quiet` | a tag, two words, a hairline |
| 05 | `build` | 0.620–0.870 | 25% | `build` | two poles + a phase rail |
| 06 | `built-work` | 0.870–1.000 | 13% | `final` | editorial close + CTAs |

Track length is **1050vh**, chosen — not `SHOTS.length * 100vh`.

The old `.captions` / `.caption__eyebrow` / `__title` / `__body` block is gone
entirely, not restyled.

## 5. Camera keyframe architecture

**Nine keyframes, six chapters** — which is the whole point of the split. Each
keyframe sits at its own progress value, so the camera can pass through the desk
approach and the footprint transition without either demanding a section.

```
0.000  wide studio establishing      Floor
0.120  desk approach                 Desk
0.215  documentation wall            Pinboard
0.320  window / context              Window
0.400  over the shoulder             Anchor_Preconstruction_Desk
0.480  down onto the sheet           Drawing
0.635  footprint, lower and closer   Building_Spawn_Anchor
0.780  build macro 3/4               Building
1.000  back out into the studio      Floor
```

`aim` resolves against the measured group map **and** the anchor map, so a keyframe
can target a group or a model empty. Keyframes 6→7 swing the azimuth from 70° to
100° around the model — **30° of controlled lateral rotation** across the assembly,
inside the 20–35° the brief asked for, with the sheet staying under the structure.

The old nine-equal-stops interpolation is replaced by a search for the bracketing
pair plus an eased blend across that specific gap.

## 6. Drawing reveal implementation

**One clipping plane per stage, swept across the sheet.**

The technique was chosen by looking at what the model actually exports rather than
by preference. Each drawn line is a thin flat box and a stage's lines are merged
into one mesh, which rules out the two obvious options: per-stage visibility gives
seven pops across two hundred viewport heights, and `setDrawRange` over
position-sorted triangles can only include or exclude a whole box, so a 500 mm grid
line would still arrive all at once.

A clipping plane cuts *through* the boxes, so a long line genuinely draws in along
its length — precise, architectural, and exactly reversible. No dissolve, no
stipple, no jitter.

- The sweep axis is built from `Drawing_System.matrixWorld`, so it keeps working if
  the sheet is ever re-angled in Blender. It rakes 0.45 off the sheet's long axis
  and starts at the corner the pencil lies in, so the plan grows away from
  `Pencil_Tip_Anchor` rather than arriving from nowhere.
- Materials are **cloned per stage mesh**. `mat_dark_metal` is shared with the desk
  frame, `mat_brushed_metal` with the chair base, `mat_blue_accent` with the
  credenza books — without the clone, half the room would wipe along with the plan.
- `gl.localClippingEnabled = true` is set in the Canvas `onCreated`.
- Cleanup restores the original materials and disposes the clones.

Colour is the model's own: graphite `mat_dark_metal`, light `mat_brushed_metal`,
architectural `mat_blue_accent` on warm paper. The only emphasis is the footprint
lifting ~35% toward a pale blue over the hold and settling back as the building
stands on it.

## 7. Exact drawing progress ranges

Seven stages across **0.408 → 0.612**, windows overlapping by design so the sheet
fills continuously rather than in seven visible steps. Duration 0.053, stagger
0.0252:

| stage | group | from | to |
|---:|---|---:|---:|
| 1 | Drawing_Grid | 0.408 | 0.461 |
| 2 | Drawing_Perimeter | 0.433 | 0.486 |
| 3 | Drawing_Structure | 0.458 | 0.512 |
| 4 | Drawing_Core | 0.484 | 0.537 |
| 5 | Drawing_Dimensions | 0.509 | 0.562 |
| 6 | Drawing_Annotations | 0.534 | 0.587 |
| 7 | Drawing_Building_Footprint | 0.559 | 0.612 |

That is **204 of 1050 viewport heights** — about 214vh of scroll on the drawing alone.

## 8. Footprint → building transition

```
DRAWING_BEGIN      0.408
DRAWING_END        0.612
RESOLVED_HOLD_END  0.640    plan holds, resolved
FOOTPRINT_HOLD_END 0.668    footprint emphasis
BUILD_START        0.668
BUILD_END          0.862
```

**No offsets were written anywhere.** The building already rests exactly on its
footprint in the GLB — `Building_Spawn_Anchor.matrixWorld` is identical to every
`Bld_*` rest matrix, which the model pass verified to `(0,0,0)`. So the code
controls nothing but visibility and growth: `BUILD_RANGE` moved from the old model
shot to 0.668–0.862 and nothing else in the assembly changed.

## 9. Was `userData.phase` available?

**Yes.** All 14 Building nodes export `phase` and `phase_index`. `phaseFromPiece()`
reads `phase_index` first, then `phase`, and only falls back to an order table if a
GLB ever turns up without them. That fallback lives in `story.js` as
`BUILD_PHASES[].orderFallback` — one place, no magic numbers scattered through
`Building.jsx`.

## 10. Building phase mapping

```
foundation  Bld_01_base, Bld_02_podium, Bld_Accent
structure   Bld_03/05/07/09_plate, Bld_11_core
envelope    Bld_04/06/08/10_volume
completion  Bld_12_roof, Bld_13_mast
```

These **interleave in assembly order** (3 plate, 4 volume, 5 plate…), which is how a
floor actually goes up. The rail therefore shows the furthest phase any piece has
*started*, computed in `Building.jsx`'s frame loop and written to
`input.current.buildPhase`; the rail polls that and calls `setState` only when the
number changes.

## 11. Content presentation modes

Six layouts, no repetition:

- **paper** — a tracing sheet with a drafting grid printed through it, a pin, a
  hairline-ruled metadata list. Not a glass card: warm off-white on a blue grid.
- **annotations** — nothing in the DOM overlay but an `sr-only` heading. The wall
  is the interface.
- **context** — `Site.` / `Scale.` / `City.` at three separate screen positions,
  appearing in sequence as the camera crosses to the window.
- **quiet** — a tag, two words, and a hairline plot meter that fills with the
  drawing. The only motion on screen during the quietest chapter.
- **build** — `Plan` low-left dimming to 26% as `Structure` rises top-right, plus
  the four-tick phase rail.
- **final** — headline, sector rail, two real anchor CTAs.

## 12. World-space annotation strategy

`drei <Html>` positioned from model nodes, never from CSS percentages. The resolver
checks the anchor map first, then any named node, so a label can target either an
`Anchor_Pinboard_*` empty or a `doc`-tagged sheet mesh:

```
01 Site logistics   Anchor_Pinboard_Site
02 Structure        Anchor_Pinboard_Structure
03 Coordination     Anchor_Pinboard_Coordination
04 Phasing          Sheet_Phasing          (bbox centre, stood 90 mm off the board)
```

Four labels, staggered in across the first half of the chapter. A missing node is
dropped with a dev warning rather than drifting to a guessed coordinate.

The only screen-positioned text is chapter 03's three words, which the brief itself
specifies by screen region ("near the left pane… near the centre… far right").

## 13. Mobile strategy

Not a shrunk desktop. Under 760px: the tracing sheet reframes from a floated panel
to a full-width pinned strip with a two-column list; display type drops to a
`vw`-driven scale; the fourth annotation steps out (four labels on a phone is
clutter) and leaders shorten; the three context words re-space to avoid collisions;
the phase rail tightens to 22px rules; the chapter rail loses its labels; CTAs stay
full-size and tappable. **The drawing and the build sequence are untouched**, because
they are the point.

## 14. Reduced-motion strategy

Nothing is removed — it arrives rather than travels.

- Drawing: stages still reveal **in order**, but the clipping plane jumps to fully
  open instead of sweeping. The information and the sequence are identical.
- Building: the existing reduced-motion path already snaps each piece to finished.
- Camera: interpolation retained, parallax and idle drift disabled (existing).
- CSS: all transitions collapse to 0.01ms and transforms are neutralised, with the
  tracing sheet keeping its rotation so it does not jump.

## 15. Production build

```
✓ 639 modules transformed
dist/assets/RoomViewer-CRSDfsay.js               26.03 kB │ gzip:  9.43 kB
dist/assets/RoomViewer-CF5FmXFo.css              10.57 kB │ gzip:  3.01 kB
dist/assets/Html-DfcPOKIh.js                      7.6  kB │ gzip:  3.07 kB
dist/assets/react-three-fiber.esm-CpVUq8oE.js   883.94 kB │ gzip: 234.99 kB
✓ built in 2.43s        exit 0
```

Clean. The only warning is the pre-existing react-three-fiber chunk-size notice.

**Verified in a browser**, production build, scrolling forward and backward:
opening studio · documentation wall with `SITE LOGISTICS` pinned to its sheet ·
blank sheet · drawing at 25% / 60% / complete · footprint emphasis · first pieces ·
mid-assembly with `03 ENVELOPE` lit and the plan still visible under the structure ·
completed model · final studio with both CTAs. Reverse scroll un-draws the plan
stage by stage and disassembles the building. `/`, `/construction`, `/crypto` and
`/education` all return 200 and `/construction` still renders its canvas with no
failed resources. No console errors — one pre-existing `THREE.Clock` deprecation
warning from @react-three/fiber.

Two real bugs were found by testing and fixed:

1. **Scroll state stalled when the tab was not visible.** I had queued the chapter
   update in `requestAnimationFrame`, which stops firing in a hidden tab — the
   scroll position kept moving while the DOM layer stayed frozen on whatever
   chapter it was on. Replaced with a quantised comparison: progress rounds to
   ~0.2% (about 500 updates across the page, not one per scroll pixel) and state is
   set only when that step changes.
2. **`04 / DOCUMENTATION` sat on top of `to build.`** Both were absolutely
   positioned with a hand-computed offset between them. They are now stacked in
   flow inside one positioned block, so they cannot collide however the type scales.

## 16. Remaining polish

1. **The wireframe cage stays visible on the finished model** in chapter 06. That is
   the existing approved building behaviour and I did not touch it, but at the final
   wide shot it pulls the eye. Fading the cage out over the last 10% of the build
   would be a few lines in `stepPiece`.
2. **Chapter 02's fourth label is tight in portrait.** It is already hidden under
   760px; between 760px and ~900px it can crowd the third.
3. **Lighting emphasis per chapter is not implemented.** The brief allowed a subtle
   desk-lamp lift during the drawing; I left `Room.jsx` alone rather than touch the
   approved lighting for a marginal gain. It would be a single damped intensity
   driven off chapter progress.
4. **Pointer parallax is still global.** The brief wanted it near-zero on the
   drawing and slight on the build; it is currently the same everywhere. A
   per-chapter multiplier in `CinematicCamera` would do it.
5. **The sector rail and CTAs point at `#projects` / `#contact`** — placeholders for
   a template.

---

## Two things to know

**I published a build into your `dist/`.** This session has no shell on your machine
and Blender was off-limits, so I assembled the project in the cloud container, ran
`npm ci` and `vite build` there, and wrote the output into `D:\Hassan\threejs-test\dist\`
so I could load the real production bundle in a browser and QA it. Your `src/` is the
authority — **re-run `npm run build` locally** and that folder is regenerated properly.
`dist/office_room_v2.glb` was also refreshed, because the copy there predated the
drawing model pass.

**The browser pane available to me is portrait**, roughly 585×830, so the visual QA
above doubles as a mobile check but is not a desktop framing check. The camera
keyframes were designed numerically against the measured group centres and the room
shell rather than eyeballed at 16:9 — worth one pass at desktop width to confirm the
pinboard and build framings read as intended.
