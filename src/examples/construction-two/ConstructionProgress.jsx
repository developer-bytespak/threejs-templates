import { STORY_CHAPTERS } from './story.js'

/**
 * Where you are in the film, and nothing more.
 *
 * This replaces a vertical stack of six tick marks pinned down the right edge
 * of the frame — which took up a column of the composition to say something
 * that fits on one line. It is now one line: the chapter, the count, and a
 * hairline that fills with the hero's own progress.
 *
 * It is presentational. Navigation between chapters belongs to the page's
 * navbar, so this does not duplicate it; what it does do is announce the
 * current chapter to a screen reader as it changes.
 *
 * It clears itself as the film ends, before the paper wipes up.
 */
function ConstructionProgress({ active, progress = 0 }) {
  const index = Math.max(0, STORY_CHAPTERS.findIndex((c) => c.id === active?.id))
  const total = STORY_CHAPTERS.length

  return (
    <>
      <div className="chapmark" data-visible={progress > 0.012 && progress < 0.955}>
        <p className="chapmark__row">
          <span className="chapmark__label">{active?.label}</span>
          <span className="chapmark__count">
            <b>{String(index + 1).padStart(2, '0')}</b>
            <em>/ {String(total).padStart(2, '0')}</em>
          </span>
        </p>
        <span className="chapmark__track" aria-hidden="true">
          <i style={{ '--v': progress }} />
        </span>
      </div>

      <p className="sr-only" aria-live="polite">
        {`Chapter ${index + 1} of ${total}: ${active?.label ?? ''}`}
      </p>
    </>
  )
}

export default ConstructionProgress
