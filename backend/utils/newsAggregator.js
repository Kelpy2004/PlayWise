/**
 * News Aggregator
 *
 * Pulls news from 6 store/platform sources:
 *   - Steam (REST API: ISteamNews/GetNewsForApp/v2)
 *   - Xbox Wire (RSS: news.xbox.com)
 *   - NVIDIA GeForce blog (RSS: blogs.nvidia.com)
 *   - Epic Games (HTML scrape from epicgames.com/site/en-US/news)
 *   - Ubisoft News (RSS: news.ubisoft.com)
 *   - EA News (HTML scrape from ea.com/news)
 *
 * All providers run in parallel via Promise.allSettled and are normalized
 * to a common NewsItem schema. Results cached in-memory for 30 min.
 */

const { logger } = require('../lib/logger')

const NEWS_CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes
const FETCH_TIMEOUT_MS = 15 * 1000 // 15 seconds per provider

let newsCache = { expiresAt: 0, items: [] }

/* ─────────────────────────────────────────────────────────────────────────
 * NORMALIZED SCHEMA
 *   id          unique identifier (`${source}-${hash}`)
 *   title       headline
 *   summary     short excerpt (plain text, ~280 chars)
 *   source      'Steam' | 'Xbox' | 'NVIDIA' | 'Epic Games' | 'Ubisoft' | 'EA'
 *   sourceSlug  lowercase, hyphenated form for filtering
 *   url         canonical URL on the source site
 *   image       hero image URL (null if none)
 *   publishedAt ISO timestamp
 *   category    coarse tag (release, sale, patch, event, hardware, esports, etc.)
 *   author?     author name when available
 *   gameSlug?   linked game slug when known
 * ─────────────────────────────────────────────────────────────────────── */

/* ─────────────────── Utility helpers ─────────────────── */

function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer))
}

