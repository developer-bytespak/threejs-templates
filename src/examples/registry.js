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
    tagline: 'An architect’s office, late afternoon',
    description:
      'A scroll-driven cinematic through a toon-shaded office. The camera moves between eight framed shots while the card model on the desk assembles itself — wireframe first, then solid.',
    tags: ['glTF', 'Toon shading', 'Scroll camera', 'Cursor parallax'],
    poster: '/previews/construction.jpg',
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
]
