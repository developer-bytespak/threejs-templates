import { useCallback, useEffect, useRef, useState } from 'react'
import { BRAND, NAV_CTA, NAV_LINKS } from './content.js'
import { usePrefersReducedMotion } from './scroll.js'

/**
 * The navigation, and the one element that has to survive every surface on the
 * page: a dark WebGL studio, warm paper, two inverted sections and a charcoal
 * close.
 *
 * Two blocks and nothing between them — the wordmark on the left, everything
 * actionable on the right, set as a single line of small uppercase type. It is
 * a drawing's title block rather than a menu bar: flat, hairline-ruled, no
 * shape behind any item.
 *
 * Rather than hard-coding scroll positions, each section declares what it is
 * with `data-zone="dark|light"`. On scroll this finds whichever section is
 * crossing the bar's own baseline and adopts it. Two custom properties carry
 * the result — `--nav-ink` and `--nav-line` — so the change is a CSS transition
 * on colour rather than a class swap, and the bar fades between surfaces
 * instead of blinking.
 */

const LINE = 70          // the bar's baseline: the y the zone test is taken at
const SCROLLED = 40      // past this the bar compacts and earns its backdrop

function scrollToId(id, reduced) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({
    behavior: reduced ? 'auto' : 'smooth',
    block: 'start',
  })
}

function ConstructionNav() {
  const reduced = usePrefersReducedMotion()
  const [zone, setZone] = useState('dark')
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)

  useEffect(() => {
    let frame = 0

    const read = () => {
      frame = 0
      let found = 'dark'
      for (const el of document.querySelectorAll('[data-zone]')) {
        const rect = el.getBoundingClientRect()
        if (rect.top <= LINE && rect.bottom > LINE) found = el.dataset.zone
      }
      setZone((was) => (was === found ? was : found))
      setScrolled(scrollY > SCROLLED)
    }

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read)
    }

    read()
    addEventListener('scroll', onScroll, { passive: true })
    addEventListener('resize', onScroll)
    return () => {
      removeEventListener('scroll', onScroll)
      removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  // The overlay owns the page while it is up: scroll locked, Escape closes,
  // and focus goes back to the trigger so the keyboard does not lose its place.
  useEffect(() => {
    if (!open) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      removeEventListener('keydown', onKey)
      triggerRef.current?.focus()
    }
  }, [open])

  const go = useCallback(
    (target) => {
      setOpen(false)
      // Let the overflow lock lift before the scroll starts, or Safari lands
      // in the wrong place.
      requestAnimationFrame(() => scrollToId(target, reduced))
    },
    [reduced],
  )

  return (
    <>
      <header
        className="c2nav"
        data-zone={zone}
        data-scrolled={scrolled}
        data-open={open}
      >
        <a
          className="c2nav__brand"
          href="#top"
          onClick={(e) => {
            e.preventDefault()
            scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
          }}
        >
          <span className="c2nav__mark">{BRAND.mark}</span>
          <i className="c2nav__tick" aria-hidden="true" />
          <span className="c2nav__name">{BRAND.name}</span>
        </a>

        <div className="c2nav__right">
          <nav className="c2nav__links" aria-label="Sections">
            {NAV_LINKS.map((link) => (
              <button key={link.id} type="button" onClick={() => go(link.target)}>
                {link.label}
              </button>
            ))}
          </nav>

          <i className="c2nav__sep" aria-hidden="true" />

          <button
            className="c2nav__cta"
            type="button"
            onClick={() => go(NAV_CTA.target)}
          >
            <span>{NAV_CTA.label}</span>
            <i aria-hidden="true">↗</i>
          </button>

          <button
            className="c2nav__trigger"
            type="button"
            ref={triggerRef}
            aria-expanded={open}
            aria-controls="c2-menu"
            onClick={() => setOpen((v) => !v)}
          >
            <span>{open ? 'Close' : 'Menu'}</span>
            <i aria-hidden="true">
              <b />
              <b />
            </i>
          </button>
        </div>

        <i className="c2nav__rule" aria-hidden="true" />
      </header>

      {/* Not a drawer sliding in from the side — a sheet of tracing paper laid
          over the page, with the links set as a drawing schedule. */}
      <div className="c2menu" id="c2-menu" data-open={open} aria-hidden={!open}>
        <div className="c2menu__grid" aria-hidden="true" />
        <p className="c2menu__label">Index</p>
        <ul className="c2menu__list">
          {NAV_LINKS.map((link, i) => (
            <li key={link.id} style={{ '--i': i }}>
              <button type="button" tabIndex={open ? 0 : -1} onClick={() => go(link.target)}>
                <em>{String(i + 1).padStart(2, '0')}</em>
                <span>{link.label}</span>
                <i aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <button
          className="c2menu__cta"
          type="button"
          tabIndex={open ? 0 : -1}
          onClick={() => go(NAV_CTA.target)}
        >
          {NAV_CTA.label} <i aria-hidden="true">↗</i>
        </button>
        <p className="c2menu__foot">{BRAND.email}</p>
      </div>
    </>
  )
}

export default ConstructionNav
