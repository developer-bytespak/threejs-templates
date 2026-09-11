# /construction-two — model-only pass
### Drawing_System, spawn anchor, documentation wall, phase metadata · 2026-09-11

**No website code was touched.** React, Three.js, JS, JSX, CSS, shaders, camera, scroll,
routes, package files — all untouched. The only files written are the Blender source
script, the .blend and the .glb.

---

## 1. Blender file modified

```
D:\Hassan\threejs-test\assets\source\construction-two\office_room_v2.blend
```

Confirmed as the latest before editing: 105 objects, opened directly, matched against the
shipped GLB. Its authoring script — the model source, not website code — is
`assets\source\construction-two\build_room_v2.py`, and that is where all the work was done
so the scene stays reproducible.

## 2. GLB exported

```
D:\Hassan\threejs-test\public\office_room_v2.glb        964,968 bytes  (was 821,248)
```

Same pipeline, same path, same flags (`export_extras=True`, `export_yup=True`, apply
modifiers, no cameras or lights). Verified after export: **136 nodes, every mesh carrying
`group` extras, zero falling through to name inference.**

## 3. The Drawing_System hierarchy

```
Drawing_System                    empty · group "Drawing" · sheet centre on the desk top
├── Drawing_Paper_Main            the physical plot
├── Drawing_Trace_Sheet           small tracing sheet over a clear corner
├── Drawing_Surface               flat animation surface, own 0..1 UV map
├── Drawing_Grid                  stage 1
├── Drawing_Perimeter             stage 2
├── Drawing_Structure             stage 3
├── Drawing_Core                  stage 4
├── Drawing_Dimensions            stage 5
├── Drawing_Annotations           stage 6
├── Drawing_Building_Footprint    stage 7
├── Drawing_Origin                anchor
├── Building_Spawn_Anchor         anchor
└── Anchor_Drawing                anchor
```

**Its local space IS the sheet** — +X across the plot, +Y up it, Z off the paper, origin
at the sheet centre on the desk. Every mesh child exports with an **identity transform**
and local-space vertex data, because the parent inverse is cleared rather than left to
cancel the parent out. The glTF hands you clean coordinates instead of offsets to
reverse-engineer.

```
Drawing_System   translation [0.5, 0.742, -1.295]   rotation -6° about Y
  every mesh child   translation [0,0,0]   rotation identity
```

## 4. Paper dimensions

**1.00 × 0.82 m, 1.8 mm thick**, bevelled, laid at −6°. Usable drawing area
0.94 × 0.76 m (`Drawing_Surface`, carrying `usable_w` / `usable_d` as extras).

This is deliberately larger than the A2/A3 you suggested, and the reason is arithmetic:
the approved building's base plate is 520 × 400 mm sitting at −62°, so its footprint
occupies a **623 × 654 mm** patch. On an A2 sheet the tower would overhang its own
drawing. 1.00 × 0.82 m is a large-format plot — what you'd actually roll out for a site
plan. The knock-on is that the sheet sits to her drawing-hand side rather than dead centre
in front of her; her nearest hand is 124 mm off its near corner, well inside working reach.

## 5. Drawing line groups

Seven, each its own object with a `stage` extra so they can be revealed in order:

| stage | object | material | content |
|---:|---|---|---|
| 1 | `Drawing_Grid` | brushed (light) | sheet registration border, structural grid on the building's own axes, grid markers |
| 2 | `Drawing_Perimeter` | dark metal | site boundary, base-plate edge, podium perimeter, tower footprint |
| 3 | `Drawing_Structure` | dark metal | primary beams, column marks at grid intersections, three internal divisions |
| 4 | `Drawing_Core` | blue accent | core outline, six-tread stair run, outlined lift car, landing line |
| 5 | `Drawing_Dimensions` | brushed | two dimension strings with ticks and witness lines |
| 6 | `Drawing_Annotations` | dark metal | title block with rules, north point, scale bar, two leaders |
| 7 | `Drawing_Building_Footprint` | blue accent | area-of-works hatch, heavy boundary, four corner registration marks |

All line work is thin flat boxes on a **2 mm z-stack** (0.25 mm between layers — hundreds
of times the depth buffer's precision at this range, and thin enough that a grazing camera
never catches lines floating off their sheet). **No readable text anywhere**; the title
block is rules and two solid blocks standing in for text.

One thing I changed after looking at the first render: stage 7 was originally a solid blue
wash over the footprint. It read as a hologram and buried the plan it was supposed to
resolve. It is now a light hatch inside a heavy boundary, which is what a drawing actually
does to mark an area of works.

