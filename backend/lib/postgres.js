const { Pool } = require('pg')

let pool = null
let activeConnectionString = null

function hasPostgresUrl() {
  return Boolean(process.env.DATABASE_URL)
}

function sanitizeConnectionString(rawUrl) {
  if (!rawUrl) return null

  try {
    const parsed = new URL(rawUrl)

    parsed.searchParams.delete('sslmode')

    return parsed.toString()
  } catch {
    return rawUrl
  }
}

function createPool() {
  if (!hasPostgresUrl()) {
    return null
  }

  const connectionString = sanitizeConnectionString(process.env.DATABASE_URL)

  activeConnectionString = connectionString

  return new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    },
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 30_000
  })
}

function getPool() {
  if (!hasPostgresUrl()) {
    return null
  }

  if (!pool) {
    pool = createPool()
  }

  return pool
}

async function query(text, params = []) {
  const clientPool = getPool()

  if (!clientPool) {
    throw new Error('DATABASE_URL is not configured.')
  }

  return clientPool.query(text, params)
}

async function withTransaction(run) {
  const clientPool = getPool()

  if (!clientPool) {
    throw new Error('DATABASE_URL is not configured.')
  }

  const client = await clientPool.connect()

  try {
    await client.query('BEGIN')
    const result = await run(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

async function pingPostgres() {
  await query('select 1')
  return true
}

async function disconnectPostgres() {
  if (!pool) {
    return
  }

  await pool.end()
  pool = null
  activeConnectionString = null
}

function getActivePostgresConnectionString() {
  return activeConnectionString
}

module.exports = {
  disconnectPostgres,
  getActivePostgresConnectionString,
  hasPostgresUrl,
  pingPostgres,
  query,
  withTransaction
}
