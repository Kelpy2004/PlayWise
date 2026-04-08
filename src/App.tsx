import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom'

import AppShell from './components/AppShell'
import ProtectedRoute from './components/ProtectedRoute'
import AdminPage from './pages/AdminPage'
import AuthPage from './pages/AuthPage'
import GamePage from './pages/GamePage'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'
import OpenSourcePage from './pages/OpenSourcePage'

function LegacyGameRedirect() {
  const [searchParams] = useSearchParams()
  const slug = searchParams.get('slug') || 'assassins-creed'
  return <Navigate replace to={`/games/${slug}`} />
}

function LegacySlugRedirect({ slug }: { slug: string }) {
  return <Navigate replace to={`/games/${slug}`} />
}

function LegacySimpleRedirect({ to }: { to: string }) {
  return <Navigate replace to={to} />
}

function ScrollToTop() {
  const location = useLocation()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: location.hash ? 'smooth' : 'auto' })
    }
  }, [location.hash, location.pathname, location.search])

  return null
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="/index.html" element={<LegacySimpleRedirect to="/" />} />
          <Route path="/games/:slug" element={<GamePage />} />
          <Route path="/game.html" element={<LegacyGameRedirect />} />
          <Route path="/ac.html" element={<LegacySlugRedirect slug="assassins-creed" />} />
          <Route path="/dishonored.html" element={<LegacySlugRedirect slug="dishonored" />} />
          <Route path="/watchdogs2.html" element={<LegacySlugRedirect slug="watch-dogs-2" />} />
          <Route path="/darksiders2.html" element={<LegacySlugRedirect slug="darksiders-2" />} />
          <Route path="/cod.html" element={<LegacySlugRedirect slug="call-of-duty-modern-warfare" />} />
          <Route path="/open-source" element={<OpenSourcePage />} />
          <Route path="/open-source.html" element={<LegacySimpleRedirect to="/open-source" />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/login.html" element={<LegacySimpleRedirect to="/login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/registration.html" element={<LegacySimpleRedirect to="/register" />} />
          <Route
            path="/admin/hardware"
            element={
              <ProtectedRoute adminOnly>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route path="/hardware-admin.html" element={<LegacySimpleRedirect to="/admin/hardware" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  )
}
