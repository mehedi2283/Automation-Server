const mongoose = require('mongoose');

const TeamMemberSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: String,
  image: String,
  bio: String,
  socials: {
    linkedin: String,
    twitter: String,
    email: String
  }
}, { timestamps: true });

module.exports = mongoose.model('TeamMember', TeamMemberSchema);