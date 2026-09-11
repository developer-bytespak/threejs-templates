# Photography for /construction-two

The page is built around real photographs. None ship with the template, because
none of the stock we could ship would be licensed for your client's site — so
every image slot resolves to a drawn architectural plate until the file exists,
and swaps to the photograph the moment it does. No code change, no rebuild
logic: the filename is the contract.

Drop files in at exactly these paths, relative to this folder.

## Selected work — the four project photographs

These carry the section. They are seen large (up to 52vw tall on a desktop),
one at a time, so resolution and composition both matter.

| File | What it should be |
| --- | --- |
| `projects/harbor-district.jpg` | A mixed-use waterfront block — podium and tower, under construction or newly finished. Horizontal, some sky. |
| `projects/northline-works.jpg` | Long-span steel: an industrial shed frame, or a clear-height interior with the portal frames repeating away from camera. |
| `projects/the-atrium.jpg` | A full-height atrium looking up or across. Strong repetition, strong light. |
| `projects/civic-commons.jpg` | Contemporary civic architecture — library, hall, gallery. Stone or concrete, restrained, no people. |

Optional, and used on phones if present: the same four names with an `@1x`
suffix before the extension (`projects/harbor-district@1x.jpg`), at half width.
The `srcset` degrades to the single full-size file if they are absent.

## Film strip — five site-progress frames

Smaller, seen in sequence, read as a set. They should look like one project
photographed at five stages rather than five unrelated buildings.

`site/foundation.jpg`, `site/structure.jpg`, `site/envelope.jpg`,
`site/interiors.jpg`, `site/handover.jpg`

## Specification

- **Size** 2000 × 1400 or larger, 3:2 landscape. Below 1600px wide it will
  visibly soften at the sizes this page uses.
- **Format** JPEG at quality 80, or WebP if you also update the extensions in
  `content.js`. Aim under 400 KB each; the page lazy-loads everything except
  the first project.
- **Colour** Cool, grey-blue, low saturation. The page's own palette is warm
  paper and charcoal, and the photographs are the only colour on it — a warm
  orange sunset shot will fight the type.

## What not to use

- AI-generated imagery.
- Posed workers, thumbs-up hard hats, handshakes, people smiling at camera.
- Cranes silhouetted against sunsets.
- Renders, diagrams or drawings in the photography slots. The page already
  has its own drawings and they are doing that job.

## One legal note

The project names in `content.js` are fictional. Do not caption a photograph
in a way that claims the building pictured was built by Bytes Construction,
and check the licence of anything you place here — Unsplash and Pexels are
both fine for a template, client work usually is not.
