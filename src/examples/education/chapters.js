/**
 * The eight chapters of the journey, and every word of copy in the page.
 *
 * Each chapter owns a slice of the master scroll progress. The HTML layers
 * read `range` to decide when they are on stage; the camera and the scene
 * read the same numbers through stages.js. Nothing here is a "section" in the
 * page-layout sense — a chapter is a moment in one continuous shot, and the
 * copy that belongs to it is composed differently every time on purpose.
 */
export const CHAPTERS = [
  { id: 'seed', label: 'The Seed', range: [0.0, 0.1] },
  { id: 'growth', label: 'Growth', range: [0.1, 0.22] },
  { id: 'branches', label: 'Disciplines', range: [0.22, 0.39] },
  { id: 'museum', label: 'The Knowledge Museum', range: [0.39, 0.58] },
  { id: 'connection', label: 'Connection', range: [0.58, 0.68] },
  { id: 'glimpse', label: 'Campus Glimpse', range: [0.68, 0.77] },
  { id: 'reveal', label: 'The Campus', range: [0.77, 0.9] },
  { id: 'future', label: 'Your Next Chapter', range: [0.9, 1.0] },
]

export const CHAPTER_INDEX = Object.fromEntries(
  CHAPTERS.map((chapter, index) => [chapter.id, index]),
)

/** The five disciplines, in the order they read around the tree. */
export const DISCIPLINES = [
  {
    id: 'technology',
    name: 'Technology',
    number: '01',
    // Matches the group names in the GLBs.
    branch: 'branch_technology',
    leaves: 'leaves_technology',
    artifacts: 'artifacts_technology',
    building: 'technology_building',
    accent: '#7fb3d5',
    word: 'BUILD',
    meta: ['Computing', 'Artificial Intelligence', 'Software', 'Digital Systems'],
  },
  {
    id: 'science',
    name: 'Science',
    number: '02',
    branch: 'branch_science',
    leaves: 'leaves_science',
    artifacts: 'artifacts_science',
    building: 'science_building',
    accent: '#84c4a4',
    word: 'PROVE',
    meta: ['Labs', 'Biotechnology', 'Applied Research', 'Materials'],
  },
  {
    id: 'design',
    name: 'Design',
    number: '03',
    branch: 'branch_design',
    leaves: 'leaves_design',
    artifacts: 'artifacts_design',
    building: 'design_building',
    accent: '#b7a3d6',
    word: 'SHAPE',
    meta: ['Form', 'Interaction', 'Motion', 'Craft'],
  },
  {
    id: 'engineering',
    name: 'Engineering',
    number: '04',
    branch: 'branch_engineering',
    leaves: 'leaves_engineering',
    artifacts: 'artifacts_engineering',
    building: 'engineering_building',
    accent: '#9fbf8d',
    word: 'SOLVE',
    meta: ['Structures', 'Systems', 'Robotics', 'Energy'],
  },
  {
    id: 'business',
    name: 'Business',
    number: '05',
    branch: 'branch_business',
    leaves: 'leaves_business',
    artifacts: 'artifacts_business',
    building: 'business_building',
    accent: '#d8b98a',
    word: 'REACH',
    meta: ['Markets', 'Ventures', 'Strategy', 'Economics'],
  },
]

export const DISCIPLINE_BY_ID = Object.fromEntries(
  DISCIPLINES.map((discipline) => [discipline.id, discipline]),
)

/**
 * The fragments that ride the horizontal rail through chapter two. Deliberately
 * single words: the rail is a texture of ideas passing, not a sentence.
 */
export const RAIL_WORDS = [
  'Curiosity',
  'Experimentation',
  'Discovery',
  'Discipline',
  'Evidence',
  'Craft',
  'Community',
  'Consequence',
]

/** Campus buildings that answer to the pointer, with the label each shows. */
export const CAMPUS_BUILDINGS = [
  { node: 'academic_main', label: 'Academic Main', kind: 'warm' },
  { node: 'library', label: 'Library', kind: 'lantern' },
  { node: 'auditorium', label: 'Auditorium', kind: 'warm' },
  { node: 'technology_building', label: 'Technology', kind: 'cool' },
  { node: 'science_building', label: 'Science', kind: 'clean' },
  { node: 'design_building', label: 'Design', kind: 'expressive' },
  { node: 'engineering_building', label: 'Engineering', kind: 'structural' },
  { node: 'business_building', label: 'Business', kind: 'restrained' },
]

/** Numbers shown around the campus. Small, factual-sounding, non-specific. */
export const CAMPUS_FACTS = [
  { value: '25+', label: 'Programmes' },
  { value: '12', label: 'Labs & studios' },
  { value: 'Global', label: 'Community' },
]

export const BRAND = {
  name: 'Bytes College',
  established: 'Est. 2026',
  positioning: 'Learning built for what comes next.',
}

export const NAV = [
  { label: 'Programmes', target: 'branches' },
  { label: 'Campus', target: 'reveal' },
  { label: 'Admissions', target: 'future' },
  { label: 'About', target: 'growth' },
]
