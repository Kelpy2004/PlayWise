const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { z } = require('zod')

const { env } = require('../lib/env')
const { ApiError, asyncHandler } = require('../lib/http')
const { getPrisma, isDatabaseReady } = require('../lib/prisma')
const { JWT_SECRET, requireAuth } = require('../middleware/auth')
const { validateBody } = require('../middleware/validate')
const {
  addDemoUser,
  countDemoAdmins,
  findDemoUserByUsernameOrEmail,
  nextDemoUserId
} = require('../utils/runtimeStore')

const router = express.Router()
const PASSWORD_RULE_MESSAGE =
  'Password must be at least 6 characters and include 1 uppercase letter, 1 lowercase letter, and 1 special character like ! @ # $ % ^ & * ( ) - _ + = ? / \\ . ,'
const passwordSchema = z
  .string()
  .min(6)
  .refine((value) => /[A-Z]/.test(value), PASSWORD_RULE_MESSAGE)
  .refine((value) => /[a-z]/.test(value), PASSWORD_RULE_MESSAGE)
  .refine((value) => /[^A-Za-z0-9]/.test(value), PASSWORD_RULE_MESSAGE)

const registerSchema = z.object({
  username: z.string().trim().min(3),
  email: z.string().trim().email(),
  password: passwordSchema,
  adminSetupCode: z.string().trim().optional().default('')
})

const loginSchema = z.object({
  usernameOrEmail: z.string().trim().min(1),
  password: z.string().min(1)
})

function normalizeRole(role) {
  return String(role || 'USER').toLowerCase()
}

function signToken(user) {
  return jwt.sign(
    {
      id: String(user.id),
      role: normalizeRole(user.role),
      username: user.username,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES }
  )
}

function serializeUser(user) {
  return {
    id: String(user.id),
    username: user.username,
    email: user.email,
    role: normalizeRole(user.role)
  }
}

async function findUserByUsernameOrEmail(usernameOrEmail) {
  const needle = String(usernameOrEmail || '').trim()

  if (!isDatabaseReady()) {
    return findDemoUserByUsernameOrEmail(needle)
  }

  const prisma = getPrisma()
  return prisma.user.findFirst({
    where: {
      OR: [
        { username: { equals: needle, mode: 'insensitive' } },
        { email: { equals: needle.toLowerCase(), mode: 'insensitive' } }
      ]
    }
  })
}

async function countAdmins() {
  if (!isDatabaseReady()) {
    return countDemoAdmins()
  }

  return getPrisma().user.count({ where: { role: 'ADMIN' } })
}

function shouldGrantAdmin(email, adminSetupCode, adminCount) {
  const configuredAdmins = String(env.ADMIN_EMAILS || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)

  if (configuredAdmins.includes(email)) return true

  if (env.ADMIN_SETUP_CODE && adminSetupCode === env.ADMIN_SETUP_CODE) {
    return true
  }

  return adminCount === 0
}

router.post(
  '/register',
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { username, email, password, adminSetupCode } = req.validatedBody

    const existingUser = (await findUserByUsernameOrEmail(username)) || (await findUserByUsernameOrEmail(email))
    if (existingUser) {
      throw new ApiError(409, 'A user with that username or email already exists.')
    }

    const role = shouldGrantAdmin(email, adminSetupCode, await countAdmins()) ? 'ADMIN' : 'USER'
    const passwordHash = await bcrypt.hash(password, 10)

    const user = isDatabaseReady()
      ? await getPrisma().user.create({
          data: {
            username,
            email: email.toLowerCase(),
            passwordHash,
            role
          }
        })
      : addDemoUser({
          id: nextDemoUserId(),
          username,
          email: email.toLowerCase(),
          passwordHash,
          role
        })

    const token = signToken(user)

    res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: serializeUser(user)
    })
  })
)

router.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { usernameOrEmail, password } = req.validatedBody
    const user = await findUserByUsernameOrEmail(usernameOrEmail)
    if (!user) {
      throw new ApiError(401, 'Invalid credentials.')
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash)
    if (!isMatch) {
      throw new ApiError(401, 'Invalid credentials.')
    }

    const token = signToken(user)
    res.json({ token, user: serializeUser(user) })
  })
)

router.get(
  '/session',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role
      }
    })
  })
)

module.exports = router
