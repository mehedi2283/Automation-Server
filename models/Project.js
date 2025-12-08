const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  client: String,
  industry: String,
  description: String,
  challenge: String,
  solution: String,
  mainImage: String,
  clientMeetingImage: String,
  videoPoster: String,
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