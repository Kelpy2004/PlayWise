const HISTORY_POINT_LIMIT = Number(process.env.PRICE_HISTORY_POINT_LIMIT || 36)

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function toAmount(value) {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'object') {
    if (typeof value.amount === 'number') return value.amount
    if (typeof value.amountInt === 'number') return value.amountInt / 100
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeTimestamp(value) {
  if (!value) return null
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) return null
  return timestamp.toISOString()
}

function differenceInDays(a, b) {
  const first = new Date(a)
  const second = new Date(b)
  if (Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) return null
  return Math.max(0, Math.round((first.getTime() - second.getTime()) / (1000 * 60 * 60 * 24)))
}

function average(values) {
  if (!values.length) return null
  return values.reduce((total, value) => total + value, 0) / values.length
}

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }
  return sorted[middle]
}

function buildHistoryPoint(entry) {
  const amount = toAmount(entry?.deal?.price || entry?.price || entry?.currentPrice || entry?.amount)
  const regularAmount = toAmount(entry?.deal?.regular || entry?.regular || entry?.regularPrice)
  const timestamp = normalizeTimestamp(entry?.timestamp || entry?.changedAt || entry?.date || entry?.at)

  if (amount == null || !timestamp) return null

  const cut = typeof entry?.deal?.cut === 'number'
    ? entry.deal.cut
    : typeof entry?.cut === 'number'
      ? entry.cut
    : regularAmount && regularAmount > amount
      ? Math.round(((regularAmount - amount) / regularAmount) * 100)
      : null

  const currency = entry?.deal?.price?.currency || entry?.price?.currency || entry?.regular?.currency || entry?.currency || null
  const store = entry?.shop?.name || entry?.store?.name || entry?.store || null

  return {
    amount,
    regularAmount,
    cut,
    currency,
    store,
    timestamp
  }
}

function extractHistoryEntries(payload, id) {
  if (!payload) return []

  if (Array.isArray(payload)) {
    const directPoints = payload.map(buildHistoryPoint).filter(Boolean)
    if (directPoints.length) return directPoints

    const matchingRecord = payload.find((entry) => entry?.id === id)
    if (matchingRecord) {
      return extractHistoryEntries(
        matchingRecord.history
        || matchingRecord.prices
        || matchingRecord.log
        || matchingRecord.data,
        id
      )
    }

    for (const entry of payload) {
      const nested = extractHistoryEntries(entry, id)
      if (nested.length) return nested
    }

    return []
  }

  if (typeof payload === 'object') {
    return extractHistoryEntries(
      payload.history
      || payload.prices
      || payload.log
      || payload.data
      || payload.entries,
      id
    )
  }

  return []
}

function compressHistory(points, maxPoints = HISTORY_POINT_LIMIT) {
  if (points.length <= maxPoints) return points

  const result = [points[0]]
  const usable = maxPoints - 2
  const step = (points.length - 2) / usable

  for (let index = 0; index < usable; index += 1) {
    const targetIndex = 1 + Math.round(index * step)
    const point = points[Math.min(points.length - 2, targetIndex)]
    if (point && point !== result[result.length - 1]) {
      result.push(point)
    }
  }

  result.push(points[points.length - 1])
  return result
}

function normalizeHistory(payload, id) {
  const rawPoints = extractHistoryEntries(payload, id)
  const unique = new Map()

  rawPoints.forEach((point) => {
    const key = `${point.timestamp}:${point.store || 'unknown'}:${point.amount}`
    unique.set(key, point)
  })

  return [...unique.values()].sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp))
}

function getRecentPoints(points, days) {
  if (!points.length) return []
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000)
  return points.filter((point) => new Date(point.timestamp).getTime() >= cutoff)
}

function detectSaleEvents(points) {
  const events = []

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    const dropRatio = previous.amount > 0 ? (previous.amount - current.amount) / previous.amount : 0
    const hasMeaningfulCut = (current.cut || 0) >= 20

    if (dropRatio >= 0.12 || hasMeaningfulCut) {
      const previousEvent = events[events.length - 1]
      const daysSincePrevious = previousEvent ? differenceInDays(current.timestamp, previousEvent.timestamp) : null
      if (daysSincePrevious == null || daysSincePrevious >= 5) {
        events.push(current)
      }
    }
  }

  return events
}

