import { BRAND, CHAPTERS, NAV } from './chapters.js'
import SoundButton from '../../audio/SoundButton.jsx'

/**
 * The persistent furniture: a mark, a short nav, the chapter rail and the
 * pointer readout. All of it is deliberately thin — the experience is the
 * interface, and a conventional header bar sitting across the top would
 * flatten the whole thing into a normal site.
 */
function EducationChrome({ chapter, hover, menuOpen, onToggleMenu, onNavigate }) {
  return (
    <>
      <header className="edu-header">
        <a
          className="edu-mark"
          href="#seed"
          onClick={(event) => {
            event.preventDefault()
            onNavigate('seed')
          }}
        >
          <span className="edu-mark__dot" aria-hidden="true" />
          {BRAND.name}
        </a>

        <nav className="edu-nav" aria-label="Sections">
          {NAV.map((item) => (
            <button
              key={item.label}
              type="button"
              className="edu-nav__item"
              onClick={() => onNavigate(item.target)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Last in the bar, past the navigation — the same position it holds
            on /construction-two. It is a utility switch, not a section. */}
        <SoundButton />

        <button
          type="button"
          className="edu-menu-toggle"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={onToggleMenu}
        >
          <span />
          <span />
        </button>
      </header>

      {menuOpen ? (
        <div className="edu-menu">
          <nav aria-label="Sections">
            {NAV.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  onNavigate(item.target)
                  onToggleMenu()
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      ) : null}

      {/* The rail doubles as a table of contents and as the only always-on
          indication of how far through the journey you are. */}
      <nav className="edu-rail-nav" aria-label="Chapters">
        {CHAPTERS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className="edu-rail-nav__item"
            data-active={index === chapter}
            aria-current={index === chapter}
            onClick={() => onNavigate(item.id)}
          >
            <span className="edu-rail-nav__tick" aria-hidden="true" />
            <span className="edu-rail-nav__label">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Named by the pointer, not by a tooltip that follows the cursor. */}
      <p className="edu-readout" data-active={Boolean(hover.kind)}>
        <span className="edu-readout__rule" aria-hidden="true" />
        {hover.label ?? hover.id ?? ''}
      </p>
    </>
  )
}

export default EducationChrome
