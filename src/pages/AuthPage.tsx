import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, type Location } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { getOAuthStartUrl, api } from '../lib/api'
import { trackEvent } from '../lib/telemetry'
import type { AuthAvailabilityEntry, AuthProviderOption } from '../types/api'
import Seo from '../components/Seo'
import Logo from '../components/Logo'

const PASSWORD_HELP_TEXT =
  'Use at least 8 characters with 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.'
const USERNAME_HELP_TEXT = 'Use 3 to 24 characters with only letters, numbers, underscores, or periods.'
const USERNAME_PATTERN = /^[A-Za-z0-9._]+$/

const DEFAULT_OAUTH_PROVIDERS: AuthProviderOption[] = [
  { key: 'google', label: 'Google', type: 'oauth', available: false, hint: 'Provider status unavailable right now.' }
]

function passwordChecks(password: string) {
  return {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password)
  }
}

function passwordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' }
  const checks = passwordChecks(password)
  const passed = Object.values(checks).filter(Boolean).length
  if (passed <= 1) return { score: 1, label: 'Very weak', color: '#ef4444' }
  if (passed === 2) return { score: 2, label: 'Weak', color: '#f97316' }
  if (passed === 3) return { score: 3, label: 'Fair', color: '#eab308' }
  if (passed === 4) return { score: 4, label: 'Good', color: '#22c55e' }
  return { score: 5, label: 'Strong', color: '#00d4ff' }
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

  return <div className="auth-field-note auth-field-note-danger">{entry.message}</div>
}