function buildFallbackTiming(bestDeal, historicalLow) {
  const currentAmount = bestDeal?.amount ?? null
  const lowAmount = historicalLow?.amount ?? null

  if (currentAmount == null || lowAmount == null) {
    return {
      decision: 'WATCH_CLOSELY',
      confidence: 0.44,
      dropProbability: 0.5,
      forecastWindowDays: null,
      summary: 'PlayWise does not have enough history yet to call the timing with confidence.',
      reasons: [
        'Only the current price signal is available right now.',
        'Connect live price history so the timing model can look for sale cycles and rebound patterns.'
      ],
      stats: {
        currentAmount,
        historicalLowAmount: lowAmount,
        currentVsLowPct: null,
        saleCycleDays: null,
        daysSinceLastSale: null,
        recentTrendPct: null,
        volatility: null
      }
    }
  }

  const currentVsLowPct = ((currentAmount - lowAmount) / Math.max(lowAmount, 0.01)) * 100
  const buyNow = currentVsLowPct <= 10

  return {
    decision: buyNow ? 'BUY_NOW' : 'WATCH_CLOSELY',
    confidence: buyNow ? 0.72 : 0.52,
    dropProbability: buyNow ? 0.18 : 0.58,
    forecastWindowDays: null,
    summary: buyNow
      ? 'The current deal is already very close to the historical floor, so waiting may not unlock much extra value.'
      : 'The current price is noticeably above the historical floor, but PlayWise needs more history before predicting the next drop window.',
    reasons: [
      buyNow
        ? 'Current price is within roughly ten percent of the best recorded low.'
        : 'Current price is still materially above the historical low.',
      'Sale-cycle timing is unavailable until more historical price points are collected.'
    ],
    stats: {
      currentAmount,
      historicalLowAmount: lowAmount,
      currentVsLowPct,
      saleCycleDays: null,
      daysSinceLastSale: null,
      recentTrendPct: null,
      volatility: null
    }
  }
}

