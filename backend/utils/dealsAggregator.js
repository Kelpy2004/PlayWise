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

// ──────────────────────────── EPIC GAMES FREE ────────────────────────────
async function fetchEpicFreeGames() {
  try {
    const response = await fetch(
      'https://store-site-backend-official.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=US&allowCountries=US',
      { headers: { Accept: 'application/json', 'User-Agent': 'PlayWise/1.0' } }
    )
    if (!response.ok) throw new Error(`Epic API ${response.status}`)

    const json = await response.json()
    const elements = json?.data?.Catalog?.searchStore?.elements || []
    const deals = []

    for (const el of elements) {
      const promotions = el?.promotions?.promotionalOffers || []
      const upcoming = el?.promotions?.upcomingPromotionalOffers || []
      const allOffers = [...promotions, ...upcoming]
      if (!allOffers.length) continue

      for (const group of allOffers) {
        for (const offer of group?.promotionalOffers || []) {
          if (offer?.discountSetting?.discountPercentage !== 0) continue

          const originalPrice = el?.price?.totalPrice?.originalPrice
            ? el.price.totalPrice.originalPrice / 100
            : null
          const imageUrl = el?.keyImages?.find((i) => i.type === 'DieselStoreFrontWide')?.url
            || el?.keyImages?.find((i) => i.type === 'OfferImageWide')?.url
            || el?.keyImages?.find((i) => i.type === 'VaultClosed')?.url
            || el?.keyImages?.find((i) => i.type === 'Thumbnail')?.url
            || el?.keyImages?.find((i) => i.type === 'DieselStoreFrontTall')?.url
            || el?.keyImages?.[0]?.url || null
          const slug = String(el?.productSlug || el?.urlSlug || el?.catalogNs?.mappings?.[0]?.pageSlug || '').trim()

          deals.push({
            externalId: `epic-free-${el?.id || slug}`,
            type: 'FREE_GAME',
            title: String(el?.title || 'Free Game').trim(),
            gameSlug: slug ? slug.toLowerCase().replace(/[^a-z0-9]+/g, '-') : null,
            store: 'Epic Games Store',
            originalPrice,
            dealPrice: 0,
            discountPct: 100,
            currency: el?.price?.totalPrice?.currencyCode || 'USD',
            url: slug
              ? `https://store.epicgames.com/p/${slug}`
              : 'https://store.epicgames.com/free-games',
            imageUrl,
            startsAt: offer?.startDate || null,
            endsAt: offer?.endDate || null,
            source: 'epic',
            metadata: {
              namespace: el?.namespace || null,
              seller: el?.seller?.name || null,
              isUpcoming: upcoming.length > 0 && promotions.length === 0
            },
            isActive: true
          })
        }
      }
    }

    return deals
  } catch (error) {
    logger.warn({ error }, 'Failed to fetch Epic free games')
    return []
  }
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

// ──────────────────────────── STEAM FREE (basic) ────────────────────────────
async function fetchSteamFreeGames() {
  try {
    const response = await fetch(
      'https://store.steampowered.com/api/featuredcategories?cc=us',
      { headers: { Accept: 'application/json', 'User-Agent': 'PlayWise/1.0' } }
    )
    if (!response.ok) return []

    const json = await response.json()
    const specials = json?.specials?.items || []

    return specials
      .filter((item) => item?.final_price === 0 && item?.discount_percent === 100)
      .map((item) => ({
        externalId: `steam-free-${item?.id || ''}`,
        type: 'FREE_GAME',
        title: String(item?.name || '').trim(),
        gameSlug: String(item?.name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || null,
        store: 'Steam',
        originalPrice: item?.original_price ? item.original_price / 100 : null,
        dealPrice: 0,
        discountPct: 100,
        currency: 'USD',
        url: `https://store.steampowered.com/app/${item?.id || ''}`,
        imageUrl: item?.large_capsule_image || item?.header_image || null,
        startsAt: null,
        endsAt: item?.discount_expiration
          ? new Date(item.discount_expiration * 1000).toISOString()
          : null,
        source: 'steam',
        metadata: { steamAppId: item?.id },
        isActive: true
      }))
  } catch (error) {
    logger.debug({ error }, 'Steam free games fetch failed (non-critical)')
    return []
  }
}

// ──────────────────────────── AGGREGATE ────────────────────────────
function dealQualityScore(deal) {
  let score = 0
  if (deal.type === 'FREE_GAME') score += 50
  const rating = parseInt(deal.metadata?.steamRating || '0', 10)
  const metacritic = parseInt(deal.metadata?.metacritic || '0', 10)
  score += Math.max(rating, metacritic)
  if (deal.discountPct) score += deal.discountPct / 2
  const majorStores = ['Steam', 'Epic Games Store', 'Ubisoft Store', 'Xbox', 'NVIDIA']
  if (majorStores.some((s) => deal.store?.includes(s))) score += 20
  return score
}

function dedupeDeals(deals) {
  const seen = new Set()
  return deals
    .filter((d) => {
      if (!d.externalId || seen.has(d.externalId)) return false
      seen.add(d.externalId)
      return true
    })
    .sort((a, b) => dealQualityScore(b) - dealQualityScore(a))
}

async function refreshDeals() {
  const minPct = env.DEALS_MIN_DISCOUNT_PCT || 75

  const [epicFree, cheapsharkFree, cheapsharkDeals, itadDeals, steamFree] =
    await Promise.allSettled([
      fetchEpicFreeGames(),
      fetchCheapSharkFreeGames(),
      fetchCheapSharkDiscounts(minPct),
      fetchItadDeals(minPct),
      fetchSteamFreeGames()
    ])

  const allDeals = dedupeDeals([
    ...(epicFree.status === 'fulfilled' ? epicFree.value : []),
    ...(cheapsharkFree.status === 'fulfilled' ? cheapsharkFree.value : []),
    ...(cheapsharkDeals.status === 'fulfilled' ? cheapsharkDeals.value : []),
    ...(itadDeals.status === 'fulfilled' ? itadDeals.value : []),
    ...(steamFree.status === 'fulfilled' ? steamFree.value : [])
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
  getDealsCache
}
