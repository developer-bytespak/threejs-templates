/**
 * Every word and number on the page below the hero.
 *
 * This is a template, so all of it is demo content and all of it is meant to be
 * replaced. Keeping it in one module means a client-specific build is an edit
 * to this file and nothing else — no hunting through JSX for a square-footage
 * figure. Projects carry an `image` field: leave it null and the section draws
 * its own architectural plate, set it to a path and that image is used instead.
 */

export const BRAND = {
  mark: 'Bytes',
  name: 'Construction',
  email: 'hello@bytesconstruction.com',
}

export const NAV_LINKS = [
  { id: 'work', label: 'Projects', target: 'selected-work' },
  { id: 'capabilities', label: 'Capabilities', target: 'capabilities' },
  { id: 'approach', label: 'Approach', target: 'process' },
  { id: 'about', label: 'About', target: 'statement' },
]

export const NAV_CTA = { label: 'Start a project', target: 'start' }

/* ---------------------------------------------------------------- projects */
export const PROJECTS = [
  {
    id: 'harbor',
    index: '01',
    sector: 'Commercial / Mixed-use',
    sectorShort: 'Commercial',
    name: 'Harbor District',
    area: '142,000 sq ft',
    delivery: 'Design + Build',
    year: '2025',
    place: 'Waterfront',
    note: 'Two podium levels of retail under four floors of workspace, built over a live service road.',
    plate: 'tower',
    image: null,
  },
  {
    id: 'northline',
    index: '02',
    sector: 'Industrial',
    sectorShort: 'Industrial',
    name: 'Northline Works',
    area: '310,000 sq ft',
    delivery: 'Construction Management',
    year: '2025',
    place: 'Inland Port',
    note: 'Long-span manufacturing with a 14 m clear height and the plant commissioned in phases.',
    plate: 'works',
    image: null,
  },
  {
    id: 'atrium',
    index: '03',
    sector: 'Hospitality',
    sectorShort: 'Hospitality',
    name: 'The Atrium',
    area: '96,400 sq ft',
    delivery: 'Design + Build',
    year: '2024',
    place: 'City Centre',
    note: 'A 180-key hotel around a full-height atrium, kept open on three sides throughout.',
    plate: 'atrium',
    image: null,
  },
  {
    id: 'civic',
    index: '04',
    sector: 'Institutional / Public',
    sectorShort: 'Institutional',
    name: 'Civic Commons',
    area: '74,800 sq ft',
    delivery: 'Construction Management',
    year: '2024',
    place: 'Old Town',
    note: 'A public library and civic hall joined behind a restored colonnade.',
    plate: 'civic',
    image: null,
  },
]

/* ------------------------------------------------------------------- stats */
export const STATS = [
  { id: 'years', value: '20+', label: 'Years building', rule: 'Since 2005' },
  { id: 'projects', value: '145', label: 'Projects delivered', rule: 'Across nine sectors' },
  { id: 'area', value: '3.2M', label: 'Sq ft completed', rule: 'Measured at handover' },
  { id: 'markets', value: '12', label: 'Active markets', rule: 'Self-perform in four' },
]

/* ------------------------------------------------------------ capabilities */
export const CAPABILITIES = [
  {
    id: 'preconstruction',
    index: '01',
    headline: ['From scope', 'to certainty.'],
    discipline: 'Preconstruction',
    terms: ['Estimating', 'Scheduling', 'Logistics', 'Budget control'],
    note: 'The number that matters is the one agreed before anyone mobilises.',
    plate: 'precon',
  },
  {
    id: 'management',
    index: '02',
    headline: ['From drawings', 'to delivery.'],
    discipline: 'Construction Management',
    terms: ['Coordination', 'Procurement', 'Field execution', 'Quality control'],
    note: 'One construction set, one sequence, every trade working from it.',
    plate: 'manage',
  },
  {
    id: 'closeout',
    index: '03',
    headline: ['From handover', 'to performance.'],
    discipline: 'Closeout',
    terms: ['Commissioning', 'Documentation', 'Occupancy', 'Warranty'],
    note: 'A building is finished when it performs, not when the fence comes down.',
    plate: 'closeout',
  },
]

/* -------------------------------------------------------------- film strip */
export const FILM_FRAMES = [
  { id: 'foundation', label: 'Foundation', year: '2025', sector: 'Commercial', place: 'Waterfront', plate: 'foundation' },
  { id: 'structure', label: 'Structure', year: '2025', sector: 'Industrial', place: 'Inland Port', plate: 'structure' },
  { id: 'envelope', label: 'Envelope', year: '2025', sector: 'Mixed-use', place: 'City Centre', plate: 'envelope' },
  { id: 'interiors', label: 'Interiors', year: '2024', sector: 'Hospitality', place: 'City Centre', plate: 'interiors' },
  { id: 'handover', label: 'Handover', year: '2024', sector: 'Institutional', place: 'Old Town', plate: 'handover' },
  { id: 'fitout', label: 'Fit-out', year: '2024', sector: 'Commercial', place: 'North Quarter', plate: 'interiors' },
]

/* ----------------------------------------------------------------- process */
export const PROCESS = [
  {
    id: 'plan',
    index: '01',
    title: 'Plan',
    body: 'Scope, cost, programme and logistics aligned before mobilisation.',
  },
  {
    id: 'coordinate',
    index: '02',
    title: 'Coordinate',
    body: 'Teams, trades and information moving from one clear construction set.',
  },
  {
    id: 'build',
    index: '03',
    title: 'Build',
    body: 'Sequenced execution with quality, safety and programme under control.',
  },
  {
    id: 'deliver',
    index: '04',
    title: 'Deliver',
    body: 'Commissioning, documentation and handover without the loose ends.',
  },
]

/* --------------------------------------------------------------- statement */
export const STATEMENT = {
  label: 'Built for the real world',
  lines: ['We plan for', 'what happens', 'after the drawing', 'leaves the desk.'],
  footnote:
    'Every job is won on a drawing and judged on a building. The distance between the two is the work.',
}

/* ------------------------------------------------------------------- proof */
export const CLIENTS = ['North & Co', 'Atlas', 'Parker', 'Mason', 'Form', 'Civic', 'Verde', 'Ridgeway']

export const FACTS = [
  { id: 'value', value: '$85M', label: 'Active construction value' },
  { id: 'repeat', value: '92%', label: 'Repeat / referral work' },
]

/* --------------------------------------------------------------------- cta */
export const CTA = {
  lines: ['Have a site', 'in mind?'],
  note: 'Send us a location, a programme and a date. We will tell you what it takes.',
  primary: 'Start a project',
  secondary: 'View selected work',
}

/* ------------------------------------------------------------------ footer */
export const FOOTER = {
  columns: [
    {
      id: 'site',
      label: 'Site',
      items: [
        { label: 'Projects', target: 'selected-work' },
        { label: 'Capabilities', target: 'capabilities' },
        { label: 'Approach', target: 'process' },
        { label: 'About', target: 'statement' },
      ],
    },
    {
      id: 'business',
      label: 'New business',
      items: [{ label: BRAND.email, href: `mailto:${BRAND.email}` }],
    },
    {
      id: 'elsewhere',
      label: 'Elsewhere',
      items: [
        { label: 'LinkedIn', href: '#' },
        { label: 'Instagram', href: '#' },
      ],
    },
  ],
  locations: ['Karachi', 'International'],
  legal: '© 2026 Bytes Construction. Template content — replace before release.',
}
