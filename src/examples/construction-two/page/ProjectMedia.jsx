import { useState } from 'react'
import Plate from './Plates.jsx'

/**
 * A project's photograph, with the drawn plate as its safety net.
 *
 * The template ships without photography, so this tries the local file first
 * and swaps to the architectural plate if it is not there. That keeps two
 * promises at once: a client who drops four JPEGs into
 * public/assets/construction-two/projects/ gets real photography with no code
 * change, and a fresh clone never shows a broken image icon.
 *
 * The wrapper owns the aspect ratio so nothing reflows when the file finally
 * loads, and everything below the fold is lazy.
 */
function ProjectMedia({ src, small, plate, alt = '', eager = false }) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) return <Plate kind={plate} />

  return (
    <img
      className="c2media"
      src={src}
      srcSet={small ? `${small} 1000w, ${src} 2000w` : undefined}
      sizes="(max-width: 760px) 92vw, 60vw"
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={eager ? 'high' : 'auto'}
      onError={() => setFailed(true)}
    />
  )
}

export default ProjectMedia
