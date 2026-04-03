const mongoose = require('mongoose')

const laptopSchema = new mongoose.Schema({
  model: { type: String, required: true, unique: true },
  brand: String,
  cpu: { type: String, required: true },
  gpu: { type: String, required: true },
  ram: { type: Number, required: true },
  platform: { type: String, default: 'windows' },
  tags: [String],
  notes: String
}, { timestamps: true })

module.exports = mongoose.model('Laptop', laptopSchema)
