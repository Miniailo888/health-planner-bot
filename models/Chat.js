const { mongoose } = require('../db');

const MessageSchema = new mongoose.Schema({
  from:      { type: String, required: true }, // 'coach' | 'student'
  text:      { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const ChatSchema = new mongoose.Schema({
  coachId:   { type: String, required: true, index: true },
  studentId: { type: String, required: true, index: true },
  messages:  { type: [MessageSchema], default: [] },
}, { timestamps: true });

ChatSchema.index({ coachId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('Chat', ChatSchema);
