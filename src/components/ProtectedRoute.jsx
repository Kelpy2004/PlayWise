import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, adminOnly = false }) {
  const location = useLocation()
  const { isLoading, user } = useAuth()

  if (isLoading) {
    return (
      <section className="container py-5">
        <div className="hero-panel p-5 text-center">
          <div className="spinner-border text-dark" role="status" />
          <p className="mt-3 mb-0 text-secondary-emphasis">Checking your session…</p>
        </div>
      </section>
    )
  }

  if (!user) {
    return <Navigate replace to="/login" state={{ from: `${location.pathname}${location.search}` }} />
  }

  if (adminOnly && user.role !== 'admin') {
    return (
      <section className="container py-5">
        <div className="hero-panel p-5">
          <p className="eyebrow mb-2">Admin only</p>
          <h1 className="h3">This area is reserved for PlayWise admins.</h1>
          <p className="text-secondary-emphasis mb-0">
            Sign in with an admin account or use the first registered account to initialize the admin hardware tools.
          </p>
        </div>
      </section>
    )
  }

  return children
}
