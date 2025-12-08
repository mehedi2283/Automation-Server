const mongoose = require('mongoose');

const ClientImageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  imageUrl: { type: String, required: true },
  name: String
}, { timestamps: true });

module.exports = mongoose.model('ClientImage', ClientImageSchema);