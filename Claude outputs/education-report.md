# `/education` — Bytes College "Knowledge Tree"

A complete technical and design briefing on the `/education` route of the
`threejs-test` project, written to be handed to someone with no prior context.

Everything below was read from the source or measured by rendering the built
page at 1440×900 and stepping through all eight chapters. Where something is an
opinion rather than a fact, it says so.

---

## 1. What the page is

A single continuous 3D shot, scrolled through, telling one story: a seed opens,
a tree grows out of it, five disciplines branch from the trunk, educational
objects hang in the canopy like a museum, and hidden *inside* the foliage there
is a miniature campus that the camera finally flies into.

It is not a page with a 3D header. There are no sections in the layout sense.
The entire route is one fixed WebGL canvas plus HTML typography layered in
front of and behind it, and a tall empty div that exists only to give the page
something to scroll.

**Brand fiction:** "Bytes College", Est. 2026, positioning line "Learning built
for what comes next."

---

## 2. Stack and where the code lives

- React 19, Vite 8 (rolldown), `@react-three/fiber` v9, `@react-three/drei`, three.js
- Route is lazy-loaded from `src/App.jsx` at path `/education`
- All code in `src/examples/education/` — **19 files, ~4,200 lines**

| File | Lines | What it is |
|---|---:|---|
| `EducationExperience.css` | 1238 | Every style. Two media queries only (900px, reduced-motion) |
| `EducationEditorial.jsx` | 324 | All page copy, composed per chapter |
| `useEducationModels.js` | 299 | Loads 3 GLBs, clones + rigs every material |
| `KnowledgeTree.jsx` | 246 | Growth, discipline focus, canopy thinning |
| `EducationExperience.jsx` | 242 | Root: scroll/pointer wiring, Canvas, chapter state |
| `EducationCamera.jsx` | 240 | 18-keyframe camera path |
| `revealMaterial.js` | 235 | The growth/dissolve shader injection |
| `EducationLighting.jsx` | 183 | Camera-relative studio rig |
| `stages.js` | 149 | Scroll → all derived visual weights |
| `KnowledgeArtifacts.jsx` | 149 | Museum props, idle motion, hover |
| `Motes.jsx` | 141 | Custom GLSL point cloud |
| `chapters.js` | 139 | Chapters, disciplines, all copy constants |
| `EducationScene.jsx` | 132 | Scene graph + per-frame state owner |
| `KnowledgeCampus.jsx` | 128 | Hidden campus, per-building hover response |
| `EducationChrome.jsx` | 96 | Header, nav, chapter rail, pointer readout |
| `WorldLabels.jsx` | 94 | Labels pinned to world anchors |
| `quality.js` | 66 | Device tiers + composition offsets |
| `lightingStates.js` | 58 | 9 lighting keyframes |
| `materials.js` | 53 | Post-load material corrections |

**Assets:** three GLBs in `public/models/education/`, **2.24 MB total**, no textures.

- `knowledge_tree_core.glb` — 530 KB
- `knowledge_artifacts.glb` — 318 KB
- `knowledge_campus.glb` — 1.40 MB

The three files share one world space. The campus genuinely sits *inside* the
canopy at roughly y = 14; nothing is repositioned on load. The concealment is
real geometry, not a trick.

---

## 3. The core architectural idea

**One number drives everything.** Scroll position becomes `progress` (0..1).
`stages.js` derives ~25 named weights from it every frame — `seedOpen`,
`trunkGrowth`, `leafReveal`, `museumFill`, `campusVisibility`, `canopyClear`,
`warmth`, and so on. There are no timelines, no tweens, no stored animation
state anywhere in the scene.

The consequence, and it is the single best decision in this codebase: **scrolling
backwards is correct by construction.** The scene holds no opinion about where
it is, so it cannot fall out of step with the page no matter how hard the
scrollbar is thrown around.

Supporting decisions:

