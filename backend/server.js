require('dotenv').config()

const express = require('express')
const mongoose = require('mongoose')
const helmet = require('helmet')
const cors = require('cors')
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
const FRONTEND_ROOT = path.resolve(__dirname, '..')

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

app.use('/api/auth', authRoutes)
app.use('/api/games', gameRoutes)
app.use('/api/comments', commentRoutes)
app.use('/api/contact', contactRoutes)
app.use('/api/hardware', hardwareRoutes)

app.use(express.static(FRONTEND_ROOT))

app.get('/', (req, res) => {
  res.sendFile(path.join(FRONTEND_ROOT, 'index.html'))
})

connectDatabase().finally(() => {
  startPriceRefreshLoop()
  app.listen(PORT, () => {
    console.log(`PlayWise server running at http://localhost:${PORT}`)
  })
})
