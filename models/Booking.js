const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, unique: true },
  clientName: { type: String, default: 'Online Visitor' },
  clientEmail: String,
  appointmentDate: Date,
  status: { type: String, default: 'confirmed' },
  source: { type: String, default: 'direct' }
}, { timestamps: true });

module.exports = mongoose.model('Booking', BookingSchema);