const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { randomBytes, randomUUID } = require('crypto')
const { z } = require('zod')

const { env } = require('../lib/env')
const { ApiError, asyncHandler } = require('../lib/http')
const { hasPostgresUrl, query, withTransaction } = require('../lib/postgres')
const { JWT_SECRET, requireAuth } = require('../middleware/auth')
const { validateBody } = require('../middleware/validate')
const {
  addDemoUser,
  countDemoAdmins,
  findDemoUserByUsernameOrEmail,
  getDemoUsers,
  nextDemoUserId
} = require('../utils/runtimeStore')

const router = express.Router()

const USERNAME_RULE_MESSAGE =
  'Username must be 3 to 24 characters and use only letters, numbers, underscores, or periods.'
const PASSWORD_RULE_MESSAGE =
  'Password must be at least 6 characters and include 1 uppercase letter, 1 lowercase letter, and 1 special character like ! @ # $ % ^ & * ( ) - _ + = ? / \\ . ,'

const usernameSchema = z
  .string()
  .trim()
  .min(3, USERNAME_RULE_MESSAGE)
  .max(24, USERNAME_RULE_MESSAGE)
  .regex(/^[A-Za-z0-9._]+$/, USERNAME_RULE_MESSAGE)

const passwordSchema = z
  .string()
  .min(6)
  .refine((value) => /[A-Z]/.test(value), PASSWORD_RULE_MESSAGE)
  .refine((value) => /[a-z]/.test(value), PASSWORD_RULE_MESSAGE)
  .refine((value) => /[^A-Za-z0-9]/.test(value), PASSWORD_RULE_MESSAGE)

const registerSchema = z.object({
  username: usernameSchema,
  email: z.string().trim().email(),
  password: passwordSchema,
  adminSetupCode: z.string().trim().optional().default('')
})

const loginSchema = z.object({
  usernameOrEmail: z.string().trim().min(1),
  password: z.string().min(1)
})

const availabilityQuerySchema = z.object({
  username: z.string().trim().optional(),
  email: z.string().trim().optional()
})

const OAUTH_PROVIDERS = ['google', 'microsoft', 'apple']

