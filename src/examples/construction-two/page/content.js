/**
 * Every word, number and image path on the page below the hero.
 *
 * This is a template, so all of it is demo content and all of it is meant to be
 * replaced. Keeping it in one module means a client-specific build is an edit
 * to this file and nothing else.
 */

export const BRAND = {
  mark: 'Bytes',
  name: 'Construction',
  email: 'hello@bytesconstruction.com',
}

export const NAV_LINKS = [
  { id: 'work', label: 'Projects', target: 'selected-work' },
  // The standalone capabilities section was removed; the capability content
  // that survived lives in the Approach sequence, so the item points there.
  { id: 'capabilities', label: 'Capabilities', target: 'process' },
  { id: 'approach', label: 'Approach', target: 'process' },
  { id: 'about', label: 'About', target: 'statement' },
]

export const NAV_CTA = { label: 'Start a project', target: 'start' }

/* ---------------------------------------------------------------- imagery
 *
 * PHOTOGRAPHY IS NOT INCLUDED WITH THIS TEMPLATE.
 *
 * Each project points at a local file under public/assets/construction-two/.
 * Drop the four JPEGs in at those exact names and they appear — no code change
 * is needed. Until a file exists the section falls back to a drawn plate, so
 * the page never shows a broken image or an empty box.
 *
 * Save at roughly 2000x1400 (3:2 landscape) and again at half that width with
 * a `@1x` suffix if you want the smaller source used on phones; the srcset
 * below is written for that pair and degrades to the single file if the small
 * one is absent.
 *
 * Licensing: use something you can actually ship. Unsplash and Pexels are both
 * fine for a template. The names are fictional, so do not caption a photograph
 * in a way that claims the pictured building is one of these projects — this
 * is demo imagery standing in for a client's own portfolio.
 */
const IMG = '/assets/construction-two/'

export const IMAGE_NOTES = {
  root: 'public/assets/construction-two/',
  needed: [
    'projects/harbor-district.jpg — podium + tower under construction, or a finished mixed-use waterfront block',
    'projects/northline-works.jpg — long-span steel structure, industrial shed frame, clear-height interior',
    'projects/the-atrium.jpg — full-height hotel or office atrium looking up, strong repetition',
    'projects/civic-commons.jpg — contemporary civic or library architecture, stone or concrete, restrained',
    'site/foundation.jpg, site/structure.jpg, site/envelope.jpg, site/interiors.jpg, site/handover.jpg — site-progress frames for the strip',
  ],
  avoid: 'posed workers, thumbs-up hard-hat stock, cranes against sunsets, anything below 1600px wide',
}

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
    image: `${IMG}projects/harbor-district.jpg`,
    imageSmall: `${IMG}projects/harbor-district@1x.jpg`,
    plate: 'tower',
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
    image: `${IMG}projects/northline-works.jpg`,
    imageSmall: `${IMG}projects/northline-works@1x.jpg`,
    plate: 'works',
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
    image: `${IMG}projects/the-atrium.jpg`,
    imageSmall: `${IMG}projects/the-atrium@1x.jpg`,
    plate: 'atrium',
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
    image: `${IMG}projects/civic-commons.jpg`,
    imageSmall: `${IMG}projects/civic-commons@1x.jpg`,
    plate: 'civic',
  },
]

/* ------------------------------------------------------------------- stats */
export const STATS = [
  { id: 'years', value: '20+', label: 'Years building', rule: 'Since 2005' },
  { id: 'projects', value: '145', label: 'Projects delivered', rule: 'Across nine sectors' },
  { id: 'area', value: '3.2M', label: 'Sq ft completed', rule: 'Measured at handover' },
  { id: 'markets', value: '12', label: 'Active markets', rule: 'Self-perform in four' },
]

/* -------------------------------------------------------------- film strip */
export const FILM_FRAMES = [
  { id: 'foundation', label: 'Foundation', year: '2025', sector: 'Commercial', place: 'Waterfront', image: `${IMG}site/foundation.jpg`, plate: 'foundation' },
  { id: 'structure', label: 'Structure', year: '2025', sector: 'Industrial', place: 'Inland Port', image: `${IMG}site/structure.jpg`, plate: 'structure' },
  { id: 'envelope', label: 'Envelope', year: '2025', sector: 'Mixed-use', place: 'City Centre', image: `${IMG}site/envelope.jpg`, plate: 'envelope' },
  { id: 'interiors', label: 'Interiors', year: '2024', sector: 'Hospitality', place: 'City Centre', image: `${IMG}site/interiors.jpg`, plate: 'interiors' },
  { id: 'handover', label: 'Handover', year: '2024', sector: 'Institutional', place: 'Old Town', image: `${IMG}site/handover.jpg`, plate: 'handover' },
  { id: 'fitout', label: 'Fit-out', year: '2024', sector: 'Commercial', place: 'North Quarter', image: `${IMG}site/interiors.jpg`, plate: 'interiors' },
]

/* ----------------------------------------------------------------- process
 *
 * This now carries the capability content too — the standalone capabilities
 * section was cut, and the four disciplines it listed belong against the stage
 * of work they actually happen in.
 */
export const PROCESS = [
  {
    id: 'plan',
    index: '01',
    title: 'Plan',
    body: 'Scope, programme, cost and logistics aligned before mobilisation.',
    terms: ['Estimating', 'Scheduling', 'Logistics', 'Budget control'],
  },
  {
    id: 'coordinate',
    index: '02',
    title: 'Coordinate',
    body: 'Teams, trades and information working from one clear construction set.',
    terms: ['Coordination', 'Procurement', 'Clash resolution', 'Submittals'],
  },
  {
    id: 'build',
    index: '03',
    title: 'Build',
    body: 'Sequenced execution with programme, safety and quality under control.',
    terms: ['Field execution', 'Quality control', 'Safety', 'Self-perform'],
  },
  {
    id: 'deliver',
    index: '04',
    title: 'Deliver',
    body: 'Commissioning, documentation and handover without loose ends.',
    terms: ['Commissioning', 'Documentation', 'Occupancy', 'Warranty'],
  },
]

/* --------------------------------------------------------------- statement */
export const STATEMENT = {
  label: 'Built for the real world',
  lines: ['We plan for', 'what happens', 'after the drawing', 'leaves the desk.'],
  footnote:
    'Every job is won on a drawing and judged on a building. The distance between the two is the work.',
}

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
