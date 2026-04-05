const express = require('express')

const Cpu = require('../models/Cpu')
const Gpu = require('../models/Gpu')
const Laptop = require('../models/Laptop')
const { requireAuth, requireAdmin } = require('../middleware/auth')
const { getHardwareCatalog, estimatePerformance } = require('../utils/hardware')
const { isDatabaseReady } = require('../utils/dbState')

const router = express.Router()

function normalizeEntryBody(body = {}) {
  return {
    name: String(body.name || '').trim(),
    score: Number(body.score),
    family: String(body.family || '').trim(),
    platform: String(body.platform || 'windows').trim().toLowerCase(),
    notes: String(body.notes || '').trim()
  }
}

function normalizeLaptopBody(body = {}) {
  return {
    model: String(body.model || '').trim(),
    brand: String(body.brand || '').trim(),
    cpu: String(body.cpu || '').trim(),
    gpu: String(body.gpu || '').trim(),
    ram: Number(body.ram),
    platform: String(body.platform || 'windows').trim().toLowerCase(),
    tags: Array.isArray(body.tags)
      ? body.tags.map((item) => String(item).trim()).filter(Boolean)
      : [],
    notes: String(body.notes || '').trim()
  }
}

router.get('/catalog', async (req, res) => {
  try {
    const catalog = await getHardwareCatalog()
    res.json(catalog)
  } catch (err) {
    res.status(500).json({ message: 'Could not load hardware catalog' })
  }
})

router.get('/cpus', async (req, res) => {
  try {
    const catalog = await getHardwareCatalog()
    res.json(catalog.cpus)
  } catch (err) {
    res.status(500).json({ message: 'Could not load CPUs' })
  }
})

router.get('/gpus', async (req, res) => {
  try {
    const catalog = await getHardwareCatalog()
    res.json(catalog.gpus)
  } catch (err) {
    res.status(500).json({ message: 'Could not load GPUs' })
  }
})

router.get('/laptops', async (req, res) => {
  try {
    const catalog = await getHardwareCatalog()
    const q = String(req.query.q || '').trim().toLowerCase()

    if (!q) {
      return res.json(catalog.laptops)
    }

    const filtered = catalog.laptops.filter((item) => {
      const line = `${item.brand || ''} ${item.model || ''}`.toLowerCase()
      return line.includes(q)
    })

    res.json(filtered)
  } catch (err) {
    res.status(500).json({ message: 'Could not load laptops' })
  }
})

router.post('/cpus', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!isDatabaseReady()) {
      return res.status(503).json({ message: 'Hardware writes require an active database connection.' })
    }

    const payload = normalizeEntryBody(req.body)
    if (!payload.name || !Number.isFinite(payload.score)) {
      return res.status(400).json({ message: 'CPU name and numeric score are required.' })
    }

    const created = await Cpu.create(payload)
    res.status(201).json(created)
  } catch (err) {
    res.status(400).json({ message: 'Could not save CPU', error: err.message })
  }
})

router.post('/gpus', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!isDatabaseReady()) {
      return res.status(503).json({ message: 'Hardware writes require an active database connection.' })
    }

    const payload = normalizeEntryBody(req.body)
    if (!payload.name || !Number.isFinite(payload.score)) {
      return res.status(400).json({ message: 'GPU name and numeric score are required.' })
    }

    const created = await Gpu.create(payload)
    res.status(201).json(created)
  } catch (err) {
    res.status(400).json({ message: 'Could not save GPU', error: err.message })
  }
})

router.post('/laptops', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!isDatabaseReady()) {
      return res.status(503).json({ message: 'Hardware writes require an active database connection.' })
    }

    const payload = normalizeLaptopBody(req.body)
    if (!payload.model || !payload.cpu || !payload.gpu || !Number.isFinite(payload.ram)) {
      return res.status(400).json({ message: 'Model, CPU, GPU, and RAM are required.' })
    }

    const created = await Laptop.create(payload)
    res.status(201).json(created)
  } catch (err) {
    res.status(400).json({ message: 'Could not save laptop', error: err.message })
  }
})

router.post('/compatibility', async (req, res) => {
  try {
    const result = await estimatePerformance(req.body.game || {}, req.body.hardware || {})
    res.json(result)
  } catch (err) {
    res.status(500).json({ message: 'Compatibility check failed', error: err.message })
  }
})

module.exports = router