function normalizeRole(role) {
  return String(role || 'USER').toLowerCase()
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function normalizeUsername(username) {
  return String(username || '').trim()
}

function toProviderEnum(provider) {
  return String(provider || '').toUpperCase()
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

function parseJwtPayload(token) {
  if (!token || typeof token !== 'string') return {}
  const parts = token.split('.')
  if (parts.length < 2) return {}

  const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')

  try {
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'))
  } catch {
    return {}
  }
}

function isProviderAvailable(provider) {
  if (provider === 'google') {
    return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
  }

  if (provider === 'microsoft') {
    return Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET)
  }

  if (provider === 'apple') {
    return Boolean(env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY)
  }

  return false
}

function getProviderLabel(provider) {
  if (provider === 'google') return 'Google'
  if (provider === 'microsoft') return 'Microsoft'
  if (provider === 'apple') return 'Apple'
  return 'Provider'
}

function getProviderHint(provider) {
  if (isProviderAvailable(provider)) return ''
  if (provider === 'google') return 'Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env'
  if (provider === 'microsoft') return 'Add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET in backend/.env'
  if (provider === 'apple') return 'Add APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, and APPLE_PRIVATE_KEY in backend/.env'
  return 'Provider setup is incomplete.'
}

function listAuthProviders() {
  return [
    {
      key: 'password',
      label: 'Email and password',
      type: 'password',
      available: true
    },
    ...OAUTH_PROVIDERS.map((provider) => ({
      key: provider,
      label: getProviderLabel(provider),
      type: 'oauth',
      available: isProviderAvailable(provider),
      hint: getProviderHint(provider)
    }))
  ]
}

function buildAppOrigin(req) {
  return env.APP_ORIGIN || `${req.protocol}://${req.get('host')}`
}

function sanitizeReturnTo(returnTo) {
  const candidate = String(returnTo || '').trim()
  if (!candidate.startsWith('/')) return '/'
  if (candidate.startsWith('//')) return '/'
  return candidate
}

function buildFrontendAuthRedirect(req, params) {
  const target = new URL('/login', buildAppOrigin(req))
  target.hash = new URLSearchParams(
    Object.entries(params || {}).reduce((result, [key, value]) => {
      if (value != null && value !== '') {
        result[key] = String(value)
      }
      return result
    }, {})
  ).toString()
  return target.toString()
}

function createOAuthState(provider, returnTo) {
  return jwt.sign(
    {
      provider,
      returnTo: sanitizeReturnTo(returnTo)
    },
    JWT_SECRET,
    { expiresIn: '10m' }
  )
}

function readOAuthState(state, provider) {
  try {
    const payload = jwt.verify(String(state || ''), JWT_SECRET)
    if (!payload || payload.provider !== provider) {
      throw new Error('Provider mismatch')
    }

    return payload
  } catch {
    throw new ApiError(400, 'The social login request could not be verified. Please try again.')
  }
}

function createAppleClientSecret() {
  if (!env.APPLE_CLIENT_ID || !env.APPLE_TEAM_ID || !env.APPLE_KEY_ID || !env.APPLE_PRIVATE_KEY) {
    throw new ApiError(503, 'Apple sign-in is not configured right now.')
  }

  const privateKey = env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n')
  const issuedAt = Math.floor(Date.now() / 1000)

  return jwt.sign(
    {
      iss: env.APPLE_TEAM_ID,
      aud: 'https://appleid.apple.com',
      sub: env.APPLE_CLIENT_ID,
      iat: issuedAt,
      exp: issuedAt + (60 * 10)
    },
    privateKey,
    {
      algorithm: 'ES256',
      keyid: env.APPLE_KEY_ID
    }
  )
}

function getProviderConfig(provider, req) {
  const redirectUri = `${buildAppOrigin(req)}/api/auth/oauth/${provider}/callback`

  if (provider === 'google') {
    return {
      provider,
      label: 'Google',
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri,
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
      scopes: ['openid', 'email', 'profile']
    }
  }

  if (provider === 'microsoft') {
    const tenant = env.MICROSOFT_TENANT_ID || 'common'

    return {
      provider,
      label: 'Microsoft',
      clientId: env.MICROSOFT_CLIENT_ID,
      clientSecret: env.MICROSOFT_CLIENT_SECRET,
      redirectUri,
      authorizeUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
      tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      userInfoUrl: 'https://graph.microsoft.com/oidc/userinfo',
      scopes: ['openid', 'email', 'profile', 'User.Read']
    }
  }

  if (provider === 'apple') {
    return {
      provider,
      label: 'Apple',
      clientId: env.APPLE_CLIENT_ID,
      clientSecret: createAppleClientSecret(),
      redirectUri,
      authorizeUrl: 'https://appleid.apple.com/auth/authorize',
      tokenUrl: 'https://appleid.apple.com/auth/token',
      scopes: ['name', 'email']
    }
  }

  throw new ApiError(404, 'Unsupported login provider.')
}

function buildAuthorizationUrl(provider, req, returnTo) {
  const config = getProviderConfig(provider, req)
  const url = new URL(config.authorizeUrl)
  const state = createOAuthState(provider, returnTo)

  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', config.scopes.join(' '))
  url.searchParams.set('state', state)

  if (provider === 'google' || provider === 'microsoft') {
    url.searchParams.set('prompt', 'select_account')
  }

  if (provider === 'apple') {
    url.searchParams.set('response_mode', 'form_post')
  }

  return url.toString()
}

async function exchangeCodeForTokens(provider, req, code) {
  const config = getProviderConfig(provider, req)
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code: String(code || ''),
    grant_type: 'authorization_code',
    redirect_uri: config.redirectUri
  })

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new ApiError(502, `${config.label} sign-in could not be completed right now.`, payload)
  }

  return payload
}

