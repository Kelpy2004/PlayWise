const PRICE_CATALOG = require('../data/priceCatalog')
const { env } = require('../lib/env')
const { getPrisma, isDatabaseReady } = require('../lib/prisma')
const { getCheapSharkSnapshot } = require('./cheapShark')
const { buildTimingInsight, compressHistory, normalizeHistory } = require('./priceIntelligence')

const CACHE_TTL_MS = env.PRICE_CACHE_MS
const COUNTRY_CODE = env.ITAD_COUNTRY.toUpperCase()
const ITAD_API_KEY = env.ITAD_API_KEY || ''
const ITAD_BASE = 'https://api.isthereanydeal.com'
const HISTORY_WINDOW_DAYS = Number(process.env.PRICE_HISTORY_DAYS || 180)
const cache = new Map()
let intervalStarted = false

function withAuth(url) {
  const finalUrl = new URL(url)
  if (ITAD_API_KEY) {
    finalUrl.searchParams.set('key', ITAD_API_KEY)
  }
  const headers = { 'Content-Type': 'application/json' }
  if (ITAD_API_KEY) {
    headers['X-API-Key'] = ITAD_API_KEY
    headers.Authorization = `Bearer ${ITAD_API_KEY}`
  }
  return { url: finalUrl.toString(), headers }
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.headers || {})
      }
    })

    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText)
      throw new Error(message || `Request failed with status ${response.status}`)
    }

    return response.json()
  } finally {
    clearTimeout(timeout)
  }
}

function toAmount(price) {
  if (!price) return null
  if (typeof price.amount === 'number') return price.amount
  if (typeof price.amountInt === 'number') return price.amountInt / 100
  const parsed = Number(price)
  return Number.isFinite(parsed) ? parsed : null
}

function formatMoney(price) {
  const amount = toAmount(price)
  if (amount == null) return null

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: price.currency || 'USD',
      maximumFractionDigits: 2
    }).format(amount)
  } catch (_) {
    return `${price.currency || 'USD'} ${amount}`
  }
}

function normalizeStoreLabel(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function resolvePriceMeta(slug, title) {
  const configured = PRICE_CATALOG[slug]
  if (configured) {
    return configured
  }

  if (!title) return null

  return {
    title,
    paid: true,
    stores: []
  }
}

function buildConfiguredStores(slug, meta = PRICE_CATALOG[slug]) {
  if (!meta?.stores?.length) return []
  return meta.stores.map((store) => ({
    store: store.label,
    normalizedStore: normalizeStoreLabel(store.label),
    amount: null,
    regularAmount: null,
    currency: null,
    currentPrice: null,
    regularPrice: null,
    cut: null,
    url: store.url || null,
    isBestCurrent: false,
    isHistoricalLow: false,
    note: ITAD_API_KEY
      ? (normalizeStoreLabel(store.label) === 'official site'
        ? 'Official publisher pages usually do not expose a trackable live price in the price provider.'
        : 'Waiting for the live provider response for this store.')
      : 'Live price unavailable until the API key is configured.'
  }))
}

function buildFallbackSnapshot(slug, meta = PRICE_CATALOG[slug], extra = {}) {
  if (!meta || !meta.paid) {
    return {
      supported: false,
      live: false,
      message: 'Live price tracking is only shown for paid licensed games.',
      stores: [],
      history: {
        available: false,
        points: [],
        source: 'Unavailable'
      },
      timing: {
        decision: 'WATCH_CLOSELY',
        confidence: 0.42,
        dropProbability: 0.5,
        forecastWindowDays: null,
        summary: 'Timing signals are unavailable because there is no live paid-price data for this title.',
        reasons: ['Live timing analysis is only generated for paid tracked games.'],
        stats: {}
      },
      lastUpdated: new Date().toISOString(),
      ...extra
    }
  }

  return {
    supported: true,
    live: false,
    message: 'Store links are ready. Add ITAD_API_KEY in backend/.env to pull live prices and timing history automatically.',
    source: 'Store links fallback',
    bestDeal: null,
    historicalLow: null,
    stores: buildConfiguredStores(slug, meta),
    history: {
      available: false,
      points: [],
      source: 'No live history yet'
    },
    timing: {
      decision: 'WATCH_CLOSELY',
      confidence: 0.44,
      dropProbability: 0.5,
      forecastWindowDays: null,
      summary: 'PlayWise needs live price history before it can predict whether this title is likely to drop again soon.',
      reasons: [
        'Store links are available, but live historical price data is not connected yet.'
      ],
      stats: {}
    },
    lastUpdated: new Date().toISOString(),
    ...extra
  }
}

function mergeStoreRows(primaryStores = [], fallbackStores = []) {
  const merged = [...primaryStores]
  const knownStores = new Set(primaryStores.map((store) => normalizeStoreLabel(store.store)))

  for (const store of fallbackStores) {
    const normalized = normalizeStoreLabel(store.store)
    if (knownStores.has(normalized)) continue
    knownStores.add(normalized)
    merged.push(store)
  }

  return merged
}

async function lookupGameId(title) {
  const request = withAuth(`${ITAD_BASE}/lookup/id/title/v1`)
  const payload = await fetchJson(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify([title])
  })
  return payload?.[title] || null
}