## 6. Building_Spawn_Anchor

```
world       (0.560, 1.300, 0.7441)   rotZ −62.000°
sheet-local (0.05915, 0.0021, −0.01124)   rotation −56° about Y
extras      role "building_origin", footprint_w 0.520, footprint_d 0.400
```

It is not an estimate of where the model goes. It carries **exactly the rest transform
every `Bld_*` piece is exported with** — measured delta against `Bld_01_base` is
`(0.000000, 0.000000, 0.000000)` and the rotation matches to three decimals. Read the
anchor and you know where the building begins.

## 7. How the drawing corresponds to the building

The plan is **derived from the building's own constants at build time**, not drawn by eye,
so it cannot drift:

```python
FP_X, FP_Y = R(-DS_ROT) · (MX - DS_X, MY - DS_Y)
FP_ROT     = MROT - DS_ROT
```

Every plan element is then placed through `BP(building_x, building_y)`. What the viewer
sees matching, and where it comes from:

| drawn | taken from |
|---|---|
| site/base-plate rectangle 520 × 400 | `Bld_01_base` slab |
| building perimeter 450 × 330 at −6° | `Bld_02_podium` cap slab |
| tower footprint 210 × 196 at −6° | `Bld_04_volume` |
| core 70 × 104 at (−0.176, −0.042) | `Bld_11_core` |
| grid spacing 104 mm / 100 mm | the column lines the massing is built on |

The building's internal −6° rotation is reproduced, so the tower sits skewed inside the
site boundary exactly as the model is skewed — which also reads correctly as a site plan,
where the building rarely aligns to the plot.

Validation render 7 shows the base plate landing on the blue boundary with the dimension
strings and grid running out from under it onto the sheet.

## 8. Pinboard sheets and groups

Seven documents split out as their own objects, each with a `doc` extra; the remaining
four stay pooled in `Board_Sheets` rather than fragmenting every scrap of paper:

`Sheet_Site` · `Sheet_Plan` · `Sheet_Structure` · `Sheet_Section` · `Sheet_Elevation`
· `Sheet_Coordination` · `Sheet_Phasing`

Four new drawing types were authored so the board reads as a real documentation set rather
than four repeating motifs:

- **site** — boundary, road with centreline, our plot picked out in blue, neighbouring
  blocks, north point
- **structure** — column grid with column marks, core zone, transfer beams
- **coordination** — base plan in graphite with a services overlay in blue and two clash
  circles
- **phasing** — a staggered bar programme with phase gridlines

Still no readable text on any of them.

## 9. Semantic anchors added

Thirteen empties, no geometry, all exporting cleanly with `group: "Anchors"`:

```
Building_Spawn_Anchor   Drawing_Origin        Anchor_Drawing
Pencil_Tip_Anchor       Anchor_Preconstruction_Desk
Anchor_Pinboard_Site    Anchor_Pinboard_Structure   Anchor_Pinboard_Coordination
Anchor_Window_Context
Anchor_Building_Foundation  Anchor_Building_Structure
Anchor_Building_Envelope    Anchor_Building_Completion
```

The four building anchors form a ladder up the tower, one label height per phase.
`Pencil_Tip_Anchor` sits at (−0.043, 0.983, 0.7482) — the pencil was moved so its tip
rests on the plot at the edge of the drawn area, so a line animating outward from that
point reads as coming off the pencil.

## 10. glTF extras / custom properties added

| key | on | values |
|---|---|---|
| `system` | Drawing_System and every drawing child | `"Drawing"` |
| `stage` | the seven line groups | `1`–`7` |
| `role` | paper, trace, surface, footprint, anchors | `"paper"`, `"animation_surface"`, `"spawn_footprint"`, `"building_origin"`, `"sheet_origin"`, `"draw_start"` |
| `usable_w` / `usable_d` | `Drawing_Surface` | `0.94` / `0.76` |
| `footprint_w` / `footprint_d` | `Building_Spawn_Anchor` | `0.52` / `0.40` |
| `doc` / `sheet` | the seven pinboard sheets | `"site"`, `"plan"`, … |
| `anchor` / `topic` | every anchor | its own name; `"preconstruction"`, `"site"`, `"delivery"`, … |
| `phase` / `phase_index` | all 14 Building nodes | `"foundation"`/0 … `"completion"`/3 |
| `group` | **new values** `"Drawing"`, `"Anchors"` | |

Existing `group` and `order` extras are untouched.

**Phase mapping**, read off the geometry rather than assigned for convenience:

