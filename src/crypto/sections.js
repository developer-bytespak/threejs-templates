import { BLOCK_COUNT } from './layout.js'
import { CITIES } from './worldMask.js'

/**
 * The six scroll states.
 *
 * `layout` decides which side of the frame the copy occupies, and the camera
 * pushes the 3D subject the other way (see SHOTS in CryptoCamera). `reveal`
 * picks how the block enters. Both vary section to section on purpose: a
 * single repeated treatment reads as a template no matter how good the copy is.
 *
 * `meta` is a readout of the scene actually on screen rather than invented
 * marketing figures — the numbers come from the live quality tier and from the
 * same city list the globe draws its hubs from.
 */
export const SECTIONS = [
  {
    id: 'sphere',
    layout: 'left',
    reveal: 'rise',
    scale: 'hero',
    eyebrow: 'Decentralized infrastructure',
    headline: 'The financial network is becoming programmable.',
    body: 'A living digital system where value, data and ownership move across a global decentralized network.',
    actions: [{ label: 'Explore the Network', href: '#transactions', primary: true }],
  },
  {
    id: 'transactions',
    layout: 'right',
    reveal: 'slide',
    eyebrow: 'Real-time value transfer',
    headline: 'Every transaction becomes part of the network.',
    body: 'Data moves continuously between participants, markets and decentralized infrastructure.',
    meta: {
      kind: 'stats',
      of: (quality) => [
        ['Nodes', String(quality.nodes)],
        ['Active routes', String(quality.transactionArcs)],
        ['Participants', quality.particles.toLocaleString('en-US')],
      ],
    },
  },
  {
    id: 'decentralized',
    layout: 'center',
    reveal: 'zoom',
    scale: 'statement',
    eyebrow: 'Decentralized by design',
    headline: 'A network without a single center.',
    body: 'Participants remain independent while contributing to a shared system of verification and settlement.',
  },
  {
    id: 'blockchain',
    layout: 'lower',
    reveal: 'wipe',
    eyebrow: 'Verified on-chain',
    headline: 'Transactions become immutable blocks of trust.',
    body: 'Each validated event strengthens the chain and extends a shared record that cannot be silently rewritten.',
    meta: {
      kind: 'ledger',
      of: () => [
        ['Blocks', String(BLOCK_COUNT)],
        ['Connectors', String(BLOCK_COUNT - 1)],
        ['Validation', 'Sequential'],
      ],
    },
  },
  {
    id: 'global',
    layout: 'right',
    reveal: 'slide',
    eyebrow: 'Global by default',
    headline: 'Digital value moves without borders.',
    body: 'Infrastructure connects markets, organizations and users through one programmable global layer.',
    meta: {
      kind: 'hubs',
      of: () => CITIES.slice(0, 9).map((city) => city.name),
    },
  },
  {
    id: 'final',
    layout: 'closing',
    reveal: 'rise',
    scale: 'statement',
    eyebrow: 'The next financial layer',
    headline: 'Build on infrastructure designed for a connected world.',
    actions: [
      { label: 'Start Building', href: '#sphere', primary: true },
      { label: 'View Infrastructure', href: '#blockchain' },
    ],
  },
]
