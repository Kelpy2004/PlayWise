require('dotenv').config()

const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const rateLimit = require('express-rate-limit')

const authRoutes = require('./routes/auth')
const gameRoutes = require('./routes/games')
const commentRoutes = require('./routes/comments')
const contactRoutes = require('./routes/contact')
const hardwareRoutes = require('./routes/hardware')
const telemetryRoutes = require('./routes/telemetry')
const userRoutes = require('./routes/users')
const recommendationRoutes = require('./routes/recommendations')
const assistantRoutes = require('./routes/assistant')

const { env } = require('./lib/env')
const { connectPrisma, isDatabaseReady } = require('./lib/prisma')
const { httpLogger, logger } = require('./lib/logger')
const { initSentry, isSentryEnabled } = require('./lib/sentry')
const { errorHandler } = require('./middleware/errorHandler')
const { startPriceRefreshLoop } = require('./utils/priceTracker')
const { ensureHardwareSeeded } = require('./utils/hardware')
const { ensureGamesSeeded } = require('./utils/gameCatalog')

const app = express()
const PORT = env.PORT
const DIST_ROOT = path.resolve(__dirname, '..', 'dist')
const HAS_FRONTEND_BUILD = fs.existsSync(path.join(DIST_ROOT, 'index.html'))
const FRONTEND_ROOT = DIST_ROOT

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false
})

initSentry()

async function connectDatabase() {
  try {
    if (!process.env.DATABASE_URL) {
      logger.info('DATABASE_URL not found, so running in demo mode.')
      return
    }

    await connectPrisma()
    await ensureGamesSeeded()
    await ensureHardwareSeeded()
    logger.info('PostgreSQL connected successfully and seeds are ready.')
  } catch (error) {
    logger.error({ error }, 'Database connection failed. App will keep running in demo mode.')
  }
}

app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({ origin: true, credentials: true }))
app.use(apiLimiter)
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(httpLogger)

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    databaseReady: isDatabaseReady(),
    frontendBuilt: HAS_FRONTEND_BUILD,
    frontendRoot: FRONTEND_ROOT,
    stack: {
      frontend: 'React + TypeScript + Tailwind foundation',
      backend: 'Express + Prisma + PostgreSQL'
    },
    monitoring: {
      sentry: isSentryEnabled()
    }
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/games', gameRoutes)
app.use('/api/comments', commentRoutes)
app.use('/api/contact', contactRoutes)
app.use('/api/hardware', hardwareRoutes)
app.use('/api/telemetry', telemetryRoutes)
app.use('/api/users', userRoutes)
app.use('/api/recommendations', recommendationRoutes)
app.use('/api/assistant', assistantRoutes)

if (HAS_FRONTEND_BUILD) {
  app.use(express.static(FRONTEND_ROOT))
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(FRONTEND_ROOT, 'index.html'))
  })
} else {
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.status(503).send('Frontend build not found. Run npm run build before starting the server.')
  })
}

app.use(errorHandler)

connectDatabase().finally(() => {
  startPriceRefreshLoop()
  app.listen(PORT, () => {
    logger.info(`PlayWise server running at http://localhost:${PORT}`)
  })
})
