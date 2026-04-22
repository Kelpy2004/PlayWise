const express = require('express')
const { z } = require('zod')

const { asyncHandler } = require('../lib/http')
const { getPrisma, isDatabaseReady } = require('../lib/prisma')
const { logger } = require('../lib/logger')
const { optionalAuth } = require('../middleware/auth')
const { validateBody } = require('../middleware/validate')
const { addTelemetryEvent, recordRuntimeError } = require('../utils/runtimeStore')

const router = express.Router()

const telemetrySchema = z.object({
  category: z.string().trim().min(1),
  action: z.string().trim().min(1),
  label: z.string().trim().optional(),
  path: z.string().trim().optional(),
  sessionId: z.string().trim().optional(),
  meta: z.record(z.any()).optional()
})

const clientErrorSchema = z.object({
  message: z.string().trim().min(1),
  stack: z.string().optional(),
  path: z.string().trim().optional(),
  sessionId: z.string().trim().optional(),
  meta: z.record(z.any()).optional()
})

async function persistTelemetryEvent(payload, fallback) {
  if (!isDatabaseReady()) {
    fallback()
    return
  }

  try {
    await getPrisma().telemetryEvent.create({ data: payload })
  } catch (error) {
    logger.warn({ error, category: payload.category, action: payload.action }, 'Telemetry write failed, using runtime fallback')
    fallback()
  }
}

router.post(
  '/events',
  optionalAuth,
  validateBody(telemetrySchema),
  asyncHandler(async (req, res) => {
    const payload = {
      ...req.validatedBody,
      userId: req.user?.id || null
    }

    await persistTelemetryEvent(payload, () => {
      addTelemetryEvent({ ...payload, createdAt: new Date().toISOString() })
    })

    res.status(201).json({ ok: true })
  })
)

router.post(
  '/errors',
  optionalAuth,
  validateBody(clientErrorSchema),
  asyncHandler(async (req, res) => {
    const payload = {
      category: 'client',
      action: 'error',
      label: req.validatedBody.message,
      path: req.validatedBody.path,
      sessionId: req.validatedBody.sessionId,
      meta: {
        stack: req.validatedBody.stack,
        ...req.validatedBody.meta
      },
      userId: req.user?.id || null
    }

    await persistTelemetryEvent(payload, () => {
      recordRuntimeError({
        message: req.validatedBody.message,
        path: req.validatedBody.path,
        stack: req.validatedBody.stack,
        createdAt: new Date().toISOString()
      })
    })

    res.status(201).json({ ok: true })
  })
)

module.exports = router
