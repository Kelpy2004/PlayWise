function dealQualityScore(deal) {
  let score = 0
  if (deal.type === 'FREE_GAME') score += 50
  if (deal.discountPct) score += deal.discountPct / 2
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

describe('dealQualityScore', () => {
  it('scores free games highest', () => {
    const free = { type: 'FREE_GAME', discountPct: 100, source: 'steam' }
    const discount = { type: 'DISCOUNT', discountPct: 80, source: 'steam' }
    expect(dealQualityScore(free)).toBeGreaterThan(dealQualityScore(discount))
  })

  it('boosts admin-curated deals by 10', () => {
    const admin = { type: 'DISCOUNT', discountPct: 50, source: 'admin' }
    const auto = { type: 'DISCOUNT', discountPct: 50, source: 'steam' }
    expect(dealQualityScore(admin) - dealQualityScore(auto)).toBe(10)
  })

  it('scores higher discount higher', () => {
    const high = { type: 'DISCOUNT', discountPct: 90, source: 'epic' }
    const low = { type: 'DISCOUNT', discountPct: 30, source: 'epic' }
    expect(dealQualityScore(high)).toBeGreaterThan(dealQualityScore(low))
  })

  it('handles missing fields without crashing', () => {
    expect(dealQualityScore({})).toBe(0)
    expect(dealQualityScore({ type: null })).toBe(0)
  })
})

describe('dedupeDeals', () => {
  it('removes duplicate external IDs', () => {
    const deals = [
      { externalId: 'steam-1', title: 'Game A', store: 'Steam', type: 'DISCOUNT', discountPct: 50 },
      { externalId: 'steam-1', title: 'Game A', store: 'Steam', type: 'DISCOUNT', discountPct: 50 }
    ]
    expect(dedupeDeals(deals)).toHaveLength(1)
  })

  it('removes same title+store even with different IDs', () => {
    const deals = [
      { externalId: 'steam-1', title: 'The Witcher 3', store: 'Steam', type: 'DISCOUNT', discountPct: 50 },
      { externalId: 'steam-2', title: 'The Witcher 3', store: 'Steam', type: 'DISCOUNT', discountPct: 60 }
    ]
    expect(dedupeDeals(deals)).toHaveLength(1)
  })

  it('keeps same title on different stores', () => {
    const deals = [
      { externalId: 'steam-1', title: 'Cyberpunk', store: 'Steam', type: 'DISCOUNT', discountPct: 50 },
      { externalId: 'epic-1', title: 'Cyberpunk', store: 'Epic Games Store', type: 'DISCOUNT', discountPct: 60 }
    ]
    expect(dedupeDeals(deals)).toHaveLength(2)
  })

  it('sorts by quality score descending', () => {
    const deals = [
      { externalId: 'a', title: 'Low', store: 'Steam', type: 'DISCOUNT', discountPct: 20 },
      { externalId: 'b', title: 'High', store: 'Steam', type: 'FREE_GAME', discountPct: 100 }
    ]
    const result = dedupeDeals(deals)
    expect(result[0].title).toBe('High')
    expect(result[1].title).toBe('Low')
  })

  it('handles empty array', () => {
    expect(dedupeDeals([])).toHaveLength(0)
  })

  it('filters out deals without externalId', () => {
    const deals = [
      { externalId: '', title: 'No ID', store: 'Steam', type: 'DISCOUNT' },
      { externalId: 'valid-1', title: 'Valid', store: 'Steam', type: 'DISCOUNT', discountPct: 30 }
    ]
    expect(dedupeDeals(deals)).toHaveLength(1)
    expect(dedupeDeals(deals)[0].title).toBe('Valid')
  })

  it('handles title normalization edge cases', () => {
    const deals = [
      { externalId: 'a', title: "Assassin's Creed", store: 'Steam', type: 'DISCOUNT', discountPct: 50 },
      { externalId: 'b', title: 'assassins creed', store: 'Steam', type: 'DISCOUNT', discountPct: 60 }
    ]
    expect(dedupeDeals(deals)).toHaveLength(1)
  })
})
