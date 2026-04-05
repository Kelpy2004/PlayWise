import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register'
  const navigate = useNavigate()
  const location = useLocation()
  const { login, register } = useAuth()
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    usernameOrEmail: '',
    adminSetupCode: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState({ tone: 'danger', message: '' })

  const returnTo = location.state?.from || '/'

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setFeedback({ tone: 'danger', message: '' })

    try {
      const user = isRegister
        ? await register({
            username: form.username,
            email: form.email,
            password: form.password,
            adminSetupCode: form.adminSetupCode
          })
        : await login({
            usernameOrEmail: form.usernameOrEmail,
            password: form.password
          })

      navigate(user.role === 'admin' ? '/admin/hardware' : returnTo, { replace: true })
    } catch (error) {
      setFeedback({ tone: 'danger', message: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="py-5">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-7 col-xl-5">
            <div className="feature-card">
              <p className="eyebrow text-uppercase mb-2">{isRegister ? 'Create account' : 'Welcome back'}</p>
              <h1 className="h2 mb-3">{isRegister ? 'Register for PlayWise' : 'Login to PlayWise'}</h1>
              <p className="text-secondary-emphasis mb-4">
                {isRegister
                  ? 'Accounts unlock named comments, persistent sessions, and admin access for the first registered user.'
                  : 'Sign in to keep your session, post comments faster, and access admin tools when available.'}
              </p>

              <form onSubmit={handleSubmit}>
                <div className="row g-3">
                  {isRegister ? (
                    <>
                      <div className="col-12">
                        <label className="form-label fw-semibold">Username</label>
                        <input
                          className="form-control form-control-lg rounded-4"
                          value={form.username}
                          onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                          required
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label fw-semibold">Email</label>
                        <input
                          type="email"
                          className="form-control form-control-lg rounded-4"
                          value={form.email}
                          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                          required
                        />
                      </div>
                    </>
                  ) : (
                    <div className="col-12">
                      <label className="form-label fw-semibold">Username or email</label>
                      <input
                        className="form-control form-control-lg rounded-4"
                        value={form.usernameOrEmail}
                        onChange={(event) => setForm((current) => ({ ...current, usernameOrEmail: event.target.value }))}
                        required
                      />
                    </div>
                  )}

                  <div className="col-12">
                    <label className="form-label fw-semibold">Password</label>
                    <input
                      type="password"
                      className="form-control form-control-lg rounded-4"
                      value={form.password}
                      onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                      required
                    />
                  </div>

                  {isRegister ? (
                    <div className="col-12">
                      <label className="form-label fw-semibold">Admin setup code (optional)</label>
                      <input
                        className="form-control form-control-lg rounded-4"
                        value={form.adminSetupCode}
                        onChange={(event) => setForm((current) => ({ ...current, adminSetupCode: event.target.value }))}
                      />
                      <div className="form-text">
                        The first registered account becomes admin automatically if no admin exists yet.
                      </div>
                    </div>
                  ) : null}
                </div>

                <button type="submit" className="btn btn-brand btn-lg rounded-pill px-4 mt-4" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting…' : isRegister ? 'Create account' : 'Login'}
                </button>

                {feedback.message ? (
                  <div className={`alert alert-${feedback.tone} mt-4 mb-0 rounded-4`}>{feedback.message}</div>
                ) : null}
              </form>

              <p className="text-secondary-emphasis mt-4 mb-0">
                {isRegister ? 'Already have an account?' : 'Need an account?'}{' '}
                <Link to={isRegister ? '/login' : '/register'} className="link-dark fw-semibold">
                  {isRegister ? 'Login here' : 'Register here'}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
