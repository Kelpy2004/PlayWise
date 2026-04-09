const { PrismaClient } = require('@prisma/client')

let prisma = null
let activeDatabaseUrl = null
let databaseReady = false

function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL)
}

function buildSupabaseRuntimeFallbackUrl(rawUrl) {
  if (!rawUrl) return null

  try {
    const parsed = new URL(rawUrl)
    const isSupabasePooler = parsed.hostname.includes('pooler.supabase.com')
    const isSessionPort = !parsed.port || parsed.port === '5432'
    const alreadyPgbouncer = parsed.searchParams.get('pgbouncer') === 'true'

    if (!isSupabasePooler || !isSessionPort || alreadyPgbouncer) {
      return null
    }

    parsed.port = '6543'
    parsed.searchParams.set('pgbouncer', 'true')
    parsed.searchParams.set('connection_limit', '1')

    if (!parsed.searchParams.get('sslmode')) {
      parsed.searchParams.set('sslmode', 'require')
    }

    if (!parsed.searchParams.get('connect_timeout')) {
      parsed.searchParams.set('connect_timeout', '30')
    }

    return parsed.toString()
  } catch {
    return null
  }
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
    activeDatabaseUrl = process.env.DATABASE_URL
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
  const fallbackUrl = buildSupabaseRuntimeFallbackUrl(primaryUrl)
  const candidateUrls = fallbackUrl ? [primaryUrl, fallbackUrl] : [primaryUrl]
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
