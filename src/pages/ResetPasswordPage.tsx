import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { api } from '../lib/api'
import Seo from '../components/Seo'
import Logo from '../components/Logo'

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
  const allRulesMet =
    checks.minLength && checks.uppercase && checks.lowercase && checks.digit && checks.special

  const rules = [
    { key: 'minLength', label: 'At least 8 characters', met: checks.minLength },
    { key: 'uppercase', label: 'One uppercase letter', met: checks.uppercase },
    { key: 'lowercase', label: 'One lowercase letter', met: checks.lowercase },
    { key: 'digit', label: 'One number', met: checks.digit },
    { key: 'special', label: 'One special character', met: checks.special }
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
      setFeedback({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Could not reset password. Please try again.'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!resetToken) {
    return (
      <>
        <Seo title="Reset password | PlayWise" noIndex />
        <section className="auth-shell">
          <div className="auth-modal-wrap">
            <div className="auth-modal-card">
              <div className="auth-modal-header">
                <div className="auth-modal-brand">
                  <span className="auth-modal-mark">
                    <Logo size={32} />
                  </span>
                  <div>
                    <p className="auth-modal-kicker">PlayWise</p>
                    <h1>Invalid reset link</h1>
                  </div>
                </div>
              </div>
              <div className="auth-inline-alert auth-inline-alert-danger">
                This password reset link is invalid or has expired. Please request a new one.
              </div>
              <div className="auth-modal-footer" style={{ marginTop: '1.5rem' }}>
                <p>
                  <Link to="/login" className="auth-footer-link">Back to login</Link>
                </p>
              </div>
            </div>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <Seo title="Reset password | PlayWise" noIndex />
      <section className="auth-shell">
        <div className="auth-modal-wrap">
          <div className="auth-modal-card">
            <div className="auth-modal-header">
              <div className="auth-modal-brand">
                <span className="auth-modal-mark">
                  <Logo size={32} />
                </span>
                <div>
                  <p className="auth-modal-kicker">PlayWise</p>
                  <h1>{isComplete ? 'Password updated' : 'Set new password'}</h1>
                </div>
              </div>
            </div>

            {feedback.message ? (
              <div className={`auth-inline-alert auth-inline-alert-${feedback.tone}`}>
                {feedback.message}
              </div>
            ) : null}

            {isComplete ? (
              <div className="auth-modal-footer" style={{ marginTop: '1rem' }}>
                <Link to="/login" className="auth-submit-button" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '0.82rem 1rem' }}>
                  Go to login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="auth-modal-form">
                <div className="auth-form-group">
                  <label>New password</label>
                  <div className="auth-password-wrap">
                    <input
                      name="password"
                      autoComplete="new-password"
                      type={showPassword ? 'text' : 'password'}
                      className="form-control auth-modal-input"
                      placeholder="Enter your new password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
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

                  {password && (
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
                  )}
                </div>

                <div className="auth-form-group">
                  <label>Confirm new password</label>
                  <div className="auth-password-wrap">
                    <input
                      name="confirmPassword"
                      autoComplete="new-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="form-control auth-modal-input"
                      placeholder="Re-enter your new password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
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
                  {confirmPassword && password !== confirmPassword && (
                    <div className="auth-field-note auth-field-note-danger">Passwords do not match.</div>
                  )}
                  {confirmPassword && password === confirmPassword && confirmPassword.length > 0 && (
                    <div className="auth-field-note auth-field-note-success">Passwords match.</div>
                  )}
                </div>

                <button
                  type="submit"
                  className="auth-submit-button"
                  disabled={isSubmitting || !allRulesMet || password !== confirmPassword}
                >
                  {isSubmitting ? 'Resetting...' : 'Reset password'}
                </button>
              </form>
            )}

            {!isComplete && (
              <div className="auth-modal-footer" style={{ marginTop: '1rem' }}>
                <p>
                  <Link to="/login" className="auth-footer-link">Back to login</Link>
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
