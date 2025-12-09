const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  order: { type: Number, default: 0 },
  title: { type: String, required: true },
  client: String,
  industry: String,
  description: String,
  challenge: String,
  solution: String,
  mainImage: String,
  clientMeetingImage: String,
  extraImage: String,     // New field for additional detail image
  videoPoster: String,
  videoLink: String,
  isFeatured: { type: Boolean, default: false },
  stats: [{
    label: String,
    value: String
  }],
  tags: [String],
  clientFeedback: {
    quote: String,
    author: String,
    role: String,
    image: String
  }
}, { timestamps: true });

module.exports = mongoose.model('Project', ProjectSchema);