- **Scroll and pointer never enter React state.** They live in a `useRef` the
  frame loop reads. Only *chapter index* and *museum stop* are React state, and
  those change a handful of times across the whole page.
- Continuous HTML motion (the word rail, the ribbon) is driven by a `--p` CSS
  custom property written by the scroll handler, so the editorial layer never
  re-renders while scrolling.
- `EducationScene` runs its `useFrame` at **priority −1** so all derived state
  is computed before any other frame callback reads it.
- Raw scroll is damped (`THREE.MathUtils.damp`, factor 4.5) before driving
  anything. This is what stops a flung scrollbar tearing the camera through the
  canopy.

---

## 4. The eight chapters

Each owns a slice of scroll progress. Total track length is **1100vh**.

| # | id | Range | Copy composition |
|---|---|---|---|
| 0 | `seed` | 0.00–0.10 | "Knowledge starts small." — oversized, 3 lines, last runs off-frame |
| 1 | `growth` | 0.10–0.22 | Horizontal moving rail of 8 single words |
| 2 | `branches` | 0.22–0.39 | Discipline list left, giant "05" bottom-right |
| 3 | `museum` | 0.39–0.58 | 4 sub-stops, each a different layout (verb, panel, rotated type, corner) |
| 4 | `connection` | 0.58–0.68 | Two words pinned to opposite edges, tree passes between |
| 5 | `glimpse` | 0.68–0.77 | One whispered line |
| 6 | `reveal` | 0.77–0.90 | 3 facts at different depths + travelling ribbon |
| 7 | `future` | 0.90–1.00 | Headline + 3 actions, in one column |

**The z-order trick.** The canvas is transparent (`gl: { alpha: true }`) and the
page background is painted in CSS. Editorial layers are split into `--behind`
and `--front` groups that sit on opposite sides of the canvas in z-order, so
"behind" typography is genuinely **occluded by geometry** rather than covered by
a drawn rectangle. The wrapper uses `display: contents` specifically so it
cannot create a stacking context and trap both groups on one side.

The five disciplines: Technology (BUILD), Science (PROVE), Design (SHAPE),
Engineering (SOLVE), Business (REACH) — each with an accent colour, a number,
four meta terms, and matching group names in the GLBs.

---

## 5. The growth shader (`revealMaterial.js`)

The most technically interesting part.

Scaling a branch up from zero reads as a balloon inflating — the silhouette is
wrong the whole way. Instead every vertex stays exactly where Blender put it and
**fragments that have not been reached yet are discarded**, so geometry is
revealed in place along a moving front. The front carries a thin emissive band,
which is what sells it as something advancing rather than something being
uncovered.

Injected via `material.onBeforeCompile` into standard three materials. Three
metrics, because parts of a tree do not grow the same way:

- `up` — world height (the trunk rises)
- `out` — radial distance from the trunk axis (the roots spread)
- `point` — distance from an origin (branches and leaves push outward)

**Critical detail:** every discard is quantised to a fixed world-space grid
(`uEduCell`). A per-fragment hash looks better on paper but dissolves a canopy of
small leaves into a cloud of crawling dots, because the pattern is evaluated per
pixel and so slides across surfaces as the camera moves. Snapping to a grid the
geometry sits still in means a leaf is either revealed or it is not.

Uniforms per material: `uRevealEdge`, `uRevealOrigin`, `uRevealBand`,
`uRevealJitter`, `uRevealGlow`, `uEduCell`, `uEduFade`, `uEduNear`,
`uGrowthHeight`, `uEduEmphasis`.

**Ordering guarantee.** Beyond each part's own weight, everything is gated on
`growthHeight` — the world height the growth front has reached, walked through a
10-point curve from y = −0.75 to y = 24. A branch cannot appear before the front
climbs to its junction; a leaf cannot appear before the branch under it.