async function fetchUserInfoJson(url, accessToken) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new ApiError(502, 'The social profile could not be loaded right now.', payload)
  }

  return payload
}

async function fetchOAuthProfile(provider, req, tokenPayload) {
  if (provider === 'google') {
    const profile = await fetchUserInfoJson('https://openidconnect.googleapis.com/v1/userinfo', tokenPayload.access_token)

    return {
      provider,
      providerAccountId: String(profile.sub || ''),
      email: normalizeEmail(profile.email),
      emailVerified: Boolean(profile.email_verified),
      name: profile.name || profile.given_name || 'Google Player',
      avatarUrl: profile.picture || '',
      usernameHint: profile.email ? String(profile.email).split('@')[0] : profile.name
    }
  }

  if (provider === 'microsoft') {
    const profile = await fetchUserInfoJson('https://graph.microsoft.com/oidc/userinfo', tokenPayload.access_token)
    const email = normalizeEmail(profile.email || profile.preferred_username)

    return {
      provider,
      providerAccountId: String(profile.sub || ''),
      email,
      emailVerified: Boolean(email),
      name: profile.name || 'Microsoft Player',
      avatarUrl: '',
      usernameHint: email ? email.split('@')[0] : profile.name
    }
  }

  if (provider === 'apple') {
    const claims = parseJwtPayload(tokenPayload.id_token)
    let displayName = claims.name || ''

    if (!displayName && req.body?.user) {
      try {
        const parsed = JSON.parse(req.body.user)
        displayName = [parsed?.name?.firstName, parsed?.name?.lastName].filter(Boolean).join(' ')
      } catch {
        displayName = ''
      }
    }

    const email = normalizeEmail(claims.email)

    return {
      provider,
      providerAccountId: String(claims.sub || ''),
      email,
      emailVerified: claims.email_verified === true || claims.email_verified === 'true',
      name: displayName || (email ? email.split('@')[0] : 'Apple Player'),
      avatarUrl: '',
      usernameHint: email ? email.split('@')[0] : displayName
    }
  }

  throw new ApiError(404, 'Unsupported login provider.')
}

function makeSocialPlaceholderEmail(provider, providerAccountId) {
  return `${provider}.${providerAccountId}@oauth.playwise.local`
}

function sanitizeUsernameCandidate(value) {
  const trimmed = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, '.')
    .replace(/^[._]+|[._]+$/g, '')

  if (trimmed.length >= 3) {
    return trimmed.slice(0, 24)
  }

  return 'player'
}

function authUsesDatabase() {
  return hasPostgresUrl()
}

function isDatabaseConflictError(error) {
  return Boolean(error && typeof error === 'object' && error.code === '23505')
}

async function runDatabaseQuery(client, statement, params = []) {
  if (client) {
    return client.query(statement, params)
  }

  return query(statement, params)
}

function mapUserRow(row) {
  if (!row) return null

  return {
    id: String(row.id),
    username: row.username,
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role,
    verified: Boolean(row.verified),
    avatarUrl: row.avatarUrl || ''
  }
}

async function createDatabaseUser(user, client = null) {
  const id = user.id || randomUUID()
  const timestamp = new Date()
  const result = await runDatabaseQuery(
    client,
    `
      insert into "User" (
        id,
        "username",
        "email",
        "passwordHash",
        "role",
        "verified",
        "avatarUrl",
        "createdAt",
        "updatedAt"
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning
        id,
        username,
        email,
        "passwordHash" as "passwordHash",
        role,
        verified,
        "avatarUrl" as "avatarUrl"
    `,
    [
      id,
      user.username,
      user.email,
      user.passwordHash,
      user.role,
      Boolean(user.verified),
      user.avatarUrl || '',
      timestamp,
      timestamp
    ]
  )

  return mapUserRow(result.rows[0])
}

