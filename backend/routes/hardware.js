const express = require('express')
const { z } = require('zod')

const { ApiError, asyncHandler } = require('../lib/http')
const { getPrisma, isDatabaseReady } = require('../lib/prisma')
const { requireAuth, requireAdmin } = require('../middleware/auth')
const { validateBody } = require('../middleware/validate')
const { getHardwareCatalog, estimatePerformance, searchHardware } = require('../utils/hardware')

const router = express.Router()

const hardwareEntrySchema = z.object({
  name: z.string().trim().min(1),
  score: z.number().int().nonnegative(),
  family: z.string().trim().optional().default(''),
  platform: z.string().trim().optional().default('windows'),
  notes: z.string().trim().optional().default('')
})

const laptopSchema = z.object({
  model: z.string().trim().min(1),
  brand: z.string().trim().min(1),
  cpu: z.string().trim().min(1),
  gpu: z.string().trim().min(1),
  ram: z.number().int().positive(),
  platform: z.string().trim().optional().default('windows'),
  tags: z.array(z.string().trim()).optional().default([]),
  notes: z.string().trim().optional().default('')
})

const compatibilitySchema = z.object({
  game: z.record(z.any()).optional().default({}),
  hardware: z
    .object({
      laptop: z.string().trim().optional(),
      cpu: z.string().trim().optional(),
      gpu: z.string().trim().optional(),
      ram: z.union([z.string(), z.number()]).optional(),
      source: z.string().trim().optional(),
      cpuScore: z.union([z.string(), z.number()]).optional(),
      gpuScore: z.union([z.string(), z.number()]).optional()
    })
    .passthrough()
    .optional()
    .default({})
})

router.get(
  '/catalog',
  asyncHandler(async (_req, res) => {
    const catalog = await getHardwareCatalog()
    res.json(catalog)
  })
)

router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim()
    const kind = String(req.query.kind || 'laptop').trim().toLowerCase()
    const limit = Math.min(Math.max(Number(req.query.limit) || 6, 1), 10)

    if (!['laptop', 'cpu', 'gpu'].includes(kind)) {
      throw new ApiError(400, 'Search kind must be laptop, cpu, or gpu.')
    }

    if (!q) {
      return res.json([])
    }

    const results = await searchHardware(kind, q, limit)
    res.json(results)
  })
)

router.get(
  '/cpus',
  asyncHandler(async (_req, res) => {
    const catalog = await getHardwareCatalog()
    res.json(catalog.cpus)
  })
)

router.get(
  '/gpus',
  asyncHandler(async (_req, res) => {
    const catalog = await getHardwareCatalog()
    res.json(catalog.gpus)
  })
)

router.get(
  '/laptops',
  asyncHandler(async (req, res) => {
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
  })
)

router.post(
  '/cpus',
  requireAuth,
  requireAdmin,
  validateBody(hardwareEntrySchema),
  asyncHandler(async (req, res) => {
    if (!isDatabaseReady()) {
      throw new ApiError(503, 'Hardware writes require an active SQL database connection.')
    }

    const created = await getPrisma().cpu.create({ data: req.validatedBody })
    res.status(201).json(created)
  })
)

router.post(
  '/gpus',
  requireAuth,
  requireAdmin,
  validateBody(hardwareEntrySchema),
  asyncHandler(async (req, res) => {
    if (!isDatabaseReady()) {
      throw new ApiError(503, 'Hardware writes require an active SQL database connection.')
    }

    const created = await getPrisma().gpu.create({ data: req.validatedBody })
    res.status(201).json(created)
  })
)

router.post(
  '/laptops',
  requireAuth,
  requireAdmin,
  validateBody(laptopSchema),
  asyncHandler(async (req, res) => {
    if (!isDatabaseReady()) {
      throw new ApiError(503, 'Hardware writes require an active SQL database connection.')
    }

    const created = await getPrisma().laptop.create({ data: req.validatedBody })
    res.status(201).json(created)
  })
)

router.post(
  '/compatibility',
  validateBody(compatibilitySchema),
  asyncHandler(async (req, res) => {
    const result = await estimatePerformance(req.validatedBody.game || {}, req.validatedBody.hardware || {})
    res.json(result)
  })
)

module.exports = router