function PasswordStrengthBar({ password }: { password: string }) {
  const checks = passwordChecks(password)
  const strength = passwordStrength(password)

  if (!password) return null

  const rules = [
    { key: 'minLength', label: 'At least 8 characters', met: checks.minLength },
    { key: 'uppercase', label: 'One uppercase letter', met: checks.uppercase },
    { key: 'lowercase', label: 'One lowercase letter', met: checks.lowercase },
    { key: 'digit', label: 'One number', met: checks.digit },
    { key: 'special', label: 'One special character', met: checks.special }
  ]

  return (
    <div className="auth-pw-strength">
      <div className="auth-pw-strength-bar-track">
        {[1, 2, 3, 4, 5].map((segment) => (
          <div
            key={segment}
            className="auth-pw-strength-bar-segment"
            style={{
              background: segment <= strength.score ? strength.color : 'rgba(255,255,255,0.08)'
            }}
          />
        ))}
      </div>
      <span className="auth-pw-strength-label" style={{ color: strength.color }}>
        {strength.label}
      </span>
      <ul className="auth-pw-rules">
        {rules.map((rule) => (
          <li key={rule.key} className={rule.met ? 'auth-pw-rule-met' : 'auth-pw-rule-unmet'}>
            <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>
              {rule.met ? 'check_circle' : 'radio_button_unchecked'}
            </span>
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  )
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
    confirmPassword: '',
    usernameOrEmail: '',
    adminSetupCode: ''
  })
  const [providers, setProviders] = useState<AuthProviderOption[]>(DEFAULT_OAUTH_PROVIDERS)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isProcessingRedirect, setIsProcessingRedirect] = useState(false)
  const [feedback, setFeedback] = useState({ tone: 'danger', message: '' })
  const [fieldErrors, setFieldErrors] = useState<{
    username?: boolean
    email?: boolean
    password?: boolean
    confirmPassword?: boolean
    usernameOrEmail?: boolean
  }>({})
  const [availability, setAvailability] = useState<{
    username?: AuthAvailabilityEntry | null
    email?: AuthAvailabilityEntry | null
  }>({})

  const [slowConnection, setSlowConnection] = useState(false)

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSubmitting, setForgotSubmitting] = useState(false)
  const [forgotFeedback, setForgotFeedback] = useState({ tone: '', message: '' })

  const locationState = location.state as { from?: string; backgroundLocation?: Location } | null
  const returnTo = locationState?.from || '/'
  const passwordState = passwordChecks(form.password)
  const allPasswordRulesMet =
    passwordState.minLength && passwordState.uppercase && passwordState.lowercase && passwordState.digit && passwordState.special
  const oauthProviders = useMemo(
    () =>
      providers.filter(
        (provider): provider is AuthProviderOption & { type: 'oauth'; key: 'google' } =>
          provider.type === 'oauth' && provider.key === 'google'
      ),
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
    const message = params.get('message')
    const tone = params.get('tone')
    const oauthError = params.get('oauthError')
    const oauthToken = params.get('token')
    const oauthReturnTo = params.get('returnTo') || returnTo
    const provider = params.get('provider') || 'oauth'

    if (message && !oauthError && !oauthToken) {
      setFeedback({
        tone: tone === 'success' || tone === 'warning' ? tone : 'danger',
        message
      })
      navigate(location.pathname, { replace: true, state: location.state })
      return
    }

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

        navigate(user.role === 'admin' ? '/admin/deals' : oauthReturnTo, { replace: true })
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

  useEffect(() => {
    if (!isSubmitting) {
      setSlowConnection(false)
      return
    }
    const timer = window.setTimeout(() => setSlowConnection(true), 5000)
    return () => window.clearTimeout(timer)
  }, [isSubmitting])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setSlowConnection(false)
    setFeedback({ tone: 'danger', message: '' })
    setFieldErrors({})

    const username = form.username.trim()
    const email = form.email.trim()
    const password = form.password
    const confirmPassword = form.confirmPassword
    const usernameOrEmail = form.usernameOrEmail.trim()
    const adminSetupCode = form.adminSetupCode.trim()

    if (isRegister && !USERNAME_PATTERN.test(username)) {
      setFieldErrors({ username: true })
      setFeedback({ tone: 'danger', message: USERNAME_HELP_TEXT })
      setIsSubmitting(false)
      return
    }

    if (isRegister && !allPasswordRulesMet) {
      setFieldErrors({ password: true })
      setFeedback({ tone: 'danger', message: PASSWORD_HELP_TEXT })
      setIsSubmitting(false)
      return
    }

    if (isRegister && password !== confirmPassword) {
      setFieldErrors({ confirmPassword: true })
      setFeedback({ tone: 'danger', message: 'Passwords do not match.' })
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
      if (isRegister) {
        const response = await register({
          username,
          email,
          password,
          adminSetupCode
        })

        setFieldErrors({})
        setForm((current) => ({
          ...current,
          password: '',
          confirmPassword: '',
          usernameOrEmail: current.email
        }))
        navigate(
          {
            pathname: '/login',
            hash: `#message=${encodeURIComponent(
              response.message || 'Account created. Check your email to verify your account before logging in.'
            )}&tone=success`
          },
          {
            replace: true,
            state: {
              from: returnTo
            }
          }
        )
        return
      }

      const user = await login({
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

      navigate(user.role === 'admin' ? '/admin/deals' : returnTo, { replace: true })
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

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setForgotSubmitting(true)
    setForgotFeedback({ tone: '', message: '' })

    const email = forgotEmail.trim()
    if (!email || !email.includes('@')) {
      setForgotFeedback({ tone: 'danger', message: 'Please enter a valid email address.' })
      setForgotSubmitting(false)
      return
    }

    try {
      const result = await api.forgotPassword({ email })
      setForgotFeedback({ tone: 'success', message: result.message })
    } catch (error) {
      setForgotFeedback({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Could not send reset email. Please try again.'
      })
    } finally {
      setForgotSubmitting(false)
    }
  }

  function handleSocialStart(provider: AuthProviderOption & { type: 'oauth'; key: 'google' }) {
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
    : isSubmitting && slowConnection
      ? 'Server is waking up, hang tight...'
      : isSubmitting
        ? 'Working...'
        : isRegister
          ? 'Create account'
          : 'Log in'
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const seoTitle = isRegister ? 'Create account | PlayWise' : 'Login | PlayWise'
  const seoDescription = isRegister
    ? 'Join PlayWise to save your wishlist, hardware profiles, and alerts.'
    : 'Sign in to access your PlayWise wishlist, saved specs, and alerts.'
  const seoUrl = origin ? `${origin}/${isRegister ? 'register' : 'login'}` : undefined

  return (
    <>
      <Seo title={seoTitle} description={seoDescription} url={seoUrl} noIndex />
      <section className="auth-shell" onClick={() => navigate(returnTo, { replace: true })}>
        <div className="auth-modal-wrap">
        <div className="auth-modal-card" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="auth-modal-close"
            aria-label="Close"
            onClick={() => navigate(returnTo, { replace: true })}
          >
            <span className="material-symbols-outlined">close</span>
          </button>

          <div className="auth-modal-header">
            <div className="auth-modal-brand">
              <span className="auth-modal-mark">
                <Logo size={32} />
              </span>
              <div>
                <p className="auth-modal-kicker">PlayWise</p>
                <h1>
                  {showForgotPassword
                    ? 'Reset your password'
                    : isRegister
                      ? 'Join PlayWise today'
                      : 'Welcome back to PlayWise'}
                </h1>
              </div>
            </div>
            {!showForgotPassword && (
              <div className="auth-mode-switch">
                <Link to="/login" state={locationState || undefined} className={`auth-mode-pill ${!isRegister ? 'is-active' : ''}`}>
                  Log in
                </Link>
                <Link to="/register" state={locationState || undefined} className={`auth-mode-pill ${isRegister ? 'is-active' : ''}`}>
                  Sign up
                </Link>
              </div>
            )}
          </div>

          {/* ─── Forgot Password inline form ─── */}
          {showForgotPassword ? (
            <div className="auth-forgot-section">
              <p className="auth-forgot-desc">
                Enter the email address linked to your account and we'll send you a link to reset your password.
              </p>

              {forgotFeedback.message ? (
                <div className={`auth-inline-alert auth-inline-alert-${forgotFeedback.tone}`}>
                  {forgotFeedback.message}
                </div>
              ) : null}

              <form onSubmit={handleForgotPassword} className="auth-modal-form">
                <div className="auth-form-group">
                  <label>Email address</label>
                  <input
                    name="forgotEmail"
                    type="email"
                    autoComplete="email"
                    className="form-control auth-modal-input"
                    placeholder="you@example.com"
                    value={forgotEmail}
                    onChange={(event) => setForgotEmail(event.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="auth-submit-button"
                  disabled={forgotSubmitting}
                >
                  {forgotSubmitting ? 'Sending...' : 'Send reset link'}
                </button>
              </form>

              <button
                type="button"
                className="auth-forgot-back"
                onClick={() => {
                  setShowForgotPassword(false)
                  setForgotFeedback({ tone: '', message: '' })
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>arrow_back</span>
                Back to login
              </button>
            </div>
          ) : (
            <>
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
                  {isRegister && <PasswordStrengthBar password={form.password} />}
                </div>

                {isRegister && (
                  <div className="auth-form-group">
                    <label>Confirm password</label>
                    <div className="auth-password-wrap">
                      <input
                        name="confirmPassword"
                        autoComplete="new-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        className={`form-control auth-modal-input ${fieldErrors.confirmPassword ? 'is-invalid' : ''}`}
                        placeholder="Re-enter your password"
                        value={form.confirmPassword}
                        onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                        required
                      />
                      <button
                        type="button"
                        className="auth-password-toggle"
                        onClick={() => setShowConfirmPassword((current) => !current)}
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    {form.confirmPassword && form.password !== form.confirmPassword && (
                      <div className="auth-field-note auth-field-note-danger">Passwords do not match.</div>
                    )}
                    {form.confirmPassword && form.password === form.confirmPassword && form.confirmPassword.length > 0 && (
                      <div className="auth-field-note auth-field-note-success">Passwords match.</div>
                    )}
                  </div>
                )}

                {!isRegister && (
                  <div className="auth-forgot-link-wrap">
                    <button
                      type="button"
                      className="auth-forgot-link"
                      onClick={() => {
                        setShowForgotPassword(true)
                        setFeedback({ tone: 'danger', message: '' })
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

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
                  disabled={isSubmitting || isProcessingRedirect || (isRegister && !allPasswordRulesMet)}
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
                  <Link to={isRegister ? '/login' : '/register'} state={locationState || undefined} className="auth-footer-link">
                    {isRegister ? 'Log in' : 'Sign up'}
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
        </div>
      </section>
    </>
  )
}
