import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, type Location } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { getOAuthStartUrl, api } from '../lib/api'
import { trackEvent } from '../lib/telemetry'
import type { AuthAvailabilityEntry, AuthProviderOption } from '../types/api'

const PASSWORD_HELP_TEXT =
  'Use at least 8 characters with 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.'
const USERNAME_HELP_TEXT = 'Use 3 to 24 characters with only letters, numbers, underscores, or periods.'
const USERNAME_PATTERN = /^[A-Za-z0-9._]+$/

const DEFAULT_OAUTH_PROVIDERS: AuthProviderOption[] = [
  { key: 'google', label: 'Google', type: 'oauth', available: false, hint: 'Provider status unavailable right now.' },
]

function passwordChecks(password: string) {
  return {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  }
}

function passwordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' }
  const passed = Object.values(passwordChecks(password)).filter(Boolean).length
  if (passed <= 1) return { score: 1, label: 'Very weak', color: '#ef4444' }
  if (passed === 2) return { score: 2, label: 'Weak', color: '#f97316' }
  if (passed === 3) return { score: 3, label: 'Fair', color: '#eab308' }
  if (passed === 4) return { score: 4, label: 'Good', color: '#22c55e' }
  return { score: 5, label: 'Strong', color: '#1fd7ff' }
}

// ---- shared styles (neo-brutalist .pw system) ------------------------------
const label: CSSProperties = { fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: 'var(--tx3,#736c92)', textTransform: 'uppercase', margin: '0 0 7px', display: 'block' }
const fieldWrap = (invalid?: boolean): CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg,#0b0a12)', border: `2px solid ${invalid ? 'var(--pink)' : 'var(--line2,#3a3460)'}`, borderRadius: 12, padding: '11px 13px' })
const inputStyle: CSSProperties = { flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: 'var(--tx,#f6f4ff)', font: 'inherit', fontSize: 15 }
const primaryBtn: CSSProperties = { width: '100%', fontFamily: 'var(--fd)', fontSize: 14.5, fontWeight: 800, letterSpacing: '-.01em', color: '#0b0a12', background: 'var(--lime)', border: '2.5px solid var(--bd,#f6f4ff)', borderRadius: 12, padding: '13px 16px', cursor: 'pointer', boxShadow: '3px 3px 0 var(--hard)', transition: 'transform .1s,box-shadow .1s' }
const noteDanger: CSSProperties = { fontFamily: 'var(--fm)', fontSize: 11.5, color: 'var(--pink)', marginTop: 6 }
const noteOk: CSSProperties = { fontFamily: 'var(--fm)', fontSize: 11.5, color: 'var(--lime)', marginTop: 6 }

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden focusable="false">
      <path fill="#4285F4" d="M21.64 12.2c0-.64-.06-1.25-.18-1.84H12v3.48h5.4a4.62 4.62 0 0 1-2 3.03v2.52h3.24c1.9-1.76 3-4.35 3-7.19Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.63-2.43l-3.24-2.52c-.9.6-2.05.95-3.39.95-2.6 0-4.8-1.76-5.58-4.12H3.08v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.42 13.88A5.99 5.99 0 0 1 6.1 12c0-.65.11-1.27.32-1.88V7.52H3.08A10 10 0 0 0 2 12c0 1.61.39 3.14 1.08 4.48l3.34-2.6Z" />
      <path fill="#EA4335" d="M12 5.98c1.47 0 2.78.5 3.82 1.49l2.86-2.86C16.96 3 14.7 2 12 2A10 10 0 0 0 3.08 7.52l3.34 2.6C7.2 7.74 9.4 5.98 12 5.98Z" />
    </svg>
  )
}

function Availability({ entry }: { entry?: AuthAvailabilityEntry | null }) {
  if (!entry || entry.available) return null
  return <div style={noteDanger}>{entry.message}</div>
}

