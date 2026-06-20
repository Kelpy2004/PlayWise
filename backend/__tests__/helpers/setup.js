const express = require('express')
const helmet = require('helmet')
const cors = require('cors')

delete process.env.DATABASE_URL
delete process.env.DIRECT_DATABASE_URL

function createTestApp() {
  const app = express()

  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(cors({ origin: true, credentials: true }))
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true }))

  return app
}

function mountRoutes(app, routes) {
  for (const [prefix, router] of Object.entries(routes)) {
    app.use(prefix, router)
  }

  const { errorHandler } = require('../../middleware/errorHandler')
  app.use(errorHandler)

  return app
}

module.exports = { createTestApp, mountRoutes }