Materials are **cloned per group** on load, because glTF shares one material
instance across groups — without cloning, driving the trunk's reveal would drive
the branches' too. Rigs are cached in a `WeakMap` keyed on the loaded scene,
since `useGLTF` returns the same object on every visit to the route.

---

## 6. Camera

18 keyframes in `EducationCamera.jsx`, each with position, look target, fov,
signed composition shift, and a parallax allowance. Coordinates were read off
the GLBs, not guessed.

Two non-obvious solutions worth knowing about:

1. **Orbit legs interpolate in cylindrical space** (`arc: true`). Lerping two
   positions directly draws a chord, and a chord between opposite sides of the
   tree passes straight through the trunk. Azimuth/radius/height interpolation
   keeps the camera outside the canopy.
2. **The glance target.** Holding aim on a distant artifact while swinging round
   the tree means staring through ten metres of leaves for the whole move. The
   look target is lerped toward a point on the near canopy surface, weighted
   `sin(local·π)` so it is zero at both ends and each shot still lands exactly
   on its hero.

Also: vertical FOV means a portrait frame is narrower than it is tall, so the
camera backs off by `min(2.1, (1/aspect)^0.5)` when aspect < 1.

Composition offsets push the subject to the opposite side of frame from the
copy, scaled by distance so the subject stays a constant fraction of the frame.

---

## 7. Lighting

Nine keyframes in `lightingStates.js`, interpolated with smoothstep. Nothing is
created after mount.

Rig: hemi + key + cool fill + cool rim, **rotating with the camera's azimuth**
(lead 0.85 rad, heavily damped, orbit radius 30), plus a soft fill riding the
camera itself. Plus fog near/far and ACES tone-mapping exposure per keyframe.

The rotation exists because the bark is nearly black and a fixed key leaves half
the orbit as an unreadable silhouette. The camera fill exists because inside the
canopy nothing else reaches the subject.

`materials.js` corrects the Blender export after load: the bark exports at 0.067
linear albedo (a 7% reflector) and collapses into the background, so the darkest
materials are scaled toward a target luminance — scaled, not replaced, to
preserve the hue the artist chose. All five leaf materials are forced to
`DoubleSide`, because without it every leaf facing away from the key renders
black, which is most of them at any moment.

---

## 8. Performance and device handling

Three tiers in `quality.js`, chosen by width:

| | compact <720 | medium <1200 | full ≥1200 |
|---|---|---|---|
| max DPR | 1.5 | 1.75 | 2 |
| motes | 260 | 480 | 720 |
| pointer strength | 0.35 | 0.7 | 1 |
| path scale | 0.62 | 0.85 | 1 |
| fov boost | +8 | +3 | 0 |
| world labels | 3 | 4 | 5 |

Shadows are **off at every tier**. `PerformanceMonitor` drops DPR to 1 on decline.
Resize only re-renders if the tier or composition shift actually changed.

Composition also collapses by width: at ≥1180 the subject may sit 30% off-centre
horizontally; below 820 the horizontal range goes to zero and the subject simply
lifts above the copy instead.

Touch is excluded from parallax explicitly — following it would fight the
gesture the user is already making. Reduced-motion zeroes parallax, raises
damping to 30 (effectively instant), widens FOV, and disables the custom cursor.

---

## 9. What works well (my assessment)

- **The architecture.** Derive-everything-from-one-number is the right call and
  is executed consistently. This is the part worth keeping no matter what else
  changes.
- **The growth shader.** Genuinely good, and the grid-quantisation insight is the
  kind of thing most implementations get wrong.
- **The hidden campus.** Real geometry inside the canopy, so occlusion is honest.
  Chapter 5 (`glimpse`) works exactly as intended — you catch the campus through
  gaps and it reads as a discovery.
- **Chapter 0.** The seed occluding the word "Knowledge" proves the z-split, and
  it looks good.
- **The closing shot.** Campus filling frame with a legible headline column over
  a veil. Strongest frame on the page.
