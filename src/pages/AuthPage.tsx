import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, type Location } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { getOAuthStartUrl, api } from '../lib/api'
import { trackEvent } from '../lib/telemetry'
import type { AuthAvailabilityEntry, AuthProviderOption } from '../types/api'

const PASSWORD_HELP_TEXT =
  'Use at least 6 characters with 1 uppercase letter, 1 lowercase letter, and 1 special character like ! @ # $ % ^ & * ( ) - _ + = ? / \\ . ,'
const USERNAME_HELP_TEXT = 'Use 3 to 24 characters with only letters, numbers, underscores, or periods.'
const USERNAME_PATTERN = /^[A-Za-z0-9._]+$/

const DEFAULT_OAUTH_PROVIDERS: AuthProviderOption[] = [
  { key: 'google', label: 'Google', type: 'oauth', available: false, hint: 'Provider status unavailable right now.' }
]

function passwordChecks(password: string) {
  return {
    minLength: password.length >= 6,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    special: /[^A-Za-z0-9]/.test(password)
  }
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M21.64 12.2c0-.64-.06-1.25-.18-1.84H12v3.48h5.4a4.62 4.62 0 0 1-2 3.03v2.52h3.24c1.9-1.76 3-4.35 3-7.19Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.97-.9 6.63-2.43l-3.24-2.52c-.9.6-2.05.95-3.39.95-2.6 0-4.8-1.76-5.58-4.12H3.08v2.6A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.42 13.88A5.99 5.99 0 0 1 6.1 12c0-.65.11-1.27.32-1.88V7.52H3.08A10 10 0 0 0 2 12c0 1.61.39 3.14 1.08 4.48l3.34-2.6Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.98c1.47 0 2.78.5 3.82 1.49l2.86-2.86C16.96 3 14.7 2 12 2A10 10 0 0 0 3.08 7.52l3.34 2.6C7.2 7.74 9.4 5.98 12 5.98Z"
      />
    </svg>
  )
}

