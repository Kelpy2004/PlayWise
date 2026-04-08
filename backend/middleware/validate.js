const { ZodError } = require('zod')

const { ApiError } = require('../lib/http')

function validateBody(schema) {
  return (req, _res, next) => {
    try {
      req.validatedBody = schema.parse(req.body)
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        return next(new ApiError(400, 'Invalid request body.', error.flatten()))
      }
      next(error)
    }
  }
}

module.exports = {
  validateBody
}