function stripHtml(html) {
  if (!html) return ''
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    // Steam community announcement placeholders, plus any URL/path right after them
    // e.g. `{STEAM_CLAN_IMAGE}/43372748/8e2596f.jpg` or `{STEAM_CLAN_LOC_IMAGE}/554111/...png`
    .replace(/\{STEAM_[A-Z_]+\}\S*/g, ' ')
    // Steam BBCode tags: [h1], [/h1], [b], [list], [*], [url=...], [img], etc.
    .replace(/\[\/?[a-z][a-z0-9]*(?:=[^\]]*)?\]/gi, ' ')
    // Steam patch notes use literal `\` as a section/bullet marker (`\Added ...`, `\Ancient...`)
    .replace(/\\(?=[A-Za-z])/g, ' ')
    // Literal escape sequences that snuck through as text
    .replace(/\\[nrt]/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    // Unicode replacement character from broken encoding
    .replace(/�/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function clampText(text, max = 280) {
  if (!text) return ''
  const clean = String(text).trim()
  if (clean.length <= max) return clean
  const trimmed = clean.slice(0, max)
  const lastSpace = trimmed.lastIndexOf(' ')
  return (lastSpace > max * 0.7 ? trimmed.slice(0, lastSpace) : trimmed).replace(/[,;:.!?]+$/, '') + '…'
}

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + ch
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

function extractFirstImageFromHtml(html) {
  if (!html) return null
  const match = String(html).match(/<img[^>]+src=["']([^"']+)["']/i)
  return match ? match[1] : null
}

// Steam's clan-image placeholders resolve to this CDN host.
const STEAM_CLAN_CDN = 'https://clan.akamai.steamstatic.com/images'

function resolveSteamPlaceholders(url) {
  return String(url).replace(/\{STEAM_CLAN(?:_LOC)?_IMAGE\}/g, STEAM_CLAN_CDN)
}

function steamHeaderImage(appId) {
  return appId ? `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg` : null
}

// Steam news bodies embed images as BBCode against a placeholder host, e.g.
//   [img]{STEAM_CLAN_IMAGE}/43372748/8e2596f.jpg[/img]
// which extractFirstImageFromHtml (HTML <img> only) misses. Harvest the first
// embedded image; if there is none (plain-text patch notes), fall back to the
// game's store header art so every Steam-sourced item still gets a real image.
function extractSteamImage(rawContents, appId) {
  const html = String(rawContents || '')
  // 1. HTML <img src="…">
  const htmlImg = html.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (htmlImg) return resolveSteamPlaceholders(htmlImg[1])
  // 2. BBCode [img]…[/img]
  const bb = html.match(/\[img\]\s*([^[\]]+?)\s*\[\/img\]/i)
  if (bb) return resolveSteamPlaceholders(bb[1])
  // 3. Bare placeholder path: {STEAM_CLAN_IMAGE}/123/abc.jpg
  const ph = html.match(/\{STEAM_CLAN(?:_LOC)?_IMAGE\}\/\S+?\.(?:jpe?g|png|gif|webp)/i)
  if (ph) return resolveSteamPlaceholders(ph[0])
  // 4. Fallback: the game's Steam store header image
  return steamHeaderImage(appId)
}

function categorizeFromTitle(title, body = '') {
  const text = `${title} ${body}`.toLowerCase()
  if (/\b(sale|deal|discount|free|giveaway|promo)\b/.test(text)) return 'sale'
  if (/\b(patch|update v\d|hotfix|bug fix|fixed)\b/.test(text)) return 'patch'
  if (/\b(launch|release|available now|out now|coming|reveal)\b/.test(text)) return 'release'
  if (/\b(tournament|esports|championship|finals|playoff|cup)\b/.test(text)) return 'esports'
  if (/\b(gpu|rtx|driver|geforce|dlss|hardware|cpu|game pass)\b/.test(text)) return 'hardware'
  if (/\b(event|season|live|stream|showcase|conference)\b/.test(text)) return 'event'
  return 'news'
}

/* ─────────────────── Lightweight RSS parser ─────────────────── */

function parseRss(xml) {
  if (!xml) return []
  const items = []
  // Match each <item>...</item> block (RSS 2.0) or <entry>...</entry> (Atom)
  const itemRegex = /<(item|entry)[^>]*>([\s\S]*?)<\/\1>/gi
  let match
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[2]
    items.push({
      title: extractTag(block, 'title'),
      link: extractRssLink(block),
      description: extractTag(block, 'description') || extractTag(block, 'summary') || extractTag(block, 'content'),
      contentEncoded: extractTag(block, 'content:encoded'),
      pubDate: extractTag(block, 'pubDate') || extractTag(block, 'published') || extractTag(block, 'updated'),
      creator: extractTag(block, 'dc:creator') || extractTag(block, 'author'),
      enclosure: extractEnclosure(block),
      mediaContent: extractMediaContent(block),
      mediaThumbnail: extractMediaThumbnail(block),
    })
  }
  return items
}

function extractTag(block, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i')
  const m = block.match(re)
  return m ? m[1].trim() : ''
}

function extractRssLink(block) {
  // Atom format: <link href="..."/>
  const atom = block.match(/<link[^>]+href=["']([^"']+)["']/i)
  if (atom) return atom[1]
  // RSS format: <link>...</link>
  const rss = block.match(/<link>([\s\S]*?)<\/link>/i)
  return rss ? rss[1].trim() : ''
}

function extractEnclosure(block) {
  const m = block.match(/<enclosure[^>]+url=["']([^"']+)["']/i)
  return m ? m[1] : null
}

function extractMediaContent(block) {
  const m = block.match(/<media:content[^>]+url=["']([^"']+)["']/i)
  return m ? m[1] : null
}

function extractMediaThumbnail(block) {
  const m = block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)
  return m ? m[1] : null
}

/* ─────────────────── 1. STEAM (REST API) ─────────────────── */

