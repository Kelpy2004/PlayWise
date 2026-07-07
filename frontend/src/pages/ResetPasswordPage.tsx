import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { api } from '../lib/api'
import Seo from '../components/Seo'
import Logo from '../components/Logo'

// ---- shared styles (neo-brutalist .pw system, mirrors AuthPage) ------------
const label: CSSProperties = { fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: 'var(--tx3,#736c92)', textTransform: 'uppercase', margin: '0 0 7px', display: 'block' }
const fieldWrap: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg,#0b0a12)', border: '2px solid var(--line2,#3a3460)', borderRadius: 12, padding: '11px 13px' }
const inputStyle: CSSProperties = { flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: 'var(--tx,#f6f4ff)', font: 'inherit', fontSize: 15 }
const primaryBtn: CSSProperties = { width: '100%', fontFamily: 'var(--fd)', fontSize: 14.5, fontWeight: 800, letterSpacing: '-.01em', color: '#0b0a12', background: 'var(--lime)', border: '2.5px solid var(--bd,#f6f4ff)', borderRadius: 12, padding: '13px 16px', cursor: 'pointer', boxShadow: '3px 3px 0 var(--hard)', transition: 'transform .1s,box-shadow .1s' }
const noteDanger: CSSProperties = { fontFamily: 'var(--fm)', fontSize: 11.5, color: 'var(--pink)', marginTop: 6 }
const noteOk: CSSProperties = { fontFamily: 'var(--fm)', fontSize: 11.5, color: 'var(--lime)', marginTop: 6 }
const showToggle: CSSProperties = { fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, color: 'var(--tx2,#aaa3c6)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }

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

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ maxWidth: 1320, margin: '0 auto', padding: '60px 26px 40px', display: 'grid', placeItems: 'center' }}>
      <div className="rise" style={{ width: '100%', maxWidth: 452, background: 'var(--card,#1a1630)', border: '3px solid var(--bd,#f6f4ff)', borderRadius: 22, boxShadow: '10px 12px 0 var(--hard)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13, padding: '20px 21px 16px', borderBottom: '2px solid var(--line)' }}>
          <span style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 12, background: 'var(--bg,#0b0a12)', border: '2.5px solid var(--bd,#f6f4ff)', boxShadow: '3px 3px 0 var(--vio)', display: 'grid', placeItems: 'center' }}>
            <Logo size={22} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, letterSpacing: '.14em', color: 'var(--cyan)' }}>PLAYWISE</div>
            <div style={{ fontFamily: 'var(--fd)', fontSize: 21, fontWeight: 800, letterSpacing: '-.02em', marginTop: 3 }}>{title}</div>
          </div>
        </div>
        <div style={{ padding: '18px 21px 22px' }}>{children}</div>
      </div>
    </section>
  )
}

function BackToLogin() {
  return (
    <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--tx2,#aaa3c6)' }}>
      <Link to="/login" style={{ fontWeight: 700, color: 'var(--cyan)', textDecoration: 'underline', textUnderlineOffset: 3 }}>Back to login</Link>
    </div>
  )
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const resetToken = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState({ tone: '', message: '' })
  const [isComplete, setIsComplete] = useState(false)

  const checks = passwordChecks(password)
  const strength = passwordStrength(password)
  const allRulesMet = checks.minLength && checks.uppercase && checks.lowercase && checks.digit && checks.special

  const rules = [
    { key: 'minLength', label: 'At least 8 characters', met: checks.minLength },
    { key: 'uppercase', label: 'One uppercase letter', met: checks.uppercase },
    { key: 'lowercase', label: 'One lowercase letter', met: checks.lowercase },
    { key: 'digit', label: 'One number', met: checks.digit },
    { key: 'special', label: 'One special character', met: checks.special },
  ]

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback({ tone: '', message: '' })

    if (!resetToken) {
      setFeedback({ tone: 'danger', message: 'Invalid or missing reset token. Please request a new reset link.' })
      return
    }
    if (!allRulesMet) {
      setFeedback({ tone: 'danger', message: 'Please meet all password requirements.' })
      return
    }
    if (password !== confirmPassword) {
      setFeedback({ tone: 'danger', message: 'Passwords do not match.' })
      return
    }

    setIsSubmitting(true)
    try {
      const result = await api.resetPassword({ token: resetToken, password })
      setFeedback({ tone: 'success', message: result.message })
      setIsComplete(true)
    } catch (error) {
      setFeedback({ tone: 'danger', message: error instanceof Error ? error.message : 'Could not reset password. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const feedbackColor = feedback.tone === 'success' ? 'var(--lime)' : 'var(--pink)'
  const Alert = feedback.message ? (
    <div style={{ fontSize: 13, fontWeight: 600, color: feedbackColor, background: 'var(--bg,#0b0a12)', border: `2px solid ${feedbackColor}`, borderRadius: 11, padding: '10px 13px', marginBottom: 14 }}>{feedback.message}</div>
  ) : null

  if (!resetToken) {
    return (
      <>
        <Seo title="Reset password | PlayWise" noIndex />
        <Shell title="Invalid reset link">
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pink)', background: 'var(--bg,#0b0a12)', border: '2px solid var(--pink)', borderRadius: 11, padding: '10px 13px' }}>
            This password reset link is invalid or has expired. Please request a new one.
          </div>
          <BackToLogin />
        </Shell>
      </>
    )
  }

  return (
    <>
      <Seo title="Reset password | PlayWise" noIndex />
      <Shell title={isComplete ? 'Password updated' : 'Set new password'}>
        {Alert}

        {isComplete ? (
          <Link to="/login" className="press" style={{ ...primaryBtn, display: 'block', textAlign: 'center', textDecoration: 'none' }}>Go to login</Link>
        ) : (
          <>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={label}>New password</label>
                <div className="pwfield" style={fieldWrap}>
                  <input name="password" autoComplete="new-password" type={showPassword ? 'text' : 'password'} placeholder="Enter your new password" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />
                  <button type="button" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? 'Hide password' : 'Show password'} style={showToggle}>{showPassword ? 'HIDE' : 'SHOW'}</button>
                </div>

                {password && (
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
                )}
              </div>

              <div>
                <label style={label}>Confirm new password</label>
                <div className="pwfield" style={fieldWrap}>
                  <input name="confirmPassword" autoComplete="new-password" type={showConfirmPassword ? 'text' : 'password'} placeholder="Re-enter your new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required style={inputStyle} />
                  <button type="button" onClick={() => setShowConfirmPassword((s) => !s)} aria-label={showConfirmPassword ? 'Hide password' : 'Show password'} style={showToggle}>{showConfirmPassword ? 'HIDE' : 'SHOW'}</button>
                </div>
                {confirmPassword && password !== confirmPassword && <div style={noteDanger}>Passwords do not match.</div>}
                {confirmPassword && password === confirmPassword && <div style={noteOk}>Passwords match.</div>}
              </div>

              <button type="submit" className="press" disabled={isSubmitting || !allRulesMet || password !== confirmPassword} style={{ ...primaryBtn, marginTop: 2, opacity: isSubmitting || !allRulesMet || password !== confirmPassword ? 0.7 : 1 }}>
                {isSubmitting ? 'Resetting…' : 'Reset password'}
              </button>
            </form>
            <BackToLogin />
          </>
        )}
      </Shell>
    </>
  )
}
