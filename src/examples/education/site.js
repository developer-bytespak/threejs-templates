/**
 * Everything the editorial sections say.
 *
 * Kept out of the JSX so this stays a template: replacing the copy for a real
 * institution means editing this file and nothing else. The disciplines
 * themselves are not repeated here — they already exist in `chapters.js`,
 * where the 3D scene reads them, and one list is better than two that can
 * disagree.
 */

export const INTRO = {
  eyebrow: 'The idea',
  headline: ['Learning built for', 'what comes next.'],
  body: [
    'Technology. Science. Design. Engineering. Business.',
    'Different disciplines. One connected way of thinking.',
  ],
  note: 'Est. 2026 — a college organised around how knowledge actually grows.',
}

export const DISCIPLINE_SECTION = {
  eyebrow: 'Five disciplines',
  headline: ['Five ways to', 'build an idea.'],
  note: 'Hover a discipline to find it in the tree.',
  noteTouch: 'Tap a discipline to find it in the tree.',
}

export const MUSEUM_INTRO = {
  headline: "Ideas don't stay on paper.",
  steps: ['Research', 'Experiment', 'Design', 'Build'],
}

export const CONNECTION = {
  eyebrow: 'Connection',
  headline: ['What happens when', 'disciplines connect?'],
  body: ['The strongest ideas', 'rarely belong to', 'one field.'],
}

export const CAMPUS_INFO = {
  eyebrow: 'The campus',
  headline: 'A place where ideas become practice.',
  stats: [
    { value: '12', label: 'Labs & studios', note: 'Shared, not departmental' },
    { value: '05', label: 'Disciplines', note: 'One connected faculty' },
    { value: '01', label: 'Connected campus', note: 'Everything within a walk' },
  ],
}

export const FUTURE = {
  headline: 'Build what comes next.',
  body: [
    'Learning is not preparation for the future.',
    'It is how the future gets built.',
  ],
  actions: [
    { label: 'Explore the disciplines', target: 'branches' },
    { label: 'Explore the campus', target: 'reveal' },
    { label: 'Start a conversation', target: 'future' },
  ],
}

export const CTA = {
  eyebrow: 'Admissions',
  headline: 'Ready to explore?',
  body: ['Discover the disciplines,', 'the campus and the ideas', 'being built here.'],
  primary: 'Start your journey',
  secondary: 'Explore campus',
}

export const FOOTER = {
  mark: ['Bytes', 'College'],
  line: 'Learn. Build. Connect.',
  cta: { headline: 'Ready to explore?', action: 'Start your journey' },
  columns: [
    {
      title: 'Explore',
      links: ['Disciplines', 'Campus', 'Research', 'Student Life', 'Admissions'],
    },
    {
      title: 'Connect',
      links: ['About', 'Contact', 'Visit Campus', 'Start a Conversation'],
    },
    { title: 'Social', links: ['Instagram', 'LinkedIn', 'YouTube'] },
  ],
  legal: '© 2026 Bytes College',
  policies: ['Privacy', 'Accessibility', 'Terms'],
}
