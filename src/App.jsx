import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Menu from './routes/Menu.jsx'
import ExampleFrame from './routes/ExampleFrame.jsx'

// Each example owns a folder under examples/ and is split out here so the
// menu does not pull three.js down with it.
const Construction = lazy(() =>
  import('./examples/construction/ConstructionExperience.jsx'),
)
const ConstructionTwo = lazy(() =>
  import('./examples/construction-two/ConstructionTwoPage.jsx'),
)
const Crypto = lazy(() => import('./examples/crypto/CryptoExperience.jsx'))
const Education = lazy(() =>
  import('./examples/education/EducationExperience.jsx'),
)

function App() {
  return (
    <Routes>
      <Route path="/" element={<Menu />} />
      <Route
        path="/construction"
        element={
          <ExampleFrame title="Construction">
            <Suspense fallback={null}>
              <Construction />
            </Suspense>
          </ExampleFrame>
        }
      />
      <Route
        path="/construction-two"
        element={
          <ExampleFrame title="Construction Two">
            {/* The route's own loader cannot paint until this chunk has
                arrived, and the default white behind it is a flash straight
                into a dark page. One filled rectangle closes that gap. */}
            <Suspense fallback={<div style={{ position: 'fixed', inset: 0, background: '#0b0d10' }} />}>
              <ConstructionTwo />
            </Suspense>
          </ExampleFrame>
        }
      />
      <Route
        path="/crypto"
        element={
          <ExampleFrame title="Crypto Network">
            <Suspense fallback={null}>
              <Crypto />
            </Suspense>
          </ExampleFrame>
        }
      />
      <Route
        path="/education"
        element={
          <ExampleFrame title="Bytes College">
            <Suspense fallback={null}>
              <Education />
            </Suspense>
          </ExampleFrame>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
