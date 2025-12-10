const mongoose = require('mongoose');

const ChatWidgetSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  messages: [{
    type: { type: String, enum: ['human', 'ai', 'system'], default: 'human' },
    data: mongoose.Schema.Types.Mixed, // Allows flexible data structure (string or object)
    timestamp: { type: Date, default: Date.now }
  }]
}, { 
  timestamps: true,
  collection: 'chat_widget' // Explicitly map to the existing collection name from screenshot
});

module.exports = mongoose.model('ChatWidget', ChatWidgetSchema);
