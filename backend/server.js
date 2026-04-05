require('dotenv').config()

const express = require('express')
const mongoose = require('mongoose')
const helmet = require('helmet')
const cors = require('cors')
const fs = require('fs')
const path = require('path')

const authRoutes = require('./routes/auth')
const gameRoutes = require('./routes/games')
const commentRoutes = require('./routes/comments')
const contactRoutes = require('./routes/contact')
const hardwareRoutes = require('./routes/hardware')

const Game = require('./models/Game')
const seedGames = require('./data/seedGames')
const { startPriceRefreshLoop } = require('./utils/priceTracker')
const { ensureHardwareSeeded } = require('./utils/hardware')

const app = express()
const PORT = process.env.PORT || 4000
const DIST_ROOT = path.resolve(__dirname, '..', 'dist')
const HAS_FRONTEND_BUILD = fs.existsSync(path.join(DIST_ROOT, 'index.html'))
const FRONTEND_ROOT = DIST_ROOT

async function connectDatabase() {
  try {
    if (!process.env.MONGO_URI) {
      console.log('MONGO_URI not found, so running in demo mode.')
      return
    }

    await mongoose.connect(process.env.MONGO_URI)
    console.log('MongoDB connected successfully.')

    const totalGames = await Game.countDocuments()
    if (!totalGames) {
      await Game.insertMany(seedGames)
      console.log('Seeded game data.')
    }

    await ensureHardwareSeeded()
    console.log('Hardware data ready.')
  } catch (err) {
    console.error('Database connection failed. App will keep running in demo mode.', err.message)
  }
}

app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({ origin: true, credentials: true }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    databaseReady: mongoose.connection.readyState === 1,
    frontendBuilt: HAS_FRONTEND_BUILD,
    frontendRoot: FRONTEND_ROOT
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/games', gameRoutes)
app.use('/api/comments', commentRoutes)
app.use('/api/contact', contactRoutes)
app.use('/api/hardware', hardwareRoutes)

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

connectDatabase().finally(() => {
  startPriceRefreshLoop()
  app.listen(PORT, () => {
    console.log(`PlayWise server running at http://localhost:${PORT}`)
  })
})
