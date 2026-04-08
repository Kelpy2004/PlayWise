const express = require('express')
const { z } = require('zod')

const { ApiError, asyncHandler } = require('../lib/http')
const { getPrisma, isDatabaseReady } = require('../lib/prisma')
const { requireAuth } = require('../middleware/auth')
const { validateBody } = require('../middleware/validate')
const { resolveGameIdentity } = require('../utils/gameResolver')
const {
  addRuntimeFavorite,
  addRuntimeHardwareProfile,
  getRuntimeFavorites,
  getRuntimeHardwareProfiles,
  removeRuntimeFavorite
} = require('../utils/runtimeStore')

const router = express.Router()

const favoriteSchema = z.object({
  gameSlug: z.string().trim().min(1)
})

const hardwareProfileSchema = z.object({
  label: z.string().trim().min(1),
  kind: z.enum(['LAPTOP', 'MANUAL']),
  laptopModel: z.string().trim().optional().nullable(),
  cpuName: z.string().trim().optional().nullable(),
  gpuName: z.string().trim().optional().nullable(),
  ram: z.number().int().positive().optional().nullable(),
  isDefault: z.boolean().optional().default(false)
})

router.get(
  '/me/favorites',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (isDatabaseReady()) {
      const favorites = await getPrisma().favoriteGame.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' }
      })
      return res.json(favorites.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })))
    }

    res.json(getRuntimeFavorites(req.user.id))
  })
)

router.post(
  '/me/favorites',
  requireAuth,
  validateBody(favoriteSchema),
  asyncHandler(async (req, res) => {
    const identity = await resolveGameIdentity(req.validatedBody.gameSlug)

    if (!identity.game) {
      throw new ApiError(404, 'Game not found.')
    }

    if (isDatabaseReady()) {
      await getPrisma().favoriteGame.deleteMany({
        where: {
          userId: req.user.id,
          gameSlug: { in: identity.aliases.filter((slug) => slug !== identity.canonicalSlug) }
        }
      })

      const favorite = await getPrisma().favoriteGame.upsert({
        where: {
          userId_gameSlug: {
            userId: req.user.id,
            gameSlug: identity.canonicalSlug
          }
        },
        update: {},
        create: {
          userId: req.user.id,
          gameSlug: identity.canonicalSlug
        }
      })

      return res.status(201).json({ ...favorite, createdAt: favorite.createdAt.toISOString() })
    }

    res.status(201).json(addRuntimeFavorite(req.user.id, identity.canonicalSlug))
  })
)

router.post(
  '/me/favorites/remove',
  requireAuth,
  validateBody(favoriteSchema),
  asyncHandler(async (req, res) => {
    const identity = await resolveGameIdentity(req.validatedBody.gameSlug)
    const aliases = identity.aliases.length ? identity.aliases : [req.validatedBody.gameSlug]

    if (isDatabaseReady()) {
      await getPrisma().favoriteGame.deleteMany({
        where: {
          userId: req.user.id,
          gameSlug: { in: aliases }
        }
      })

      return res.json({ ok: true })
    }

    aliases.forEach((slug) => removeRuntimeFavorite(req.user.id, slug))
    res.json({ ok: true })
  })
)

router.get(
  '/me/hardware-profiles',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (isDatabaseReady()) {
      const profiles = await getPrisma().savedHardwareProfile.findMany({
        where: { userId: req.user.id },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
      })

      return res.json(profiles)
    }

    res.json(getRuntimeHardwareProfiles(req.user.id))
  })
)

router.post(
  '/me/hardware-profiles',
  requireAuth,
  validateBody(hardwareProfileSchema),
  asyncHandler(async (req, res) => {
    if (req.validatedBody.kind === 'LAPTOP' && !req.validatedBody.laptopModel) {
      throw new ApiError(400, 'Laptop profiles require a laptop model.')
    }

    if (
      req.validatedBody.kind === 'MANUAL' &&
      (!req.validatedBody.cpuName || !req.validatedBody.gpuName || !req.validatedBody.ram)
    ) {
      throw new ApiError(400, 'Manual profiles require CPU, GPU, and RAM.')
    }

    if (isDatabaseReady()) {
      if (req.validatedBody.isDefault) {
        await getPrisma().savedHardwareProfile.updateMany({
          where: { userId: req.user.id },
          data: { isDefault: false }
        })
      }

      const profile = await getPrisma().savedHardwareProfile.create({
        data: {
          ...req.validatedBody,
          userId: req.user.id
        }
      })

      return res.status(201).json(profile)
    }

    res.status(201).json(addRuntimeHardwareProfile(req.user.id, req.validatedBody))
  })
)

module.exports = router