async function usernameExists(username) {
  const normalized = sanitizeUsernameCandidate(username)

  if (!authUsesDatabase()) {
    return getDemoUsers().some((user) => String(user.username || '').toLowerCase() === normalized.toLowerCase())
  }

  const existing = await query(
    `
      select id
      from "User"
      where lower("username") = lower($1)
      limit 1
    `,
    [normalized]
  )

  return existing.rowCount > 0
}

async function buildUniqueUsername(base) {
  const seed = sanitizeUsernameCandidate(base)
  let candidate = seed
  let counter = 1

  while (await usernameExists(candidate)) {
    counter += 1
    const suffix = `.${counter}`
    const truncatedBase = seed.slice(0, Math.max(3, 24 - suffix.length))
    candidate = `${truncatedBase}${suffix}`
  }

  return candidate
}

async function createRandomPasswordHash() {
  return bcrypt.hash(randomBytes(24).toString('hex'), 10)
}

async function findUserByUsername(username) {
  const needle = normalizeUsername(username)

  if (!needle) return null

  if (!authUsesDatabase()) {
    return getDemoUsers().find((user) => String(user.username || '').toLowerCase() === needle.toLowerCase()) || null
  }

  const result = await query(
    `
      select
        id,
        username,
        email,
        "passwordHash" as "passwordHash",
        role,
        verified,
        "avatarUrl" as "avatarUrl"
      from "User"
      where lower("username") = lower($1)
      limit 1
    `,
    [needle]
  )

  return mapUserRow(result.rows[0])
}

async function findUserByEmail(email) {
  const needle = normalizeEmail(email)

  if (!needle) return null

  if (!authUsesDatabase()) {
    return findDemoUserByUsernameOrEmail(needle)
  }

  const result = await query(
    `
      select
        id,
        username,
        email,
        "passwordHash" as "passwordHash",
        role,
        verified,
        "avatarUrl" as "avatarUrl"
      from "User"
      where lower("email") = lower($1)
      limit 1
    `,
    [needle]
  )

  return mapUserRow(result.rows[0])
}

async function findUserByUsernameOrEmail(usernameOrEmail) {
  const needle = String(usernameOrEmail || '').trim()

  if (!needle) return null

  if (!authUsesDatabase()) {
    return findDemoUserByUsernameOrEmail(needle)
  }

  const result = await query(
    `
      select
        id,
        username,
        email,
        "passwordHash" as "passwordHash",
        role,
        verified,
        "avatarUrl" as "avatarUrl"
      from "User"
      where lower("username") = lower($1)
        or lower("email") = lower($2)
      limit 1
    `,
    [needle, normalizeEmail(needle)]
  )

  return mapUserRow(result.rows[0])
}

async function findUserByProviderAccount(provider, providerAccountId) {
  if (!authUsesDatabase()) {
    return null
  }

  const result = await query(
    `
      select
        u.id,
        u.username,
        u.email,
        u."passwordHash" as "passwordHash",
        u.role,
        u.verified,
        u."avatarUrl" as "avatarUrl"
      from "ProviderAccount" pa
      inner join "User" u on u.id = pa."userId"
      where pa."provider" = $1
        and pa."providerAccountId" = $2
      limit 1
    `,
    [toProviderEnum(provider), String(providerAccountId || '')]
  )

  return mapUserRow(result.rows[0])
}

async function countAdmins() {
  if (!authUsesDatabase()) {
    return countDemoAdmins()
  }

  const result = await query(
    `
      select count(*)::int as count
      from "User"
      where role = 'ADMIN'
    `
  )

  return Number(result.rows[0]?.count || 0)
}

function shouldGrantAdmin(email, adminSetupCode, adminCount) {
  const configuredAdmins = String(env.ADMIN_EMAILS || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)

  if (configuredAdmins.includes(normalizeEmail(email))) return true

  if (env.ADMIN_SETUP_CODE && adminSetupCode === env.ADMIN_SETUP_CODE) {
    return true
  }

  return adminCount === 0
}