const STEAM_GLOBAL_APP_IDS = [
  '730',     // CS2
  '570',     // Dota 2
  '1172470', // Apex Legends
  '578080',  // PUBG
  '1086940', // Baldur's Gate 3
  '1245620', // Elden Ring
  '292030',  // Witcher 3
  '1091500', // Cyberpunk 2077
  '271590',  // GTA V
  '252490',  // Rust
  '440',     // Team Fortress 2
  '550',     // Left 4 Dead 2
  '1517290', // Battlefield 2042
  '2358720', // Black Myth: Wukong
  '1599340', // Lords of the Fallen
  '413150',  // Stardew Valley
  '2050650', // Resident Evil 4
  '1888160', // EA Sports FC 24
  '1971870', // Helldivers 2
]

async function fetchSteamGameNews(appId, count = 5) {
  try {
    const url = `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${appId}&count=${count}&maxlength=600`
    const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } })
    if (!response.ok) return []
    const json = await response.json()
    return Array.isArray(json?.appnews?.newsitems) ? json.appnews.newsitems : []
  } catch (error) {
    logger.warn({ error: error.message, appId }, 'Steam news fetch failed')
    return []
  }
}

async function fetchSteamNews(appIds = STEAM_GLOBAL_APP_IDS) {
  const ids = (appIds || []).slice(0, 25)
  const results = await Promise.allSettled(ids.map((id) => fetchSteamGameNews(id, 3)))
  const items = []

  results.forEach((res, idx) => {
    if (res.status !== 'fulfilled') return
    const appId = ids[idx]
    for (const news of res.value) {
      const title = String(news?.title || '').trim()
      const rawContents = String(news?.contents || '').trim()
      const body = stripHtml(rawContents)
      if (!title || !body) continue
      const url = news?.url || ''
      const date = news?.date ? new Date(news.date * 1000).toISOString() : null
      if (!date) continue
      const image = extractSteamImage(rawContents, appId)
      items.push({
        id: `steam-${news?.gid || hashString(title + appId)}`,
        title,
        summary: clampText(body, 280),
        source: 'Steam',
        sourceSlug: 'steam',
        url,
        image,
        publishedAt: date,
        category: categorizeFromTitle(title, body),
        author: news?.author || null,
        appId,
      })
    }
  })

  return items
}

/* ─────────────────── 2. XBOX (RSS) ─────────────────── */

const XBOX_RSS_URL = 'https://news.xbox.com/en-us/feed/'

async function fetchXboxNews() {
  try {
    const res = await fetchWithTimeout(XBOX_RSS_URL, { headers: { 'User-Agent': 'PlayWise/1.0' } })
    if (!res.ok) throw new Error(`Xbox RSS HTTP ${res.status}`)
    const xml = await res.text()
    const rawItems = parseRss(xml)

    return rawItems
      .map((it) => {
        const title = stripHtml(it.title)
        const html = it.contentEncoded || it.description || ''
        const summary = clampText(stripHtml(html), 280)
        const url = it.link
        const pub = it.pubDate ? new Date(it.pubDate).toISOString() : new Date().toISOString()
        const image = extractFirstImageFromHtml(html) || it.enclosure || it.mediaContent || it.mediaThumbnail
        if (!title || !url) return null
        return {
          id: `xbox-${hashString(url)}`,
          title,
          summary,
          source: 'Xbox',
          sourceSlug: 'xbox',
          url,
          image,
          publishedAt: pub,
          category: categorizeFromTitle(title, summary),
          author: it.creator || null,
        }
      })
      .filter(Boolean)
  } catch (error) {
    logger.warn({ error: error.message }, 'Xbox news fetch failed')
    return []
  }
}

/* ─────────────────── 3. NVIDIA GEFORCE (RSS) ─────────────────── */

const NVIDIA_RSS_URL = 'https://blogs.nvidia.com/feed/'
const NVIDIA_GEFORCE_KEYWORDS = /\b(geforce|rtx|gpu|gaming|game ready|dlss|reflex|gfn|ai pc|nvidia app|driver|graphics|broadcast)\b/i

