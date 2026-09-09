/**
 * The registry behind the menu at "/". Each example lives in its own folder
 * beside this file and owns everything it needs — components, styles and
 * helpers — so nothing is shared between them by accident.
 *
 * Adding one means creating that folder, adding an entry here and adding a
 * route in App.jsx; the menu builds itself from this list.
 */
export const EXAMPLES = [
  {
    id: 'construction',
    path: '/construction',
    title: 'Construction',
    tagline: 'A building, taken apart',
    description:
      'A scroll-driven exploded view of a nine-storey building. Eight systems — foundation, columns, beams, slabs, walls, glazing, facade and roof — separate in sequence, hold as an architectural diagram, then reassemble. The scroll sections carry no copy: this one is a template waiting for content.',
    tags: ['glTF', 'Scroll choreography', 'Exploded view', 'Layer hover'],
    poster: '/previews/construction.jpg',
    accent: '#0b0d11',
  },
  {
    id: 'construction-two',
    path: '/construction-two',
    title: 'Construction Two',
    tagline: 'An architect\u2019s office, late afternoon',
    description:
      'A scroll-driven cinematic through a toon-shaded office. The camera moves between eight framed shots while the card model on the desk assembles itself \u2014 wireframe first, then solid.',
    tags: ['glTF', 'Toon shading', 'Scroll camera', 'Cursor parallax'],
    poster: '/previews/construction-two.jpg',
    accent: '#0a1740',
  },
  {
    id: 'crypto',
    path: '/crypto',
    title: 'Crypto Network',
    tagline: 'A programmable financial layer',
    description:
      'One particle system carries a six-act story: a living data sphere resolves into transactions, breaks apart, reassembles as a blockchain, then reforms as a digital globe.',
    tags: ['GPU particles', 'GLSL morphing', 'Scroll states', 'Pointer parallax'],
    poster: '/previews/crypto.jpg',
    accent: '#07090d',
  },
  {
    id: 'education',
    path: '/education',
    title: 'Bytes College',
    tagline: 'The Knowledge Tree',
    description:
      'An eight-chapter journey through one continuous shot: a seed opens, roots and trunk grow along a shader reveal front, five discipline branches fill the canopy, and a miniature campus hidden inside the foliage is finally reached.',
    tags: ['Three GLBs', 'Shader growth', 'Camera path', 'Occluded typography'],
    poster: '/previews/education.jpg',
    accent: '#06080b',
  },
]
