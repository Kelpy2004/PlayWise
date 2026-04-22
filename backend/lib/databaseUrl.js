const { env } = require('./env')

function normalizeRuntimeDatabaseUrl(rawUrl) {
  if (!rawUrl) return null

  try {
    const parsed = new URL(rawUrl)
    const isSupabasePooler = parsed.hostname.includes('pooler.supabase.com')
    const isSessionPort = !parsed.port || parsed.port === '5432'

    if (!isSupabasePooler || !isSessionPort) {
      return parsed.toString()
    }

    parsed.port = '6543'
    parsed.searchParams.set('pgbouncer', 'true')
    parsed.searchParams.set('connection_limit', String(Math.max(1, Math.min(10, Number(env.DB_CONNECTION_LIMIT) || 5))))

    if (!parsed.searchParams.get('sslmode')) {
      parsed.searchParams.set('sslmode', 'require')
    }

    if (!parsed.searchParams.get('connect_timeout')) {
      parsed.searchParams.set('connect_timeout', '30')
    }

    return parsed.toString()
  } catch {
    return rawUrl
  }
}

module.exports = {
  normalizeRuntimeDatabaseUrl
}
