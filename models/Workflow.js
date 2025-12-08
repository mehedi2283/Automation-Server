const mongoose = require('mongoose');

const WorkflowSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: String,
  model: String,
  systemInstruction: String,
  temperature: Number,
  status: { 
    type: String, 
    enum: ['active', 'draft', 'archived'], 
    default: 'draft' 
  }
}, { timestamps: true });

module.exports = mongoose.model('Workflow', WorkflowSchema);