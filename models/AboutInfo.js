const mongoose = require('mongoose');

const AboutInfoSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  bio: String,
  totalProjects: String,
  hoursLogged: String,
  achievements: [{
    title: String,
    description: String
  }]
}, { timestamps: true });

module.exports = mongoose.model('AboutInfo', AboutInfoSchema);