async function upsertProviderAccount(userId, profile) {
  if (!authUsesDatabase()) return

  const timestamp = new Date()

  await query(
    `
      insert into "ProviderAccount" (
        id,
        "userId",
        "provider",
        "providerAccountId",
        "email",
        "displayName",
        "avatarUrl",
        "createdAt",
        "updatedAt"
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      on conflict ("provider", "providerAccountId")
      do update set
        "userId" = excluded."userId",
        "email" = excluded."email",
        "displayName" = excluded."displayName",
        "avatarUrl" = excluded."avatarUrl",
        "updatedAt" = now()
    `,
    [
      randomUUID(),
      userId,
      toProviderEnum(profile.provider),
      String(profile.providerAccountId),
      profile.email || null,
      profile.name || null,
      profile.avatarUrl || null,
      timestamp,
      timestamp
    ]
  )
}

async function resolveOAuthUser(profile) {
  const providerAccountUser = await findUserByProviderAccount(profile.provider, profile.providerAccountId)
  if (providerAccountUser) {
    return providerAccountUser
  }

  let user = profile.email ? await findUserByEmail(profile.email) : null

  if (!user) {
    const email = profile.email || makeSocialPlaceholderEmail(profile.provider, profile.providerAccountId)
    const passwordHash = await createRandomPasswordHash()
    const role = shouldGrantAdmin(email, '', await countAdmins()) ? 'ADMIN' : 'USER'

    if (!authUsesDatabase()) {
      user = addDemoUser({
        id: nextDemoUserId(),
        username: await buildUniqueUsername(profile.usernameHint || profile.name || profile.provider),
        email,
        passwordHash,
        role,
        verified: Boolean(profile.emailVerified),
        avatarUrl: profile.avatarUrl || ''
      })
    } else {
      user = await withTransaction(async (client) => {
        const existingByEmail = profile.email
          ? await runDatabaseQuery(
              client,
              `
                select
                  id,
                  username,
                  email,
                  "passwordHash" as "passwordHash",
                  role,
                  verified,
                  "avatarUrl" as "avatarUrl"
                from "User"
                where lower("email") = lower($1)
                limit 1
              `,
              [email]
            ).then((result) => mapUserRow(result.rows[0]))
          : null

        if (existingByEmail) {
          return existingByEmail
        }

        let attempts = 0

        while (attempts < 5) {
          attempts += 1
          const username = await buildUniqueUsername(profile.usernameHint || profile.name || profile.provider)

          try {
            return await createDatabaseUser(
              {
                username,
                email,
                passwordHash,
                role,
                verified: Boolean(profile.emailVerified),
                avatarUrl: profile.avatarUrl || ''
              },
              client
            )
          } catch (error) {
            if (!isDatabaseConflictError(error)) {
              throw error
            }

            const existingEmailResult = await runDatabaseQuery(
              client,
              `
                select
                  id,
                  username,
                  email,
                  "passwordHash" as "passwordHash",
                  role,
                  verified,
                  "avatarUrl" as "avatarUrl"
                from "User"
                where lower("email") = lower($1)
                limit 1
              `,
              [email]
            )

            const existingEmailUser = mapUserRow(existingEmailResult.rows[0])
            if (existingEmailUser) {
              return existingEmailUser
            }
          }
        }

        throw new ApiError(500, 'The social account could not be reserved right now.')
      })
    }
  }

  if (!user) {
    throw new ApiError(500, 'The social account could not be linked right now.')
  }

  await upsertProviderAccount(user.id, profile)

  if (authUsesDatabase() && profile.avatarUrl && !user.avatarUrl) {
    const result = await query(
      `
        update "User"
        set "avatarUrl" = $2,
            "updatedAt" = now()
        where id = $1
        returning
          id,
          username,
          email,
          "passwordHash" as "passwordHash",
          role,
          verified,
          "avatarUrl" as "avatarUrl"
      `,
      [user.id, profile.avatarUrl]
    )

    user = mapUserRow(result.rows[0]) || user
  }

  return user
}

