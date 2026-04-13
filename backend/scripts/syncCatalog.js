require('dotenv').config()

const { connectPrisma, disconnectPrisma, isDatabaseReady } = require('../lib/prisma')
const { logger } = require('../lib/logger')
const { env } = require('../lib/env')
const { syncExpandedCatalogToDatabase } = require('../utils/gameCatalog')

async function main() {
  await connectPrisma()

  if (!isDatabaseReady()) {
    throw new Error('DATABASE_URL is not ready. Cannot sync catalog.')
  }

  const synced = await syncExpandedCatalogToDatabase(env.IGDB_TOP_GAMES_LIMIT)
  logger.info({ synced }, 'Catalog sync complete')
}

main()
  .catch((error) => {
    logger.error({ error }, 'Catalog sync failed')
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectPrisma().catch(() => {})
  })
