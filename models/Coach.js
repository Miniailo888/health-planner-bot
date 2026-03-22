const { mongoose } = require('../db');

const CoachSchema = new mongoose.Schema({
  id:         { type: String, required: true, unique: true },
  telegramId: { type: String, required: true, unique: true, index: true },
  name:       { type: String, required: true },
  inviteCode: { type: String, required: true, unique: true, index: true },
  students:   { type: [String], default: [] },
  createdAt:  { type: String },
}, { timestamps: false });

module.exports = mongoose.model('Coach', CoachSchema);
