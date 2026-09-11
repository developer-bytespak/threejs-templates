import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useRoomModel } from './useRoomModel.js'
import { span } from './story.js'

/**
 * Labels that belong to the wall rather than to the screen.
 *
 * Every position here comes out of the model: either an `Anchors` empty the
 * Blender pass placed in front of a specific sheet, or the centre of a sheet
 * mesh carrying a `doc` extra. Nothing is positioned with a CSS percentage,
 * which is the whole reason those anchors exist — a label that says STRUCTURE
 * stays on the structural drawing when the camera moves, because it is pinned
 * to that drawing in world space.
 *
 * If an expected node is missing the label is dropped and dev warns, rather
 * than the label drifting to some guessed coordinate.
 */

const LABELS = [
  { node: 'Anchor_Pinboard_Site', index: '01', text: 'Site logistics' },
  { node: 'Anchor_Pinboard_Structure', index: '02', text: 'Structure' },
  { node: 'Anchor_Pinboard_Coordination', index: '03', text: 'Coordination' },
  { node: 'Sheet_Phasing', index: '04', text: 'Phasing', side: 'right' },
]

/** Anchors first, then any named node — so a doc sheet works as a target too. */
function locate(anchors, nodes, name) {
  const anchor = anchors?.get(name)
  if (anchor) return anchor.position.clone()

  const node = nodes?.get(name)
  if (!node) return null

  const box = new THREE.Box3().setFromObject(node)
  const centre = box.getCenter(new THREE.Vector3())
  // Stand a label off the board so the leader line has somewhere to go.
  centre.z += 0.09
  return centre
}

function ConstructionAnnotations({ chapter, progress }) {
  const { anchors, nodes } = useRoomModel()

  const marks = useMemo(() => {
    const found = []
    for (const label of LABELS) {
      const position = locate(anchors, nodes, label.node)
      if (!position) {
        if (import.meta.env.DEV) {
          console.warn(
            `[annotations] "${label.node}" is not in this model — the`,
            `"${label.text}" label will not be shown.`,
          )
        }
        continue
      }
      found.push({ ...label, position })
    }
    return found
  }, [anchors, nodes])

  if (chapter?.mode !== 'annotations' || !marks.length) return null

  // Stagger them in across the first half of the chapter, then hold.
  const reveal = span(progress, chapter.from + 0.012, chapter.from + 0.085)

  return (
    <>
      {marks.map((mark, i) => {
        const on = reveal > i / marks.length
        return (
          <Html
            key={mark.node}
            position={mark.position}
            center={false}
            zIndexRange={[12, 8]}
            wrapperClass="annotation-wrap"
            style={{ pointerEvents: 'none' }}
          >
            <div
              className="annotation"
              data-on={on}
              data-side={mark.side ?? 'left'}
            >
              <i className="annotation__leader" aria-hidden="true" />
              <span className="annotation__index">{mark.index}</span>
              <span className="annotation__text">{mark.text}</span>
            </div>
          </Html>
        )
      })}
    </>
  )
}

export default ConstructionAnnotations
