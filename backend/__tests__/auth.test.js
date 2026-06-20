const request = require('supertest')
const { createTestApp, mountRoutes } = require('./helpers/setup')
const { resetRuntimeStoreForTests, getDemoUsers } = require('../utils/runtimeStore')

const TS = String(Date.now()).slice(-6)
const unique = (base) => `${base}${TS}`

let app

beforeAll(() => {
  resetRuntimeStoreForTests()
  console.log('[auth.test] users after reset:', getDemoUsers().length)
  app = createTestApp()
  const authRoutes = require('../routes/auth')
  mountRoutes(app, { '/api/auth': authRoutes })
})

describe('POST /api/auth/register', () => {
  it('creates a new user with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: unique('testplayer'),
        email: `test_${TS}@playwise.dev`,
        password: 'Str0ng!Pass'
      })

    if (res.status !== 201) {
      console.log('[auth.test] register failed:', res.status, JSON.stringify(res.body))
      console.log('[auth.test] users at failure:', getDemoUsers().length, getDemoUsers().map(u => u.username))
      console.log('[auth.test] DATABASE_URL:', JSON.stringify(process.env.DATABASE_URL))
    }

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('token')
    expect(res.body).toHaveProperty('user')
    expect(res.body.user.username).toBe(unique('testplayer'))
    expect(res.body.user.email).toBe(`test_${TS}@playwise.dev`)
    expect(res.body.user).not.toHaveProperty('passwordHash')
  })

  it('rejects duplicate username or email', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        username: unique('dupuser'),
        email: `dup_${TS}@playwise.dev`,
        password: 'Str0ng!Pass'
      })

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: unique('dupuser'),
        email: `dup2_${TS}@playwise.dev`,
        password: 'Str0ng!Pass'
      })

    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/already exists/i)
  })

  it('rejects weak passwords', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: unique('weakpw'),
        email: `weak_${TS}@playwise.dev`,
        password: 'short'
      })

    expect(res.status).toBe(400)
  })

  it('rejects invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: unique('bademail'),
        email: 'not-an-email',
        password: 'Str0ng!Pass'
      })

    expect(res.status).toBe(400)
  })

  it('rejects short usernames', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'ab',
        email: `short_${TS}@playwise.dev`,
        password: 'Str0ng!Pass'
      })

    expect(res.status).toBe(400)
  })

  it('rejects usernames with invalid characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'bad user!',
        email: `badchar_${TS}@playwise.dev`,
        password: 'Str0ng!Pass'
      })

    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        username: unique('loginuser'),
        email: `login_${TS}@playwise.dev`,
        password: 'Str0ng!Pass'
      })
  })

  it('authenticates with correct username and password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        usernameOrEmail: unique('loginuser'),
        password: 'Str0ng!Pass'
      })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
    expect(res.body.user.username).toBe(unique('loginuser'))
  })

  it('authenticates with correct email and password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        usernameOrEmail: `login_${TS}@playwise.dev`,
        password: 'Str0ng!Pass'
      })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
  })

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        usernameOrEmail: unique('loginuser'),
        password: 'WrongPass!1'
      })

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/invalid credentials/i)
  })

  it('rejects non-existent user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        usernameOrEmail: 'ghostuser',
        password: 'Str0ng!Pass'
      })

    expect(res.status).toBe(401)
  })

  it('rejects empty credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        usernameOrEmail: '',
        password: ''
      })

    expect(res.status).toBe(400)
  })
})

describe('GET /api/auth/session', () => {
  it('returns user data with valid token', async () => {
    const loginRes = await request(app)
      .post('/api/auth/register')
      .send({
        username: unique('sessionuser'),
        email: `session_${TS}@playwise.dev`,
        password: 'Str0ng!Pass'
      })

    expect(loginRes.status).toBe(201)
    const token = loginRes.body.token
    expect(token).toBeDefined()

    const res = await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.user.username).toBe(unique('sessionuser'))
  })

  it('rejects request without token', async () => {
    const res = await request(app).get('/api/auth/session')
    expect(res.status).toBe(401)
  })

  it('rejects request with malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/session')
      .set('Authorization', 'Bearer garbage.token.here')

    expect(res.status).toBe(401)
  })
})

describe('GET /api/auth/providers', () => {
  it('returns available auth providers', async () => {
    const res = await request(app).get('/api/auth/providers')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('providers')
    expect(Array.isArray(res.body.providers)).toBe(true)

    const password = res.body.providers.find((p) => p.key === 'password')
    expect(password).toBeDefined()
    expect(password.available).toBe(true)
  })
})

describe('GET /api/auth/availability', () => {
  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        username: unique('takenname'),
        email: `taken_${TS}@playwise.dev`,
        password: 'Str0ng!Pass'
      })
  })

  it('reports taken username as unavailable', async () => {
    const res = await request(app)
      .get(`/api/auth/availability?username=${unique('takenname')}`)

    expect(res.status).toBe(200)
    expect(res.body.username.available).toBe(false)
  })

  it('reports fresh username as available', async () => {
    const res = await request(app)
      .get('/api/auth/availability?username=freshname')

    expect(res.status).toBe(200)
    expect(res.body.username.available).toBe(true)
  })
})

describe('POST /api/auth/forgot-password', () => {
  it('always returns success to prevent email enumeration', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nonexistent@example.com' })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('rejects invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'bad' })

    expect(res.status).toBe(400)
  })
})
