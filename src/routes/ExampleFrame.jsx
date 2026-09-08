import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import './ExampleFrame.css'

/**
 * Wraps a full-bleed example: adds the way back to the menu, and flags the
 * document as immersive so global styles (hidden scrollbar) apply only here
 * and not on the menu, where a scrollbar is a useful affordance.
 */
function ExampleFrame({ title, children }) {
  useEffect(() => {
    document.documentElement.dataset.immersive = 'true'
    return () => {
      delete document.documentElement.dataset.immersive
    }
  }, [])

  return (
    <>
      <Link className="back" to="/">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M13 8H4M7.5 4l-4 4 4 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>{title}</span>
      </Link>
      {children}
    </>
  )
}

export default ExampleFrame
