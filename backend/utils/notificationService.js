const { getPrisma, isDatabaseReady } = require('../lib/prisma')
const { addRuntimeNotificationDelivery } = require('./runtimeStore')
const { sendEmail } = require('./emailService')
const {
  newsletterCampaignEmail,
  priceAlertEmail,
  tournamentLiveEmail,
  tournamentSoonEmail
} = require('./emailTemplates')

function resolveTemplate(type, payload) {
  if (type === 'PRICE_DROP' || type === 'PRICE_TARGET') {
    return priceAlertEmail(payload)
  }
  if (type === 'TOURNAMENT_SOON') {
    return tournamentSoonEmail(payload)
  }
  if (type === 'TOURNAMENT_LIVE') {
    return tournamentLiveEmail(payload)
  }
  return newsletterCampaignEmail(payload)
}

async function writeDeliveryLog(data) {
  if (isDatabaseReady()) {
    const prisma = getPrisma()
    let safeTournamentId = data.tournamentId || null

    // External providers (e.g. PandaScore) may send ids that do not exist in our Tournament table.
    // To avoid FK failures, only persist tournamentId when the record exists locally.
    if (safeTournamentId) {
      const existingTournament = await prisma.tournament.findUnique({
        where: { id: safeTournamentId },
        select: { id: true }
      })
      if (!existingTournament) {
        safeTournamentId = null
      }
    }

    return prisma.notificationDelivery.create({
      data: {
        ...data,
        tournamentId: safeTournamentId
      }
    })
  }

  return addRuntimeNotificationDelivery({
    ...data,
    sentAt: data.sentAt ? data.sentAt.toISOString() : null,
    updatedAt: new Date().toISOString()
  })
}

async function sendTypedNotification({
  type,
  email,
  userId = null,
  gameSlug = null,
  tournamentId = null,
  payload = {}
}) {
  const template = resolveTemplate(type, payload)
  const sendResult = await sendEmail({
    to: email,
    subject: template.subject,
    html: template.html
  })

  const status = sendResult.status || (sendResult.ok ? 'SENT' : 'FAILED')
  const sentAt = status === 'SENT' ? new Date() : null

  const log = await writeDeliveryLog({
    type,
    channel: 'EMAIL',
    status,
    recipientEmail: email,
    userId,
    gameSlug,
    tournamentId,
    payload,
    errorMessage: sendResult.error || null,
    sentAt
  })

  return { sendResult, log }
}

module.exports = {
  sendTypedNotification
}
