# office_room — model specification and handoff notes

Everything below was read directly out of the Blender file, the exported GLB and the
front-end source on 2026-09-10. Figures are measured, not estimated.

---

## 1. File locations

| What | Path |
|---|---|
| **Blender source (the master)** | `C:\Users\S JUNAID\Documents\3d_room.blend` — 4.81 MB, Blender 5.1.1 |
| **Exported model used by the site** | `D:\Hassan\threejs-test\public\office_room.glb` — 5.61 MB |
| **Hand-written manifest beside it** | `D:\Hassan\threejs-test\public\office_room.json` — 2.6 KB |
| **Front-end project** | `D:\Hassan\threejs-test` (Vite + React + react-three-fiber, git repo) |
| **Code that consumes the model** | `D:\Hassan\threejs-test\src\examples\construction-two\` (9 files) |
| **Route it renders at** | `/construction-two` |

> **Note:** the `.blend` lives in `Documents`, **outside** the git repo that holds the
> `.glb`. The source of truth is not version-controlled with the thing it produces.

---

## 2. What it is

A stylised architect's office, built for a scroll-driven cinematic on the web. A woman
sits at a desk facing a pinboard; a window on her left looks onto a flat city; a scale
model of a tower sits on the desk. The camera moves between nine framed shots as the
page scrolls, and the tower on the desk assembles itself — wireframe edges drawing on
first, then solid volumes growing up inside the cage.

The look is deliberately flat: two tones per material (a lit colour and a shadow
colour, no gradient) plus a black outline around every object. Blue/cream palette,
background `#0A1740`.

**Scale and orientation**

- Metric, 1 unit = 1 m, Blender Z-up. Exported Y-up.
- Room interior: **6.4 m × 7.1 m × 3.0 m** (bbox `-3.2,-4.0,-0.12` → `3.2,3.12,2.92`).
- Desk top at z = 0.75 m. Figure is 1.30 m tall seated.
- Room walls are **single-sided**. A camera outside the shell sees nothing.

---

## 3. How it was made

**Procedurally, by Blender Python scripts** — not modelled by hand in the viewport.
Almost every object is a primitive (cube/cylinder/cone) placed by code, which is why
names are systematic (`Pin_Sheet_0..6`, `Bld_01_base`..`Bld_13_mast`, `City_Block_0..9`)
and why nearly every mesh is 12 triangles.

The one exception is the figure: a purchased rigged human ("Claudia Rigged 002",
Free3D), imported as FBX, posed on its armature, then **baked to a static mesh** for
export.

**Modifiers still live in the .blend** (applied at export time, not before):

| Modifier | Count | Purpose |
|---|---|---|
| `SOLIDIFY` | 67 | 66 outline shells + the bin |
| `BEVEL` | 36 | edge softening on furniture |
| `SIMPLE_DEFORM` | 9 | plant leaf curl |
| `ARMATURE` | 2 | figure + its outline shell |

No animation: 0 actions, 0 shape keys, frame range untouched at 1–250.
No image textures — everything is flat colour from shader nodes.

---

## 4. Object inventory

**188 objects total, 112,269 triangles**, in two collections:

- `Collection` — 118 objects, all the real geometry
- `Outlines` — 66 objects, every `*_OL` shell

| Group | Objects | of which outlines | Triangles | Materials |
|---|---|---|---|---|
| Room shell (`Room_*`) | 8 | 0 | 96 | NPR_Floor, NPR_Wall, NPR_Ceiling |
| Window (`Win_*`) | 12 | 6 | 144 | NPR_Wood, NPR_Outline |
| City / sky (`City_*`, `Cloud_*`, `Sky_*`) | 17 | 0 | 204 | NPR_City, NPR_Tower, NPR_Cloud, NPR_Sky |
| Desk (`Table_*`, parented to `Table` empty) | 18 | 9 | 216 | NPR_Wood, NPR_Outline |
| **Building on desk** (`Bld_*`, parented to `Bld_Root` empty) | **13** | 0 | 156 | NPR_Model |
| Chair (`Chair_*`) | 16 | 8 | 416 | NPR_Chair, NPR_Outline |
| Pinboard (`Pin_*`) | 26 | 9 | 1,096 | NPR_Board, NPR_Paper, NPR_Metal, NPR_Outline |
| Plant (`Plant_*`) | 20 | 10 | 464 | NPR_Plant, NPR_Furn, NPR_Outline |
| Shelf / credenza (`Shelf_*`) | 25 | 12 | 2,580 | NPR_Furn, NPR_Paper, NPR_Outline |
| Desk props (`Prop_*`) | 23 | 11 | 612 | NPR_Paper, NPR_Furn, NPR_Metal, NPR_Chair, NPR_Outline |
| **Figure** (`Claudia_*`, `rp_claudia_*`) | 4 | 2 | **106,285** | NPR_Skin, NPR_Hair, NPR_Blouse, NPR_Trousers, NPR_Shoes, NPR_Outline |

