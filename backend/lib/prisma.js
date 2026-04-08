const { PrismaClient } = require('@prisma/client')

let prisma = null
let databaseReady = false

function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL)
}

function getPrisma() {
  if (!hasDatabaseUrl()) {
    return null
  }

  if (!prisma) {
    prisma = new PrismaClient()
  }

  return prisma
}

async function connectPrisma() {
  const client = getPrisma()
  if (!client) {
    databaseReady = false
    return false
  }

  await client.$connect()
  databaseReady = true
  return true
}

async function disconnectPrisma() {
  if (!prisma) return
  await prisma.$disconnect()
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
