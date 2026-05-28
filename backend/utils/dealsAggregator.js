const { env } = require('../lib/env')
const { logger } = require('../lib/logger')
const { getPrisma, isDatabaseReady } = require('../lib/prisma')
const { getRuntimeDeals, upsertRuntimeDeal } = require('./runtimeStore')

let dealsCache = { data: [], updatedAt: 0 }
let refreshTimer = null

// ──────────────────────────── STEAM (direct official API — no key needed) ────────────────────────────
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

// ──────────────────────────── EPIC GAMES (direct store endpoint — no key needed) ────────────────────────────
async function fetchEpicDeals() {
  const deals = []

  try {
    const res = await fetch(
      'https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=US&allowCountries=US',
      { headers: { Accept: 'application/json', 'User-Agent': 'PlayWise/1.0' }, signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) {
      logger.debug({ status: res.status }, 'Epic promotions endpoint returned non-OK')
      return []
    }

    const json = await res.json()
    const elements = json?.data?.Catalog?.searchStore?.elements || []

    for (const el of elements) {
      const title = String(el?.title || '').trim()
      if (!title) continue

      const price = el?.price?.totalPrice
      const originalPrice = price?.originalPrice != null ? price.originalPrice / 100 : null
      const currentPrice = price?.discountPrice != null ? price.discountPrice / 100 : null

      const promos = el?.promotions?.promotionalOffers || []
      const upcoming = el?.promotions?.upcomingPromotionalOffers || []
      const hasActivePromo = promos.length > 0
      const isFree = currentPrice === 0 && hasActivePromo

      if (!isFree && (currentPrice == null || currentPrice === originalPrice)) continue

      const discountPct = originalPrice && originalPrice > 0 && currentPrice != null
        ? Math.round((1 - currentPrice / originalPrice) * 100)
        : isFree ? 100 : 0

      const images = el?.keyImages || []
      const wideImg = images.find((i) => i.type === 'OfferImageWide')
        || images.find((i) => i.type === 'DieselStoreFrontWide')
        || images.find((i) => i.type === 'OfferImageTall')
        || images[0]

      const mapping = (el?.catalogNs?.mappings || []).find((m) => m.pageSlug) || {}
      const productSlug = el?.productSlug || el?.urlSlug || mapping.pageSlug || ''
      const storeUrl = productSlug
        ? `https://store.epicgames.com/en-US/p/${productSlug}`
        : 'https://store.epicgames.com'

      let startsAt = null
      let endsAt = null
      if (hasActivePromo && promos[0]?.promotionalOffers?.[0]) {
        const offer = promos[0].promotionalOffers[0]
        startsAt = offer.startDate || null
        endsAt = offer.endDate || null
      } else if (upcoming.length > 0 && upcoming[0]?.promotionalOffers?.[0]) {
        const offer = upcoming[0].promotionalOffers[0]
        startsAt = offer.startDate || null
        endsAt = offer.endDate || null
      }

      deals.push({
        externalId: `epic-${el?.id || title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        type: isFree ? 'FREE_GAME' : 'DISCOUNT',
        title,
        gameSlug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || null,
        store: 'Epic Games Store',
        originalPrice,
        dealPrice: isFree ? 0 : currentPrice,
        discountPct,
        currency: price?.currencyCode || 'USD',
        url: storeUrl,
        imageUrl: wideImg?.url || null,
        startsAt,
        endsAt,
        source: 'epic',
        metadata: {
          epicId: el?.id || null,
          namespace: el?.namespace || null,
          seller: el?.seller?.name || null
        },
        isActive: true
      })
    }
  } catch (error) {
    logger.debug({ error }, 'Epic deals fetch failed (non-critical)')
  }

  return deals
}

// ──────────────────────────── XBOX / MICROSOFT STORE (direct catalog — no key needed) ────────────────────────────
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

// ──────────────────────────── UBISOFT STORE (direct HTML scrape — no key needed) ────────────────────────────
function decodeHtmlEntities(str) {
  return (str || '')
    .replace(/&rsquo;/g, '’')
    .replace(/&lsquo;/g, '‘')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

async function fetchUbisoftDeals() {
  const deals = []

  try {
    const res = await fetch('https://store.ubisoft.com/us/deals', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      logger.debug({ status: res.status }, 'Ubisoft Store returned non-OK')
      return []
    }

    const html = await res.text()

    // ── Strategy: extract parallel arrays using global regex, then zip by index ──
    // The inline JSON scripts sit AFTER the <!-- END: .product-tile --> comment,
    // so splitting by that marker misaligns JSON with HTML. Instead we extract
    // each data point globally in document order and match by position.

    // 1. Inline product JSON (id, url, image, edition, brand, promotions)
    const jsonBlocks = [...html.matchAll(/var\s+product\s*=\s*(\{[^}]+\})\s*;/g)]
      .map((m) => { try { return JSON.parse(m[1]) } catch { return null } })
      .filter((d) => d && d.id)

    // 2. Display titles from <div class="prod-title">
    const titles = [...html.matchAll(/<div\s+class="prod-title">\s*([\s\S]*?)\s*<\/div>/g)]
      .map((m) => decodeHtmlEntities(m[1]))

    // 3. Edition / subtitle from <div class="card-subtitle">
    const editions = [...html.matchAll(/<div\s+class="card-subtitle">\s*([\s\S]*?)\s*<\/div>/g)]
      .map((m) => m[1].trim())

    // 4. Sale prices from <span class="price-sales ...">$XX.XX</span>
    const salePrices = [...html.matchAll(/<span\s+class="price-sales[^"]*">\s*\$?([\d,.]+)\s*<\/span>/g)]
      .map((m) => parseFloat(m[1].replace(/,/g, '')))

    // 5. Original prices from <span class="price-item">$XX.XX</span>
    const origPrices = [...html.matchAll(/<span\s+class="price-item">\s*\$?([\d,.]+)\s*<\/span>/g)]
      .map((m) => parseFloat(m[1].replace(/,/g, '')))

    // 6. Discount badges from <div class="deal-percentage ..." >-XX%</div>
    const discounts = [...html.matchAll(/<div\s+class="deal-percentage[^"]*"\s*>\s*-?(\d+)%\s*<\/div>/g)]
      .map((m) => parseInt(m[1], 10))

    const count = jsonBlocks.length
    if (!count) {
      logger.debug('Ubisoft Store: no products found in HTML')
      return []
    }

    for (let i = 0; i < count; i++) {
      const pd = jsonBlocks[i]
      const productId = pd.id

      // Display title (fallback to JSON name)
      let displayTitle = (i < titles.length) ? titles[i] : ''
      const edition = (i < editions.length) ? editions[i] : (pd.edition || '')

      let title = displayTitle || pd.name || ''
      if (edition && !title.toLowerCase().includes(edition.toLowerCase())) {
        title = `${title} - ${edition}`
      }
      title = title.trim()
      if (!title) continue

      // Prices
      let salePrice = (i < salePrices.length && Number.isFinite(salePrices[i])) ? salePrices[i] : null
      let originalPrice = (i < origPrices.length && Number.isFinite(origPrices[i])) ? origPrices[i] : null

      // JSON fallback for prices (works for DLC items)
      if (salePrice == null && pd.unit_sale_price) salePrice = pd.unit_sale_price
      if (originalPrice == null && pd.unit_price) originalPrice = pd.unit_price

      // Discount %
      let discountPct = (i < discounts.length) ? discounts[i] : 0

      // Fallback: extract from promotion code (e.g. "Promo-TCTD2-2026-60off")
      if (!discountPct && Array.isArray(pd.promotions) && pd.promotions.length) {
        const promoMatch = String(pd.promotions[0] || '').match(/(\d+)off/i)
        if (promoMatch) discountPct = parseInt(promoMatch[1], 10)
      }

      // Fallback: calculate from prices
      if (!discountPct && originalPrice && salePrice != null && originalPrice > salePrice) {
        discountPct = Math.round((1 - salePrice / originalPrice) * 100)
      }

      const isFree = salePrice === 0 && discountPct === 100
      const imageUrl = pd.image_url || null
      const productUrl = pd.url || `https://store.ubisoft.com/us/${productId}.html`

      deals.push({
        externalId: `ubi-${productId}`,
        type: isFree ? 'FREE_GAME' : 'DISCOUNT',
        title,
        gameSlug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || null,
        store: 'Ubisoft Store',
        originalPrice: Number.isFinite(originalPrice) && originalPrice > 0 ? originalPrice : null,
        dealPrice: isFree ? 0 : (Number.isFinite(salePrice) ? salePrice : null),
        discountPct,
        currency: pd.currency || 'USD',
        url: productUrl,
        imageUrl,
        startsAt: null,
        endsAt: null,
        source: 'ubisoft',
        metadata: {
          ubisoftId: productId,
          edition: edition || null,
          brand: pd.brand || null,
          platform: pd.platform || null,
          promotions: pd.promotions || [],
        },
        isActive: true,
      })
    }

    logger.info({ count: deals.length }, 'Ubisoft Store deals scraped directly')
  } catch (error) {
    logger.debug({ error }, 'Ubisoft Store deals fetch failed (non-critical)')
  }

  return deals
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

// ──────────────────────────── AGGREGATE ────────────────────────────
function dealQualityScore(deal) {
  let score = 0
  if (deal.type === 'FREE_GAME') score += 50
  if (deal.discountPct) score += deal.discountPct / 2
  // All deals now come from direct store APIs — boost admin-curated ones
  if (deal.source === 'admin') score += 10
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

      const key = `${normTitle(d.title)}::${(d.store || '').toLowerCase()}`
      if (seenTitleStore.has(key)) return false
      seenTitleStore.add(key)

      return true
    })
    .sort((a, b) => dealQualityScore(b) - dealQualityScore(a))
}

async function refreshDeals() {
  const minPct = env.DEALS_MIN_DISCOUNT_PCT || 75

  const [steamDeals, epicDeals, xboxDeals, ubisoftDeals] = await Promise.allSettled([
    fetchSteamDeals(minPct),
    fetchEpicDeals(),
    fetchXboxDeals(),
    fetchUbisoftDeals()
  ])

  const autoDeals = dedupeDeals([
    ...(steamDeals.status === 'fulfilled' ? steamDeals.value : []),
    ...(epicDeals.status === 'fulfilled' ? epicDeals.value : []),
    ...(xboxDeals.status === 'fulfilled' ? xboxDeals.value : []),
    ...(ubisoftDeals.status === 'fulfilled' ? ubisoftDeals.value : [])
  ])

  if (isDatabaseReady()) {
    const prisma = getPrisma()

    // Upsert auto-fetched deals (never touch admin-created ones)
    for (const deal of autoDeals) {
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

    // Deactivate stale deals from retired third-party sources
    try {
      const retired = await prisma.deal.updateMany({
        where: { source: { in: ['cheapshark', 'itad', 'gamerpower'] }, isActive: true },
        data: { isActive: false }
      })
      if (retired.count) logger.info({ count: retired.count }, 'Deactivated stale third-party deals')
    } catch { /* non-critical */ }

    // Load ALL active deals (auto + admin) for cache
    try {
      const allRows = await prisma.deal.findMany({
        where: { isActive: true },
        orderBy: [{ type: 'asc' }, { discountPct: 'desc' }, { createdAt: 'desc' }],
        take: 200
      })
      dealsCache = { data: allRows, updatedAt: Date.now() }
      logger.info({ auto: autoDeals.length, total: allRows.length }, 'Deals refreshed (direct APIs + admin)')
      return allRows
    } catch (error) {
      logger.debug({ error }, 'Failed to reload deals from DB after refresh')
    }
  } else {
    for (const deal of autoDeals) {
      upsertRuntimeDeal(deal)
    }
  }

  dealsCache = { data: autoDeals, updatedAt: Date.now() }
  logger.info({ count: autoDeals.length }, 'Deals refreshed (direct APIs)')
  return autoDeals
}

async function getDeals(options = {}) {
  const cacheMs = env.DEALS_CACHE_MS || 30 * 60 * 1000
  const now = Date.now()

  if (dealsCache.data.length && now - dealsCache.updatedAt < cacheMs) {
    return filterDeals(dealsCache.data, options)
  }

  if (isDatabaseReady()) {
    try {
      const prisma = getPrisma()
      const rows = await prisma.deal.findMany({
        where: { isActive: true },
        orderBy: [{ type: 'asc' }, { discountPct: 'desc' }, { createdAt: 'desc' }],
        take: 200
      })
      if (rows.length) {
        dealsCache = { data: rows, updatedAt: now }
        return filterDeals(rows, options)
      }
    } catch (error) {
      logger.debug({ error }, 'Failed to load deals from DB')
    }
  }

  const runtime = getRuntimeDeals()
  if (runtime.length) {
    dealsCache = { data: runtime, updatedAt: now }
    return filterDeals(runtime, options)
  }

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
