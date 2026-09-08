import { useEffect } from 'react'

/**
 * Wraps a full-bleed example. Examples open in their own tab, so there is no
 * in-page way back — the tab itself is the affordance. What this does provide
 * is the tab's name, and the flag that marks the document as immersive so
 * global styles (hidden scrollbar) apply only here and not on the menu, where
 * a scrollbar is a useful affordance.
 */
function ExampleFrame({ title, children }) {
  useEffect(() => {
    const previous = document.title
    document.title = title
    document.documentElement.dataset.immersive = 'true'
    return () => {
      document.title = previous
      delete document.documentElement.dataset.immersive
    }
  }, [title])

  return children
}

export default ExampleFrame