function buildTimingInsight({ historyPoints = [], bestDeal = null, historicalLow = null } = {}) {
  if (!historyPoints.length) {
    return buildFallbackTiming(bestDeal, historicalLow)
  }

  const latestPoint = historyPoints[historyPoints.length - 1]
  const currentAmount = bestDeal?.amount ?? latestPoint.amount
  const lowAmount = historicalLow?.amount ?? Math.min(...historyPoints.map((point) => point.amount))
  const currentVsLowPct = lowAmount
    ? ((currentAmount - lowAmount) / Math.max(lowAmount, 0.01)) * 100
    : null

  const last30Points = getRecentPoints(historyPoints, 30)
  const last90Points = getRecentPoints(historyPoints, 90)
  const average30 = average(last30Points.map((point) => point.amount))
  const average90 = average(last90Points.map((point) => point.amount))
  const recentAnchor = last30Points[0] || historyPoints[Math.max(0, historyPoints.length - 4)]
  const recentTrendPct = recentAnchor?.amount
    ? ((currentAmount - recentAnchor.amount) / Math.max(recentAnchor.amount, 0.01)) * 100
    : null

  const dispersionBase = average90 || average30 || currentAmount || 1
  const volatility = last90Points.length > 2
    ? Math.sqrt(
        last90Points.reduce((total, point) => total + ((point.amount - dispersionBase) ** 2), 0) / last90Points.length
      ) / Math.max(dispersionBase, 0.01)
    : 0

  const saleEvents = detectSaleEvents(historyPoints)
  const saleGaps = saleEvents.slice(1).map((event, index) => differenceInDays(event.timestamp, saleEvents[index].timestamp)).filter(Boolean)
  const saleCycleDays = median(saleGaps)
  const daysSinceLastSale = saleEvents.length ? differenceInDays(new Date().toISOString(), saleEvents[saleEvents.length - 1].timestamp) : null

  let dropProbability = 0.34

  if (currentVsLowPct != null) {
    if (currentVsLowPct >= 35) dropProbability += 0.24
    else if (currentVsLowPct >= 20) dropProbability += 0.14
    else if (currentVsLowPct <= 10) dropProbability -= 0.2
  }

  if (saleCycleDays && daysSinceLastSale != null) {
    const cycleRatio = daysSinceLastSale / Math.max(saleCycleDays, 1)
    if (cycleRatio >= 0.85 && cycleRatio <= 1.35) dropProbability += 0.18
    else if (cycleRatio < 0.45) dropProbability -= 0.08
    else if (cycleRatio > 1.35) dropProbability += 0.1
  }

  if ((bestDeal?.cut || 0) >= 45) dropProbability -= 0.16
  if ((bestDeal?.cut || 0) < 15) dropProbability += 0.08
  if ((recentTrendPct || 0) > 8) dropProbability += 0.1
  if ((recentTrendPct || 0) < -8) dropProbability -= 0.08
  dropProbability = clamp(dropProbability, 0.08, 0.92)

  let decision = 'WATCH_CLOSELY'
  if ((currentVsLowPct != null && currentVsLowPct <= 8) || ((bestDeal?.cut || 0) >= 50 && (currentVsLowPct || 999) <= 15)) {
    decision = 'BUY_NOW'
  } else if (dropProbability >= 0.68) {
    decision = 'WAIT_FOR_DROP'
  } else if (currentVsLowPct != null && currentVsLowPct <= 18) {
    decision = 'FAIR_PRICE'
  }

  let forecastWindowDays = null
  if (saleCycleDays && daysSinceLastSale != null) {
    const remaining = Math.round(saleCycleDays - daysSinceLastSale)
    forecastWindowDays = remaining > 0 ? remaining : Math.max(7, Math.round(saleCycleDays * 0.35))
  } else if (decision === 'WAIT_FOR_DROP') {
    forecastWindowDays = 21
  }

  const reasons = []
  if (currentVsLowPct != null) {
    reasons.push(
      currentVsLowPct <= 10
        ? `Current deal is only ${Math.round(currentVsLowPct)}% above the best recorded low.`
        : `Current deal sits about ${Math.round(currentVsLowPct)}% above the best recorded low.`
    )
  }

  if (saleCycleDays) {
    reasons.push(`This title tends to cycle into a fresh discount roughly every ${Math.round(saleCycleDays)} days.`)
  }

  if (daysSinceLastSale != null) {
    reasons.push(`It has been about ${daysSinceLastSale} days since the last meaningful price drop.`)
  }

  if (recentTrendPct != null) {
    reasons.push(
      recentTrendPct > 5
        ? 'The recent price trend is moving upward, which usually raises the odds of another future dip.'
        : recentTrendPct < -5
          ? 'The recent trend is already moving downward, so the current price may still be softening.'
          : 'The recent price trend is relatively flat, so timing depends more on the normal sale cycle.'
    )
  }

  if (volatility >= 0.18) {
    reasons.push('This price history is fairly volatile, so sharp discount windows are common.')
  } else {
    reasons.push('This price history is fairly stable, so deep surprise drops are less common.')
  }

  let summary = 'PlayWise timing model needs a bit more signal before calling this a great buy or an obvious wait.'
  if (decision === 'BUY_NOW') {
    summary = 'PlayWise timing model says the current deal is already in the sweet spot, so buying now looks justified.'
  } else if (decision === 'WAIT_FOR_DROP') {
    summary = forecastWindowDays
      ? `PlayWise timing model expects a better deal window within roughly the next ${forecastWindowDays} days.`
      : 'PlayWise timing model thinks this title is more likely to dip again than reward an immediate purchase.'
  } else if (decision === 'FAIR_PRICE') {
    summary = 'This is not a rock-bottom deal, but the current price is close enough to the usual sale band that buying now is reasonable.'
  }

  const confidence = clamp(
    0.58
      + Math.min(historyPoints.length, 24) / 120
      + (saleCycleDays ? 0.08 : 0)
      + (currentVsLowPct != null ? 0.06 : 0)
      + Math.min(volatility, 0.2) / 5,
    0.52,
    0.94
  )

  return {
    decision,
    confidence,
    dropProbability,
    forecastWindowDays,
    summary,
    reasons: reasons.slice(0, 4),
    stats: {
      currentAmount,
      historicalLowAmount: lowAmount,
      average30Amount: average30,
      average90Amount: average90,
      currentVsLowPct,
      saleCycleDays,
      daysSinceLastSale,
      recentTrendPct,
      volatility
    }
  }
}

module.exports = {
  buildTimingInsight,
  compressHistory,
  normalizeHistory
}
