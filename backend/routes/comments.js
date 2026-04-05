const express = require('express')

const Comment = require('../models/Comment')
const { optionalAuth } = require('../middleware/auth')
const { isDatabaseReady } = require('../utils/dbState')
const { addRuntimeComment, getRuntimeComments } = require('../utils/runtimeStore')

const router = express.Router()

router.get('/:slug', async (req, res) => {
  const slug = String(req.params.slug || '').trim()

  try {
    if (isDatabaseReady()) {
      const comments = await Comment.find({ gameSlug: slug }).sort({ createdAt: -1 }).lean()
      return res.json(comments)
    }

    res.json(getRuntimeComments(slug))
  } catch (_) {
    res.json(getRuntimeComments(slug))
  }
})

router.post('/:slug', optionalAuth, async (req, res) => {
  const slug = String(req.params.slug || '').trim()
  const message = String(req.body.message || '').trim()
  const username = req.user?.username || String(req.body.username || '').trim()

  if (!message) {
    return res.status(400).json({ message: 'Comment message is required.' })
  }

  if (!username) {
    return res.status(400).json({ message: 'Username is required for guest comments.' })
  }

  if (message.length > 600) {
    return res.status(400).json({ message: 'Comment must be 600 characters or fewer.' })
  }

  const commentPayload = {
    gameSlug: slug,
    username,
    message,
    userId: req.user?.id || null,
    createdAt: new Date()
  }

  try {
    if (isDatabaseReady()) {
      const created = await Comment.create(commentPayload)
      return res.status(201).json(created)
    }

    res.status(201).json(addRuntimeComment(slug, commentPayload))
  } catch (_) {
    res.status(201).json(addRuntimeComment(slug, commentPayload))
  }
})

module.exports = router
