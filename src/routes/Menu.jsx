import { Link } from 'react-router-dom'
import { EXAMPLES } from '../examples.js'
import './Menu.css'

function Menu() {
  return (
    <main className="menu">
      <header className="menu__head">
        <p className="menu__eyebrow">Three.js</p>
        <h1 className="menu__title">Examples</h1>
        <p className="menu__lede">
          Scenes built with React Three Fiber. Pick one to open it.
        </p>
      </header>

      <ul className="menu__grid">
        {EXAMPLES.map((example) => (
          <li key={example.id}>
            <Link
              className="card"
              to={example.path}
              style={{ '--accent': example.accent }}
            >
              <div className="card__frame">
                {/* The poster is decorative — the card's own text is the
                    accessible label, so alt is intentionally empty. */}
                <img
                  className="card__poster"
                  src={example.poster}
                  alt=""
                  loading="lazy"
                  width="1000"
                  height="620"
                />
              </div>

              <div className="card__body">
                <h2 className="card__title">{example.title}</h2>
                <p className="card__tagline">{example.tagline}</p>
                <p className="card__description">{example.description}</p>

                <ul className="card__tags">
                  {example.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>

                <span className="card__cta">
                  Open
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M3 8h9M8.5 4l4 4-4 4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}

export default Menu