**The figure is 95% of the triangle budget.** Everything else in the room together is
under 6,000 triangles.

**Non-mesh objects:** `Sun` (SUN, energy 6.0, rot `1.024, 0, -1.002`), `SunFill`
(SUN, energy 1.35, rot `1.308, 0, -0.315`), `Camera`, `Table` (empty),
`Bld_Root` (empty), `rp_claudia_rigged_002` (armature).

**The building pieces** — numbered bottom-up, 12 triangles each, all `NPR_Model`:

```
Bld_01_base   Bld_02_podium  Bld_03_plate  Bld_04_tier   Bld_05_plate
Bld_06_tier   Bld_07_plate   Bld_08_tier   Bld_09_plate  Bld_10_tier
Bld_11_core   Bld_12_cap     Bld_13_mast
```

Footprint `0.06, 1.08, 0.75` → `0.58, 1.54, 1.14` (about 52 × 46 × 39 cm on the desk).

---

## 5. The shading system

### 5.1 Toon materials (21 of them)

Every lit material is the same five-node chain in EEVEE:

```
Diffuse BSDF → Shader to RGB → ColorRamp (2 stops) → Emission → Material Output
```

`Shader to RGB` converts the lighting result to a value; the ColorRamp quantises it to
exactly two colours; Emission outputs it flat so nothing further lights it. The ramp
interpolation is `CONSTANT` for hard-edged surfaces and `LINEAR` with a narrow band
(≈0.06 wide) for organic ones — skin, hair, cloth, the model — to avoid a jagged
terminator on curved geometry.

Six materials skip the chain entirely and are pure `Emission` — flat, unlit by design:
`NPR_Ceiling`, `NPR_City`, `NPR_Tower`, `NPR_Cloud`, `NPR_Sky`, `NPR_Outline`.

**Full palette (lit / shadow):**

| Material | Lit | Shadow | Ramp | Users |
|---|---|---|---|---|
| NPR_Wall | `#2E5BC8` | `#1B3FA0` | CONSTANT @0.40 | 6 |
| NPR_Floor | `#1B3FA0` | `#122A73` | CONSTANT @0.44 | 1 |
| NPR_Ceiling | `#122A73` | `#122A73` | — (emission) | 1 |
| NPR_Wood | `#DEDACF` | `#1B3FA0` | CONSTANT @0.34 | 15 |
| NPR_Furn | `#2E5BC8` | `#122A73` | CONSTANT @0.42 | 13 |
| NPR_Chair | `#DEDACF` | `#1B3FA0` | CONSTANT @0.22 | 9 |
| NPR_Paper | `#DEDACF` | `#C6C3BA` | CONSTANT @0.26 | 20 |
| NPR_Board | `#C9C5B9` | `#5E7BB5` | CONSTANT @0.30 | 1 |
| NPR_Metal | `#DEDACF` | `#122A73` | CONSTANT @0.45 | 8 |
| NPR_Plant | `#2E5BC8` | `#122A73` | CONSTANT @0.46 | 9 |
| NPR_Model | `#EDE9DF` | `#2E5BC8` | LINEAR 0.23–0.29 | 13 |
| NPR_Skin | `#DEDACF` | `#1B3FA0` | LINEAR 0.16–0.22 | 2 |
| NPR_Hair | `#1E357A` | `#080F33` | LINEAR 0.33–0.39 | 2 |
| NPR_Blouse | `#EFECE4` | `#3A63CE` | LINEAR 0.14–0.20 | 2 |
| NPR_Trousers | `#3E63BE` | `#14245E` | LINEAR 0.27–0.33 | 2 |
| NPR_Shoes | `#1B2E70` | `#080F33` | LINEAR 0.31–0.37 | 2 |
| NPR_City | `#9DB6CC` | — | emission | 10 |
| NPR_Tower | `#5E7BB5` | — | emission | 3 |
| NPR_Cloud | `#DEDACF` | — | emission | 3 |
| NPR_Sky | `#C4D8E3` | — | emission | 1 |
| NPR_Outline | `#0A1740` | — | emission, backface-culled | 67 |

