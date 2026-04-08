const { loadGames } = require('./gameCatalog')
const { getTopRatedGameBySlug } = require('./igdbCatalog')

function uniqueStrings(values) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  )
}

async function resolveGameIdentity(slug) {
  const requestedSlug = String(slug || '').trim()

  if (!requestedSlug) {
    return {
      game: null,
      requestedSlug: '',
      canonicalSlug: '',
      aliases: []
    }
  }

  const catalog = await loadGames()
  const catalogGame =
    catalog.find((entry) => entry.slug === requestedSlug || entry.originalSlug === requestedSlug) || null
  const game = catalogGame || (await getTopRatedGameBySlug(requestedSlug))
  const aliases = uniqueStrings([requestedSlug, game?.slug, game?.originalSlug])

  return {
    game,
    requestedSlug,
    canonicalSlug: game?.slug || requestedSlug,
    aliases
  }
}

async function resolveGameBySlug(slug) {
  return (await resolveGameIdentity(slug)).game
}

async function resolveCanonicalGameSlug(slug) {
  return (await resolveGameIdentity(slug)).canonicalSlug
}

module.exports = {
  resolveCanonicalGameSlug,
  resolveGameBySlug,
  resolveGameIdentity
}