- **Comment quality.** Unusually high. Most non-obvious decisions record *why*,
  often including what was tried first and why it failed.

---

## 10. Problems I can see (ranked)

### Severe

**1. Chapter 4 "Connection" is unreadable.** The two words "Every discipline" /
"connects." are pinned to opposite edges with the tree passing between them. In
practice both bleed off-frame *and* sit behind dense foliage: at 1440×900 the
left word reads as "Ever\ndisciplin" cut by the viewport edge, and "connects" is
roughly half off the right edge and behind branches. The idea is good; the
execution loses the sentence entirely. This needs either edge padding, a
contrast treatment, or a camera keyframe that opens a gap for it.

**2. The campus reveal is still "peering through a hedge."** `canopyClear` ramps
over 0.74–0.85, but at p = 0.83 the campus is still substantially occluded by
leaves. The code comments say this is exactly the failure mode they were trying
to avoid, so the thinning is not going far enough or not starting early enough.

### Moderate

**3. Text contrast over the scene.** Several pieces of copy sit at very low
contrast over lit geometry: "There is something built in here" (ch. 5), the
"12 / Labs & studios" fact and "Global / Community" (ch. 6). The `--front`
layers have no scrim of their own except in the final chapter, which *does* have
a veil — and that chapter is the most legible. Worth generalising.

**4. The nav is overlapped by geometry.** "Programmes" in particular sits over
branches in chapters 2, 3, 6 and 7 with no background, and becomes hard to read.

**5. The seed doesn't read as a seed.** In chapter 0 it renders as a large flat
tan form — closer to a cushion or a bread roll than a seed, and much larger in
frame than the "about a fifth of frame height" the camera comment describes. It
is also the very first thing anyone sees.

**6. The tree silhouette is thin.** Branches read as smooth bent tubes crossing
each other at odd angles rather than as a tree structure, and foliage is clumpy
with large bare gaps. This is a modelling/asset issue more than a code one.

### Minor

**7. `knowledge_campus.glb` is 1.40 MB** — 62% of the page's asset weight, for
something not seen until 68% of the scroll. A candidate for Draco/meshopt
compression or deferred loading.

**8. The loader is thin.** A growing line plus "Bytes College", keyed to
`useProgress` and dismissed on `onCreated` — i.e. it hides when the canvas is
*created*, not when the models are ready. Compare with `/construction-two`, which
now gates on model bytes, all images and fonts.

**9. Only two media queries** in 1238 lines of CSS (900px and reduced-motion).
The scene adapts well by tier; the typography has far less breakpoint coverage
than the 3D does.

**10. No audio layer**, unlike `/construction-two`.

---

## 11. Things worth asking before changing anything

- Is the goal a **portfolio piece** or a **real college site**? The current copy
  is atmospheric ("There is something built in here") and would not survive
  contact with an actual admissions team.
- **Is the tree asset final?** Several of the issues above (silhouette, foliage
  distribution, the seed) are modelling problems. Fixing them in code means
  fighting the asset.
- **How long should the journey be?** 1100vh across eight chapters is roughly
  11 screens of scrolling with no way to skip except the chapter rail.
- **Mobile.** The tiers exist and the camera path collapses sensibly, but the
  editorial compositions are elaborate and only one breakpoint exists. Has this
  actually been reviewed on a phone?

---

## 12. Quick reference for a conversation

- Route: `/education` → `src/examples/education/EducationExperience.jsx`
- One number → `stages.js::deriveStage()` → everything
- Growth = fragment discard along a moving world-space front, grid-quantised
- Camera = 18 keyframes, cylindrical interpolation on orbit legs
- Lighting = 9 keyframes, rig rotates with camera azimuth
- Copy = all of it in `chapters.js` + `EducationEditorial.jsx`
- Tuning knobs: `quality.js` (tiers), `lightingStates.js` (light), `stages.js`
  (timing of every reveal), `EducationCamera.jsx` `PATH` (shots)
