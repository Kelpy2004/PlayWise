const mongoose = require('mongoose')

function isDatabaseReady() {
  return mongoose.connection.readyState === 1
}

module.exports = { isDatabaseReady }