All materials are `blend_method = HASHED`.

### 5.2 Outlines — the inverted-hull trick

There is no post-process edge detection. Instead **every object that needs an outline
has a second object beside it**, suffixed `_OL`, which is:

- a copy of the mesh with its own mesh datablock (not linked/shared),
- carrying a `SOLIDIFY` modifier: `thickness 0.009`, `offset -1.0`,
  `use_flip_normals True`, `use_rim False`,
- assigned `NPR_Outline` with `use_backface_culling = True`,
- parented to the same parent and sitting at the identical transform.

Because the normals are flipped and the front faces are culled, you only ever see the
shell where it pokes out past the silhouette of the real object — a 9 mm black edge.

**66 outline objects, one per outlined mesh.** They are a manually maintained parallel
copy of the geometry.

---

## 6. Export pipeline and the name mangling

The GLB was produced by **Khronos glTF Blender I/O v5.1.19**, Y-up, modifiers applied.

| | .blend | .glb |
|---|---|---|
| Objects / nodes | 188 | 183 |
| Meshes | 182 | 180 |
| Triangles | 112,269 | 76,439 |
| Materials | 21 | 21, each renamed with an `_EXP` suffix |
| Animations / skins | 0 / — | 0 / 0 |

**Object names do not survive the export.** Everything is renamed to
`Grp_<GroupName>_<index>` before export:

| Blender name | GLB node name |
|---|---|
| `Bld_01_base` | `Grp_Building_1` |
| `Bld_13_mast` | `Grp_Building_13` |
| `Table_Top` | one of `Grp_Desk_1..9` |
| `Claudia_Export` | `Grp_Figure_1` |
| any `*_OL` | one of `Grp_Outline_1..66` |

The 14 group names in the GLB are:

```
Floor  Ceiling  Walls  Window  Skyline  Pinboard  Desk
Chair  Desktop  Bin    Credenza  Plant   Figure   Outline
```

Materials likewise become `NPR_Wall_EXP`, `NPR_Model_EXP`, etc. — the ShaderToRGB
chain has no glTF equivalent, so the exporter bakes each one down to a flat PBR
material and the two-tone look is **re-implemented from scratch on the web side**.

The GLB also still contains the `Sun`, `SunFill` and `Camera` nodes, which the runtime
ignores — it builds its own lighting.

---

## 7. The runtime contract (what the web code depends on)

`src/examples/construction-two/useRoomModel.js` loads the GLB and:

1. For each mesh, walks **up** the parent chain to find the nearest ancestor whose name
   starts with `Grp_`, then strips the prefix and the trailing index to get the group
   name. (It walks up because a multi-material node — the figure has five — becomes a
   Group whose children GLTFLoader names after the glTF *mesh*, e.g. `Mesh001_2`, and
   only the ancestor still carries the `Grp_` name.)
2. Replaces every material with a custom toon `ShaderMaterial`, mapping back to the
   palette by stripping the `_EXP` suffix (and a `Toon_` prefix on re-entry).
3. Re-seats the whole scene so the room footprint is centred on the origin with the
   floor at y = 0 — **deliberately excluding the `Skyline` group**, which sits metres
   outside the window and would otherwise drag the centre off.
4. Measures a bounding box per group; the camera shots aim at those boxes rather than
   at hard-coded coordinates.
5. Collects the `Building` group into an ordered list, **parsing the assembly order out
   of the trailing number in the node name** (`Grp_Building_1` = base plate), and hides
   every piece until the scroll reaches it.

Constants that must agree with the model (`palette.js`):

