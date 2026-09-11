# /construction-two — visual and interaction refinement pass

Everything below is implemented, built and written to `D:\Hassan\threejs-test`
(source under `src/examples/construction-two/`, plus a complete rebuilt `dist/`).

The navbar, its spacing, its scroll-height behaviour and its colours were not
touched. Neither was the hero/environment overlay, any Blender file, any GLB,
the room geometry, the camera choreography, the drawing animation or the
building assembly.

---

## 1. Hero chapter indicator

The vertical six-tick sidebar is gone. In its place, bottom-right of the hero,
is a single horizontal block: the chapter name on the left, `01 / 06` on the
right, and a 1px track underneath that fills as the film runs. It fades in at
1.2% of the hero and fades out at 95.5%, so it is absent for both the opening
title and the handoff. A visually hidden `aria-live` line announces the chapter
for screen readers.

`ConstructionProgress.jsx`, `.chapmark*` in `RoomViewer.css`.

## 2. "SCROLL" indicator

Removed completely — the element, the `.hint*` rules and the `hint-fall`
keyframes. The `.c2page .hint` z-index and hero-lift selectors that referenced
it were repointed at `.chapmark` rather than left dangling. No reserved space
remains anywhere.

## 3. "Built to perform." spacing

`.sectors` now carries `margin: clamp(30px, 4.2vh, 48px) 0 clamp(26px, 3.4vh, 38px)`
with `padding: 16px 0 0` — roughly 30–48px down to the category row and a
comfortable, deliberate gap to the action links at every viewport height.

## 4. Lenis

`lenis@1.3.26` (the current package, not `@studio-freight/lenis`). Exactly one
instance, created in `ConstructionTwoPage` via `useLenis`, with `lerp: 0.1`,
`wheelMultiplier: 1`, `touchMultiplier: 1.6`, `syncTouch: false`.

The important detail is `autoRaf: false`. Lenis is advanced from inside the
page's existing single `requestAnimationFrame` — `lenis.raf(now)` runs first,
then every registered section measures the new position in the same frame. The
page therefore has one loop for smoothing and measuring, not two, and it stays
asleep when the page is at rest.

No double-smoothing: the hero already damps its own progress before the camera
reads it, which is why the lerp here is deliberately light. Under
`prefers-reduced-motion` no instance is constructed at all and every
`scrollTo` becomes an instant jump.

`page/scroll.js`.

## 5. Selected Work — rebuilt

Four projects through one frame.

- **No dead scroll.** Project 01 is fully composed from the first pixel of the
  section. (An earlier version gave it a partial "head start" reveal; at the
  landing position that read as a page still loading, so it was dropped.) Its
  motion is the crop opening.
- **Physical overtake.** Each slot's exit overlaps the next slot's entry by
  30%, so for a third of a viewport both photographs are on screen and moving —
  one contracting and drifting, one expanding over it. Nothing fades out and
  waits.
- **No cards.** A fixed left text column and a travelling photo frame. The type
  clips over between projects; the photograph does the travelling. Two project
  titles can never collide.
- One wipe grammar, three axes (`up`, `right`, a corner `diag`). Every wipe is
  closed at *both* ends — that was a real bug: the diagonal only reached
  `inset(70% 0 0 40%)` at rest, which left a band of project 03 sitting under
  project 02 for a third of the section.
- The frame widens as the picture counter-scales inside it, so the crop opens
  rather than the image magnifying.
- An odometer index that slides rather than switches, and four progress ticks.

`page/SelectedWork.jsx`, `.c2work*`.

## 6. Stats — pointer-interactive

One idea, not four. A single accent lives in the section; at rest it sits on
`3.2M`, and hovering any other figure transfers the blue to it. The blue moves;
nothing lights up. Around that:

- each figure leans up to 7px horizontally / 4px vertically toward the cursor,
- its measurement rule runs out up to 4% further as the cursor moves right,
- figures not holding the accent step back slightly, so there is always one
  subject.

No cards, no 3D tilt. All of it is damped in JS and written to the node as
custom properties via `usePointerField` — refs and direct style writes, never
state. The listener is never attached on `(hover: none)`, so the whole
behaviour is absent on touch and every expression resolves to its resting
value.

`page/ProjectStats.jsx`, `.c2stat*`.

## 7. Capabilities section

Removed entirely — component deleted, markup gone, ~190 lines of CSS gone.

The **navbar item stays**, repointed to `#process`. The four capability
disciplines were not thrown away: they now sit under the process stage they
actually belong to, as a small uppercase term list per stage.

## 8. Process / Approach — rebuilt

