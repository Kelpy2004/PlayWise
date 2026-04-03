const mongoose = require('mongoose')

const cpuSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  score: { type: Number, required: true },
  family: String,
  platform: { type: String, default: 'windows' },
  notes: String
}, { timestamps: true })

module.exports = mongoose.model('Cpu', cpuSchema)