async function fetchNvidiaNews() {
  try {
    const res = await fetchWithTimeout(NVIDIA_RSS_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PlayWise/1.0)' } })
    if (!res.ok) throw new Error(`NVIDIA RSS HTTP ${res.status}`)
    const xml = await res.text()
    const rawItems = parseRss(xml)

    return rawItems
      .map((it) => {
        const title = stripHtml(it.title)
        const html = it.contentEncoded || it.description || ''
        const summary = clampText(stripHtml(html), 280)
        const url = it.link
        const pub = it.pubDate ? new Date(it.pubDate).toISOString() : new Date().toISOString()
        const image = extractFirstImageFromHtml(html) || it.enclosure || it.mediaContent || it.mediaThumbnail
        if (!title || !url) return null
        // Filter to gaming/GeForce-related content (blog covers AI/datacenter too)
        if (!NVIDIA_GEFORCE_KEYWORDS.test(`${title} ${summary}`)) return null
        return {
          id: `nvidia-${hashString(url)}`,
          title,
          summary,
          source: 'NVIDIA',
          sourceSlug: 'nvidia',
          url,
          image,
          publishedAt: pub,
          category: categorizeFromTitle(title, summary),
          author: it.creator || null,
        }
      })
      .filter(Boolean)
  } catch (error) {
    logger.warn({ error: error.message }, 'NVIDIA news fetch failed')
    return []
  }
}

/* ─────────────────── 4. EPIC GAMES (HTML scrape) ─────────────────── */

// Epic Games' website is protected by Akamai bot detection (TLS fingerprint
// blocking) and rejects Node fetch even with full browser headers. We use
// their two public unauthenticated backend APIs that DO work:
//   1. freeGamesPromotions — weekly free game announcements
//   2. searchStoreQuery via the same CDN — new releases & trending
const EPIC_FREE_GAMES_URL = 'https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=US'
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function pickEpicImage(keyImages = []) {
  if (!Array.isArray(keyImages) || !keyImages.length) return null
  const priority = ['DieselStoreFrontWide', 'OfferImageWide', 'featuredMedia', 'Thumbnail', 'DieselStoreFrontTall']
  for (const type of priority) {
    const hit = keyImages.find((img) => img?.type === type && img?.url)
    if (hit) return hit.url
  }
  return keyImages[0]?.url || null
}