function AvailabilityText({ entry }: { entry?: AuthAvailabilityEntry | null }) {
  if (!entry || entry.available) {
    return null
  }

  return <div className="form-text text-danger">{entry.message}</div>
}

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register'
  const navigate = useNavigate()
  const location = useLocation()
  const { acceptExternalToken, login, register, token } = useAuth()
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    usernameOrEmail: '',
    adminSetupCode: ''
  })
  const [providers, setProviders] = useState<AuthProviderOption[]>(DEFAULT_OAUTH_PROVIDERS)
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isProcessingRedirect, setIsProcessingRedirect] = useState(false)
  const [feedback, setFeedback] = useState({ tone: 'danger', message: '' })
  const [fieldErrors, setFieldErrors] = useState<{
    username?: boolean
    email?: boolean
    password?: boolean
    usernameOrEmail?: boolean
  }>({})
  const [availability, setAvailability] = useState<{
    username?: AuthAvailabilityEntry | null
    email?: AuthAvailabilityEntry | null
  }>({})

  const locationState = location.state as { from?: string; backgroundLocation?: Location } | null
  const returnTo = locationState?.from || '/'
  const passwordState = passwordChecks(form.password)
  const oauthProviders = useMemo(
    () => providers.filter((provider) => provider.type === 'oauth' && provider.key === 'google'),
    [providers]
  )

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    let ignore = false

    async function loadProviders() {
      try {
        const response = await api.fetchAuthProviders()
        if (!ignore) {
          setProviders(response.providers)
        }
      } catch {
        if (!ignore) {
          setProviders(DEFAULT_OAUTH_PROVIDERS)
        }
      }
    }

    void loadProviders()

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    const hash = location.hash.startsWith('#') ? location.hash.slice(1) : ''
    if (!hash) {
      return
    }

    const params = new URLSearchParams(hash)
    const oauthError = params.get('oauthError')
    const oauthToken = params.get('token')
    const oauthReturnTo = params.get('returnTo') || returnTo
    const provider = params.get('provider') || 'oauth'

    if (oauthError) {
      setFeedback({ tone: 'danger', message: oauthError })
      navigate(location.pathname, { replace: true, state: location.state })
      return
    }

    if (!oauthToken) {
      return
    }

    let ignore = false
    setIsProcessingRedirect(true)
    setFeedback({ tone: 'danger', message: '' })

    void acceptExternalToken(oauthToken)
      .then(async (user) => {
        if (ignore) return

        await trackEvent(
          {
            category: 'auth',
            action: 'oauth_login_success',
            label: provider
          },
          oauthToken
        )

        navigate(user.role === 'admin' ? '/admin/hardware' : oauthReturnTo, { replace: true })
      })
      .catch((error) => {
        if (!ignore) {
          setFeedback({
            tone: 'danger',
            message: error instanceof Error ? error.message : 'The social login could not be completed.'
          })
          navigate(location.pathname, { replace: true, state: location.state })
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsProcessingRedirect(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [acceptExternalToken, location.hash, location.pathname, location.state, navigate, returnTo])

  useEffect(() => {
    if (!isRegister) {
      return
    }

    const username = form.username.trim()
    const email = form.email.trim()

    if (!username && !email) {
      setAvailability({})
      return
    }

    const shouldCheckUsername = username.length >= 3 && USERNAME_PATTERN.test(username)
    const shouldCheckEmail = email.includes('@')

    if (!shouldCheckUsername && !shouldCheckEmail) {
      return
    }

    let ignore = false
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await api.checkAuthAvailability({
          username: shouldCheckUsername ? username : undefined,
          email: shouldCheckEmail ? email : undefined
        })

        if (!ignore) {
          setAvailability(response)
        }
      } catch {
        if (!ignore) {
          setAvailability({})
        }
      }
    }, 320)

    return () => {
      ignore = true
      window.clearTimeout(timeoutId)
    }
  }, [form.email, form.username, isRegister])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setFeedback({ tone: 'danger', message: '' })
    setFieldErrors({})

    const username = form.username.trim()
    const email = form.email.trim()
    const password = form.password
    const usernameOrEmail = form.usernameOrEmail.trim()
    const adminSetupCode = form.adminSetupCode.trim()

    if (isRegister && !USERNAME_PATTERN.test(username)) {
      setFieldErrors({ username: true })
      setFeedback({ tone: 'danger', message: USERNAME_HELP_TEXT })
      setIsSubmitting(false)
      return
    }

    if (isRegister && (!passwordState.minLength || !passwordState.uppercase || !passwordState.lowercase || !passwordState.special)) {
      setFieldErrors({ password: true })
      setFeedback({ tone: 'danger', message: PASSWORD_HELP_TEXT })
      setIsSubmitting(false)
      return
    }

    if (isRegister && (availability.username?.available === false || availability.email?.available === false)) {
      setFieldErrors({
        username: availability.username?.available === false,
        email: availability.email?.available === false
      })
      setFeedback({
        tone: 'danger',
        message:
          availability.username?.available === false
            ? availability.username.message
            : availability.email?.message || 'Please fix the highlighted fields.'
      })
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

      await trackEvent(
        {
          category: 'auth',
          action: isRegister ? 'register_success' : 'login_success',
          label: user.role
        },
        token
      )

      navigate(user.role === 'admin' ? '/admin/hardware' : returnTo, { replace: true })
    } catch (error) {
      setFieldErrors(
        isRegister
          ? {
              username: true,
              email: true,
              password: true
            }
          : {
              usernameOrEmail: true,
              password: true
            }
      )
      setFeedback({ tone: 'danger', message: error instanceof Error ? error.message : 'Could not continue.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleSocialStart(provider: AuthProviderOption) {
    if (!provider.available || provider.type !== 'oauth') {
      setFeedback({
        tone: 'warning',
        message: provider.hint || `${provider.label} sign-in is not configured right now.`
      })
      return
    }

    void trackEvent(
      {
        category: 'auth',
        action: 'oauth_start',
        label: provider.key
      },
      token
    )

    window.location.assign(getOAuthStartUrl(provider.key, returnTo))
  }

  const submitLabel = isProcessingRedirect
    ? 'Finishing sign in...'
    : isSubmitting
      ? 'Working...'
      : isRegister
        ? 'Continue'
        : 'Log in'

  return (
    <section className="auth-shell" onClick={() => navigate(returnTo, { replace: true })}>
      <div className="auth-modal-wrap">
        <div className="auth-modal-card" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="auth-modal-close"
            aria-label="Close"
            onClick={() => navigate(returnTo, { replace: true })}
          >
            X
          </button>

          <div className="auth-modal-header">
            <h1>Join PlayWise today</h1>
          </div>

          {feedback.message ? (
            <div className={`auth-inline-alert auth-inline-alert-${feedback.tone}`}>{feedback.message}</div>
          ) : null}

          <form onSubmit={handleSubmit} className="auth-modal-form">
            {isRegister ? (
              <>
                <div className="auth-form-group">
                  <label>Email</label>
                  <input
                    name="email"
                    autoComplete="email"
                    type="email"
                    className={`form-control auth-modal-input ${fieldErrors.email ? 'is-invalid' : ''}`}
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    required
                  />
                  <AvailabilityText entry={availability.email} />
                </div>

                <div className="auth-form-group">
                  <label>Username</label>
                  <input
                    name="username"
                    autoComplete="username"
                    className={`form-control auth-modal-input ${fieldErrors.username ? 'is-invalid' : ''}`}
                    placeholder="Choose a unique username"
                    value={form.username}
                    onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                    required
                  />
                  <AvailabilityText entry={availability.username} />
                </div>
              </>
            ) : (
              <div className="auth-form-group">
                <label>Username or email</label>
                <input
                  name="usernameOrEmail"
                  autoComplete="username"
                  className={`form-control auth-modal-input ${fieldErrors.usernameOrEmail ? 'is-invalid' : ''}`}
                  placeholder="Enter your username or email"
                  value={form.usernameOrEmail}
                  onChange={(event) => setForm((current) => ({ ...current, usernameOrEmail: event.target.value }))}
                  required
                />
              </div>
            )}

            <div className="auth-form-group">
              <label>Password</label>
              <div className="auth-password-wrap">
                <input
                  name="password"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  type={showPassword ? 'text' : 'password'}
                  className={`form-control auth-modal-input ${fieldErrors.password ? 'is-invalid' : ''}`}
                  placeholder={isRegister ? 'Create a password' : 'Enter your password'}
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  required
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {isRegister ? (
              <details className="auth-admin-details">
                <summary>I have an admin setup code</summary>
                <div className="auth-form-group auth-admin-group">
                  <label>Admin setup code</label>
                  <input
                    name="adminSetupCode"
                    autoComplete="off"
                    className="form-control auth-modal-input"
                    placeholder="Only if someone shared one with you"
                    value={form.adminSetupCode}
                    onChange={(event) => setForm((current) => ({ ...current, adminSetupCode: event.target.value }))}
                  />
                </div>
              </details>
            ) : null}

            <button
              type="submit"
              className="auth-submit-button"
              disabled={isSubmitting || isProcessingRedirect}
            >
              {submitLabel}
            </button>
          </form>

          <div className="auth-divider">
            <span>or</span>
          </div>

          <div className="auth-social-grid">
            {oauthProviders.map((provider) => {
              return (
                <button
                  key={provider.key}
                  type="button"
                  className="auth-social-button google"
                  onClick={() => handleSocialStart(provider)}
                  disabled={!provider.available || isSubmitting || isProcessingRedirect}
                >
                  <span className="auth-social-mark google-icon" aria-hidden="true">
                    <GoogleMark />
                  </span>
                  <span className="auth-social-copy">
                    <strong>{isRegister ? 'Sign up with Google' : 'Sign in with Google'}</strong>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="auth-modal-footer">
            <p>
              {isRegister ? 'Have an account already?' : 'Need an account?'}{' '}
              <Link to={isRegister ? '/login' : '/register'} state={locationState || undefined}>
                {isRegister ? 'Log in' : 'Sign up'}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