One continuous route across a pinned 280vh stage: landing, drop, landing, drop.

- **Drawn as seven measured segments, not an SVG dash.** The obvious
  implementation is one path with `pathLength="1"` and a dash offset — which is
  what the hero pen does, and what this did at first. It is wrong here: the
  stage is drawn with `preserveAspectRatio="none"` so coordinates read as
  percentages, and a dash pattern under non-uniform scale with
  `non-scaling-stroke` visibly comes apart into disconnected pieces. Each
  segment now owns its slice of the route's length and scales from the end the
  line arrives at. It plots in order, in every engine.
- **Nodes sit on the route**, as their own elements at measured points, not
  guessed into position inside the text. A step switches on when the line has
  physically reached its node — never before, never all four at once.
- **Overlap is structural.** Every block stands on top of its own landing, the
  way an annotation sits over a dimension line, so the route passes under its
  text and never through it. Consecutive landings step sideways as well as
  down, so no two blocks share both a column and a neighbouring band.
- 280vh, inside the requested 220–300vh.
- On phones the route straightens into one plotted line down the margin —
  drawn with a transform rather than a swapped `d:` path, which Firefox does
  not support.

`page/ProcessSection.jsx`, `.c2proc*`.

## 9. Structural frame beside the Editorial Statement

The right half was empty; it now holds an abstract building section that
assembles in the order a building actually does — ground datum and setting-out
grid, columns, floor plates, envelope, then the dimensions that say it is a
drawing and not a picture. Five groups, each taking its own slice of the
section's progress, so you cannot get a slab before there is a column under it.

Plotted with `pathLength="1"` and a dash offset — correct here, because this
SVG scales uniformly. No JavaScript animates it; the section writes `--p` and
CSS does the rest.

`page/ScrollDrawings.jsx` → `StructuralFrame`, `.c2draw*`, `.c2say__draw`.

## 10. Client / proof section

Removed completely — component deleted, the marquee, the `c2rail` keyframes and
all `.c2proof*` CSS gone.

## 11. Site plan beside the Final CTA

Deliberately a different drawing from the one above it: that is a building,
this is a plot, which is what the section is asking for. Boundary with the
corner the road cuts off, dimension strings off two edges, setback, footprint
plus wing, the way in, a hatched yard, and a survey crosshair that resolves
last. Once resolved the crosshair tracks the cursor by 6px and no more, damped,
disabled under reduced motion and on touch.

The first cut had the setback only 16 units off the boundary, which read as
double-line noise; it is now held well inside so the two read as two.

`page/ScrollDrawings.jsx` → `SitePlan`, `.c2cta__draw`.

## 12. Photography — image-ready

I could not download photographs: this environment only permits web content
through `WebFetch`/`WebSearch`, which cannot write binaries, and fetching URLs
through shell or Python is not allowed. Per your choice, the page is built
around real `<img>` elements with exact local paths and falls back to the drawn
architectural plates until the files exist.

- `ProjectMedia.jsx` renders a real `<img>` with `srcset` (`@1x` + full),
  `sizes`, `loading="lazy"` for everything except the first project,
  `decoding="async"`, and an `onError` that swaps in the plate. A fresh clone
  never shows a broken-image icon; dropping four JPEGs in needs no code change.
- The wrapper owns the aspect box, so nothing reflows when a file finally
  loads.
- `public/assets/construction-two/README.md` is the drop sheet: exact
  filenames, what each shot should be, size/format/colour spec, and an explicit
  do-not list (no AI imagery, no posed workers or hard-hat stock, no cranes
  against sunsets, no renders in photography slots, nothing under 1600px).

**Files to drop in** — `public/assets/construction-two/`:

```
projects/harbor-district.jpg    mixed-use waterfront block, podium + tower
projects/northline-works.jpg    long-span steel, industrial frame or clear-height interior
projects/the-atrium.jpg         full-height atrium, strong repetition
projects/civic-commons.jpg      contemporary civic architecture, restrained, no people
site/foundation.jpg  site/structure.jpg  site/envelope.jpg
site/interiors.jpg   site/handover.jpg
```

Optional `@1x` half-width variants of the four project files are used on
phones if present and ignored if not. 2000×1400 or larger, 3:2, JPEG q80,
under ~400KB, cool and low-saturation. The project names are fictional and the
README says so — nothing should caption a real building as one of these.

## 13. Section order

Hero film → Selected Work → Stats → On-site film strip → Approach → Statement →
Start a project → Footer.

Light, light, dark, light, dark, dark. The removals did not leave two dark
sections adjacent or two pinned sections back to back, and the film strip still
sits between the two pinned sections as the breath between them.

