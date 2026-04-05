const express = require('express')

const Game = require('../models/Game')
const seedGames = require('../data/seedGames')
const { LAPTOP_LIBRARY, CPU_SCORES, GPU_SCORES, estimatePerformance } = require('../utils/hardware')
const { getPriceSnapshot } = require('../utils/priceTracker')
const { isDatabaseReady } = require('../utils/dbState')

const router = express.Router()

async function loadGames() {
  if (!isDatabaseReady()) {
    return seedGames
  }

  try {
    const games = await Game.find().lean()
    return games.length ? games : seedGames
  } catch (_) {
    return seedGames
  }
}

function buildSearchText(game) {
  const genres = Array.isArray(game.genres)
    ? game.genres
    : Array.isArray(game.genre)
      ? game.genre
      : game.genre
        ? [game.genre]
        : []

  return [
    game.title,
    ...genres,
    game.heroTag || '',
    game.description || ''
  ].join(' ').toLowerCase()
}

router.get('/', async (req, res) => {
  const query = String(req.query.q || '').trim().toLowerCase()
  const games = await loadGames()
  const filtered = !query ? games : games.filter((game) => buildSearchText(game).includes(query))
  res.json(filtered)
})

router.get('/hardware/library', (_req, res) => {
  res.json({ laptops: LAPTOP_LIBRARY, cpuScores: CPU_SCORES, gpuScores: GPU_SCORES })
})

router.get('/:slug/prices', async (req, res) => {
  const snapshot = await getPriceSnapshot(req.params.slug, {
    forceRefresh: req.query.refresh === '1'
  })

  res.json(snapshot)
})

router.get('/:slug', async (req, res) => {
  const games = await loadGames()
  const game = games.find((item) => item.slug === req.params.slug)

  if (!game) {
    return res.status(404).json({ message: 'Game not found' })
  }

  res.json(game)
})

router.post('/:slug/compatibility', async (req, res) => {
  const games = await loadGames()
  const game = games.find((item) => item.slug === req.params.slug)

  if (!game) {
    return res.status(404).json({ message: 'Game not found' })
  }

  let hardware = req.body
  if (req.body.laptop) {
    const laptop = LAPTOP_LIBRARY.find((item) => item.model.toLowerCase() === String(req.body.laptop).trim().toLowerCase())
    if (laptop) {
      hardware = laptop
    }
  }

  const result = await estimatePerformance(game, hardware)
  res.json(result)
})

module.exports = router
