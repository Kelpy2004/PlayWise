const express = require('express')

const Contact = require('../models/Contact')
const { isDatabaseReady } = require('../utils/dbState')
const { addRuntimeContact } = require('../utils/runtimeStore')

const router = express.Router()
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

router.post('/', async (req, res) => {
  const name = String(req.body.name || '').trim()
  const email = String(req.body.email || '').trim().toLowerCase()
  const message = String(req.body.message || '').trim()

  if (!name || !email || !message) {
    return res.status(400).json({ message: 'Name, email, and message are required.' })
  }

  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ message: 'Please enter a valid email address.' })
  }

  if (message.length < 10) {
    return res.status(400).json({ message: 'Message should be at least 10 characters long.' })
  }

  const payload = { name, email, message, createdAt: new Date() }

  try {
    if (isDatabaseReady()) {
      await Contact.create(payload)
      return res.status(201).json({ ok: true, message: 'Message stored successfully.' })
    }

    addRuntimeContact(payload)
    res.status(201).json({ ok: true, message: 'Message accepted in demo mode.' })
  } catch (_) {
    addRuntimeContact(payload)
    res.status(201).json({ ok: true, message: 'Message accepted in demo mode.' })
  }
})

module.exports = router
