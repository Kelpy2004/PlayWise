const request = require('supertest')
const { createTestApp, mountRoutes } = require('./helpers/setup')

const MOCK_GAMES = [
  {
    slug: 'test-game-alpha',
    title: 'Test Game Alpha',
    genres: ['RPG', 'Adventure'],
    catalogBuckets: ['top-rated'],
    platform: ['PC'],
    supportedPlatforms: ['PC'],
    heroTag: 'An epic RPG',
    description: 'A test game for vitest',
    steamAppId: '12345'
  },
  {
    slug: 'test-game-beta',
    title: 'Assassin Quest Beta',
    genres: ['FPS', 'Action'],
    catalogBuckets: ['new-release'],
    platform: ['PC', 'Xbox'],
    supportedPlatforms: ['PC', 'Xbox'],
    heroTag: 'A shooter',
    description: 'Another test game',
    steamAppId: '67890'
  }
]

const gameCatalog = require('../utils/gameCatalog')
const originalLoadGames = gameCatalog.loadGames
gameCatalog.loadGames = async () => MOCK_GAMES

let app

beforeAll(() => {
  app = createTestApp()
  const gameRoutes = require('../routes/games')
  mountRoutes(app, { '/api/games': gameRoutes })
})

afterAll(() => {
  gameCatalog.loadGames = originalLoadGames
})

describe('GET /api/games', () => {
  it('returns an array of games', async () => {
    const res = await request(app).get('/api/games')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBe(2)
  })

  it('sets cache-control headers', async () => {
    const res = await request(app).get('/api/games')

    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toMatch(/max-age/)
  })

  it('supports search query parameter', async () => {
    const res = await request(app).get('/api/games?q=assassin')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBe(1)
    expect(res.body[0].slug).toBe('test-game-beta')
  })

  it('supports section filter', async () => {
    const res = await request(app).get('/api/games?section=top')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBe(1)
    expect(res.body[0].slug).toBe('test-game-alpha')
  })

  it('supports platform filter', async () => {
    const res = await request(app).get('/api/games?platform=xbox')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBe(1)
    expect(res.body[0].slug).toBe('test-game-beta')
  })
})

describe('GET /api/games/:slug', () => {
  it('returns a game when slug exists', async () => {
    const res = await request(app).get('/api/games/test-game-alpha')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('slug', 'test-game-alpha')
    expect(res.body).toHaveProperty('title', 'Test Game Alpha')
  })

  it('returns 404 for non-existent slug', async () => {
    const res = await request(app).get('/api/games/this-game-does-not-exist-xyz')
    expect(res.status).toBe(404)
  })
})

describe('GET /api/games/:slug/prices', () => {
  it('returns a price snapshot structure', async () => {
    const res = await request(app).get('/api/games/test-game-alpha/prices')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('supported')
    expect(res.body).toHaveProperty('message')
    expect(typeof res.body.supported).toBe('boolean')
  })
})

describe('GET /api/games/:slug/reactions', () => {
  it('returns reaction summary without auth', async () => {
    const res = await request(app).get('/api/games/test-game-alpha/reactions')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('gameSlug')
    expect(res.body).toHaveProperty('likeCount')
    expect(res.body).toHaveProperty('dislikeCount')
    expect(typeof res.body.likeCount).toBe('number')
    expect(typeof res.body.dislikeCount).toBe('number')
  })
})

describe('game record shape', () => {
  it('every game has required fields', async () => {
    const res = await request(app).get('/api/games')

    for (const game of res.body) {
      expect(game).toHaveProperty('slug')
      expect(game).toHaveProperty('title')
      expect(typeof game.slug).toBe('string')
      expect(typeof game.title).toBe('string')
    }
  })
})
