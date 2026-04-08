const STORES_URL = 'https://www.cheapshark.com/api/1.0/stores'
const SEARCH_URL = 'https://www.cheapshark.com/api/1.0/games'

let storesCache = { expiresAt: 0, stores: new Map() }

function toAmount(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatUsd(value) {
  const amount = toAmount(value)
  if (amount == null) return null

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(amount)
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  })

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText)
    throw new Error(message || `Request failed with status ${response.status}`)
  }

  return response.json()
}

async function getStoresMap() {
  if (storesCache.expiresAt > Date.now() && storesCache.stores.size) {
    return storesCache.stores
  }

  const payload = await fetchJson(STORES_URL)
  const map = new Map(
    Array.isArray(payload)
      ? payload.map((store) => [String(store.storeID), store])
      : []
  )

  storesCache = {
    expiresAt: Date.now() + (1000 * 60 * 60 * 12),
    stores: map
  }

  return map
}

async function findGame(title) {
  if (!title) return null
  const query = new URL(SEARCH_URL)
  query.searchParams.set('title', title)
  query.searchParams.set('limit', '1')
  query.searchParams.set('exact', '0')

  const payload = await fetchJson(query.toString())
  return Array.isArray(payload) && payload[0] ? payload[0] : null
}

async function getGameDeals(gameId) {
  if (!gameId) return null
  const query = new URL(SEARCH_URL)
  query.searchParams.set('id', String(gameId))
  return fetchJson(query.toString())
}

async function getCheapSharkSnapshot(title) {
  const match = await findGame(title)
  if (!match?.gameID) return null

  const [details, storesMap] = await Promise.all([getGameDeals(match.gameID), getStoresMap()])
  const deals = Array.isArray(details?.deals) ? details.deals : []

  const stores = deals
    .map((deal) => {
      const store = storesMap.get(String(deal.storeID))
      const amount = toAmount(deal.price)
      const regularAmount = toAmount(deal.retailPrice)

      return {
        store: store?.storeName || `Store ${deal.storeID}`,
        amount,
        regularAmount,
        currency: 'USD',
        currentPrice: formatUsd(deal.price),
        regularPrice: formatUsd(deal.retailPrice),
        cut: typeof deal.savings !== 'undefined' ? Math.round(Number(deal.savings)) : null,
        url: deal.dealID ? `https://www.cheapshark.com/redirect?dealID=${encodeURIComponent(deal.dealID)}` : null,
        note: 'Live deal via CheapShark fallback'
      }
    })
    .filter((deal) => deal.amount != null)
    .sort((left, right) => left.amount - right.amount)

  const bestDeal = stores[0] || null
  const cheapestEverAmount = toAmount(details?.cheapestPriceEver?.price)

  return {
    supported: true,
    live: Boolean(bestDeal),
    source: 'CheapShark API',
    message: bestDeal
      ? 'PlayWise pulled the live deal list from CheapShark as a fallback price source.'
      : 'CheapShark matched this title, but there were no current live deals in the response.',
    bestDeal,
    historicalLow: cheapestEverAmount != null
      ? {
          store: 'CheapShark network',
          amount: cheapestEverAmount,
          currency: 'USD',
          price: formatUsd(cheapestEverAmount),
          regularAmount: null,
          regularPrice: null,
          cut: null,
          timestamp: details?.cheapestPriceEver?.date || null
        }
      : null,
    stores,
    history: {
      available: false,
      source: 'CheapShark current-deal feed',
      spanDays: 0,
      points: []
    }
  }
}

module.exports = {
  getCheapSharkSnapshot
}
