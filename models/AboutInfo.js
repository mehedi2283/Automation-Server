const mongoose = require('mongoose');

const AboutInfoSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  bio: String,
  totalProjects: String,
  hoursLogged: String,
  agencyName: { type: String, default: 'AgencyAI' }, // New field
  adminPassword: { type: String, default: 'admin123' }, // New field
  achievements: [{
    title: String,
    description: String
  }]
}, { timestamps: true });

module.exports = mongoose.model('AboutInfo', AboutInfoSchema);