function mapDealEntry(entry) {
  if (!entry?.shop?.name) return null
  const amount = toAmount(entry.price)
  const regularAmount = toAmount(entry.regular)

  return {
    store: entry.shop.name,
    normalizedStore: normalizeStoreLabel(entry.shop.name),
    amount,
    regularAmount,
    currency: entry.price?.currency || entry.regular?.currency || null,
    currentPrice: formatMoney(entry.price),
    regularPrice: formatMoney(entry.regular),
    cut: typeof entry.cut === 'number' ? entry.cut : null,
    url: entry.url || null,
    isBestCurrent: false,
    isHistoricalLow: false,
    historicalLow: null,
    historicalLowCut: null,
    historicalLowAt: null,
    note: entry.voucher ? `Voucher: ${entry.voucher}` : null
  }
}

async function fetchOverview(id) {
  const request = withAuth(`${ITAD_BASE}/games/overview/v2?country=${COUNTRY_CODE}&vouchers=true`)
  const payload = await fetchJson(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify([id])
  })
  return Array.isArray(payload?.prices) ? payload.prices.find((item) => item.id === id) || payload.prices[0] : null
}

async function fetchDeals(id) {
  const request = withAuth(`${ITAD_BASE}/games/prices/v3?country=${COUNTRY_CODE}&vouchers=true&capacity=12`)
  const payload = await fetchJson(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify([id])
  })
  return Array.isArray(payload) ? payload.find((item) => item.id === id) || payload[0] : null
}

async function fetchHistoryLog(id) {
  const sinceValues = [
    new Date(Date.now() - (HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000)).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    new Date(Date.now() - (540 * 24 * 60 * 60 * 1000)).toISOString().replace(/\.\d{3}Z$/, 'Z')
  ]

  let lastError = null

  for (const since of sinceValues) {
    const candidate = `${ITAD_BASE}/games/history/v2?id=${encodeURIComponent(id)}&country=${COUNTRY_CODE}&since=${encodeURIComponent(since)}`

    try {
      const request = withAuth(candidate)
      const payload = await fetchJson(request.url, {
        headers: request.headers
      })

      if (Array.isArray(payload) && payload.length) {
        return payload
      }

      if (payload && !Array.isArray(payload)) {
        return payload
      }
    } catch (error) {
      lastError = error
    }
  }

  if (lastError) {
    throw lastError
  }

  return []
}

function matchConfiguredStore(configuredStore, liveDeal) {
  const configured = configuredStore.normalizedStore
  const live = liveDeal.normalizedStore

  if (configured === live) return true
  if (configured.includes('steam') && live.includes('steam')) return true
  if (configured.includes('epic') && live.includes('epic')) return true
  if (configured.includes('official')) return false
  return false
}

function mergeLiveIntoConfiguredStores(configuredStores, liveDeals, overview) {
  const stores = configuredStores.map((store) => ({ ...store }))

  stores.forEach((configuredStore) => {
    const liveDeal = liveDeals.find((deal) => matchConfiguredStore(configuredStore, deal))
    if (!liveDeal) return

    configuredStore.amount = liveDeal.amount
    configuredStore.regularAmount = liveDeal.regularAmount
    configuredStore.currency = liveDeal.currency
    configuredStore.currentPrice = liveDeal.currentPrice
    configuredStore.regularPrice = liveDeal.regularPrice
    configuredStore.cut = liveDeal.cut
    configuredStore.url = liveDeal.url || configuredStore.url
    configuredStore.note = liveDeal.note || null
  })

  const currentStoreName = normalizeStoreLabel(overview?.current?.shop?.name || '')
  const historicalStoreName = normalizeStoreLabel(overview?.lowest?.shop?.name || '')

  stores.forEach((store) => {
    if (store.normalizedStore === currentStoreName) {
      store.isBestCurrent = true
    }
    if (store.normalizedStore === historicalStoreName) {
      store.isHistoricalLow = true
      store.historicalLow = formatMoney(overview?.lowest?.price)
      store.historicalLowCut = typeof overview?.lowest?.cut === 'number' ? overview.lowest.cut : null
      store.historicalLowAt = overview?.lowest?.timestamp || null
    }
  })

  return stores
}

