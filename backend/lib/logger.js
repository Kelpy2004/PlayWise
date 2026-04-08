const pino = require('pino')
const pinoHttp = require('pino-http')

const logger = pino({
  level: process.env.LOG_LEVEL || 'info'
})

const httpLogger = pinoHttp({
  logger,
  customSuccessMessage(req, res) {
    return `${req.method} ${req.url} completed with ${res.statusCode}`
  },
  customErrorMessage(req, res) {
    return `${req.method} ${req.url} failed with ${res.statusCode}`
  }
})

module.exports = {
  logger,
  httpLogger
}
