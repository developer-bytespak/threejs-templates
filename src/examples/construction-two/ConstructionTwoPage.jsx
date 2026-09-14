import { useLayoutEffect, useRef } from 'react'
import RoomViewer from './RoomViewer.jsx'
import { TRACK_VH } from './story.js'
import ConstructionNav from './page/ConstructionNav.jsx'
import SelectedWork from './page/SelectedWork.jsx'
import ProjectStats from './page/ProjectStats.jsx'
import ProjectFilmStrip from './page/ProjectFilmStrip.jsx'
import ProcessSection from './page/ProcessSection.jsx'
import EditorialStatement from './page/EditorialStatement.jsx'
import FinalProjectCTA from './page/FinalProjectCTA.jsx'
import ConstructionFooter from './page/ConstructionFooter.jsx'
import Preloader from './page/Preloader.jsx'
import useSiteLoad from './page/useSiteLoad.js'
import { useLenis, usePrefersReducedMotion, useScrollLink } from './page/scroll.js'
import { useAudioDelegates, useAudioInit } from './audio/useAudio.js'
import './page/page.css'

/**
 * /construction-two — the whole site.
 *
 * The Three.js sequence is the opening film and nothing more: it owns the hero
 * section's box, sticks inside it, and is finished with by the time the box has
 * been scrolled through. Everything after it is ordinary document flow with
 * scroll-linked CSS, which is the right division of labour — WebGL where it
 * earns its cost, and nowhere else.
 *
 * The hero registers with the page's scroll driver so its own 0..1 is available
 * as `--p` for the handoff, which is a separate concern from the progress the
 * camera runs on (that one is damped, and measured inside RoomViewer).
 */
/**
 * Deep links. The sections are real destinations — a proposal that says "see
 * bytesconstruction.com/#process" should land there — but this is a single
 * page app, so by the time the sections exist the browser has long since given
 * up on the fragment. This re-runs it once, after mount, without smoothing:
 * arriving somewhere should be arrival, not a fourteen-thousand-pixel flight.
 */
function useHashLanding(ready) {
  useLayoutEffect(() => {
    // Not until the loader has let go. Landing on a section while the panel is
    // still up means the reader never sees the arrival, and the scroll lock
    // would be fighting it the whole way.
    if (!ready) return undefined
    const id = location.hash.slice(1)
    if (!id) return undefined
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ block: 'start' })
      })
    })
    return () => cancelAnimationFrame(raf)
  }, [ready])
}

function ConstructionTwoPage() {
  const heroRef = useRef(null)
  const pageRef = useRef(null)
  const reduced = usePrefersReducedMotion()

  // Arms the audio system: it reads the stored preference and the motion
  // query, and constructs nothing. No AudioContext exists, and nothing can
  // make a sound, until the SOUND control in the navbar is pressed.
  useAudioInit()
  // Every hover and click sound on the page, from one delegated listener, so
  // that adding sound did not mean editing the navbar, the footer, the
  // project frames, the statistics and both calls to action.
  useAudioDelegates(pageRef)

  // One Lenis for the whole route, mounted here and nowhere else. It is driven
  // from the same animation frame as the scroll driver, so the page has a
  // single loop rather than one for smoothing and one for measuring.
  useLenis(reduced)
  useScrollLink(heroRef, 'pin')

  // Nothing scrolls until the model, every photograph and the type are in.
  // The page renders underneath the whole time — the hero needs to be mounted
  // and compiling for there to be anything to wait for.
  const { target, stage, ready } = useSiteLoad()
  useHashLanding(ready)

  return (
    <div className="c2page" ref={pageRef}>
      <Preloader target={target} stage={stage} ready={ready} />
      <ConstructionNav />

      <main>
        <section
          className="c2hero"
          id="top"
          data-zone="dark"
          ref={heroRef}
          style={{ height: `${TRACK_VH}vh` }}
          aria-label="Preconstruction studio"
        >
          <RoomViewer hostRef={heroRef} />

          {/* The handoff. In the hero's last few per cent a drafting line
              extends across the frame and the warm paper of the portfolio
              wipes up behind it, taking the studio with it. The line and the
              metadata it carries are the same ones the section below opens
              with, so the two are one move rather than a cut. */}
          <div className="c2hand" aria-hidden="true">
            <div className="c2hand__paper" />
            <i className="c2hand__rule" />
            <p className="c2hand__meta">
              <span>Selected work</span>
              <span>01 — 04</span>
            </p>
          </div>
        </section>

        <SelectedWork />
        <ProjectStats />
        <ProjectFilmStrip />
        <ProcessSection />
        <EditorialStatement />
        <FinalProjectCTA />
      </main>

      <ConstructionFooter />
    </div>
  )
}

export default ConstructionTwoPage