function buildLiveStoreRows(liveDeals, overview) {
  const currentStoreName = normalizeStoreLabel(overview?.current?.shop?.name || '')
  const historicalStoreName = normalizeStoreLabel(overview?.lowest?.shop?.name || '')

  return liveDeals.map((deal) => ({
    ...deal,
    isBestCurrent: deal.normalizedStore === currentStoreName,
    isHistoricalLow: deal.normalizedStore === historicalStoreName,
    historicalLow: deal.normalizedStore === historicalStoreName ? formatMoney(overview?.lowest?.price) : null,
    historicalLowCut: deal.normalizedStore === historicalStoreName && typeof overview?.lowest?.cut === 'number' ? overview.lowest.cut : null,
    historicalLowAt: deal.normalizedStore === historicalStoreName ? overview?.lowest?.timestamp || null : null
  }))
}

function pickBestDeal(stores) {
  const liveStores = stores.filter((store) => typeof store.amount === 'number')
  if (!liveStores.length) return null

  return liveStores.reduce((best, current) => {
    return current.amount < best.amount ? current : best
  })
}

function buildHistoryPayload(historyPoints, currency, source) {
  const points = compressHistory(historyPoints).map((point) => ({
    timestamp: point.timestamp,
    amount: point.amount,
    regularAmount: point.regularAmount,
    cut: point.cut,
    currency: point.currency || currency || null,
    store: point.store || null,
    label: point.store ? `${point.store} / ${point.amount}` : `${point.amount}`
  }))

  return {
    available: points.length >= 2,
    source,
    spanDays: points.length >= 2
      ? Math.max(1, Math.round((new Date(points[points.length - 1].timestamp) - new Date(points[0].timestamp)) / (1000 * 60 * 60 * 24)))
      : 0,
    points
  }
}

async function persistPriceSignals(slug, historyPoints, timing, currency) {
  if (!isDatabaseReady()) return

  try {
    const prisma = getPrisma()
    if (!prisma?.priceTimingSnapshot || !prisma?.priceHistoryEntry) return

    await prisma.$transaction([
      prisma.priceHistoryEntry.deleteMany({ where: { gameSlug: slug } }),
      ...(historyPoints.length
        ? [
            prisma.priceHistoryEntry.createMany({
              data: historyPoints.map((point) => ({
                gameSlug: slug,
                store: point.store || null,
                amount: point.amount,
                regularAmount: point.regularAmount ?? null,
                cut: point.cut ?? null,
                currency: point.currency || currency || null,
                recordedAt: new Date(point.timestamp),
                source: 'IsThereAnyDeal API'
              }))
            })
          ]
        : []),
      prisma.priceTimingSnapshot.upsert({
        where: { gameSlug: slug },
        update: {
          decision: timing.decision,
          confidence: timing.confidence,
          dropProbability: timing.dropProbability,
          expectedWindowDays: timing.forecastWindowDays ?? null,
          currentAmount: timing.stats.currentAmount ?? null,
          historicalLowAmount: timing.stats.historicalLowAmount ?? null,
          average30Amount: timing.stats.average30Amount ?? null,
          average90Amount: timing.stats.average90Amount ?? null,
          currency: currency || null,
          summary: timing.summary,
          reasons: timing.reasons,
          stats: timing.stats
        },
        create: {
          gameSlug: slug,
          decision: timing.decision,
          confidence: timing.confidence,
          dropProbability: timing.dropProbability,
          expectedWindowDays: timing.forecastWindowDays ?? null,
          currentAmount: timing.stats.currentAmount ?? null,
          historicalLowAmount: timing.stats.historicalLowAmount ?? null,
          average30Amount: timing.stats.average30Amount ?? null,
          average90Amount: timing.stats.average90Amount ?? null,
          currency: currency || null,
          summary: timing.summary,
          reasons: timing.reasons,
          stats: timing.stats
        }
      })
    ])
  } catch (_) {
    // Ignore schema/cache persistence issues and keep the live response working.
  }
}

