const mongoose = require('mongoose')

const commentSchema = new mongoose.Schema(
  {
    gameSlug: { type: String, required: true, index: true },
    username: { type: String, required: true },
    message: { type: String, required: true },
    userId: { type: String, default: null }
  },
  { timestamps: true }
)

module.exports = mongoose.model('Comment', commentSchema)
