import { Fragment } from 'react'
import { SECTIONS } from './sections.js'
import { SECTION_SPANS, TRACK_VH } from './quality.js'

/**
 * Headlines in the two "rise" states are split into words so they can stagger
 * in individually. Everywhere else the headline moves as one block — using the
 * same flourish six times is exactly what made the page feel templated.
 */
function Headline({ text, split, order }) {
  if (!split) {
    return (
      <h2 className="cs__headline cs__line" style={{ '--i': order }}>
        {text}
      </h2>
    )
  }

  const words = text.split(' ')
  return (
    <h2 className="cs__headline">
      {words.map((word, i) => (
        <Fragment key={`${word}-${i}`}>
          <span className="cs__word" style={{ '--i': order + i * 0.4 }}>
            {word}
          </span>{' '}
        </Fragment>
      ))}
    </h2>
  )
}

function Meta({ meta, quality, order }) {
  const rows = meta.of(quality)

  if (meta.kind === 'hubs') {
    return (
      <ul className="cs__hubs cs__line" style={{ '--i': order }}>
        {rows.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    )
  }

  return (
    <dl className="cs__stats cs__line" data-kind={meta.kind} style={{ '--i': order }}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function CryptoSections({ active, quality, onNavigate }) {
  return (
    <main className="crypto__content">
      {SECTIONS.map((section, index) => {
        const split = section.reveal === 'rise'
        // Children share one running counter so the stagger reads as a single
        // gesture rather than each element animating on its own clock.
        let order = 0
        const next = () => order++

        const eyebrowOrder = next()
        const headlineOrder = next()
        const wordSpan = split ? section.headline.split(' ').length * 0.4 : 0
        order += wordSpan

        return (
          <section
            key={section.id}
            id={section.id}
            data-state={section.id}
            data-layout={section.layout}
            className="cs"
            style={{ minHeight: `${SECTION_SPANS[index] * TRACK_VH}vh` }}
          >
            <div className="cs__sticky">
              <div
                className="cs__panel"
                data-active={index === active}
                data-reveal={section.reveal}
                data-scale={section.scale ?? 'default'}
              >
                <p className="cs__eyebrow cs__line" style={{ '--i': eyebrowOrder }}>
                  {section.eyebrow}
                </p>

                <Headline
                  text={section.headline}
                  split={split}
                  order={headlineOrder}
                />

                {section.body ? (
                  <p className="cs__body cs__line" style={{ '--i': next() }}>
                    {section.body}
                  </p>
                ) : null}

                {section.meta ? (
                  <Meta meta={section.meta} quality={quality} order={next()} />
                ) : null}

                {section.actions ? (
                  <div className="cs__actions cs__line" style={{ '--i': next() }}>
                    {section.actions.map((action) => {
                      const target = SECTIONS.findIndex(
                        (item) => `#${item.id}` === action.href,
                      )
                      return (
                        <a
                          key={action.label}
                          className="cs__cta"
                          data-primary={Boolean(action.primary)}
                          href={action.href}
                          onClick={(event) => {
                            if (target < 0) return
                            event.preventDefault()
                            onNavigate(target)
                          }}
                        >
                          {action.label}
                        </a>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        )
      })}
    </main>
  )
}

export default CryptoSections