async function readPersistedPriceSignals(slug) {
  if (!isDatabaseReady()) return null

  try {
    const prisma = getPrisma()
    if (!prisma?.priceTimingSnapshot || !prisma?.priceHistoryEntry) return null

    const [historyEntries, timingSnapshot] = await Promise.all([
      prisma.priceHistoryEntry.findMany({
        where: { gameSlug: slug },
        orderBy: { recordedAt: 'asc' }
      }),
      prisma.priceTimingSnapshot.findUnique({
        where: { gameSlug: slug }
      })
    ])

    if (!historyEntries.length && !timingSnapshot) return null

    const history = buildHistoryPayload(
      historyEntries.map((entry) => ({
        amount: entry.amount,
        regularAmount: entry.regularAmount,
        cut: entry.cut,
        currency: entry.currency,
        store: entry.store,
        timestamp: entry.recordedAt.toISOString()
      })),
      timingSnapshot?.currency || historyEntries[0]?.currency || null,
      'Cached PlayWise history'
    )

    return {
      history,
      timing: timingSnapshot
        ? {
            decision: timingSnapshot.decision,
            confidence: timingSnapshot.confidence,
            dropProbability: timingSnapshot.dropProbability,
            forecastWindowDays: timingSnapshot.expectedWindowDays,
            summary: timingSnapshot.summary,
            reasons: Array.isArray(timingSnapshot.reasons) ? timingSnapshot.reasons : [],
            stats: timingSnapshot.stats || {}
          }
        : null
    }
  } catch (_) {
    return null
  }
}

async function pullLiveSnapshot(slug, options = {}) {
  const meta = resolvePriceMeta(slug, options.title)
  if (!meta || !meta.paid) {
    return buildFallbackSnapshot(slug, meta)
  }

  const persisted = await readPersistedPriceSignals(slug)

  if (!ITAD_API_KEY) {
    const cheapShark = await getCheapSharkSnapshot(meta.title).catch(() => null)
    if (cheapShark) {
      const timing = buildTimingInsight({
        historyPoints: [],
        bestDeal: cheapShark.bestDeal,
        historicalLow: cheapShark.historicalLow
      })

      return {
        ...cheapShark,
        history: persisted?.history || cheapShark.history,
        timing: persisted?.timing || timing,
        message: persisted?.history
          ? 'Live ITAD refresh is off, so PlayWise is combining stored history with current CheapShark deals.'
          : `${cheapShark.message} Connect ITAD as well if you want the richer price-history graph and stronger timing predictions.`
      }
    }

    return buildFallbackSnapshot(slug, meta, persisted ? {
      history: persisted.history,
      timing: persisted.timing || buildFallbackSnapshot(slug, meta).timing,
      message: 'Live refresh is off, but PlayWise is showing the last stored price history signal.'
    } : {})
  }

  const gameId = await lookupGameId(meta.title)
  if (!gameId) {
    return buildFallbackSnapshot(slug, {
      message: 'Could not match this title in the live price provider yet.',
      ...(persisted ? { history: persisted.history, timing: persisted.timing } : {})
    })
  }

  const [overview, dealsPayload, historyPayload] = await Promise.all([
    fetchOverview(gameId),
    fetchDeals(gameId),
    fetchHistoryLog(gameId).catch(() => null)
  ])

  const liveDeals = (dealsPayload?.deals || [])
    .map(mapDealEntry)
    .filter(Boolean)

  const configuredStores = buildConfiguredStores(slug, meta)
  let stores = configuredStores.length
    ? mergeLiveIntoConfiguredStores(configuredStores, liveDeals, overview)
    : buildLiveStoreRows(liveDeals, overview)
  if (!stores.some((store) => store.currentPrice)) {
    const cheapShark = await getCheapSharkSnapshot(meta.title).catch(() => null)
    if (cheapShark?.stores?.length) {
      stores = mergeStoreRows(stores, cheapShark.stores)
    }
  }
  const bestDeal = pickBestDeal(stores)
  const historicalLow = overview?.lowest ? {
    store: overview.lowest.shop?.name || null,
    amount: toAmount(overview.lowest.price),
    currency: overview.lowest.price?.currency || null,
    price: formatMoney(overview.lowest.price),
    regularAmount: toAmount(overview.lowest.regular),
    regularPrice: formatMoney(overview.lowest.regular),
    cut: typeof overview.lowest.cut === 'number' ? overview.lowest.cut : null,
    timestamp: overview.lowest.timestamp || null
  } : null

  const normalizedHistory = historyPayload ? normalizeHistory(historyPayload, gameId) : []
  const currency = bestDeal?.currency || historicalLow?.currency || normalizedHistory[0]?.currency || null
  const history = normalizedHistory.length
    ? buildHistoryPayload(normalizedHistory, currency, 'IsThereAnyDeal API')
    : (persisted?.history || { available: false, points: [], source: 'No live history points yet', spanDays: 0 })
  const timing = buildTimingInsight({
    historyPoints: normalizedHistory.length
      ? normalizedHistory
      : ((persisted?.history?.points || []).map((point) => ({
          amount: point.amount,
          regularAmount: point.regularAmount,
          cut: point.cut,
          currency: point.currency,
          store: point.store,
          timestamp: point.timestamp
        }))),
    bestDeal,
    historicalLow
  })

  await persistPriceSignals(slug, normalizedHistory, timing, currency)

  const currentLiveCount = stores.filter((store) => store.currentPrice).length
  const message = currentLiveCount
    ? 'Live prices loaded for the tracked stores below. PlayWise also analyzed historical patterns to estimate timing.'
    : 'No tracked store returned a live current price just now. You can still use the store links and timing history below.'

  return {
    supported: true,
    live: currentLiveCount > 0,
    source: 'IsThereAnyDeal API',
    message,
    bestDeal: bestDeal ? {
      store: bestDeal.store,
      amount: bestDeal.amount,
      currency: bestDeal.currency || currency || null,
      currentPrice: bestDeal.currentPrice,
      regularAmount: bestDeal.regularAmount,
      regularPrice: bestDeal.regularPrice,
      cut: bestDeal.cut,
      url: bestDeal.url || null
    } : null,
    historicalLow,
    stores: stores.map(({ normalizedStore, ...rest }) => rest),
    history,
    timing,
    lastUpdated: new Date().toISOString(),
    titleMatched: meta.title,
    country: COUNTRY_CODE
  }
}

