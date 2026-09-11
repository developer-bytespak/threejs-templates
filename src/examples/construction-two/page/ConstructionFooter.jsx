import { useCallback } from 'react'
import { BRAND, FOOTER } from './content.js'
import { usePrefersReducedMotion } from './scroll.js'

function ConstructionFooter() {
  const reduced = usePrefersReducedMotion()

  const go = useCallback(
    (id) => {
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    },
    [reduced],
  )

  return (
    <footer className="c2foot" data-zone="dark">
      <div className="c2foot__top">
        <p className="c2foot__brand">
          <span>{BRAND.mark}</span>
          <i aria-hidden="true" />
          <span>{BRAND.name}</span>
        </p>

        {FOOTER.columns.map((column) => (
          <nav className="c2foot__col" key={column.id} aria-label={column.label}>
            <p className="c2foot__colLabel">{column.label}</p>
            <ul>
              {column.items.map((item) => (
                <li key={item.label}>
                  {item.href ? (
                    <a href={item.href}>{item.label}</a>
                  ) : (
                    <button type="button" onClick={() => go(item.target)}>
                      {item.label}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="c2foot__bottom">
        <p className="c2foot__where">
          {FOOTER.locations.map((place) => (
            <span key={place}>{place}</span>
          ))}
        </p>
        <p className="c2foot__legal">{FOOTER.legal}</p>
      </div>
    </footer>
  )
}

export default ConstructionFooter
