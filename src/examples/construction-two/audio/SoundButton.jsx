import { useEffect, useState } from 'react'
import Shared from '../../../audio/SoundButton.jsx'
import { onEntered } from '../page/entrance.js'

/**
 * This route's sound control is the shared one; all this adds is *when* it may
 * ask.
 *
 * The invitation has to start counting from the moment the reader can see the
 * page, and on this route that is not mount — the loading panel covers
 * everything until the model, every photograph and the type are in. Started at
 * mount, the whole invitation played out behind the panel.
 */
function SoundButton() {
  const [entered, setEntered] = useState(false)
  useEffect(() => onEntered(setEntered), [])
  return <Shared entered={entered} />
}

export default SoundButton
