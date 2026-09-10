# /construction-two — targeted repair pass
### Chair rebuild + building assembly alignment · 2026-09-10

Both problems are fixed and both were verified **in a browser**, running the production
build, scrolling forward and backward. That verification was the one thing the last pass
could not complete.

---

## 1. Chair geometry changes

Rebuilt from nothing. The old chair was not merely bulky — it was **broken**, and the
diagnosis is worth having on record:

`room_lib.sweep()` chooses its own parallel-transport frame. On a run that is mostly
horizontal, that frame stands the profile on edge. The old seat was swept front-to-back
along Y with a `rrect_profile(0.46, 0.055)`, so the 46 cm dimension came out **vertical**
and the 5.5 cm dimension came out across. The measured result:

```
Chair_Seat  bbox  x 0.056 m   y 0.442 m   z 0.464 m
```

A 5.6 cm wide, 46 cm tall vertical fin running through the sitter's legs. That pale slab
filling the middle of the "before" profile shot is the seat. Nothing was going to make the
old chair look right, because there was no seat in it.

The rebuild replaces `sweep()` with a local `loft()` that places every cross-section
explicitly, and adds a comment saying why.

**Thirteen components under a `Chair_Root` node, exactly as specified:**

| node | what it is |
|---|---|
| `Chair_Seat` | 49 × 45 cm, thin, dished, tapered underside, rolled front edge |
| `Chair_Back` | 22 mm mesh-style panel, curved in plan (620 mm radius), lumbar bulge, 43 → 31 cm taper |
| `Chair_BackFrame` | slim perimeter rails + two spines routed *behind* the seat |
| `Chair_Arm_Left` / `_Right` | 58 mm pad on one outward-leaning tapered blade |
| `Chair_Mechanism` | compact housing + the cross-member the arm blades land on |
| `Chair_Column` | gas lift with telescoping collar |
| `Chair_Base` | five tapered spokes, one running dead aft, 66 cm span, low stance |
| `Chair_Caster_01…05` | compact wheels, each its own node |

Materials stay inside the existing palette: `mat_black` seat / arms / casters,
`mat_board` mesh back, `mat_dark_metal` frame, mechanism, column and base. No new colours.

One thing I changed after looking at the first render: the base and column were polished
`mat_brushed_metal` and read as a bright chrome star that pulled the eye to the floor in
every wide shot. Both are now dark metal, per your brief.

## 2. Chair triangle count

**2,808 triangles** — inside the 1,500–4,000 target, well under the 5,000 ceiling.
Scene total went 12,000 → 14,076.

## 3. Did the figure pose need adjusting?

**No. Not one vertex of the figure was touched.** The chair was built around her instead,
off measurements taken first:

| measured on the figure | chair answer |
|---|---|
| thigh underside runs z 0.400 – 0.414 | seat plane 0.396 – 0.405 (3–16 mm clearance) |
| lumbar reaches back to y −0.128 | back panel front face at −0.146 (18 mm clear) |
| upper back sits at y −0.06 (she leans forward) | panel recedes to −0.230 at the top |
| forearm underside from z 0.732 | arm pads top out at 0.667 |

Nothing intersects. Two deliberate gaps are worth naming, because they are the pose and
not a mistake: her back is **off** the backrest above the lumbar, and her forearms are
**above** the arm pads by 9–14 cm. She is leaning forward onto the desk. Nobody working
at a drawing keeps their spine on the backrest or their arms on the rests, and the
alternative — chasing the forearm up to 28 cm above the seat — would be the ergonomically
wrong chair.

## 4. Did the building need Blender corrections?

**Yes, but not for the alignment bug — the alignment bug was 100% JavaScript.** In Blender
the thirteen pieces were already clean: applied scale, pure-Y rotation, no parent offsets,
contiguous stacking, no floating parts, no unintended intersections.

What the renders did show was a composition problem you had flagged: `Bld_11_core`, the
"exposed circulation core", stood **detached** beside the tower with visible daylight
between it and most of the floors. Only plate 05 and the podium reached it; plates 03, 07
and 09 stopped 11–50 mm short. And it terminated dead flat at the roof line, uncapped,
because `Bld_12_roof` does not sit over it.

Three minimal fixes, no renames, no reordering:

- `Bld_03_plate` 0.330 → 0.412 wide, `Bld_07_plate` 0.300 → 0.355, `Bld_09_plate` 0.244 →
  0.337 — each now bites ~50 mm into the core instead of hanging near it. Their +X
  cantilever edges are unchanged, so the massing rhythm is untouched.
- The core runs to 0.542 and takes its own cap to 0.556, just proud of the roof's 0.549 —
  a lift overrun, which is what a core actually does.
- One more ladder rung, to match the new height.

Also corrected a comment in `build_room_v2.py` that said each piece's origin was at its own
base centre. It never was, and that false claim is what the JavaScript was written to.