async function getPriceSnapshot(slug, { forceRefresh = false, title } = {}) {
  const cached = cache.get(slug)
  if (!forceRefresh && cached && (Date.now() - cached.cachedAt) < CACHE_TTL_MS) {
    return cached.data
  }

  try {
    const data = await pullLiveSnapshot(slug, { title })
    cache.set(slug, { cachedAt: Date.now(), data })
    return data
  } catch (error) {
    if (cached?.data) {
      return {
        ...cached.data,
        live: false,
        message: 'PlayWise could not refresh the latest prices, so the last known timing snapshot is shown instead.',
        error: error.message,
        lastUpdated: cached.data.lastUpdated
      }
    }

    const persisted = await readPersistedPriceSignals(slug)
    const meta = resolvePriceMeta(slug, title)
    const cheapShark = meta ? await getCheapSharkSnapshot(meta.title).catch(() => null) : null
    const fallback = cheapShark
      ? {
          ...cheapShark,
          history: persisted?.history || cheapShark.history,
          timing: persisted?.timing || buildTimingInsight({
            historyPoints: [],
            bestDeal: cheapShark.bestDeal,
            historicalLow: cheapShark.historicalLow
          }),
          message: 'PlayWise could not refresh the richer ITAD timeline right now, so current live deals are coming from CheapShark.'
        }
      : buildFallbackSnapshot(slug, meta, {
      message: 'Price tracker could not refresh right now. Store links are still available below.',
      error: error.message,
      ...(persisted ? {
        history: persisted.history,
        timing: persisted.timing || buildFallbackSnapshot(slug, meta).timing
      } : {})
    })
    cache.set(slug, { cachedAt: Date.now(), data: fallback })
    return fallback
  }
}

function startPriceRefreshLoop() {
  if (intervalStarted) return
  intervalStarted = true
  setInterval(() => {
    Object.keys(PRICE_CATALOG).forEach((slug) => {
      if (PRICE_CATALOG[slug]?.paid) {
        getPriceSnapshot(slug, { forceRefresh: true }).catch(() => {})
      }
    })
  }, CACHE_TTL_MS).unref()
}

module.exports = {
  getPriceSnapshot,
  startPriceRefreshLoop,
  PRICE_CATALOG
}
