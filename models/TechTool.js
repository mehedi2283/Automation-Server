const mongoose = require('mongoose');

const TechToolSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  iconName: String,
  colorClass: String
}, { timestamps: true });

module.exports = mongoose.model('TechTool', TechToolSchema);