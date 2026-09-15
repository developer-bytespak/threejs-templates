/**
 * The words that are not part of a chapter.
 *
 * Kept out of the JSX so this stays a template: replacing the copy for a real
 * institution means editing this file and nothing else. The disciplines
 * themselves are not repeated here — they already exist in `chapters.js`,
 * where the 3D scene reads them, and one list is better than two that can
 * disagree.
 */

export const MUSEUM_INTRO = {
  headline: "Ideas don't stay on paper.",
  steps: ['Research', 'Experiment', 'Design', 'Build'],
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