function StrengthBar({ password }: { password: string }) {
  if (!password) return null
  const checks = passwordChecks(password)
  const strength = passwordStrength(password)
  const rules = [
    { key: 'minLength', label: 'At least 8 characters', met: checks.minLength },
    { key: 'uppercase', label: 'One uppercase letter', met: checks.uppercase },
    { key: 'lowercase', label: 'One lowercase letter', met: checks.lowercase },
    { key: 'digit', label: 'One number', met: checks.digit },
    { key: 'special', label: 'One special character', met: checks.special },
  ]
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5].map((seg) => (
          <div key={seg} style={{ flex: 1, height: 6, borderRadius: 4, border: '1.5px solid var(--bd,#f6f4ff)', background: seg <= strength.score ? strength.color : 'var(--line2,#3a3460)' }} />
        ))}
      </div>
      <div style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, color: strength.color, marginTop: 6 }}>{strength.label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 6 }}>
        {rules.map((r) => (
          <span key={r.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--fm)', fontSize: 10.5, color: r.met ? 'var(--lime)' : 'var(--tx3,#736c92)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: r.met ? 'var(--lime)' : 'var(--line2,#3a3460)' }} />{r.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register'
  const navigate = useNavigate()
  const location = useLocation()
  const { acceptExternalToken, login, register, token } = useAuth()
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '', usernameOrEmail: '', adminSetupCode: '' })
  const [providers, setProviders] = useState<AuthProviderOption[]>(DEFAULT_OAUTH_PROVIDERS)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isProcessingRedirect, setIsProcessingRedirect] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: string; message: string }>({ tone: 'danger', message: '' })
  const [fieldErrors, setFieldErrors] = useState<{ username?: boolean; email?: boolean; password?: boolean; confirmPassword?: boolean; usernameOrEmail?: boolean }>({})
  const [availability, setAvailability] = useState<{ username?: AuthAvailabilityEntry | null; email?: AuthAvailabilityEntry | null }>({})
  const [slowConnection, setSlowConnection] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSubmitting, setForgotSubmitting] = useState(false)
  const [forgotFeedback, setForgotFeedback] = useState<{ tone: string; message: string }>({ tone: '', message: '' })

  const locationState = location.state as { from?: string; backgroundLocation?: Location } | null
  const returnTo = locationState?.from || '/'
  const passwordState = passwordChecks(form.password)
  const allPasswordRulesMet = passwordState.minLength && passwordState.uppercase && passwordState.lowercase && passwordState.digit && passwordState.special
  const oauthProviders = useMemo(
    () => providers.filter((p): p is AuthProviderOption & { type: 'oauth'; key: 'google' } => p.type === 'oauth' && p.key === 'google'),
    [providers]
  )

  const close = () => navigate(returnTo, { replace: true })

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    let ignore = false
    void (async () => {
      try {
        const response = await api.fetchAuthProviders()
        if (!ignore) setProviders(response.providers)
      } catch {
        if (!ignore) setProviders(DEFAULT_OAUTH_PROVIDERS)
      }
    })()
    return () => { ignore = true }
  }, [])

  // OAuth redirect handling (token / error / message in hash)
  useEffect(() => {
    const hash = location.hash.startsWith('#') ? location.hash.slice(1) : ''
    if (!hash) return
    const params = new URLSearchParams(hash)
    const message = params.get('message')
    const tone = params.get('tone')
    const oauthError = params.get('oauthError')
    const oauthToken = params.get('token')
    const oauthReturnTo = params.get('returnTo') || returnTo
    const provider = params.get('provider') || 'oauth'

    if (message && !oauthError && !oauthToken) {
      setFeedback({ tone: tone === 'success' || tone === 'warning' ? tone : 'danger', message })
      navigate(location.pathname, { replace: true, state: location.state })
      return
    }
    if (oauthError) {
      setFeedback({ tone: 'danger', message: oauthError })
      navigate(location.pathname, { replace: true, state: location.state })
      return
    }
    if (!oauthToken) return

    let ignore = false
    setIsProcessingRedirect(true)
    setFeedback({ tone: 'danger', message: '' })
    void acceptExternalToken(oauthToken)
      .then(async (user) => {
        if (ignore) return
        await trackEvent({ category: 'auth', action: 'oauth_login_success', label: provider }, oauthToken)
        navigate(user.role === 'admin' ? '/admin/deals' : oauthReturnTo, { replace: true })
      })
      .catch((error) => {
        if (!ignore) {
          setFeedback({ tone: 'danger', message: error instanceof Error ? error.message : 'The social login could not be completed.' })
          navigate(location.pathname, { replace: true, state: location.state })
        }
      })
      .finally(() => { if (!ignore) setIsProcessingRedirect(false) })
    return () => { ignore = true }
  }, [acceptExternalToken, location.hash, location.pathname, location.state, navigate, returnTo])

  // live username/email availability while registering
  useEffect(() => {
    if (!isRegister) return
    const username = form.username.trim()
    const email = form.email.trim()
    if (!username && !email) { setAvailability({}); return }
    const checkUser = username.length >= 3 && USERNAME_PATTERN.test(username)
    const checkEmail = email.includes('@')
    if (!checkUser && !checkEmail) return
    let ignore = false
    const id = window.setTimeout(async () => {
      try {
        const response = await api.checkAuthAvailability({ username: checkUser ? username : undefined, email: checkEmail ? email : undefined })
        if (!ignore) setAvailability(response)
      } catch {
        if (!ignore) setAvailability({})
      }
    }, 320)
    return () => { ignore = true; window.clearTimeout(id) }
  }, [form.email, form.username, isRegister])

  useEffect(() => {
    if (!isSubmitting) { setSlowConnection(false); return }
    const t = window.setTimeout(() => setSlowConnection(true), 5000)
    return () => window.clearTimeout(t)
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

    if (isRegister && !USERNAME_PATTERN.test(username)) { setFieldErrors({ username: true }); setFeedback({ tone: 'danger', message: USERNAME_HELP_TEXT }); setIsSubmitting(false); return }
    if (isRegister && !allPasswordRulesMet) { setFieldErrors({ password: true }); setFeedback({ tone: 'danger', message: PASSWORD_HELP_TEXT }); setIsSubmitting(false); return }
    if (isRegister && password !== confirmPassword) { setFieldErrors({ confirmPassword: true }); setFeedback({ tone: 'danger', message: 'Passwords do not match.' }); setIsSubmitting(false); return }
    if (isRegister && (availability.username?.available === false || availability.email?.available === false)) {
      setFieldErrors({ username: availability.username?.available === false, email: availability.email?.available === false })
      setFeedback({ tone: 'danger', message: availability.username?.available === false ? availability.username.message : availability.email?.message || 'Please fix the highlighted fields.' })
      setIsSubmitting(false)
      return
    }

    try {
      const user = isRegister
        ? await register({ username, email, password, adminSetupCode })
        : await login({ usernameOrEmail, password })
      await trackEvent({ category: 'auth', action: isRegister ? 'register_success' : 'login_success', label: user.role }, token)
      navigate(user.role === 'admin' ? '/admin/deals' : returnTo, { replace: true })
    } catch (error) {
      setFieldErrors(isRegister ? { username: true, email: true, password: true } : { usernameOrEmail: true, password: true })
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
    if (!email || !email.includes('@')) { setForgotFeedback({ tone: 'danger', message: 'Please enter a valid email address.' }); setForgotSubmitting(false); return }
    try {
      const result = await api.forgotPassword({ email })
      setForgotFeedback({ tone: 'success', message: result.message })
    } catch (error) {
      setForgotFeedback({ tone: 'danger', message: error instanceof Error ? error.message : 'Could not send reset email. Please try again.' })
    } finally {
      setForgotSubmitting(false)
    }
  }

  function handleSocialStart(provider: AuthProviderOption & { type: 'oauth'; key: 'google' }) {
    if (!provider.available || provider.type !== 'oauth') {
      setFeedback({ tone: 'warning', message: provider.hint || `${provider.label} sign-in is not configured right now.` })
      return
    }
    void trackEvent({ category: 'auth', action: 'oauth_start', label: provider.key }, token)
    window.location.assign(getOAuthStartUrl(provider.key, returnTo))
  }

  const submitLabel = isProcessingRedirect
    ? 'Finishing sign in…'
    : isSubmitting && slowConnection
      ? 'Server waking up, hang tight…'
      : isSubmitting
        ? 'Working…'
        : isRegister
          ? 'Create account'
          : 'Log in'

  const feedbackColor = feedback.tone === 'success' ? 'var(--lime)' : feedback.tone === 'warning' ? 'var(--amber)' : 'var(--pink)'
  const title = showForgotPassword ? 'Reset your password' : isRegister ? 'Join PlayWise today' : 'Welcome back'

  return (
    <div className="pw" style={{ position: 'fixed', inset: 0, zIndex: 800, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto', background: 'rgba(6,5,12,.66)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} onClick={close}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal style={{ width: '100%', maxWidth: 452, margin: 'auto', background: 'var(--card,#1a1630)', border: '3px solid var(--bd,#f6f4ff)', borderRadius: 22, boxShadow: '10px 12px 0 var(--hard)', overflow: 'hidden', animation: 'pw-modalin .32s cubic-bezier(.16,1,.3,1)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13, padding: '20px 21px 16px', borderBottom: '2px solid var(--line)' }}>
          <span style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 12, background: 'var(--bg,#0b0a12)', border: '2.5px solid var(--bd,#f6f4ff)', boxShadow: '3px 3px 0 var(--vio)', display: 'grid', placeItems: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 48 48"><defs><linearGradient id="authLg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse"><stop stopColor="#ff2e6e" /><stop offset=".5" stopColor="#a24dff" /><stop offset="1" stopColor="#1fd7ff" /></linearGradient></defs><path d="M19 15 L34 24 L19 33 Z" fill="url(#authLg)" /></svg>
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, letterSpacing: '.14em', color: 'var(--cyan)' }}>PLAYWISE</div>
            <div style={{ fontFamily: 'var(--fd)', fontSize: 21, fontWeight: 800, letterSpacing: '-.02em', marginTop: 3 }}>{title}</div>
          </div>
          <button type="button" onClick={close} className="press" aria-label="Close" style={{ width: 38, height: 38, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--bg,#0b0a12)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 11, cursor: 'pointer', color: 'var(--tx,#f6f4ff)', boxShadow: '2px 2px 0 var(--hard)' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div style={{ padding: '18px 21px 22px' }}>
          {!showForgotPassword && (
            <div style={{ display: 'flex', gap: 5, background: 'var(--bg,#0b0a12)', border: '2px solid var(--line2,#3a3460)', borderRadius: 12, padding: 4, marginBottom: 18 }}>
              {([['/login', 'Log in', !isRegister], ['/register', 'Sign up', isRegister]] as const).map(([to, lbl, active]) => (
                <Link key={to} to={to} state={locationState || undefined} style={{ flex: 1, textAlign: 'center', textDecoration: 'none', fontFamily: 'var(--fd)', fontSize: 13.5, fontWeight: 700, borderRadius: 9, padding: '9px 12px', border: `2px solid ${active ? 'var(--bd,#f6f4ff)' : 'transparent'}`, background: active ? 'var(--lime)' : 'transparent', color: active ? '#0b0a12' : 'var(--tx2,#aaa3c6)' }}>{lbl}</Link>
              ))}
            </div>
          )}

          {showForgotPassword ? (
            <>
              <p style={{ fontSize: 13.5, color: 'var(--tx2,#aaa3c6)', lineHeight: 1.5, margin: '0 0 14px' }}>Enter the email linked to your account and we'll send a link to reset your password.</p>
              {forgotFeedback.message && <div style={{ fontSize: 13, fontWeight: 600, color: forgotFeedback.tone === 'success' ? 'var(--lime)' : 'var(--pink)', background: 'var(--bg,#0b0a12)', border: `2px solid ${forgotFeedback.tone === 'success' ? 'var(--lime)' : 'var(--pink)'}`, borderRadius: 11, padding: '10px 13px', marginBottom: 14 }}>{forgotFeedback.message}</div>}
              <form onSubmit={handleForgotPassword}>
                <label style={label}>Email address</label>
                <div className="pwfield" style={fieldWrap()}>
                  <input type="email" autoComplete="email" placeholder="you@example.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required style={inputStyle} />
                </div>
                <button type="submit" className="press" disabled={forgotSubmitting} style={{ ...primaryBtn, marginTop: 16, opacity: forgotSubmitting ? 0.7 : 1 }}>{forgotSubmitting ? 'Sending…' : 'Send reset link'}</button>
              </form>
              <button type="button" onClick={() => { setShowForgotPassword(false); setForgotFeedback({ tone: '', message: '' }) }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, fontFamily: 'var(--ff)', fontSize: 13, fontWeight: 700, color: 'var(--tx2,#aaa3c6)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>Back to login
              </button>
            </>
          ) : (
            <>
              {feedback.message && <div style={{ fontSize: 13, fontWeight: 600, color: feedbackColor, background: 'var(--bg,#0b0a12)', border: `2px solid ${feedbackColor}`, borderRadius: 11, padding: '10px 13px', marginBottom: 14 }}>{feedback.message}</div>}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {isRegister ? (
                  <>
                    <div>
                      <label style={label}>Email</label>
                      <div className="pwfield" style={fieldWrap(fieldErrors.email)}>
                        <input name="email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} required style={inputStyle} />
                      </div>
                      <Availability entry={availability.email} />
                    </div>
                    <div>
                      <label style={label}>Username</label>
                      <div className="pwfield" style={fieldWrap(fieldErrors.username)}>
                        <input name="username" autoComplete="username" placeholder="Choose a unique username" value={form.username} onChange={(e) => setForm((c) => ({ ...c, username: e.target.value }))} required style={inputStyle} />
                      </div>
                      <Availability entry={availability.username} />
                    </div>
                  </>
                ) : (
                  <div>
                    <label style={label}>Username or email</label>
                    <div className="pwfield" style={fieldWrap(fieldErrors.usernameOrEmail)}>
                      <input name="usernameOrEmail" autoComplete="username" placeholder="Enter your username or email" value={form.usernameOrEmail} onChange={(e) => setForm((c) => ({ ...c, usernameOrEmail: e.target.value }))} required style={inputStyle} />
                    </div>
                  </div>
                )}

                <div>
                  <label style={label}>Password</label>
                  <div className="pwfield" style={fieldWrap(fieldErrors.password)}>
                    <input name="password" autoComplete={isRegister ? 'new-password' : 'current-password'} type={showPassword ? 'text' : 'password'} placeholder={isRegister ? 'Create a password' : 'Enter your password'} value={form.password} onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))} required style={inputStyle} />
                    <button type="button" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? 'Hide password' : 'Show password'} style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, color: 'var(--tx2,#aaa3c6)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>{showPassword ? 'HIDE' : 'SHOW'}</button>
                  </div>
                  {isRegister && <StrengthBar password={form.password} />}
                </div>

                {isRegister && (
                  <div>
                    <label style={label}>Confirm password</label>
                    <div className="pwfield" style={fieldWrap(fieldErrors.confirmPassword)}>
                      <input name="confirmPassword" autoComplete="new-password" type={showConfirmPassword ? 'text' : 'password'} placeholder="Re-enter your password" value={form.confirmPassword} onChange={(e) => setForm((c) => ({ ...c, confirmPassword: e.target.value }))} required style={inputStyle} />
                      <button type="button" onClick={() => setShowConfirmPassword((s) => !s)} aria-label={showConfirmPassword ? 'Hide password' : 'Show password'} style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, color: 'var(--tx2,#aaa3c6)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>{showConfirmPassword ? 'HIDE' : 'SHOW'}</button>
                    </div>
                    {form.confirmPassword && form.password !== form.confirmPassword && <div style={noteDanger}>Passwords do not match.</div>}
                    {form.confirmPassword && form.password === form.confirmPassword && <div style={noteOk}>Passwords match.</div>}
                  </div>
                )}

                {!isRegister && (
                  <div style={{ textAlign: 'right', marginTop: -4 }}>
                    <button type="button" onClick={() => { setShowForgotPassword(true); setFeedback({ tone: 'danger', message: '' }) }} style={{ fontFamily: 'var(--ff)', fontSize: 12.5, fontWeight: 700, color: 'var(--cyan)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>Forgot password?</button>
                  </div>
                )}

                {isRegister && (
                  <details>
                    <summary style={{ fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 700, color: 'var(--tx3,#736c92)', cursor: 'pointer', letterSpacing: '.04em' }}>I have an admin setup code</summary>
                    <div style={{ marginTop: 10 }}>
                      <div className="pwfield" style={fieldWrap()}>
                        <input name="adminSetupCode" autoComplete="off" placeholder="Only if someone shared one with you" value={form.adminSetupCode} onChange={(e) => setForm((c) => ({ ...c, adminSetupCode: e.target.value }))} style={inputStyle} />
                      </div>
                    </div>
                  </details>
                )}

                <button type="submit" className="press" disabled={isSubmitting || isProcessingRedirect || (isRegister && !allPasswordRulesMet)} style={{ ...primaryBtn, marginTop: 2, opacity: isSubmitting || isProcessingRedirect || (isRegister && !allPasswordRulesMet) ? 0.7 : 1 }}>{submitLabel}</button>
              </form>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
                <span style={{ flex: 1, height: 2, background: 'var(--line)' }} />
                <span style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, color: 'var(--tx3,#736c92)' }}>or</span>
                <span style={{ flex: 1, height: 2, background: 'var(--line)' }} />
              </div>

              {oauthProviders.map((provider) => (
                <button key={provider.key} type="button" onClick={() => handleSocialStart(provider)} disabled={!provider.available || isSubmitting || isProcessingRedirect} className="press" style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: 'var(--ff)', fontSize: 14, fontWeight: 700, color: 'var(--tx,#f6f4ff)', background: 'var(--bg,#0b0a12)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 12, padding: '11px 16px', cursor: provider.available ? 'pointer' : 'not-allowed', boxShadow: '2px 2px 0 var(--hard)', opacity: provider.available ? 1 : 0.6 }}>
                  <GoogleMark />{isRegister ? 'Sign up with Google' : 'Continue with Google'}
                </button>
              ))}

              <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--tx2,#aaa3c6)' }}>
                {isRegister ? 'Have an account already?' : 'Need an account?'}{' '}
                <Link to={isRegister ? '/login' : '/register'} state={locationState || undefined} style={{ fontWeight: 700, color: 'var(--cyan)', textDecoration: 'underline', textUnderlineOffset: 3 }}>{isRegister ? 'Log in' : 'Sign up'}</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
