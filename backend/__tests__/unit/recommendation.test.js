const { buildRecommendation } = require('../../utils/recommendationEngine')

describe('buildRecommendation', () => {
  const baseGame = {
    title: 'Test Game',
    slug: 'test-game',
    genres: ['RPG'],
    structuredRatings: { ign: 9.0, metacritic: 8.5 },
    valueRating: { score: 8.8 },
    similarGames: ['fallback-game'],
    bugStatus: { label: 'Stable' }
  }

  it('returns all required fields', async () => {
    const result = await buildRecommendation(baseGame)

    expect(result).toHaveProperty('decision')
    expect(result).toHaveProperty('confidence')
    expect(result).toHaveProperty('summary')
    expect(result).toHaveProperty('reasons')
    expect(result).toHaveProperty('alternativeSlug')
    expect(typeof result.confidence).toBe('number')
    expect(Array.isArray(result.reasons)).toBe(true)
    expect(result.reasons.length).toBeGreaterThan(0)
    expect(result.reasons.length).toBeLessThanOrEqual(5)
  })

  it('confidence is between 0 and 1', async () => {
    const result = await buildRecommendation(baseGame)
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  it('recommends BUY_NOW for high-rated games', async () => {
    const highRated = {
      ...baseGame,
      structuredRatings: { ign: 9.5, metacritic: 9.0 },
      valueRating: { score: 9.0 }
    }
    const result = await buildRecommendation(highRated)
    expect(result.decision).toBe('BUY_NOW')
  })

  it('returns WAIT_FOR_SALE by default for average games', async () => {
    const avgGame = {
      ...baseGame,
      structuredRatings: { ign: 6.0 },
      valueRating: { score: 6.0 }
    }
    const result = await buildRecommendation(avgGame)
    expect(result.decision).toBe('WAIT_FOR_SALE')
  })

  it('respects price timing BUY_NOW signal', async () => {
    const timing = {
      decision: 'BUY_NOW',
      confidence: 0.92,
      summary: 'Best price in months.'
    }
    const result = await buildRecommendation(baseGame, {
      priceSnapshot: { timing }
    })
    expect(result.decision).toBe('BUY_NOW')
    expect(result.confidence).toBeGreaterThanOrEqual(0.86)
  })

  it('respects price timing WAIT_FOR_DROP signal', async () => {
    const avgGame = {
      ...baseGame,
      structuredRatings: { ign: 6.0 },
      valueRating: { score: 6.0 }
    }
    const timing = {
      decision: 'WAIT_FOR_DROP',
      confidence: 0.85,
      forecastWindowDays: 14,
      summary: 'A drop is likely.'
    }
    const result = await buildRecommendation(avgGame, {
      priceSnapshot: { timing }
    })
    expect(result.decision).toBe('WAIT_FOR_SALE')
  })

  it('recommends BUY_NOW when significant live discount exists', async () => {
    const result = await buildRecommendation(baseGame, {
      priceSnapshot: {
        bestDeal: { cut: 50, currentPrice: '$9.99', store: 'Steam' },
        live: true
      }
    })
    expect(result.decision).toBe('BUY_NOW')
  })

  it('provides alternative slug from game data', async () => {
    const result = await buildRecommendation(baseGame)
    expect(result.alternativeSlug).toBe('fallback-game')
  })

  it('handles game with no ratings gracefully', async () => {
    const noRatings = { title: 'Unknown', slug: 'unknown', genres: [] }
    const result = await buildRecommendation(noRatings)

    expect(result).toHaveProperty('decision')
    expect(result).toHaveProperty('confidence')
    expect(result.decision).toBe('WAIT_FOR_SALE')
  })

  it('notes stable bug status positively', async () => {
    const result = await buildRecommendation(baseGame)
    const hasStabilityNote = result.reasons.some(
      (r) => r.toLowerCase().includes('stability') || r.toLowerCase().includes('stable')
    )
    expect(hasStabilityNote).toBe(true)
  })
})
