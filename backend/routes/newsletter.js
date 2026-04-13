const express = require('express')
const { z } = require('zod')

const { asyncHandler } = require('../lib/http')
const { getPrisma, isDatabaseReady } = require('../lib/prisma')
const { optionalAuth } = require('../middleware/auth')
const { validateBody } = require('../middleware/validate')
const {
  findRuntimeNewsletterSubscriberByEmail,
  upsertRuntimeNewsletterSubscriber
} = require('../utils/runtimeStore')

const router = express.Router()

const newsletterSchema = z.object({
  email: z.string().trim().email()
})

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

router.post(
  '/subscribe',
  optionalAuth,
  validateBody(newsletterSchema),
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.validatedBody.email)
    const userId = req.user?.id || null

    if (isDatabaseReady()) {
      const subscriber = await getPrisma().newsletterSubscriber.upsert({
        where: { email },
        update: {
          userId: userId || undefined,
          isSubscribed: true,
          subscribedAt: new Date(),
          unsubscribedAt: null
        },
        create: {
          userId: userId || undefined,
          email,
          isSubscribed: true,
          subscribedAt: new Date(),
          unsubscribedAt: null
        }
      })

      return res.json(subscriber)
    }

    res.json(
      upsertRuntimeNewsletterSubscriber({
        userId,
        email,
        isSubscribed: true,
        subscribedAt: new Date().toISOString(),
        unsubscribedAt: null,
        updatedAt: new Date().toISOString()
      })
    )
  })
)

router.post(
  '/unsubscribe',
  optionalAuth,
  validateBody(newsletterSchema),
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.validatedBody.email)
    const userId = req.user?.id || null

    if (isDatabaseReady()) {
      const subscriber = await getPrisma().newsletterSubscriber.upsert({
        where: { email },
        update: {
          userId: userId || undefined,
          isSubscribed: false,
          unsubscribedAt: new Date()
        },
        create: {
          userId: userId || undefined,
          email,
          isSubscribed: false,
          subscribedAt: new Date(),
          unsubscribedAt: new Date()
        }
      })

      return res.json(subscriber)
    }

    const existing = findRuntimeNewsletterSubscriberByEmail(email)
    res.json(
      upsertRuntimeNewsletterSubscriber({
        ...(existing || {}),
        userId,
        email,
        isSubscribed: false,
        unsubscribedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    )
  })
)

module.exports = router
