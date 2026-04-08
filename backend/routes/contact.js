const express = require('express')
const { z } = require('zod')

const { asyncHandler } = require('../lib/http')
const { getPrisma, isDatabaseReady } = require('../lib/prisma')
const { validateBody } = require('../middleware/validate')
const { addRuntimeContact } = require('../utils/runtimeStore')

const router = express.Router()

const contactSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  message: z.string().trim().min(10)
})

router.post(
  '/',
  validateBody(contactSchema),
  asyncHandler(async (req, res) => {
    const payload = {
      ...req.validatedBody,
      email: req.validatedBody.email.toLowerCase()
    }

    if (isDatabaseReady()) {
      await getPrisma().contact.create({ data: payload })
      return res.status(201).json({ ok: true, message: 'Message stored successfully.' })
    }

    addRuntimeContact({ ...payload, createdAt: new Date().toISOString() })
    res.status(201).json({ ok: true, message: 'Message accepted in demo mode.' })
  })
)

module.exports = router