router.get(
  '/providers',
  asyncHandler(async (_req, res) => {
    res.json({
      providers: listAuthProviders()
    })
  })
)

router.get(
  '/availability',
  asyncHandler(async (req, res) => {
    const { username, email } = availabilityQuerySchema.parse(req.query)
    const response = {}

    if (username) {
      const usernameTaken = Boolean(await findUserByUsername(username))
      response.username = {
        available: !usernameTaken,
        message: usernameTaken ? 'That username is already taken.' : 'Username is available.'
      }
    }

    if (email) {
      const emailTaken = Boolean(await findUserByEmail(email))
      response.email = {
        available: !emailTaken,
        message: emailTaken ? 'That email is already registered.' : 'Email is available.'
      }
    }

    res.json(response)
  })
)

router.post(
  '/register',
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { username, email, password, adminSetupCode } = req.validatedBody
    const normalizedUsername = normalizeUsername(username)
    const normalizedEmail = normalizeEmail(email)

    const existingUser = (await findUserByUsername(normalizedUsername)) || (await findUserByEmail(normalizedEmail))
    if (existingUser) {
      throw new ApiError(409, 'A user with that username or email already exists.')
    }

    const role = shouldGrantAdmin(normalizedEmail, adminSetupCode, await countAdmins()) ? 'ADMIN' : 'USER'
    const passwordHash = await bcrypt.hash(password, 10)

    let user

    if (!authUsesDatabase()) {
      user = addDemoUser({
        id: nextDemoUserId(),
        username: normalizedUsername,
        email: normalizedEmail,
        passwordHash,
        role
      })
    } else {
      try {
        user = await createDatabaseUser({
          username: normalizedUsername,
          email: normalizedEmail,
          passwordHash,
          role
        })
      } catch (error) {
        if (isDatabaseConflictError(error)) {
          throw new ApiError(409, 'A user with that username or email already exists.')
        }

        throw error
      }
    }

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
  '/oauth/:provider/start',
  asyncHandler(async (req, res) => {
    const provider = String(req.params.provider || '').toLowerCase()
    const returnTo = sanitizeReturnTo(req.query.returnTo)

    if (!OAUTH_PROVIDERS.includes(provider)) {
      throw new ApiError(404, 'Unsupported login provider.')
    }

    if (!isProviderAvailable(provider)) {
      res.redirect(buildFrontendAuthRedirect(req, {
        oauthError: `${getProviderLabel(provider)} sign-in is not configured yet.`,
        returnTo
      }))
      return
    }

    res.redirect(buildAuthorizationUrl(provider, req, returnTo))
  })
)

router.all(
  '/oauth/:provider/callback',
  asyncHandler(async (req, res) => {
    const provider = String(req.params.provider || '').toLowerCase()

    if (!OAUTH_PROVIDERS.includes(provider)) {
      throw new ApiError(404, 'Unsupported login provider.')
    }

    const state = req.query.state || req.body.state
    const error = req.query.error || req.body.error
    const errorDescription = req.query.error_description || req.body.error_description

    if (error) {
      res.redirect(
        buildFrontendAuthRedirect(req, {
          oauthError: errorDescription || `${getProviderLabel(provider)} sign-in was cancelled.`
        })
      )
      return
    }

    const statePayload = readOAuthState(state, provider)
    const code = req.query.code || req.body.code

    if (!code) {
      res.redirect(
        buildFrontendAuthRedirect(req, {
          oauthError: `${getProviderLabel(provider)} did not return an authorization code.`,
          returnTo: statePayload.returnTo
        })
      )
      return
    }

    const tokenPayload = await exchangeCodeForTokens(provider, req, code)
    const profile = await fetchOAuthProfile(provider, req, tokenPayload)
    const user = await resolveOAuthUser(profile)
    const token = signToken(user)

    res.redirect(
      buildFrontendAuthRedirect(req, {
        token,
        provider,
        returnTo: statePayload.returnTo
      })
    )
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
