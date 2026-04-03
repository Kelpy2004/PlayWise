const PRICE_CATALOG = require('../data/priceCatalog');

const CACHE_TTL_MS = Number(process.env.PRICE_CACHE_MS || 1000 * 60 * 60 * 6);
const COUNTRY_CODE = (process.env.ITAD_COUNTRY || 'IN').toUpperCase();
const ITAD_API_KEY = process.env.ITAD_API_KEY || '';
const ITAD_BASE = 'https://api.isthereanydeal.com';
const cache = new Map();
let intervalStarted = false;

function withAuth(url) {
  const finalUrl = new URL(url);
  if (ITAD_API_KEY) {
    finalUrl.searchParams.set('key', ITAD_API_KEY);
  }
  const headers = { 'Content-Type': 'application/json' };
  if (ITAD_API_KEY) {
    headers['X-API-Key'] = ITAD_API_KEY;
    headers.Authorization = `Bearer ${ITAD_API_KEY}`;
  }
  return { url: finalUrl.toString(), headers };
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new Error(message || `Request failed with status ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function formatMoney(price) {
  if (!price || typeof price.amount !== 'number') return null;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: price.currency || 'USD',
      maximumFractionDigits: 2
    }).format(price.amount);
  } catch (_) {
    return `${price.currency || 'USD'} ${price.amount}`;
  }
}

function normalizeStoreLabel(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function buildConfiguredStores(slug) {
  const meta = PRICE_CATALOG[slug];
  if (!meta?.stores?.length) return [];
  return meta.stores.map((store) => ({
    store: store.label,
    normalizedStore: normalizeStoreLabel(store.label),
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
  }));
}

function buildFallbackSnapshot(slug, extra = {}) {
  const meta = PRICE_CATALOG[slug];
  if (!meta || !meta.paid) {
    return {
      supported: false,
      live: false,
      message: 'Live price tracking is only shown for paid licensed games.',
      stores: [],
      lastUpdated: new Date().toISOString(),
      ...extra
    };
  }

  return {
    supported: true,
    live: false,
    message: 'Store links are ready. Add ITAD_API_KEY in backend/.env to pull live prices automatically.',
    source: 'Store links fallback',
    bestDeal: null,
    historicalLow: null,
    stores: buildConfiguredStores(slug),
    lastUpdated: new Date().toISOString(),
    ...extra
  };
}

async function lookupGameId(title) {
  const request = withAuth(`${ITAD_BASE}/lookup/id/title/v1`);
  const payload = await fetchJson(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify([title])
  });
  return payload?.[title] || null;
}

function mapDealEntry(entry) {
  if (!entry?.shop?.name) return null;
  return {
    store: entry.shop.name,
    normalizedStore: normalizeStoreLabel(entry.shop.name),
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
  };
}

async function fetchOverview(id) {
  const request = withAuth(`${ITAD_BASE}/games/overview/v2?country=${COUNTRY_CODE}&vouchers=true`);
  const payload = await fetchJson(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify([id])
  });
  return Array.isArray(payload?.prices) ? payload.prices.find((item) => item.id === id) || payload.prices[0] : null;
}

async function fetchDeals(id) {
  const request = withAuth(`${ITAD_BASE}/games/prices/v3?country=${COUNTRY_CODE}&vouchers=true&capacity=12`);
  const payload = await fetchJson(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify([id])
  });
  return Array.isArray(payload) ? payload.find((item) => item.id === id) || payload[0] : null;
}

function matchConfiguredStore(configuredStore, liveDeal) {
  const configured = configuredStore.normalizedStore;
  const live = liveDeal.normalizedStore;

  if (configured === live) return true;
  if (configured.includes('steam') && live.includes('steam')) return true;
  if (configured.includes('epic') && live.includes('epic')) return true;
  if (configured.includes('official')) return false;
  return false;
}

function mergeLiveIntoConfiguredStores(configuredStores, liveDeals, overview) {
  const stores = configuredStores.map((store) => ({ ...store }));

  stores.forEach((configuredStore) => {
    const liveDeal = liveDeals.find((deal) => matchConfiguredStore(configuredStore, deal));
    if (!liveDeal) return;

    configuredStore.currentPrice = liveDeal.currentPrice;
    configuredStore.regularPrice = liveDeal.regularPrice;
    configuredStore.cut = liveDeal.cut;
    configuredStore.url = liveDeal.url || configuredStore.url;
    configuredStore.note = liveDeal.note || null;
  });

  const currentStoreName = normalizeStoreLabel(overview?.current?.shop?.name || '');
  const historicalStoreName = normalizeStoreLabel(overview?.lowest?.shop?.name || '');

  stores.forEach((store) => {
    if (store.normalizedStore === currentStoreName) {
      store.isBestCurrent = true;
    }
    if (store.normalizedStore === historicalStoreName) {
      store.isHistoricalLow = true;
      store.historicalLow = formatMoney(overview?.lowest?.price);
      store.historicalLowCut = typeof overview?.lowest?.cut === 'number' ? overview.lowest.cut : null;
      store.historicalLowAt = overview?.lowest?.timestamp || null;
    }
  });

  return stores;
}

function pickBestDeal(stores) {
  const liveStores = stores.filter((store) => store.currentPrice);
  if (!liveStores.length) return null;

  const parseAmount = (value) => Number(String(value).replace(/[^0-9.]/g, ''));
  return liveStores.reduce((best, current) => {
    const bestAmount = parseAmount(best.currentPrice);
    const currentAmount = parseAmount(current.currentPrice);
    return currentAmount < bestAmount ? current : best;
  });
}

async function pullLiveSnapshot(slug) {
  const meta = PRICE_CATALOG[slug];
  if (!meta || !meta.paid) {
    return buildFallbackSnapshot(slug);
  }
  if (!ITAD_API_KEY) {
    return buildFallbackSnapshot(slug);
  }

  const gameId = await lookupGameId(meta.title);
  if (!gameId) {
    return buildFallbackSnapshot(slug, { message: 'Could not match this title in the live price provider yet.' });
  }

  const [overview, dealsPayload] = await Promise.all([
    fetchOverview(gameId),
    fetchDeals(gameId)
  ]);

  const liveDeals = (dealsPayload?.deals || [])
    .map(mapDealEntry)
    .filter(Boolean);

  const stores = mergeLiveIntoConfiguredStores(buildConfiguredStores(slug), liveDeals, overview);
  const bestDeal = pickBestDeal(stores);
  const historicalLow = overview?.lowest ? {
    store: overview.lowest.shop?.name || null,
    price: formatMoney(overview.lowest.price),
    regularPrice: formatMoney(overview.lowest.regular),
    cut: typeof overview.lowest.cut === 'number' ? overview.lowest.cut : null,
    timestamp: overview.lowest.timestamp || null
  } : null;

  const currentLiveCount = stores.filter((store) => store.currentPrice).length;
  const message = currentLiveCount
    ? 'Live prices loaded for the tracked stores below. Unpriced rows still link directly to the store.'
    : 'No tracked store returned a live current price just now. You can still use the store links below.';

  return {
    supported: true,
    live: currentLiveCount > 0,
    source: 'IsThereAnyDeal API',
    message,
    bestDeal: bestDeal ? {
      store: bestDeal.store,
      currentPrice: bestDeal.currentPrice,
      regularPrice: bestDeal.regularPrice,
      cut: bestDeal.cut,
      url: bestDeal.url || null
    } : null,
    historicalLow,
    stores: stores.map(({ normalizedStore, ...rest }) => rest),
    lastUpdated: new Date().toISOString(),
    titleMatched: meta.title,
    country: COUNTRY_CODE
  };
}

async function getPriceSnapshot(slug, { forceRefresh = false } = {}) {
  const cached = cache.get(slug);
  if (!forceRefresh && cached && (Date.now() - cached.cachedAt) < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const data = await pullLiveSnapshot(slug);
    cache.set(slug, { cachedAt: Date.now(), data });
    return data;
  } catch (error) {
    const fallback = buildFallbackSnapshot(slug, {
      message: 'Price tracker could not refresh right now. Store links are still available below.',
      error: error.message
    });
    cache.set(slug, { cachedAt: Date.now(), data: fallback });
    return fallback;
  }
}

function startPriceRefreshLoop() {
  if (intervalStarted) return;
  intervalStarted = true;
  setInterval(() => {
    Object.keys(PRICE_CATALOG).forEach((slug) => {
      if (PRICE_CATALOG[slug]?.paid) {
        getPriceSnapshot(slug, { forceRefresh: true }).catch(() => {});
      }
    });
  }, CACHE_TTL_MS).unref();
}

module.exports = {
  getPriceSnapshot,
  startPriceRefreshLoop,
  PRICE_CATALOG
};