## 5. Root cause of the wireframe / solid mismatch

Two compounding bugs, and the second is much worse than the one you diagnosed.

**The one you found:** `Building.jsx` copied `piece.mesh.position/quaternion/scale` into the
wireframe once at setup, then `stepPiece()` rewrote `mesh.position.y` and `mesh.scale.y`
every frame. The cage held the setup transform, the solid moved. They came apart the moment
a piece started building.

**The one underneath it:** the growth maths was wrong at 100%, so the two never reconverged.

```js
piece.mesh.scale.y = solid
piece.mesh.position.y = piece.footY + (piece.height * solid) / 2   // footY = restY + localMinY
```

That is correct only if the geometry is centred on its origin — if `localMinY === -height/2`.
It is not. **All fourteen Building nodes share ONE origin** at the model's base on the desk
(`translation [0.56, 0.742, -1.3]` for every one), with each piece's height baked into its
local Y. From the shipped GLB:

```
Bld_01_base   localY  0.000 … 0.015
Bld_09_plate  localY  0.414 … 0.435
Bld_12_roof   localY  0.511 … 0.549
Bld_13_mast   localY  0.521 … 0.691
```

So the final-state error per piece is `(localMinY + localMaxY) / 2` — never zero for
anything but a piece straddling the origin:

| piece | final error | | piece | final error |
|---|---:|---|---|---:|
| Bld_01_base | 0.008 m | | Bld_08_volume | 0.362 m |
| Bld_02_podium | 0.054 m | | Bld_09_plate | 0.425 m |
| Bld_03_plate | 0.105 m | | Bld_10_volume | 0.467 m |
| Bld_04_volume | 0.151 m | | Bld_11_core | 0.278 m |
| Bld_05_plate | 0.212 m | | Bld_12_roof | **0.530 m** |
| Bld_06_volume | 0.255 m | | Bld_13_mast | **0.606 m** |
| Bld_07_plate | 0.306 m | | Bld_Accent | 0.087 m |

The mast finished **60.6 cm** above its cage on a model **69.1 cm** tall — 88% of the
building's own height. The underside also drifted up to 0.45 m *during* the build, because
scaling Y about an origin far below the piece drags its base toward that origin.

## 6. The Building.jsx architecture used

The preferred approach from your brief: a per-piece wrapper.

```
pieceRoot            <- rest transform; nothing ever writes to it
  |- wireframe       <- identity: the cage IS the destination volume
  |- mesh            <- identity at rest, animated in local space only
```

`ensurePieceRoot()` creates the group, copies the rest transform onto it, re-parents the
mesh and zeroes the mesh's local transform. `orderedEdges()` already produced geometry in
local coordinates, so the cage needs no transform of its own — at rest the two are
literally the same coordinates.

Growth then reduces to two lines with no scene-graph maths in them:

```js
piece.mesh.scale.set(1, solid, 1)
piece.mesh.position.y = piece.localMinY * (1 - solid)
```

The underside is invariant by construction:

```
localMinY * solid + localMinY * (1 - solid) = localMinY
```

and at `solid === 1` the mesh is back to the identity transform, which is exactly where the
cage has been sitting all along. **No offsets, no per-piece corrections, no magic numbers**,
and it holds whether an origin is centred, base-seated, or somewhere else entirely.

Z-fighting is handled by `offsetSolid()`: `polygonOffset` on a **cloned** per-piece material,
which shifts depth values without moving any geometry. The clone matters — `mat_model_card`
and `mat_frosted_glass` are shared with the credenza and the window, and those should not
inherit a depth bias.

## 7. Are immutable rest transforms stored?

Yes, in `useRoomModel.js`, in a new `restingState()` that runs **before any measurement is
taken**. It captures `position.clone()`, `quaternion.clone()`, `scale.clone()`, `localMinY`
and `localHeight` into `mesh.userData.rest` **once**, and never re-reads them from the live
transform afterwards.

This was a real hazard, exactly as you suspected. `useGLTF` caches by URL and `Building.jsx`
writes to those meshes every frame, so on any remount — StrictMode, route re-entry, HMR —
the old code would have captured a mid-animation pose as the resting place, and each pass
would have compounded the last. It also fed `footY`/`restY` and the camera focus boxes from
whatever frame the previous mount happened to stop on.

`restingState()` also *restores* the mesh to rest before measuring, recognising the wrapper
when one already exists, so the shell, the group bounds and every camera focus point are
now read off the assembled model. `Building.jsx`'s cleanup returns each mesh to rest too.

A DEV-only self-check in `Building.jsx` walks all thirteen pieces through 25/50/75/100% on
mount and logs the maximum footing drift, so a regression here shows up as a console error
rather than a subtle visual.

## 8. All 13 building pieces detected

