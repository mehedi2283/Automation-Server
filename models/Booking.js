const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, unique: true }, // Internal UUID
  externalId: { type: String }, // External ID from GHL/Webhook (e.g. JAbyIyR0Usp7EWsLQXDf)
  clientName: { type: String, default: 'Online Visitor' },
  clientEmail: String,
  appointmentDate: { type: String }, 
  status: { type: String, default: 'confirmed' },
  source: { type: String, default: 'direct' }
}, { timestamps: true });

module.exports = mongoose.model('Booking', BookingSchema);