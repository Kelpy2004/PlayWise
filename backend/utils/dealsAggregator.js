const { env } = require('../lib/env')
const { logger } = require('../lib/logger')
const { getPrisma, isDatabaseReady } = require('../lib/prisma')
const { getRuntimeDeals, upsertRuntimeDeal } = require('./runtimeStore')

let dealsCache = { data: [], updatedAt: 0 }
let refreshTimer = null

const CHEAPSHARK_STORE_MAP = {
  '1': 'Steam',
  '13': 'Ubisoft Store',
  '25': 'Epic Games Store',
}

const MAJOR_STORE_IDS = new Set(Object.keys(CHEAPSHARK_STORE_MAP))
const MIN_STEAM_RATING = 70
const MIN_METACRITIC = 60

function resolveCheapSharkStore(storeID) {
  return CHEAPSHARK_STORE_MAP[String(storeID)] || null
}

function isQualityGame(item) {
  const rating = parseInt(item?.steamRatingPercent || '0', 10)
  const metacritic = parseInt(item?.metacriticScore || '0', 10)
  return rating >= MIN_STEAM_RATING || metacritic >= MIN_METACRITIC
}

// ──────────────────────────── EPIC GAMES (via CheapShark storeID=25) ────────────────────────────
async function fetchEpicFreeGames() {
  const deals = []

  try {
    const [freeRes, discountRes] = await Promise.all([
      fetch('https://www.cheapshark.com/api/1.0/deals?storeID=25&upperPrice=0&pageSize=20&sortBy=recent',
        { headers: { 'User-Agent': 'PlayWise/1.0' } }),
      fetch('https://www.cheapshark.com/api/1.0/deals?storeID=25&pageSize=20&sortBy=savings&desc=1',
        { headers: { 'User-Agent': 'PlayWise/1.0' } })
    ])

    if (freeRes.ok) {
      const items = await freeRes.json()
      if (Array.isArray(items)) {
        for (const item of items) {
          deals.push({
            externalId: `cheapshark-free-${item?.dealID || ''}`,
            type: 'FREE_GAME',
            title: String(item?.title || '').trim(),
            gameSlug: String(item?.title || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || null,
            store: 'Epic Games Store',
            originalPrice: parseFloat(item?.normalPrice) || null,
            dealPrice: 0,
            discountPct: 100,
            currency: 'USD',
            url: `https://www.cheapshark.com/redirect?dealID=${item?.dealID || ''}`,
            imageUrl: item?.steamAppID
              ? `https://cdn.akamai.steamstatic.com/steam/apps/${item.steamAppID}/header.jpg`
              : item?.thumb || null,
            startsAt: null,
            endsAt: null,
            source: 'cheapshark-epic',
            metadata: {
              steamRating: item?.steamRatingPercent || null,
              metacritic: item?.metacriticScore || null,
              steamAppId: item?.steamAppID || null
            },
            isActive: true
          })
        }
      }
    }

    if (discountRes.ok) {
      const items = await discountRes.json()
      if (Array.isArray(items)) {
        for (const item of items) {
          const savings = parseFloat(item?.savings || '0')
          if (savings < 50) continue
          deals.push({
            externalId: `cheapshark-deal-${item?.dealID || ''}`,
            type: 'DISCOUNT',
            title: String(item?.title || '').trim(),
            gameSlug: String(item?.title || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || null,
            store: 'Epic Games Store',
            originalPrice: parseFloat(item?.normalPrice) || null,
            dealPrice: parseFloat(item?.salePrice) || 0,
            discountPct: Math.round(savings),
            currency: 'USD',
            url: `https://www.cheapshark.com/redirect?dealID=${item?.dealID || ''}`,
            imageUrl: item?.steamAppID
              ? `https://cdn.akamai.steamstatic.com/steam/apps/${item.steamAppID}/header.jpg`
              : item?.thumb || null,
            startsAt: null,
            endsAt: null,
            source: 'cheapshark-epic',
            metadata: {
              steamRating: item?.steamRatingPercent || null,
              metacritic: item?.metacriticScore || null,
              steamAppId: item?.steamAppID || null
            },
            isActive: true
          })
        }
      }
    }
  } catch (error) {
    logger.warn({ error }, 'Failed to fetch Epic games via CheapShark')
  }

  return deals
}

// ──────────────────────────── CHEAPSHARK FREE ────────────────────────────
async function fetchCheapSharkFreeGames() {
  try {
    const response = await fetch(
      'https://www.cheapshark.com/api/1.0/deals?upperPrice=0&pageSize=30&sortBy=recent',
      { headers: { 'User-Agent': 'PlayWise/1.0' } }
    )
    if (!response.ok) throw new Error(`CheapShark free API ${response.status}`)

    const items = await response.json()
    if (!Array.isArray(items)) return []

    return items
      .filter((item) => MAJOR_STORE_IDS.has(String(item?.storeID)))
      .map((item) => ({
        externalId: `cheapshark-free-${item?.dealID || ''}`,
        type: 'FREE_GAME',
        title: String(item?.title || '').trim(),
        gameSlug: String(item?.title || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || null,
        store: resolveCheapSharkStore(item?.storeID),
        originalPrice: parseFloat(item?.normalPrice) || null,
        dealPrice: 0,
        discountPct: 100,
        currency: 'USD',
        url: `https://www.cheapshark.com/redirect?dealID=${item?.dealID || ''}`,
        imageUrl: item?.steamAppID
          ? `https://cdn.akamai.steamstatic.com/steam/apps/${item.steamAppID}/header.jpg`
          : item?.thumb || null,
        startsAt: null,
        endsAt: null,
        source: 'cheapshark',
        metadata: {
          steamRating: item?.steamRatingPercent || null,
          metacritic: item?.metacriticScore || null,
          steamAppId: item?.steamAppID || null
        },
        isActive: true
      }))
  } catch (error) {
    logger.warn({ error }, 'Failed to fetch CheapShark free games')
    return []
  }
}

// ──────────────────────────── CHEAPSHARK DISCOUNTS ────────────────────────────
async function fetchCheapSharkDiscounts(minDiscountPct) {
  try {
    const storeFilter = Array.from(MAJOR_STORE_IDS).join(',')
    const response = await fetch(
      `https://www.cheapshark.com/api/1.0/deals?pageSize=60&sortBy=metacritic&desc=1&storeID=${storeFilter}&steamRating=${MIN_STEAM_RATING}`,
      { headers: { 'User-Agent': 'PlayWise/1.0' } }
    )
    if (!response.ok) throw new Error(`CheapShark deals API ${response.status}`)

    const items = await response.json()
    if (!Array.isArray(items)) return []

    return items
      .filter((item) => parseFloat(item?.savings || '0') >= minDiscountPct && isQualityGame(item))
      .map((item) => ({
        externalId: `cheapshark-deal-${item?.dealID || ''}`,
        type: 'DISCOUNT',
        title: String(item?.title || '').trim(),
        gameSlug: String(item?.title || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || null,
        store: resolveCheapSharkStore(item?.storeID),
        originalPrice: parseFloat(item?.normalPrice) || null,
        dealPrice: parseFloat(item?.salePrice) || 0,
        discountPct: Math.round(parseFloat(item?.savings || '0')),
        currency: 'USD',
        url: `https://www.cheapshark.com/redirect?dealID=${item?.dealID || ''}`,
        imageUrl: item?.steamAppID
          ? `https://cdn.akamai.steamstatic.com/steam/apps/${item.steamAppID}/header.jpg`
          : item?.thumb || null,
        startsAt: null,
        endsAt: null,
        source: 'cheapshark',
        metadata: {
          steamRating: item?.steamRatingPercent || null,
          metacritic: item?.metacriticScore || null,
          steamAppId: item?.steamAppID || null
        },
        isActive: true
      }))
  } catch (error) {
    logger.warn({ error }, 'Failed to fetch CheapShark discounts')
    return []
  }
}

// ──────────────────────────── ITAD DEALS ────────────────────────────
const ITAD_MAJOR_SHOPS = new Set([
  'steam', 'epic', 'ubisoft', 'microsoft', 'xbox', 'nvidia'
])

function isItadMajorShop(shopId) {
  if (!shopId) return false
  const id = String(shopId).toLowerCase()
  return Array.from(ITAD_MAJOR_SHOPS).some((s) => id.includes(s))
}

async function fetchItadDeals(minDiscountPct) {
  if (!env.ITAD_API_KEY) return []

  try {
    const response = await fetch(
      `https://api.isthereanydeal.com/deals/v2?key=${env.ITAD_API_KEY}&country=${env.ITAD_COUNTRY}&sort=cut:desc&limit=60&filter=cut:${minDiscountPct}`,
      { headers: { Accept: 'application/json' } }
    )
    if (!response.ok) throw new Error(`ITAD deals API ${response.status}`)

    const json = await response.json()
    const items = Array.isArray(json?.list) ? json.list : []

    return items
      .filter((item) => isItadMajorShop(item?.deal?.shop?.id || item?.deal?.shop?.name))
      .map((item) => ({
      externalId: `itad-deal-${item?.id || item?.slug || ''}`,
      type: item?.deal?.price?.amount === 0 ? 'FREE_GAME' : 'DISCOUNT',
      title: String(item?.title || '').trim(),
      gameSlug: String(item?.slug || item?.title || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || null,
      store: item?.deal?.shop?.name || 'Unknown Store',
      originalPrice: item?.deal?.regular?.amount || null,
      dealPrice: item?.deal?.price?.amount || 0,
      discountPct: item?.deal?.cut || 0,
      currency: item?.deal?.price?.currency || 'USD',
      url: item?.deal?.url || '#',
      imageUrl: item?.assets?.banner400 || item?.assets?.banner300 || null,
      startsAt: null,
      endsAt: item?.deal?.expiry ? new Date(item.deal.expiry * 1000).toISOString() : null,
      source: 'itad',
      metadata: {
        itadId: item?.id || null,
        storeLogo: item?.deal?.shop?.id || null,
        historical: item?.deal?.storeLow?.amount != null
          ? { storeLow: item.deal.storeLow.amount }
          : null
      },
      isActive: true
    }))
  } catch (error) {
    logger.warn({ error }, 'Failed to fetch ITAD deals')
    return []
  }
}

// ──────────────────────────── STEAM (specials + daily deal + new releases + top sellers) ────────────────────────────
function parseSteamItem(item, minDiscountPct, tag) {
  const discountPct = item?.discount_percent || 0
  const isFree = item?.final_price === 0 && discountPct === 100
  if (!isFree && discountPct < minDiscountPct) return null

  return {
    externalId: `steam-${tag}-${item?.id || ''}`,
    type: isFree ? 'FREE_GAME' : 'DISCOUNT',
    title: String(item?.name || '').trim(),
    gameSlug: String(item?.name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || null,
    store: 'Steam',
    originalPrice: item?.original_price ? item.original_price / 100 : null,
    dealPrice: item?.final_price ? item.final_price / 100 : 0,
    discountPct,
    currency: 'USD',
    url: `https://store.steampowered.com/app/${item?.id || ''}`,
    imageUrl: item?.large_capsule_image || item?.header_image || null,
    startsAt: null,
    endsAt: item?.discount_expiration
      ? new Date(item.discount_expiration * 1000).toISOString()
      : null,
    source: 'steam',
    metadata: { steamAppId: item?.id, tag },
    isActive: true
  }
}

async function fetchSteamDeals(minDiscountPct) {
  try {
    const response = await fetch(
      'https://store.steampowered.com/api/featuredcategories?cc=us',
      { headers: { Accept: 'application/json', 'User-Agent': 'PlayWise/1.0' } }
    )
    if (!response.ok) return []

    const json = await response.json()
    const deals = []

    for (const item of (json?.specials?.items || [])) {
      const d = parseSteamItem(item, minDiscountPct, 'special')
      if (d) deals.push(d)
    }

    const daily = json?.['0']
    if (daily && daily.id) {
      const d = parseSteamItem(daily, 0, 'daily')
      if (d) deals.push(d)
    }

    for (const item of (json?.new_releases?.items || []).slice(0, 10)) {
      const d = parseSteamItem(item, 0, 'new')
      if (d) deals.push(d)
    }

    for (const item of (json?.top_sellers?.items || []).slice(0, 10)) {
      const d = parseSteamItem(item, minDiscountPct, 'top')
      if (d) deals.push(d)
    }

    return deals
  } catch (error) {
    logger.debug({ error }, 'Steam deals fetch failed (non-critical)')
    return []
  }
}

// ──────────────────────────── XBOX / MICROSOFT STORE ────────────────────────────
async function fetchXboxDeals() {
  const results = []

  try {
    const siglIds = [
      'fdd9e2a7-0fee-49f6-ad69-4354098401a8',
      '29a81209-df6f-41fd-a528-2ae6b91f719c',
    ]

    const productIds = new Set()

    for (const siglId of siglIds) {
      try {
        const res = await fetch(
          `https://catalog.gamepass.com/sigls/v2?id=${siglId}&market=US&language=en-US`,
          { headers: { Accept: 'application/json', 'User-Agent': 'PlayWise/1.0' }, signal: AbortSignal.timeout(6000) }
        )
        if (!res.ok) continue

        const data = await res.json()
        if (!Array.isArray(data)) continue

        for (const item of data) {
          if (item.id && typeof item.id === 'string' && item.id.length <= 12) {
            productIds.add(item.id)
          }
        }
      } catch { /* individual sigl failure is OK */ }
    }

    if (!productIds.size) return []

    const ids = Array.from(productIds).slice(0, 25)
    const dcRes = await fetch(
      `https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${ids.join(',')}&market=US&languages=en-US`,
      { headers: { Accept: 'application/json', 'User-Agent': 'PlayWise/1.0', 'MS-CV': 'PlayWise.1' }, signal: AbortSignal.timeout(8000) }
    )
    if (!dcRes.ok) return []

    const dcData = await dcRes.json()
    const products = dcData?.Products || []

    for (const product of products) {
      const localized = product?.LocalizedProperties?.[0]
      const title = localized?.ProductTitle || ''
      const productId = product?.ProductId || ''
      if (!title) continue

      const skuAvail = product?.DisplaySkuAvailabilities?.[0]
      const avail = skuAvail?.Availabilities?.[0]
      const price = avail?.OrderManagementData?.Price
      const listPrice = price?.ListPrice ?? 0
      const msrp = price?.MSRP ?? listPrice

      const images = localized?.Images || []
      const imgObj = images.find((i) => i.ImagePurpose === 'SuperHeroArt')
        || images.find((i) => i.ImagePurpose === 'BrandedKeyArt')
        || images.find((i) => i.ImagePurpose === 'Poster')
        || images.find((i) => i.ImagePurpose === 'BoxArt')
        || images[0]
      const rawUri = imgObj?.Uri || null
      const imageUrl = rawUri ? (rawUri.startsWith('//') ? `https:${rawUri}` : rawUri) : null

      const isFree = listPrice === 0
      const discountPct = msrp > 0 && !isFree
        ? Math.round((1 - listPrice / msrp) * 100)
        : isFree ? 100 : 0

      if (!isFree && discountPct < 25) continue

      results.push({
        externalId: `xbox-${productId}`,
        type: isFree ? 'FREE_GAME' : 'DISCOUNT',
        title: String(title).trim(),
        gameSlug: String(title).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || null,
        store: 'Xbox',
        originalPrice: msrp || null,
        dealPrice: isFree ? 0 : listPrice,
        discountPct,
        currency: price?.CurrencyCode || 'USD',
        url: `https://www.xbox.com/games/store/-/${productId}`,
        imageUrl,
        startsAt: null,
        endsAt: null,
        source: 'xbox',
        metadata: { productId, category: product?.Properties?.Category || null },
        isActive: true
      })
    }
  } catch (error) {
    logger.debug({ error }, 'Xbox deals fetch failed (non-critical)')
  }

  return results
}

// ──────────────────────────── GAMERPOWER (flash giveaways) ────────────────────────────
const GAMERPOWER_PLATFORMS = new Set(['pc', 'steam', 'epic-games-store', 'ubisoft', 'xbox-one', 'xbox-series-xs'])

function gamerPowerStore(platforms) {
  if (!platforms) return 'PC'
  const p = platforms.toLowerCase()
  if (p.includes('steam')) return 'Steam'
  if (p.includes('epic')) return 'Epic Games Store'
  if (p.includes('ubisoft')) return 'Ubisoft Store'
  if (p.includes('xbox')) return 'Xbox'
  if (p.includes('nvidia') || p.includes('geforce')) return 'NVIDIA'
  return 'PC'
}

async function fetchGamerPowerGiveaways() {
  try {
    const response = await fetch(
      'https://www.gamerpower.com/api/giveaways?type=game&sort-by=value',
      { headers: { Accept: 'application/json', 'User-Agent': 'PlayWise/1.0' } }
    )
    if (!response.ok) return []

    const items = await response.json()
    if (!Array.isArray(items)) return []

    return items
      .filter((item) => {
        const platforms = String(item?.platforms || '').toLowerCase()
        return Array.from(GAMERPOWER_PLATFORMS).some((p) => platforms.includes(p))
      })
      .slice(0, 30)
      .map((item) => {
        const worth = parseFloat(String(item?.worth || '0').replace(/[^0-9.]/g, '')) || null
        return {
          externalId: `gamerpower-${item?.id || ''}`,
          type: 'FREE_GAME',
          title: String(item?.title || '').trim(),
          gameSlug: String(item?.title || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || null,
          store: gamerPowerStore(item?.platforms),
          originalPrice: worth,
          dealPrice: 0,
          discountPct: 100,
          currency: 'USD',
          url: item?.open_giveaway_url || item?.gamerpower_url || '#',
          imageUrl: item?.thumbnail || item?.image || null,
          startsAt: item?.published_date || null,
          endsAt: item?.end_date && item.end_date !== 'N/A' ? item.end_date : null,
          source: 'gamerpower',
          metadata: {
            gamerPowerId: item?.id,
            platforms: item?.platforms,
            type: item?.type,
            instructions: item?.instructions || null,
            worth: item?.worth || null
          },
          isActive: item?.status === 'Active'
        }
      })
  } catch (error) {
    logger.debug({ error }, 'GamerPower giveaways fetch failed (non-critical)')
    return []
  }
}

// ──────────────────────────── STEAM NEWS (game updates) ────────────────────────────
async function fetchSteamNews(appIds) {
  if (!appIds?.length) return []
  const results = []

  for (const appId of appIds.slice(0, 10)) {
    try {
      const response = await fetch(
        `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${appId}&count=3&maxlength=300`,
        { headers: { Accept: 'application/json' } }
      )
      if (!response.ok) continue

      const json = await response.json()
      const newsItems = json?.appnews?.newsitems || []

      for (const news of newsItems) {
        results.push({
          id: `steam-news-${news?.gid || ''}`,
          appId,
          title: String(news?.title || '').trim(),
          contents: String(news?.contents || '').trim(),
          url: news?.url || '',
          author: news?.author || '',
          date: news?.date ? new Date(news.date * 1000).toISOString() : null,
          feedLabel: news?.feedlabel || '',
          source: 'steam'
        })
      }
    } catch {
      // skip individual app failures
    }
  }

  return results
}

// ──────────────────────────── REDDIT DEALS ────────────────────────────
const REDDIT_SOURCES = [
  { sub: 'GameDeals', sort: 'hot', limit: 50 },
  { sub: 'FreeGameFindings', sort: 'new', limit: 30 },
  { sub: 'steamdeals', sort: 'hot', limit: 20 },
]

const REDDIT_STORE_ALIASES = {
  'steam': 'Steam', 'valve': 'Steam',
  'epic games': 'Epic Games Store', 'epic games store': 'Epic Games Store',
  'epic': 'Epic Games Store', 'egs': 'Epic Games Store',
  'ubisoft': 'Ubisoft Store', 'ubisoft store': 'Ubisoft Store', 'uplay': 'Ubisoft Store',
  'xbox': 'Xbox', 'microsoft': 'Xbox', 'microsoft store': 'Xbox',
  'ea': 'EA', 'origin': 'EA', 'ea app': 'EA',
  'nvidia': 'NVIDIA', 'geforce now': 'NVIDIA',
  'gog': 'GOG', 'gog.com': 'GOG',
  'humble': 'Humble Bundle', 'humble bundle': 'Humble Bundle', 'humble store': 'Humble Bundle',
  'green man gaming': 'Green Man Gaming', 'gmg': 'Green Man Gaming',
  'fanatical': 'Fanatical', 'indiegala': 'IndieGala', 'itch.io': 'itch.io',
}

const REDDIT_WANTED_STORES = new Set([
  'Steam', 'Epic Games Store', 'Ubisoft Store', 'Xbox', 'EA', 'NVIDIA'
])

function normalizeRedditStore(raw) {
  if (!raw) return null
  const lower = raw.toLowerCase().trim()
  return REDDIT_STORE_ALIASES[lower] || raw.trim()
}

function parseRedditTitle(title) {
  const match = title.match(/^\[([^\]]+)\]\s*(.+?)(?:\s*\(([^)]+)\)\s*)?$/)
  if (!match) return null

  const store = normalizeRedditStore(match[1])
  const gameTitle = (match[2] || '').trim()
  const priceInfo = (match[3] || '').trim()
  if (!gameTitle) return null

  let dealPrice = null
  let originalPrice = null
  let discountPct = 0
  let isFree = false

  const lower = priceInfo.toLowerCase()
  if (lower.includes('free') || lower === '$0' || lower === '$0.00' || lower === '100%') {
    isFree = true
    dealPrice = 0
    discountPct = 100
  } else {
    const pm = priceInfo.match(/\$(\d+(?:\.\d{2})?)/)
    if (pm) dealPrice = parseFloat(pm[1])
    const dm = priceInfo.match(/(\d+)%\s*off/i) || priceInfo.match(/-(\d+)%/)
    if (dm) {
      discountPct = parseInt(dm[1], 10)
      if (dealPrice != null && discountPct > 0 && discountPct < 100) {
        originalPrice = Math.round((dealPrice / (1 - discountPct / 100)) * 100) / 100
      }
    }
  }

  return { store, gameTitle, dealPrice, originalPrice, discountPct, isFree }
}

async function fetchRedditDeals() {
  const deals = []

  for (const { sub, sort, limit } of REDDIT_SOURCES) {
    try {
      const res = await fetch(
        `https://www.reddit.com/r/${sub}/${sort}.json?limit=${limit}&raw_json=1`,
        {
          headers: { 'User-Agent': 'PlayWise/1.0 (game deals aggregator)', Accept: 'application/json' },
          signal: AbortSignal.timeout(8000)
        }
      )
      if (!res.ok) continue

      const json = await res.json()
      const posts = json?.data?.children || []

      for (const post of posts) {
        const d = post?.data
        if (!d || d.over_18 || d.removed_by_category) continue

        const parsed = parseRedditTitle(d.title || '')
        if (!parsed || !parsed.store) continue
        if (!REDDIT_WANTED_STORES.has(parsed.store)) continue
        if ((d.score || 0) < 5) continue

        const url = d.url || d.url_overridden_by_dest || `https://reddit.com${d.permalink}`

        deals.push({
          externalId: `reddit-${d.id || ''}`,
          type: parsed.isFree ? 'FREE_GAME' : 'DISCOUNT',
          title: parsed.gameTitle,
          gameSlug: parsed.gameTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-') || null,
          store: parsed.store,
          originalPrice: parsed.originalPrice,
          dealPrice: parsed.isFree ? 0 : parsed.dealPrice,
          discountPct: parsed.discountPct,
          currency: 'USD',
          url,
          imageUrl: d.thumbnail && d.thumbnail.startsWith('http') ? d.thumbnail : null,
          startsAt: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : null,
          endsAt: null,
          source: 'reddit',
          metadata: {
            subreddit: sub,
            redditScore: d.score || 0,
            numComments: d.num_comments || 0,
            flair: d.link_flair_text || null,
            permalink: `https://reddit.com${d.permalink}`
          },
          isActive: true
        })
      }
    } catch (error) {
      logger.debug({ error, sub }, 'Reddit deals fetch failed (non-critical)')
    }
  }

  return deals
}

// ──────────────────────────── AGGREGATE ────────────────────────────
function dealQualityScore(deal) {
  let score = 0
  if (deal.type === 'FREE_GAME') score += 50
  const rating = parseInt(deal.metadata?.steamRating || '0', 10)
  const metacritic = parseInt(deal.metadata?.metacritic || '0', 10)
  score += Math.max(rating, metacritic)
  if (deal.discountPct) score += deal.discountPct / 2
  const majorStores = ['Steam', 'Epic Games Store', 'Ubisoft Store', 'Xbox', 'NVIDIA', 'EA']
  if (majorStores.some((s) => deal.store?.includes(s))) score += 20
  if (deal.source === 'reddit' && deal.metadata?.redditScore) {
    score += Math.min(deal.metadata.redditScore / 10, 30)
  }
  return score
}

function normTitle(t) {
  return (t || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function dedupeDeals(deals) {
  const seenIds = new Set()
  const seenTitleStore = new Set()

  return deals
    .filter((d) => {
      if (!d.externalId || seenIds.has(d.externalId)) return false
      seenIds.add(d.externalId)

      // Cross-source dedup: same game + same store from different providers
      const key = `${normTitle(d.title)}::${(d.store || '').toLowerCase()}`
      if (seenTitleStore.has(key)) return false
      seenTitleStore.add(key)

      return true
    })
    .sort((a, b) => dealQualityScore(b) - dealQualityScore(a))
}

async function refreshDeals() {
  const minPct = env.DEALS_MIN_DISCOUNT_PCT || 75

  const [epicFree, cheapsharkFree, cheapsharkDeals, itadDeals, steamDeals, xboxDeals, gamerPower, redditDeals] =
    await Promise.allSettled([
      fetchEpicFreeGames(),
      fetchCheapSharkFreeGames(),
      fetchCheapSharkDiscounts(minPct),
      fetchItadDeals(minPct),
      fetchSteamDeals(minPct),
      fetchXboxDeals(),
      fetchGamerPowerGiveaways(),
      fetchRedditDeals()
    ])

  // API sources come first (structured data, better images) — Reddit fills gaps
  const allDeals = dedupeDeals([
    ...(epicFree.status === 'fulfilled' ? epicFree.value : []),
    ...(cheapsharkFree.status === 'fulfilled' ? cheapsharkFree.value : []),
    ...(cheapsharkDeals.status === 'fulfilled' ? cheapsharkDeals.value : []),
    ...(itadDeals.status === 'fulfilled' ? itadDeals.value : []),
    ...(steamDeals.status === 'fulfilled' ? steamDeals.value : []),
    ...(xboxDeals.status === 'fulfilled' ? xboxDeals.value : []),
    ...(gamerPower.status === 'fulfilled' ? gamerPower.value : []),
    ...(redditDeals.status === 'fulfilled' ? redditDeals.value : [])
  ])

  // Persist to DB or runtime store
  if (isDatabaseReady()) {
    const prisma = getPrisma()
    for (const deal of allDeals) {
      try {
        await prisma.deal.upsert({
          where: { externalId: deal.externalId },
          update: {
            title: deal.title,
            type: deal.type,
            gameSlug: deal.gameSlug,
            store: deal.store,
            originalPrice: deal.originalPrice,
            dealPrice: deal.dealPrice,
            discountPct: deal.discountPct,
            currency: deal.currency,
            url: deal.url,
            imageUrl: deal.imageUrl,
            startsAt: deal.startsAt ? new Date(deal.startsAt) : null,
            endsAt: deal.endsAt ? new Date(deal.endsAt) : null,
            source: deal.source,
            metadata: deal.metadata || null,
            isActive: deal.isActive
          },
          create: {
            externalId: deal.externalId,
            type: deal.type,
            title: deal.title,
            gameSlug: deal.gameSlug,
            store: deal.store,
            originalPrice: deal.originalPrice,
            dealPrice: deal.dealPrice,
            discountPct: deal.discountPct,
            currency: deal.currency,
            url: deal.url,
            imageUrl: deal.imageUrl,
            startsAt: deal.startsAt ? new Date(deal.startsAt) : null,
            endsAt: deal.endsAt ? new Date(deal.endsAt) : null,
            source: deal.source,
            metadata: deal.metadata || null,
            isActive: deal.isActive
          }
        })
      } catch (error) {
        logger.debug({ error, externalId: deal.externalId }, 'Failed to upsert deal')
      }
    }
  } else {
    for (const deal of allDeals) {
      upsertRuntimeDeal(deal)
    }
  }

  dealsCache = { data: allDeals, updatedAt: Date.now() }
  logger.info({ count: allDeals.length }, 'Deals refreshed')
  return allDeals
}

async function getDeals(options = {}) {
  const cacheMs = env.DEALS_CACHE_MS || 30 * 60 * 1000
  const now = Date.now()

  // Return cache if fresh enough
  if (dealsCache.data.length && now - dealsCache.updatedAt < cacheMs) {
    return filterDeals(dealsCache.data, options)
  }

  // Try DB first
  if (isDatabaseReady()) {
    try {
      const prisma = getPrisma()
      const rows = await prisma.deal.findMany({
        where: { isActive: true },
        orderBy: [{ type: 'asc' }, { discountPct: 'desc' }, { createdAt: 'desc' }],
        take: 100
      })
      if (rows.length) {
        dealsCache = { data: rows, updatedAt: now }
        return filterDeals(rows, options)
      }
    } catch (error) {
      logger.debug({ error }, 'Failed to load deals from DB')
    }
  }

  // Fallback to runtime store
  const runtime = getRuntimeDeals()
  if (runtime.length) {
    dealsCache = { data: runtime, updatedAt: now }
    return filterDeals(runtime, options)
  }

  // Cold start — fetch fresh
  const fresh = await refreshDeals()
  return filterDeals(fresh, options)
}

function filterDeals(deals, options = {}) {
  let filtered = deals

  if (options.type) {
    filtered = filtered.filter((d) => d.type === options.type)
  }
  if (options.store) {
    const store = String(options.store).toLowerCase()
    filtered = filtered.filter((d) => String(d.store || '').toLowerCase().includes(store))
  }
  if (options.freeOnly) {
    filtered = filtered.filter((d) => d.type === 'FREE_GAME' || d.dealPrice === 0)
  }

  return filtered
}

function startDealsRefreshLoop() {
  if (refreshTimer) return
  const interval = Math.max(60 * 1000, env.DEALS_JOB_INTERVAL_MS || 5 * 60 * 1000)

  const tick = async () => {
    try {
      await refreshDeals()
    } catch (error) {
      logger.error({ error }, 'Deals refresh loop failed')
    }
  }

  refreshTimer = setInterval(tick, interval)
  refreshTimer.unref()
  void tick()
  logger.info({ intervalMs: interval }, 'Deals refresh loop started')
}

function getDealsCache() {
  return dealsCache
}

module.exports = {
  getDeals,
  refreshDeals,
  startDealsRefreshLoop,
  getDealsCache,
  fetchSteamNews
}
