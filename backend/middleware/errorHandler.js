const { ApiError } = require('../lib/http')
const { logger } = require('../lib/logger')
const { captureException } = require('../lib/sentry')
const { recordRuntimeError } = require('../utils/runtimeStore')
const { isDatabaseReady } = require('../lib/prisma')

function errorHandler(err, req, res, _next) {
  const statusCode = err instanceof ApiError ? err.statusCode : 500
  const message = err instanceof ApiError ? err.message : 'Something went wrong on the server.'

  logger.error(
    {
      err,
      statusCode,
      path: req.originalUrl,
      method: req.method,
      userId: req.user?.id || null
    },
    'Unhandled request error'
  )

  captureException(err, {
    path: req.originalUrl,
    method: req.method,
    userId: req.user?.id || null,
    extra: {
      statusCode
    }
  })

  if (!isDatabaseReady()) {
    recordRuntimeError({
      message,
      path: req.originalUrl,
      method: req.method,
      stack: err.stack,
      createdAt: new Date().toISOString()
    })
  }

  res.status(statusCode).json({
    message,
    ...(err instanceof ApiError && err.details ? { details: err.details } : {})
  })
}

module.exports = { errorHandler }
