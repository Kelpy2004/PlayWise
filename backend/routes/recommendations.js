const express = require('express')
const { z } = require('zod')

const { asyncHandler } = require('../lib/http')
const { getPrisma, isDatabaseReady } = require('../lib/prisma')
const { optionalAuth } = require('../middleware/auth')
const { validateBody } = require('../middleware/validate')
const { resolveGameIdentity } = require('../utils/gameResolver')
const { buildRecommendation } = require('../utils/recommendationEngine')
const { addRecommendationSnapshot } = require('../utils/runtimeStore')

const router = express.Router()

const recommendationSchema = z.object({
  gameSlug: z.string().trim().min(1),
  hardware: z.record(z.any()).optional(),
  priceSnapshot: z.record(z.any()).nullable().optional(),
  sessionId: z.string().trim().optional()
})

router.post(
  '/assist',
  optionalAuth,
  validateBody(recommendationSchema),
  asyncHandler(async (req, res) => {
    const identity = await resolveGameIdentity(req.validatedBody.gameSlug)
    const game = identity.game

    if (!game) {
      return res.status(404).json({ message: 'Game not found for recommendation.' })
    }

    const recommendation = await buildRecommendation(game, {
      hardware: req.validatedBody.hardware,
      priceSnapshot: req.validatedBody.priceSnapshot
    })

    const snapshot = {
      gameSlug: identity.canonicalSlug,
      userId: req.user?.id || null,
      sessionId: req.validatedBody.sessionId || null,
      ...recommendation
    }

    if (isDatabaseReady()) {
      await getPrisma().recommendationSnapshot.create({
        data: {
          ...snapshot,
          reasons: recommendation.reasons
        }
      })
    } else {
      addRecommendationSnapshot({ ...snapshot, createdAt: new Date().toISOString() })
    }

    res.json(recommendation)
  })
)

module.exports = router