async function fetchEpicNews() {
  try {
    const res = await fetchWithTimeout(EPIC_FREE_GAMES_URL, {
      headers: { 'User-Agent': DESKTOP_UA, Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`Epic free games HTTP ${res.status}`)

    const json = await res.json()
    const elements = json?.data?.Catalog?.searchStore?.elements || []

    const items = []
    const now = Date.now()

    for (const el of elements) {
      const title = String(el?.title || '').trim()
      if (!title) continue

      const promo = el?.promotions || {}
      const currentOffers = (promo?.promotionalOffers || []).flatMap((p) => p?.promotionalOffers || [])
      const upcomingOffers = (promo?.upcomingPromotionalOffers || []).flatMap((p) => p?.promotionalOffers || [])

      let isFree = false
      let startDate = null
      let endDate = null
      let prefix = ''

      const current = currentOffers.find((o) => o?.discountSetting?.discountPercentage === 0)
      const upcoming = upcomingOffers.find((o) => o?.discountSetting?.discountPercentage === 0)

      if (current) {
        isFree = true
        startDate = current.startDate
        endDate = current.endDate
        prefix = 'Free now — '
      } else if (upcoming) {
        isFree = true
        startDate = upcoming.startDate
        endDate = upcoming.endDate
        prefix = 'Free soon — '
      }

      if (!isFree) continue

      const productSlug = el?.productSlug || el?.urlSlug || el?.catalogNs?.mappings?.[0]?.pageSlug || ''
      const url = productSlug
        ? `https://store.epicgames.com/en-US/p/${productSlug.replace(/\/.*$/, '')}`
        : 'https://store.epicgames.com/en-US/free-games'

      const image = pickEpicImage(el?.keyImages)
      const startsAt = startDate ? new Date(startDate) : null
      const endsAt = endDate ? new Date(endDate) : null
      const niceEnd = endsAt ? endsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null
      const summary = clampText(
        [
          el?.description || '',
          niceEnd ? `Available free on the Epic Games Store until ${niceEnd}.` : 'Currently free on the Epic Games Store.',
        ].filter(Boolean).join(' '),
        280
      )

      items.push({
        id: `epic-free-${el.id || hashString(title)}`,
        title: `${prefix}${title}`,
        summary,
        source: 'Epic Games',
        sourceSlug: 'epic',
        url,
        image,
        publishedAt: startsAt ? startsAt.toISOString() : new Date().toISOString(),
        category: 'sale',
        author: 'Epic Games Store',
        appId: null,
      })
    }

    // Sort current-free first, upcoming second, then by date
    items.sort((a, b) => {
      const aFree = a.title.startsWith('Free now')
      const bFree = b.title.startsWith('Free now')
      if (aFree !== bFree) return aFree ? -1 : 1
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    })

    return items
  } catch (error) {
    logger.warn({ error: error.message }, 'Epic news fetch failed')
    return []
  }
}

/* ─────────────────── 5. UBISOFT (RSS / scrape fallback) ─────────────────── */

// Ubisoft's news site is a React SPA without server-rendered content
// and their CMS API requires auth. We pull news for Ubisoft-published
// titles from Steam — these are official Ubisoft announcements posted
// directly to the Steam Community. App IDs verified against Steam.
const UBISOFT_STEAM_APP_IDS = [
  '3159330', // Assassin's Creed Shadows
  '3035570', // Assassin's Creed Mirage
  '2208920', // Assassin's Creed Valhalla
  '812140',  // Assassin's Creed Odyssey
  '582160',  // Assassin's Creed Origins
  '359550',  // Tom Clancy's Rainbow Six Siege
  '2369390', // Far Cry 6
  '552520',  // Far Cry 5
  '2840770', // Avatar: Frontiers of Pandora
  '2751000', // Prince of Persia: The Lost Crown
  '916440',  // Anno 1800
  '460930',  // Tom Clancy's Ghost Recon Wildlands
  '2221490', // Tom Clancy's The Division 2
  '2698940', // The Crew Motorfest
  '2842040', // Star Wars Outlaws
]

async function fetchUbisoftNews() {
  try {
    // Fetch news from all Ubisoft games on Steam in parallel
    const results = await Promise.allSettled(
      UBISOFT_STEAM_APP_IDS.map((appId) => fetchSteamGameNews(appId, 2))
    )

    const items = []
    results.forEach((res, idx) => {
      if (res.status !== 'fulfilled') return
      for (const news of res.value) {
        const title = String(news?.title || '').trim()
        const rawContents = String(news?.contents || '').trim()
        const body = stripHtml(rawContents)
        // Filter to actual Ubisoft announcements (not random Steam Community posts)
        const feedLabel = String(news?.feedlabel || '').toLowerCase()
        const isOfficial = /ubisoft|community announcements|official/.test(feedLabel)
          || /^(ubisoft|community)/.test(feedLabel)
        if (!title || !body || !isOfficial) continue
        const date = news?.date ? new Date(news.date * 1000).toISOString() : null
        if (!date) continue
        items.push({
          id: `ubisoft-${news?.gid || hashString(title)}`,
          title,
          summary: clampText(body, 280),
          source: 'Ubisoft',
          sourceSlug: 'ubisoft',
          url: news?.url || '',
          image: extractSteamImage(rawContents, UBISOFT_STEAM_APP_IDS[idx]),
          publishedAt: date,
          category: categorizeFromTitle(title, body),
          author: news?.author || null,
          appId: UBISOFT_STEAM_APP_IDS[idx],
        })
      }
    })

    return items
  } catch (error) {
    logger.warn({ error: error.message }, 'Ubisoft news fetch failed')
    return []
  }
}

/* ─────────────────── 6. EA (HTML scrape) ─────────────────── */

// EA's news site is also JS-rendered; their internal APIs are dead.
// We use Steam News for EA-published titles — these come straight
// from EA's official Steam Community announcements. App IDs verified.
const EA_STEAM_APP_IDS = [
  '1172470', // Apex Legends
  '3405690', // EA Sports FC 26
  '2669320', // EA Sports FC 25
  '3230400', // Madden NFL 26
  '2582560', // Madden NFL 25
  '1517290', // Battlefield 2042
  '2807960', // Battlefield 6
  '1238810', // Battlefield V
  '1693980', // Dead Space (2023 remake)
  '1172380', // Star Wars Jedi: Fallen Order
  '1774580', // Star Wars Jedi: Survivor
  '1222670', // The Sims 4
  '1262540', // Need for Speed
  '1262580', // Need for Speed Payback
  '1426210', // It Takes Two
  '1849250', // EA Sports WRC
]

async function fetchEaNews() {
  try {
    const results = await Promise.allSettled(
      EA_STEAM_APP_IDS.map((appId) => fetchSteamGameNews(appId, 2))
    )

    const items = []
    results.forEach((res, idx) => {
      if (res.status !== 'fulfilled') return
      for (const news of res.value) {
        const title = String(news?.title || '').trim()
        const rawContents = String(news?.contents || '').trim()
        const body = stripHtml(rawContents)
        const feedLabel = String(news?.feedlabel || '').toLowerCase()
        // Only include official EA / community announcements
        const isOfficial = /ea|electronic arts|respawn|community announcements|official|battlefield|madden|fifa|apex|dice/.test(feedLabel)
          || /^community/.test(feedLabel)
        if (!title || !body || !isOfficial) continue
        const date = news?.date ? new Date(news.date * 1000).toISOString() : null
        if (!date) continue
        items.push({
          id: `ea-${news?.gid || hashString(title)}`,
          title,
          summary: clampText(body, 280),
          source: 'EA',
          sourceSlug: 'ea',
          url: news?.url || '',
          image: extractSteamImage(rawContents, EA_STEAM_APP_IDS[idx]),
          publishedAt: date,
          category: categorizeFromTitle(title, body),
          author: news?.author || null,
          appId: EA_STEAM_APP_IDS[idx],
        })
      }
    })

    return items
  } catch (error) {
    logger.warn({ error: error.message }, 'EA news fetch failed')
    return []
  }
}

/* ─────────────────── Aggregation pipeline ─────────────────── */

async function aggregateAllNews() {
  const providers = [
    { name: 'Steam', fn: () => fetchSteamNews() },
    { name: 'Xbox', fn: () => fetchXboxNews() },
    { name: 'NVIDIA', fn: () => fetchNvidiaNews() },
    { name: 'Epic Games', fn: () => fetchEpicNews() },
    { name: 'Ubisoft', fn: () => fetchUbisoftNews() },
    { name: 'EA', fn: () => fetchEaNews() },
  ]

  const results = await Promise.allSettled(providers.map((p) => p.fn()))

  const all = []
  const stats = {}

  results.forEach((res, idx) => {
    const name = providers[idx].name
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      stats[name] = res.value.length
      all.push(...res.value)
    } else {
      stats[name] = 0
      if (res.status === 'rejected') {
        logger.warn({ provider: name, error: res.reason?.message }, 'News provider failed')
      }
    }
  })

  // De-duplicate by id
  const seen = new Set()
  const unique = []
  for (const item of all) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    unique.push(item)
  }

  // Sort newest first
  unique.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

  logger.info({ stats, total: unique.length }, 'News aggregated')
  return unique
}

