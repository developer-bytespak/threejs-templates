import { useCallback, useRef, useState } from 'react'
import Plate from './Plates.jsx'
import { CAPABILITIES } from './content.js'
import { useScrollLink } from './scroll.js'

/**
 * Three capabilities, one at a time, on a pinned stage.
 *
 * The number is the anchor and it never moves; everything else is rebuilt
 * around it as the section advances. Headlines wipe in line by line from the
 * right, the supporting terms take a different coordinate in each capability
 * rather than stacking into a list, and the drawing on the right is cropped
 * horizontally out and back in — so the change reads as one viewport being
 * re-aimed rather than three panels cross-fading.
 */
function Capabilities() {
  const ref = useRef(null)
  const items = useRef([])
  const [active, setActive] = useState(0)

  const onProgress = useCallback((p) => {
    const n = CAPABILITIES.length
    const span = 1 / n
    const scaled = Math.min(p / 0.9, 1)
    for (let i = 0; i < n; i += 1) {
      const el = items.current[i]
      if (!el) continue
      const t = (scaled - i * span) / span
      el.style.setProperty('--t', Math.max(-1.2, Math.min(t, 2)).toFixed(4))
    }
    const index = Math.min(n - 1, Math.max(0, Math.floor(scaled * n - 1e-6)))
    setActive((was) => (was === index ? was : index))
  }, [])

  useScrollLink(ref, 'pin', onProgress)

  return (
    <section
      className="c2cap"
      id="capabilities"
      data-zone="light"
      ref={ref}
      style={{ '--count': CAPABILITIES.length }}
      aria-label="Capabilities"
    >
      <div className="c2cap__pin">
        <header className="c2cap__head">
          <p className="c2label">Capabilities</p>
          <p className="c2cap__of">
            <b>{CAPABILITIES[active].index}</b>
            <span>/ {String(CAPABILITIES.length).padStart(2, '0')}</span>
          </p>
        </header>

        <div className="c2cap__stage">
          {CAPABILITIES.map((cap, i) => (
            <article
              className="c2cap__item"
              key={cap.id}
              ref={(el) => {
                items.current[i] = el
              }}
              data-slot={i % 3}
              style={{ zIndex: i + 1 }}
            >
              <p className="c2cap__index" aria-hidden="true">
                {cap.index}
              </p>

              <div className="c2cap__body">
                <h3 className="c2cap__headline">
                  {cap.headline.map((line) => (
                    <span key={line}>
                      <b>{line}</b>
                    </span>
                  ))}
                </h3>
                <p className="c2cap__discipline">{cap.discipline}</p>
                <ul className="c2cap__terms">
                  {cap.terms.map((term, k) => (
                    <li key={term} style={{ '--k': k }}>
                      {term}
                    </li>
                  ))}
                </ul>
                <p className="c2cap__note">{cap.note}</p>
              </div>

              <div className="c2cap__view">
                <Plate kind={cap.plate} />
                <i aria-hidden="true" />
              </div>
            </article>
          ))}
        </div>

        <div className="c2cap__ticks" aria-hidden="true">
          {CAPABILITIES.map((cap, i) => (
            <i key={cap.id} data-on={i <= active} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default Capabilities