```js
MODEL_URL             = '/office_room.glb'
OUTLINE_GROUP         = 'Outline'
BUILDING_GROUP        = 'Building'
UNSHADOWED_GROUPS     = Set { 'Skyline', 'Outline' }
SHADOW_RECEIVERS_ONLY = Set { 'Building' }
WIREFRAME_COLOUR      = '#7FA6E0'
SUN_DIRECTION         = [-0.72, 0.52, 0.46]   FILL_DIRECTION = [-0.3, 0.26, 0.92]
SUN_WEIGHT 1.0        FILL_WEIGHT 0.35        AMBIENT_FLOOR 0.12
```

`Building.jsx` rebuilds each piece's edges as a bottom-up ordered line list and reveals
them with `setDrawRange`, then grows the solid upward from its own underside
(`WIRE_END 0.6`, `SOLID_START 0.45`, `PIECE_SHARE 0.42` of the scroll range each, the
remainder spread as stagger).

---

## 8. Where this is genuinely held together with tape

Listed honestly, worst first.

1. **Names are rewritten on export, and the web code parses meaning out of the new
   names.** Assembly order of the tower is `Number(name.match(/_(\d+)$/))`. Rename,
   reorder, add or delete a `Bld_*` piece in Blender and the site's build sequence
   changes silently — no error, just a different animation. The Blender names and the
   runtime names are two different vocabularies with an undocumented mapping between
   them.

2. **66 outline shells are a duplicate copy of the geometry, maintained by hand.**
   Move, rescale or reshape anything and its `_OL` twin must be redone or the black
   edge slides off the silhouette. There is no modifier or constraint linking them —
   the mesh data is not even shared (`Cube` vs `Cube.122`).

3. **The look exists twice, in two unrelated implementations.** EEVEE ShaderToRGB in
   Blender, a hand-written GLSL toon `ShaderMaterial` in three.js. Neither can validate
   the other; they are kept in sync by eye.

4. **The palette is stored in three places** — the `npr_palette` custom property on the
   Blender scene, `public/office_room.json`, and `src/.../palette.js`. They currently
   agree. Nothing enforces that.

5. **The figure is 106,285 of 112,269 triangles** (~64k of the GLB's 76k) for a
   character seen from behind, small in frame, in a flat two-tone style. It is a
   photoreal scan mesh wearing a cartoon shader. Decimating it would cut the GLB by
   more than half with almost no visible cost.

6. **`office_room.json` is a hand-written manifest**, not generated by the export. It
   records camera values, a suggested shot, group names and the palette. Nothing
   regenerates it when the model changes.

7. **The `.blend` is outside the repo.** `Documents\3d_room.blend` has no version
   history tied to the `.glb` it produces.

8. **Lights and a camera ride along in the GLB** unused, and `SHADOW_RECEIVERS_ONLY`
   exists purely because the sun's `normalBias` (7.5 cm) is thicker than the building's
   plates, which made them self-shadow — a workaround, documented in the source.

9. **`fig_parts`**, a scene custom property, holds a list of generic names
   (`Sphere.001`, `Cone.004`, …) left over from the figure-part detection pass. Dead
   data.

10. **Single-sided walls** mean every camera position is constrained to the interior
    shell; `resolveShots` only warns about this in dev.

**What is actually solid:** the geometry is cheap and clean (12 triangles per prop),
naming inside Blender is consistent and machine-generated, the group scheme genuinely
does drive the camera from measured geometry rather than magic numbers, and there is no
baked animation anywhere — all motion is a pure function of scroll progress.

---

## 9. If you want to change something

| Goal | Where |
|---|---|
| Change a colour | `npr_palette` in Blender **and** `palette.js` **and** `office_room.json` |
| Change outline thickness | the `SOLIDIFY` modifier on all 66 `*_OL` objects (0.009 today) |
| Add/remove a tower piece | `Bld_*` in Blender → re-export → check `Grp_Building_N` order → `Building.jsx` timing constants |
| Move furniture | the object **and** its `_OL` twin |
| Reduce file size | decimate the figure; it is the whole budget |
| Re-export | Blender glTF export, Y-up, apply modifiers, to `D:\Hassan\threejs-test\public\office_room.glb` — and keep the `Grp_*` renaming step |
