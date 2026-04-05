const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'playwise-secret'

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization || ''
  if (!authHeader.startsWith('Bearer ')) return null
  return authHeader.slice(7).trim()
}

function decodeToken(token) {
  return jwt.verify(token, JWT_SECRET)
}

function optionalAuth(req, _res, next) {
  const token = getTokenFromRequest(req)
  if (!token) {
    req.user = null
    return next()
  }

  try {
    req.user = decodeToken(token)
  } catch (_) {
    req.user = null
  }

  next()
}

function requireAuth(req, res, next) {
  const token = getTokenFromRequest(req)
  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' })
  }

  try {
    req.user = decodeToken(token)
    next()
  } catch (_) {
    res.status(401).json({ message: 'Invalid or expired session.' })
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required.' })
  }

  next()
}

module.exports = {
  JWT_SECRET,
  decodeToken,
  optionalAuth,
  requireAuth,
  requireAdmin
}