Yes, in order, from the exported GLB:

```
1 Bld_01_base   2 Bld_02_podium  2 Bld_Accent   3 Bld_03_plate  4 Bld_04_volume
5 Bld_05_plate  6 Bld_06_volume  7 Bld_07_plate 8 Bld_08_volume 9 Bld_09_plate
10 Bld_10_volume 11 Bld_11_core  12 Bld_12_roof 13 Bld_13_mast
```

To be precise rather than tidy: the runtime resolves **14 nodes** in the Building group —
the thirteen named pieces plus `Bld_Accent`, the blue reveal that shares `order: 2` and
builds with the podium. That is existing, correct v2 behaviour, not a regression.

Contract verified on the shipped GLB: 102 nodes, **every one carrying `group` extras**,
zero nodes falling through to name inference. Groups: Chair 14 (13 meshes + `Chair_Root`),
Building 14, Figure 9, Walls 14, Desktop 12, Credenza 8, Pinboard 7, Ceiling/Window/Skyline
4 each, Desk/Plant/LightingElements 3, Floor 2, Bin 1. Rotations export as pure-Y
quaternions and all rest scales are `[1,1,1]`.

`public/office_room_v2.json` regenerated from the GLB itself, now carrying each piece's
`localMinY`/`localMaxY` and rest transform so the growth maths is documented where it lives.

**GLB: 601,548 bytes** (was 565,880). Shell size and re-centre offset are unchanged at
6.99 × 3.59 × 7.76 and [0.085, 0.100, −0.120], which is why no camera needed retuning.

## 9. Forward-scroll test

Run in a browser against the production build. Stepping progress through the build range
(0.5125 → 0.62):

- cages draw in bottom-upward, ahead of their solids
- each solid rises from the bottom of its own cage, inside it
- caught the mast mid-build — cage fully drawn, solid partly grown from its base — the
  exact piece that used to finish 60 cm adrift
- at the model shot the finished tower and the cage **coincide**: every plate edge, the
  core, the roof cap and the mast sit on their lines with no visible offset
- no edge jitter, shimmer or stipple

## 10. Reverse-scroll test

Walked back down through 0.62 → 0.60 → 0.58 → 0.565. Solids shrink back onto their own
footprints and cages retract, and the pieces still built stay exactly inside their outlines
throughout. Nothing detaches in either direction — `stepPiece` is a pure function of
progress, so reverse is the same code path.

## 11. Production build

```
✓ 635 modules transformed
dist/assets/RoomViewer-CpQNTt2h.js              16.67 kB │ gzip:   6.76 kB
dist/assets/react-three-fiber.esm-2Ofn0wdm.js  883.93 kB │ gzip: 234.99 kB
✓ built in 530ms          exit code 0
```

Clean. The only warning is the pre-existing react-three-fiber chunk-size notice.

**Console: no errors, forward or backward.** One warning, pre-existing and from
@react-three/fiber, not this code: `THREE.Clock: This module has been deprecated.`

## 12. Remaining visual issues

1. **The tower still reads a little tiered** from the +X side — the plates are close in
   footprint, so it can look concentric from that one angle. The core fix helps a lot from
   the other three. Pushing the cantilevers further apart would settle it, but that is a
   design change to the massing rather than a defect, so I left it.
2. **`Bld_11_core` builds eleventh.** It grows bottom-to-top correctly within its own
   window, but a full-height core arriving after ten floors is backwards to how a building
   actually goes up, and it means plates 03–09 cantilever off nothing during assembly.
   Changing it means breaking the name/order correspondence you specified, so I did not
   touch it. Say the word and it becomes order 2.
3. **Arm-pad clearance** is 9–14 cm under her forearms, as covered in §3. Correct for the
   pose; only worth revisiting if you ever re-pose her hands lower.
4. **Cross-member ends** are just proud of the seat on both sides, reading as the arm
   mounts. Intentional after the first render showed them as longer stubs, but they are the
   fussiest detail left on the chair.
5. **Figure hands and the four-card skyline** are unchanged from the last pass and carry the
   same caveats.

---

## Files changed

```
src/examples/construction-two/Building.jsx        rewritten — wrapper, growth maths, DEV check
src/examples/construction-two/useRoomModel.js     restingState(); building pieces carry rest
assets/source/construction-two/build_room_v2.py   chair rebuilt; core + 3 plates corrected
public/office_room_v2.glb                         re-exported, 601,548 B
public/office_room_v2.json                        regenerated from the GLB
assets/source/construction-two/office_room_v2.blend
```

`palette.js`, `toonMaterial.js`, `shots.js`, `Room.jsx`, `RoomViewer.jsx` and
`CinematicCamera.jsx` are untouched. No camera values changed. `userData.group` /
`userData.order` architecture untouched. No outline shells restored.
