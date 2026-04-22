const { PrismaClient } = require('@prisma/client')
const { normalizeRuntimeDatabaseUrl } = require('./databaseUrl')

let prisma = null
let activeDatabaseUrl = null
let databaseReady = false

function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL)
}

function createClient(databaseUrl) {
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl
      }
    }
  })
}

function getPrisma() {
  if (!hasDatabaseUrl()) {
    return null
  }

  if (!prisma) {
    activeDatabaseUrl = normalizeRuntimeDatabaseUrl(process.env.DATABASE_URL)
    prisma = createClient(activeDatabaseUrl)
  }

  return prisma
}

async function connectPrisma() {
  if (!hasDatabaseUrl()) {
    databaseReady = false
    return false
  }

  const primaryUrl = process.env.DATABASE_URL
  const normalizedUrl = normalizeRuntimeDatabaseUrl(primaryUrl)
  const candidateUrls = normalizedUrl && normalizedUrl !== primaryUrl ? [normalizedUrl, primaryUrl] : [primaryUrl]
  let lastError = null

  for (const databaseUrl of candidateUrls) {
    const candidateClient = createClient(databaseUrl)

    try {
      await candidateClient.$connect()

      if (prisma && prisma !== candidateClient) {
        await prisma.$disconnect().catch(() => {})
      }

      prisma = candidateClient
      activeDatabaseUrl = databaseUrl
      databaseReady = true
      return true
    } catch (error) {
      lastError = error
      await candidateClient.$disconnect().catch(() => {})
    }
  }

  prisma = null
  activeDatabaseUrl = null
  databaseReady = false
  throw lastError
}

async function disconnectPrisma() {
  if (!prisma) return
  await prisma.$disconnect()
  prisma = null
  activeDatabaseUrl = null
  databaseReady = false
}

function isDatabaseReady() {
  return databaseReady
}

module.exports = {
  connectPrisma,
  disconnectPrisma,
  getPrisma,
  hasDatabaseUrl,
  isDatabaseReady
}
