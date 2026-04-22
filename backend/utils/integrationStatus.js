const { env } = require('../lib/env')
const { canSendEmail } = require('./emailService')

function isConfigured(...values) {
  return values.every((value) => Boolean(String(value || '').trim()))
}

function getIntegrationStatus() {
  return {
    database: {
      configured: Boolean(env.DATABASE_URL),
      provider: env.DATABASE_URL ? 'PostgreSQL' : 'none',
      mode: env.DATABASE_URL?.includes('supabase') ? 'supabase-postgres' : (env.DATABASE_URL ? 'postgresql' : 'disabled')
    },
    auth: {
      google: isConfigured(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET),
      microsoft: isConfigured(env.MICROSOFT_CLIENT_ID, env.MICROSOFT_CLIENT_SECRET),
      apple: isConfigured(env.APPLE_CLIENT_ID, env.APPLE_TEAM_ID, env.APPLE_KEY_ID, env.APPLE_PRIVATE_KEY)
    },
    catalog: {
      igdb: isConfigured(env.IGDB_CLIENT_ID, env.IGDB_CLIENT_SECRET),
      topGamesLimit: env.IGDB_TOP_GAMES_LIMIT
    },
    tournaments: {
      startgg: isConfigured(env.STARTGG_API_TOKEN),
      limit: env.STARTGG_TOURNAMENT_LIMIT
    },
    pricing: {
      itad: isConfigured(env.ITAD_API_KEY),
      country: env.ITAD_COUNTRY,
      cacheMs: env.PRICE_CACHE_MS
    },
    assistant: {
      gemini: isConfigured(env.GEMINI_API_KEY),
      model: env.GEMINI_MODEL
    },
    email: {
      provider: env.EMAIL_PROVIDER,
      configured: canSendEmail()
    },
    monitoring: {
      sentry: isConfigured(env.SENTRY_DSN)
    },
    tuning: {
      dbConnectionLimit: env.DB_CONNECTION_LIMIT,
      pgPoolMax: env.PG_POOL_MAX,
      pgIdleTimeoutMs: env.PG_IDLE_TIMEOUT_MS,
      pgConnectionTimeoutMs: env.PG_CONNECTION_TIMEOUT_MS,
      apiRateLimitMax: env.API_RATE_LIMIT_MAX,
      notificationBatchLimit: env.NOTIFICATION_BATCH_LIMIT
    }
  }
}

module.exports = {
  getIntegrationStatus
}
