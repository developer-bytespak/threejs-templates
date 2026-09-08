import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Menu from './routes/Menu.jsx'
import ExampleFrame from './routes/ExampleFrame.jsx'

// Each example is split out so the menu does not pull three.js down with it.
const Construction = lazy(() => import('./scene/RoomViewer.jsx'))
const Crypto = lazy(() => import('./crypto/CryptoExperience.jsx'))

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
        path="/crypto"
        element={
          <ExampleFrame title="Crypto Network">
            <Suspense fallback={null}>
              <Crypto />
            </Suspense>
          </ExampleFrame>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