```
foundation  1 base, 2 podium, 2 accent
structure   3, 5, 7, 9 plates + 11 core
envelope    4, 6, 8, 10 volumes
completion  12 roof, 13 mast
```

Note these **interleave in assembly order** (3 plate, 4 volume, 5 plate…). That is not a
flaw — it is how a floor actually goes up: frame a level, enclose it, frame the next. But
it does mean a scroll-driven phase caption will not advance monotonically if it reads
`phase` directly. See the implementation notes.

## 11. Triangle increase

| | before | after | delta |
|---|---:|---:|---:|
| scene total | 17,804 | **20,212** | +2,408 (+13.5%) |
| objects | 105 | 136 | +31 |
| GLB | 821,248 B | 964,968 B | +143,720 B (+17.5%) |

Where it went: `Drawing` 2,012 (new), pinboard +420 (the four new document types),
desktop −12. Anchors cost 0 triangles. Line work is flat boxes, no curves converted, no
dense edge loops.

## 12. Existing approved geometry that had to move

Four items, each with a reason:

1. **The building assembly rose 2.1 mm**, from `z 0.742` to `z 0.7441`. Required: the plot
   is 1.8 mm thick, so without the lift the model would have been sunk *inside* its own
   drawing and z-fighting with it. Names, order, rotation, internal geometry and the
   shared-origin structure are all unchanged — only the shared `loc.z` constant.
2. **`Desktop_Drawings` and its linework moved left** to (−0.66, 1.16) and dropped from
   three stacked sheets to two. It used to be the main event on this desk; it is now the
   sheet she is working *from*, and the plot is the one the building comes out of.
3. **`Desktop_Tablet` moved** from (0.02, 1.62) to (1.06, 1.60) — it was sitting on top of
   the new plot.
4. **`Desktop_Pencil` and `Desktop_Scale` repositioned** onto the plot: pencil tip at the
   edge of the drawn area, scale rule along the near edge.

Nothing else moved. The desk, walls, ceiling, window, city, credenza, plant, lamp and bin
are untouched.

## 13. Chair

**Not rebuilt. Not touched. Not moved.** Still 14 nodes
(`Chair_Root` + seat, back, back frame, two arms, mechanism, column, base, five casters),
still 2,808 triangles, byte-for-byte the same geometry as the approved version.

## 14. Building outline / assembly system

**Not replaced, not re-solved, not re-examined.** The 13-piece assembly keeps its names,
its `order` extras, its shared origin at the model base and its local-Y-baked heights —
the exact structure the wrapper-based runtime fix depends on. No duplicate outline geometry
was introduced. The only change to any `Bld_*` node is the 2.1 mm z lift in §12 and the
two additive `phase` extras.

Verified in the export: 14 Building nodes, orders 1–13 plus the accent at 2, unchanged.

## 15. Notes for the future Three.js implementation

Things I noticed that **need code and which I deliberately did not write**:

1. **`office_room_v2.json` is now stale.** It is a generated manifest, nothing imports it,
   and regenerating it would have meant writing to `public/` outside the GLB — so I left
   it. It still describes the pre-drawing model and the old building rest height.
2. **`"Drawing"` and `"Anchors"` are new group names.** The loader will pick them up
   automatically and build focus boxes for them — `Drawing` gives you a hero-drawing camera
   target for free in `shots.js`. Nothing breaks without a change: neither name is in
   `UNSHADOWED_GROUPS` or `SHADOW_RECEIVERS_ONLY`, so drawing meshes cast and receive
   normally, which is what the thin line work wants. If you ever see shadow acne on the
   plot, adding `"Drawing"` to `SHADOW_RECEIVERS_ONLY` is the one-line fix.
3. **Anchor empties have no mesh**, so the loader's mesh-only traversal ignores them
   entirely. Reach them with `scene.getObjectByName(...)`.
4. **Phase captions**: `phase` is geometrically honest but interleaves. For a monotonic
   scroll readout, band by `order` instead — 1–2 foundation, 3–8 structure, 9–11 envelope,
   12–13 completion — or take `Math.max` of `phase_index` seen so far.
5. **The drawing-to-building handoff** is already aligned: `Building_Spawn_Anchor.matrixWorld`
   equals each `Bld_*` node's rest matrix exactly, so you can parent the assembly to the
   anchor, or drive the reveal from it, without any offset maths.
6. **`Drawing_Surface`** carries a clean 0..1 UV across the usable area — a shader or a
   texture can be driven across it without deriving one at runtime.
7. **Stage ordering** is on the `stage` extra (1–7); reveal them in that order for the
   sequence in your brief.
8. The nine validation views render correctly and the narrative reads **before** any
   animation is added.
