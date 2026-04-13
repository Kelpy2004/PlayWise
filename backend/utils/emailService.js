const nodemailer = require('nodemailer')

const { env } = require('../lib/env')
const { logger } = require('../lib/logger')

let transporter = null
let initialized = false

function canSendEmail() {
  return Boolean(
    env.EMAIL_FROM &&
    env.SMTP_HOST &&
    env.SMTP_PORT &&
    env.SMTP_USER &&
    env.SMTP_PASS
  )
}

function getTransporter() {
  if (initialized) return transporter
  initialized = true

  if (!canSendEmail()) {
    transporter = null
    return transporter
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: Boolean(env.SMTP_SECURE),
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  })

  return transporter
}

async function sendEmail({ to, subject, html }) {
  const activeTransporter = getTransporter()
  if (!activeTransporter) {
    return {
      ok: false,
      status: 'SKIPPED',
      error: 'Email transport is not configured.'
    }
  }

  try {
    const result = await activeTransporter.sendMail({
      from: env.EMAIL_FROM,
      to,
      replyTo: env.EMAIL_REPLY_TO || undefined,
      subject,
      html
    })

    return {
      ok: true,
      status: 'SENT',
      providerId: result.messageId || null
    }
  } catch (error) {
    logger.error({ error, to, subject }, 'Email send failed')
    return {
      ok: false,
      status: 'FAILED',
      error: error instanceof Error ? error.message : 'Unknown email failure'
    }
  }
}

module.exports = {
  canSendEmail,
  sendEmail
}
