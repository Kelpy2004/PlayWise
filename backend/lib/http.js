class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message)
    this.statusCode = statusCode
    this.details = details
  }
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}

module.exports = {
  ApiError,
  asyncHandler
}
