import { STORY_CHAPTERS } from './story.js'

/**
 * Six construction ticks instead of nine anonymous dots.
 *
 * One per chapter, not one per camera keyframe — the camera passes through the
 * desk approach and the footprint transition without either being a place the
 * reader can be, so neither gets a tick.
 *
 * Real buttons, so it is keyboard navigable and announces which chapter is
 * current.
 */
function ConstructionProgress({ active, onJump }) {
  return (
    <nav className="rail" aria-label="Chapters">
      {STORY_CHAPTERS.map((chapter) => {
        const on = chapter.id === active?.id
        return (
          <button
            key={chapter.id}
            type="button"
            className="rail__tick"
            data-active={on}
            aria-current={on ? 'true' : undefined}
            onClick={() => onJump(chapter)}
          >
            <i aria-hidden="true" />
            <span className="rail__label">{chapter.label}</span>
            <span className="sr-only">
              {`Chapter ${chapter.index}: ${chapter.label}`}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

export default ConstructionProgress
