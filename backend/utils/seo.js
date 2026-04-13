const { env } = require('../lib/env')
const { loadGames } = require('./gameCatalog')

const CACHE_TTL_MS = 10 * 60 * 1000
const STATIC_PATHS = ['/', '/games', '/open-source', '/tournaments']

let cachedSitemap = null
let cachedAt = 0
let cachedOrigin = null

function buildSiteOrigin(req) {
  if (env.APP_ORIGIN) return env.APP_ORIGIN.replace(/\/+$/, '')
  return `${req.protocol}://${req.get('host')}`
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function buildSitemapXml(req) {
  const origin = buildSiteOrigin(req)
  const isFresh = cachedSitemap && (Date.now() - cachedAt) < CACHE_TTL_MS && cachedOrigin === origin
  if (isFresh) return cachedSitemap

  const games = await loadGames()
  const urls = [
    ...STATIC_PATHS.map((path) => `${origin}${path}`),
    ...games.map((game) => `${origin}/games/${game.slug}`)
  ]

  const now = new Date().toISOString()
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  ]

  for (const url of urls) {
    xml.push('  <url>')
    xml.push(`    <loc>${escapeXml(url)}</loc>`)
    xml.push(`    <lastmod>${now}</lastmod>`)
    xml.push('  </url>')
  }

  xml.push('</urlset>')

  cachedSitemap = xml.join('\n')
  cachedAt = Date.now()
  cachedOrigin = origin
  return cachedSitemap
}

function buildRobotsTxt(req) {
  const origin = buildSiteOrigin(req)
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /login',
    'Disallow: /register',
    `Sitemap: ${origin}/sitemap.xml`
  ].join('\n')
}

module.exports = {
  buildSitemapXml,
  buildRobotsTxt
}
