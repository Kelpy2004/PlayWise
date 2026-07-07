const request = require('supertest')
const { createTestApp, mountRoutes } = require('./helpers/setup')

let app

beforeAll(() => {
  app = createTestApp()
  const dealRoutes = require('../routes/deals')
  mountRoutes(app, { '/api/deals': dealRoutes })
})

describe('GET /api/deals', () => {
  it('returns a deals list with correct shape', async () => {
    const res = await request(app).get('/api/deals')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('ok', true)
    expect(res.body).toHaveProperty('count')
    expect(Array.isArray(res.body.deals)).toBe(true)
    expect(typeof res.body.count).toBe('number')
  })

  it('filters by type parameter', async () => {
    const res = await request(app).get('/api/deals?type=FREE_GAME')

    expect(res.status).toBe(200)
    for (const deal of res.body.deals) {
      expect(deal.type).toBe('FREE_GAME')
    }
  })

  it('filters by freeOnly parameter', async () => {
    const res = await request(app).get('/api/deals?freeOnly=true')

    expect(res.status).toBe(200)
    for (const deal of res.body.deals) {
      const isFree = deal.type === 'FREE_GAME' || deal.dealPrice === 0
      expect(isFree).toBe(true)
    }
  })
})

describe('GET /api/deals/free', () => {
  it('returns only free game deals', async () => {
    const res = await request(app).get('/api/deals/free')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('ok', true)
    expect(Array.isArray(res.body.deals)).toBe(true)
  })
})

describe('GET /api/deals/news', () => {
  it('requires appIds parameter', async () => {
    const res = await request(app).get('/api/deals/news')
    expect(res.status).toBe(400)
  })

  it('accepts comma-separated appIds', async () => {
    const res = await request(app).get('/api/deals/news?appIds=730')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('ok', true)
    expect(Array.isArray(res.body.news)).toBe(true)
  })
})

describe('POST /api/deals/subscribe', () => {
  it('rejects an empty body with 400 (a valid email is required)', async () => {
    const res = await request(app)
      .post('/api/deals/subscribe')
      .send({})

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('ok', false)
  })

  it('allows a guest to subscribe with a valid email (201 created)', async () => {
    const res = await request(app)
      .post('/api/deals/subscribe')
      .send({
        email: 'deals@playwise.dev',
        minDiscountPct: 50,
        notifyFreeGames: true,
        notifyDiscounts: true
      })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('ok', true)
    expect(res.body).toHaveProperty('action', 'created')
  })
})

describe('deal record shape validation', () => {
  it('every deal has required fields', async () => {
    const res = await request(app).get('/api/deals')

    for (const deal of res.body.deals) {
      expect(deal).toHaveProperty('title')
      expect(deal).toHaveProperty('store')
      expect(deal).toHaveProperty('type')
      expect(deal).toHaveProperty('url')
      expect(deal).toHaveProperty('source')
      expect(['FREE_GAME', 'DISCOUNT', 'MISSION_FREE']).toContain(deal.type)
    }
  })
})
