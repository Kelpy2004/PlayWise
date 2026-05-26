const { env } = require('../lib/env')
const { sendEmail } = require('./emailService')
const { passwordResetEmail, signInNoticeEmail, verificationEmail, welcomeEmail } = require('./emailTemplates')

function buildSiteUrl(req, path = '/') {
  const origin = env.APP_ORIGIN || `${req.protocol}://${req.get('host')}`
  return new URL(path, origin).toString()
}

async function sendVerificationEmail({ req, email, username, token }) {
  const expiresInHours = Math.max(1, Number(env.EMAIL_VERIFICATION_HOURS) || 24)
  const template = verificationEmail({
    username,
    verifyUrl: buildSiteUrl(req, `/api/auth/verify-email?token=${encodeURIComponent(token)}`),
    expiresInHours
  })

  return sendEmail({
    to: email,
    subject: template.subject,
    html: template.html
  })
}

async function sendWelcomeEmail({ req, email, username }) {
  const template = welcomeEmail({
    username,
    loginUrl: buildSiteUrl(req, '/login')
  })

  return sendEmail({
    to: email,
    subject: template.subject,
    html: template.html
  })
}

async function sendSignInNoticeEmail({ req, email, username, providerLabel }) {
  const template = signInNoticeEmail({
    username,
    providerLabel,
    siteUrl: buildSiteUrl(req, '/')
  })

  return sendEmail({
    to: email,
    subject: template.subject,
    html: template.html
  })
}

async function sendPasswordResetEmail({ req, email, username, token }) {
  const template = passwordResetEmail({
    username,
    resetUrl: buildSiteUrl(req, `/reset-password?token=${encodeURIComponent(token)}`),
    expiresInMinutes: 60
  })

  return sendEmail({
    to: email,
    subject: template.subject,
    html: template.html
  })
}

module.exports = {
  sendPasswordResetEmail,
  sendSignInNoticeEmail,
  sendVerificationEmail,
  sendWelcomeEmail
}
