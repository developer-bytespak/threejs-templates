/**
 * Retired.
 *
 * This file used to hold the storyboard, with each entry mixing a camera
 * position and a block of copy. That shape is what made the page feel like a
 * slideshow: because a shot *was* a caption, every camera move had to produce
 * another one, and nine stops meant nine paragraphs whether the story wanted
 * them or not.
 *
 * The two concerns now live apart in `story.js` — CAMERA_KEYFRAMES for where
 * the camera is, STORY_CHAPTERS for what the page is saying — which is what
 * lets the camera pass through the desk approach and the footprint transition
 * without either one demanding its own section.
 *
 * Re-exported here so nothing breaks on the old import path. Note that
 * `src/scene/shots.js` is a separate file belonging to the older
 * /construction route and is untouched by any of this.
 */
export {
  BUILD_RANGE,
  CAMERA_KEYFRAMES,
  STORY_CHAPTERS,
  TRACK_VH,
  resolveKeyframes,
} from './story.js'
