/**
 * One signal: the page is now visible.
 *
 * The loader covers everything for as long as it takes, so "mounted" and
 * "on screen" are not the same moment here, and anything that wants to happen
 * *after* the reader can see the page cannot start its own clock at mount. The
 * sound control's invitation was doing exactly that, and spent itself behind
 * the panel.
 *
 * A module rather than context or props: the two things that care sit at
 * opposite ends of the tree — a button inside the navbar, and the camera
 * inside the Canvas — and threading a boolean through every component between
 * them would be a worse trade than one import each.
 */
const listeners = new Set()
let entered = false

export function markEntered() {
  if (entered) return
  entered = true
  for (const fn of listeners) fn(true)
}

/** Subscribe, and get the current answer immediately. Returns an unsubscribe. */
export function onEntered(fn) {
  listeners.add(fn)
  fn(entered)
  return () => listeners.delete(fn)
}

/** Reset between mounts, so a client-side route change opens properly again. */
export function resetEntered() {
  entered = false
  listeners.clear()
}