async function getNews(options = {}) {
  const { source, limit, forceRefresh } = options

  if (!forceRefresh && newsCache.expiresAt > Date.now() && newsCache.items.length > 0) {
    return filterNews(newsCache.items, { source, limit })
  }

  const items = await aggregateAllNews()
  newsCache = { expiresAt: Date.now() + NEWS_CACHE_TTL_MS, items }
  return filterNews(items, { source, limit })
}

function filterNews(items, { source, limit }) {
  let out = items
  if (source) {
    const needle = String(source).toLowerCase().trim()
    out = out.filter((it) => it.sourceSlug === needle || it.source.toLowerCase() === needle)
  }
  if (limit) {
    const n = Math.max(1, Math.min(parseInt(limit, 10) || 50, 500))
    out = out.slice(0, n)
  }
  return out
}

function getNewsSources() {
  const items = newsCache.items
  const counts = items.reduce((acc, it) => {
    acc[it.sourceSlug] = (acc[it.sourceSlug] || 0) + 1
    return acc
  }, {})
  return [
    { slug: 'steam', name: 'Steam', count: counts.steam || 0 },
    { slug: 'xbox', name: 'Xbox', count: counts.xbox || 0 },
    { slug: 'nvidia', name: 'NVIDIA', count: counts.nvidia || 0 },
    { slug: 'epic', name: 'Epic Games', count: counts.epic || 0 },
    { slug: 'ubisoft', name: 'Ubisoft', count: counts.ubisoft || 0 },
    { slug: 'ea', name: 'EA', count: counts.ea || 0 },
  ]
}

