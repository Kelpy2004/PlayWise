import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useSearchParams, type Location } from 'react-router-dom'

import AppShell from './components/AppShell'
import ProtectedRoute from './components/ProtectedRoute'

const AdminPage = lazy(() => import('./pages/AdminPage'))
const AuthPage = lazy(() => import('./pages/AuthPage'))
const GamePage = lazy(() => import('./pages/GamePage'))
const GamesBrowsePage = lazy(() => import('./pages/GamesBrowsePage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const OpenSourcePage = lazy(() => import('./pages/OpenSourcePage'))
const TournamentsPage = lazy(() => import('./pages/TournamentsPage'))

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

function ScrollToTop({ location }: { location: Location }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: location.hash ? 'smooth' : 'auto' })
    }
  }, [location.hash, location.pathname, location.search])

  return null
}

export default function App() {
  const location = useLocation()
  const locationState = location.state as { backgroundLocation?: Location } | null
  const backgroundLocation = locationState?.backgroundLocation
  const routeLocation = backgroundLocation || location
  const routeLoadingFallback = (
    <div className="min-h-[40vh] w-full flex items-center justify-center text-white/80">
      <div className="text-center">
        <p className="text-sm uppercase tracking-[0.18em] text-[#b1fa50] font-bold mb-2">PlayWise</p>
        <p className="text-sm">Loading page…</p>
      </div>
    </div>
  )

  return (
    <>
      <ScrollToTop location={routeLocation} />
      <Suspense fallback={routeLoadingFallback}>
        <Routes location={routeLocation}>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="/games" element={<GamesBrowsePage />} />
            <Route path="/index.html" element={<LegacySimpleRedirect to="/" />} />
            <Route path="/games/:slug" element={<GamePage />} />
            <Route path="/game.html" element={<LegacyGameRedirect />} />
            <Route path="/ac.html" element={<LegacySlugRedirect slug="assassins-creed" />} />
            <Route path="/dishonored.html" element={<LegacySlugRedirect slug="dishonored" />} />
            <Route path="/watchdogs2.html" element={<LegacySlugRedirect slug="watch-dogs-2" />} />
            <Route path="/darksiders2.html" element={<LegacySlugRedirect slug="darksiders-2" />} />
            <Route path="/cod.html" element={<LegacySlugRedirect slug="call-of-duty-modern-warfare" />} />
            <Route path="/open-source" element={<OpenSourcePage />} />
            <Route path="/tournaments" element={<TournamentsPage />} />
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
        {backgroundLocation ? (
          <Routes>
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route path="/login.html" element={<Navigate replace to="/login" />} />
            <Route path="/registration.html" element={<Navigate replace to="/register" />} />
          </Routes>
        ) : null}
      </Suspense>
    </>
  )
}