## 14. Unified motion language

One `--ease` (`cubic-bezier(.16,.84,.24,1)`) everywhere. One idea — a line that
is plotted rather than revealed — restated at four scales: the hero pen, the
process route, the structural frame, the site plan. Type arrives by mask, never
by fade-up-from-nothing. Figures and rules extend to length rather than
appearing. Everything scroll-linked is a clamp of one 0..1 written as `--p`.

## 15. Navbar and hero overlay

Untouched, as instructed. The only edits inside `RoomViewer.css` were removing
the dead `.rail*`/`.hint*` rules and adding `.chapmark*`, plus the `.sectors`
spacing in item 3.

## 16. Responsive QA

Checked in the browser at 1920, 1440, 1280, 1024, 768 and 390.

- **1920 / 1440** — two-column work, four-band process route, two-column
  statement and CTA.
- **1280** — travel shortened, columns narrowed.
- **1024** — statement and CTA drop to one column with the drawing under the
  copy at a smaller scale; work keeps two columns with the note suppressed.
- **768** — portrait tablet keeps the two-column work layout; it holds.
- **390** — work stacks (photograph, then text directly under it, not pinned to
  the bottom of the screen); the process route straightens to one line down the
  margin with all four blocks fitting one viewport; statement and CTA stack.

Two real bugs were found and fixed during this:

- **The text column was sized in `ch`.** A `ch` there is measured against the
  column's own 16px body size, not the 48px display size of the project name,
  so `min(30ch, 27vw)` gave a 216px column at 1440 and "Harbor District"
  wrapped inside its own mask. It is now one named `--textw` in vw/px, and the
  frame's maximum width derives from it so the two cannot disagree.
- **The element reset out-ranked every class.** `.c2page h2` is (0,1,1) and
  beats a single-class rule like `.c2say__label`, so *every* margin and padding
  set by class on a `p`, `h2`, `h3`, `ul`, `ol`, `dl`, `dd` or `figure` was
  being silently discarded — a whole page of spacing that looked intentional
  and was not (the project title sat directly on top of its metadata; the
  process term lists had no gap; the phone process copy ran straight through
  the route line). The reset is now
  `.c2page :where(h2, h3, p, …)`, which contributes zero specificity on the
  element half. Nav, menu, hero and footer are unaffected — none of their
  spacing rules target reset elements.

## 17. Performance

- One `requestAnimationFrame` for the entire page, shared by Lenis and by every
  scroll-linked section; it is woken by scroll and stays alive only while Lenis
  is still animating.
- Scroll drives CSS custom properties written straight to the DOM node. React
  re-renders roughly four times in the whole Selected Work section, not once
  per frame.
- Motion is `transform`/`clip-path`/`opacity` — `translate3d` where it is worth
  a layer, `will-change` only on the four stat blocks.
- Pointer interaction is refs and direct style writes, damped in its own rAF
  that only exists while the pointer is over the element, and never attached on
  `(hover: none)`.
- Every `useScrollLink` removes its item and unbinds the listeners on unmount;
  `useLenis` destroys the instance; `usePointerField` cancels its frame.
- Images are lazy except the first project, which is `eager` +
  `fetchPriority="high"`; `srcset`/`sizes` on all of them.
- Under `prefers-reduced-motion`: no Lenis, no pins, no masks. Selected Work
  becomes the ordered document that was underneath it all along, all figures
  are filled, both drawings are complete and the process route is fully
  plotted.

---

## Polish pass — things changed after "it works"

- Project 01's entrance removed; it is simply already there.
- Every project wipe closed at both ends (the stacking bug above).
- Masked headings given a `padding-bottom` so a renamed project cannot lose a
  descender.
- Project metadata capped at 300px — across the full column the label/value
  pairs read as two unrelated lists rather than three rows.
- Site-plan setback moved well inside the boundary.
- Drawing strokes lifted from 58%/30% to 72%/40% on charcoal; at the old values
  they read as a smudge rather than a sheet.
- Display type on the project name allowed to reach 3.4rem on large screens.
- The `.c2media` rule moved out of the work block, since the film strip uses it
  too.

## Two things left for you

1. `page/Capabilities.jsx` and `page/ClientProof.jsx` are no longer imported by
   anything and are tree-shaken out of the build, but they are still on disk —
   this session cannot delete files on your machine. Safe to delete.
2. `lenis` was added to `package.json` and `package-lock.json`, and the package
   itself was written into `node_modules/lenis` so the current dev server and
   build work as-is. Run `npm install` once at your convenience to have npm
   manage it properly.
