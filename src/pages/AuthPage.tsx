import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { trackEvent } from '../lib/telemetry'

const PASSWORD_HELP_TEXT =
  'Use at least 6 characters with 1 uppercase letter, 1 lowercase letter, and 1 special character like ! @ # $ % ^ & * ( ) - _ + = ? / \\ . ,'

function passwordChecks(password: string) {
  return {
    minLength: password.length >= 6,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    special: /[^A-Za-z0-9]/.test(password)
  }
}

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register'
  const navigate = useNavigate()
  const location = useLocation()
  const { login, register, token } = useAuth()
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    usernameOrEmail: '',
    adminSetupCode: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState({ tone: 'danger', message: '' })

  const returnTo = (location.state as { from?: string } | null)?.from || '/'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setFeedback({ tone: 'danger', message: '' })

    const formData = new FormData(event.currentTarget)
    const username = String(formData.get('username') || '').trim()
    const email = String(formData.get('email') || '').trim()
    const password = String(formData.get('password') || '')
    const usernameOrEmail = String(formData.get('usernameOrEmail') || '').trim()
    const adminSetupCode = String(formData.get('adminSetupCode') || '').trim()
    const checks = passwordChecks(password)

    if (isRegister && (!checks.minLength || !checks.uppercase || !checks.lowercase || !checks.special)) {
      setFeedback({ tone: 'danger', message: PASSWORD_HELP_TEXT })
      setIsSubmitting(false)
      return
    }

    try {
      const user = isRegister
        ? await register({
            username,
            email,
            password,
            adminSetupCode
          })
        : await login({
            usernameOrEmail,
            password
          })

      void trackEvent(
        {
          category: 'auth',
          action: isRegister ? 'register_success' : 'login_success',
          label: user.role
        },
        token
      )

      navigate(user.role === 'admin' ? '/admin/hardware' : returnTo, { replace: true })
    } catch (error) {
      setFeedback({ tone: 'danger', message: error instanceof Error ? error.message : 'Could not continue.' })
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
                          name="username"
                          autoComplete="username"
                          className="form-control form-control-lg rounded-4"
                          value={form.username}
                          onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                          required
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label fw-semibold">Email</label>
                        <input
                          name="email"
                          autoComplete="email"
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
                        name="usernameOrEmail"
                        autoComplete="username"
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
                      name="password"
                      autoComplete={isRegister ? 'new-password' : 'current-password'}
                      type="password"
                      className="form-control form-control-lg rounded-4"
                      value={form.password}
                      onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                      required
                    />
                    {isRegister ? (
                      <>
                        <div className="form-text">{PASSWORD_HELP_TEXT}</div>
                        <div className="d-flex flex-column gap-1 mt-2">
                          <small className={passwordChecks(form.password).uppercase ? 'text-success' : 'text-secondary-emphasis'}>
                            1 uppercase letter
                          </small>
                          <small className={passwordChecks(form.password).lowercase ? 'text-success' : 'text-secondary-emphasis'}>
                            1 lowercase letter
                          </small>
                          <small className={passwordChecks(form.password).special ? 'text-success' : 'text-secondary-emphasis'}>
                            1 special character like `! @ # $ % ^ & * ( ) - _ + = ? / \ . ,`
                          </small>
                        </div>
                      </>
                    ) : null}
                  </div>

                  {isRegister ? (
                    <div className="col-12">
                      <label className="form-label fw-semibold">Admin setup code (optional)</label>
                      <input
                        name="adminSetupCode"
                        autoComplete="off"
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
                  {isSubmitting ? 'Submitting...' : isRegister ? 'Create account' : 'Login'}
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