/* ─────────────────── Per-game news ─────────────────── */

async function getNewsForGame({ slug, title, steamAppId }) {
  const items = []

  // 1. Direct Steam app news if appId available
  if (steamAppId) {
    const steamItems = await fetchSteamNews([String(steamAppId)])
    items.push(...steamItems.map((it) => ({ ...it, gameSlug: slug })))
  }

  // 2. Title-match against cached global news
  if (title) {
    if (newsCache.items.length === 0 || newsCache.expiresAt <= Date.now()) {
      await getNews() // ensure cache populated
    }
    const needle = String(title).toLowerCase()
    const tokens = needle
      .split(/[\s:'"!.,?-]+/)
      .filter((t) => t.length >= 4)

    if (tokens.length > 0) {
      for (const item of newsCache.items) {
        const haystack = `${item.title} ${item.summary}`.toLowerCase()
        const hits = tokens.filter((t) => haystack.includes(t)).length
        if (hits >= Math.min(2, tokens.length)) {
          items.push({ ...item, gameSlug: slug, matchScore: hits })
        }
      }
    }
  }

  // De-dup by id and sort newest first
  const seen = new Set()
  const unique = []
  for (const it of items) {
    if (seen.has(it.id)) continue
    seen.add(it.id)
    unique.push(it)
  }
  unique.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
  return unique.slice(0, 12)
}

/* ─────────────────── Background warm-up ─────────────────── */

let warmupInterval = null

function startNewsWarmup({ intervalMs = NEWS_CACHE_TTL_MS } = {}) {
  if (warmupInterval) return
  void getNews({ forceRefresh: true }).catch(() => {})
  warmupInterval = setInterval(() => {
    void getNews({ forceRefresh: true }).catch(() => {})
  }, intervalMs)
  logger.info({ intervalMs }, 'News warm-up loop started')
}

function stopNewsWarmup() {
  if (warmupInterval) {
    clearInterval(warmupInterval)
    warmupInterval = null
  }
}

module.exports = {
  getNews,
  getNewsSources,
  getNewsForGame,
  fetchSteamNews,
  fetchXboxNews,
  fetchNvidiaNews,
  fetchEpicNews,
  fetchUbisoftNews,
  fetchEaNews,
  startNewsWarmup,
  stopNewsWarmup,
}
