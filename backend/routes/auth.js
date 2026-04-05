const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const User = require('../models/user')
const { JWT_SECRET, requireAuth } = require('../middleware/auth')
const { isDatabaseReady } = require('../utils/dbState')
const {
  addDemoUser,
  countDemoAdmins,
  findDemoUserByUsernameOrEmail,
  nextDemoUserId
} = require('../utils/runtimeStore')

const router = express.Router()
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function signToken(user) {
  return jwt.sign(
    {
      id: String(user._id || user.id),
      role: user.role,
      username: user.username,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || '7d' }
  )
}

function serializeUser(user) {
  return {
    id: String(user._id || user.id),
    username: user.username,
    email: user.email,
    role: user.role
  }
}

function normalizeRegistrationBody(body = {}) {
  return {
    username: String(body.username || '').trim(),
    email: String(body.email || '').trim().toLowerCase(),
    password: String(body.password || ''),
    adminSetupCode: String(body.adminSetupCode || '').trim()
  }
}

async function findUserByUsernameOrEmail(usernameOrEmail) {
  const needle = String(usernameOrEmail || '').trim()

  if (!isDatabaseReady()) {
    return findDemoUserByUsernameOrEmail(needle)
  }

  const regex = new RegExp(`^${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
  return User.findOne({ $or: [{ username: regex }, { email: regex }] })
}

async function countAdmins() {
  if (!isDatabaseReady()) {
    return countDemoAdmins()
  }

  return User.countDocuments({ role: 'admin' })
}

function shouldGrantAdmin(email, adminSetupCode, adminCount) {
  const configuredAdmins = String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)

  if (configuredAdmins.includes(email)) return true

  if (process.env.ADMIN_SETUP_CODE && adminSetupCode === process.env.ADMIN_SETUP_CODE) {
    return true
  }

  return adminCount === 0
}

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, adminSetupCode } = normalizeRegistrationBody(req.body)

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email, and password are required.' })
    }

    if (username.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters.' })
    }

    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ message: 'Enter a valid email address.' })
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' })
    }

    const existingUser = await findUserByUsernameOrEmail(username) || await findUserByUsernameOrEmail(email)
    if (existingUser) {
      return res.status(409).json({ message: 'A user with that username or email already exists.' })
    }

    const role = shouldGrantAdmin(email, adminSetupCode, await countAdmins()) ? 'admin' : 'user'
    const passwordHash = await bcrypt.hash(password, 10)

    const user = isDatabaseReady()
      ? await User.create({ username, email, passwordHash, role })
      : addDemoUser({ id: nextDemoUserId(), username, email, passwordHash, role })

    const token = signToken(user)

    res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: serializeUser(user)
    })
  } catch (error) {
    res.status(500).json({ message: 'Could not register user right now.' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const usernameOrEmail = String(req.body.usernameOrEmail || '').trim()
    const password = String(req.body.password || '')

    if (!usernameOrEmail || !password) {
      return res.status(400).json({ message: 'Username/email and password are required.' })
    }

    const user = await findUserByUsernameOrEmail(usernameOrEmail)
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' })
    }

    const isMatch = typeof user.comparePassword === 'function'
      ? await user.comparePassword(password)
      : await bcrypt.compare(password, user.passwordHash)

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' })
    }

    const token = signToken(user)
    res.json({ token, user: serializeUser(user) })
  } catch (error) {
    res.status(500).json({ message: 'Could not log in right now.' })
  }
})

router.get('/session', requireAuth, async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role
    }
  })
})

module.exports = router
