const express = require('express')
const Cpu = require('../models/Cpu')
const Gpu = require('../models/Gpu')
const Laptop = require('../models/Laptop')
const { getHardwareCatalog, estimatePerformance } = require('../utils/hardware')

const router = express.Router()

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

router.post('/cpus', async (req, res) => {
  try {
    const created = await Cpu.create(req.body)
    res.status(201).json(created)
  } catch (err) {
    res.status(400).json({ message: 'Could not save CPU', error: err.message })
  }
})

router.post('/gpus', async (req, res) => {
  try {
    const created = await Gpu.create(req.body)
    res.status(201).json(created)
  } catch (err) {
    res.status(400).json({ message: 'Could not save GPU', error: err.message })
  }
})

router.post('/laptops', async (req, res) => {
  try {
    const created = await Laptop.create(req.body)
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
