const mongoose = require('mongoose');

const VisitorSchema = new mongoose.Schema({
  visitorId: { type: String, required: true, unique: true },
  userAgent: String,
  visits: { type: Number, default: 1 },
  lastVisit: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Visitor', VisitorSchema);