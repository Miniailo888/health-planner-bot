const { mongoose } = require('../db');

const UserSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true, index: true },
  role:    { type: String, default: 'guest' },
  coachId: { type: String, default: null },

  profile: {
    name:   String,
    gender: String,
    age:    Number,
    weight: Number,
    height: Number,
    goal:   String,
  },

  corrections: {
    generalNote:       String,
    nutritionNote:     String,
    sportNote:         String,
    assignedNutrition: { type: mongoose.Schema.Types.Mixed, default: [] },
    assignedSport:     { type: mongoose.Schema.Types.Mixed, default: [] },
    updatedAt:         String,
  },

  // Дані додатку — весь blob що надсилає фронтенд
  savedNutrition: { type: Array,  default: [] },
  savedSport:     { type: Array,  default: [] },
  savedWeek:      { type: mongoose.Schema.Types.Mixed, default: null },
  mealTimes:      { type: Object, default: {} },
  sportTimes:     { type: Object, default: {} },
  weekTimes:      { type: Object, default: {} },
  selectedSnacks: { type: Object, default: {} },
  mealOptions:    { type: Object, default: {} },
  notes:          { type: Array,  default: [] },
  cycleData:      { type: Object, default: {} },
  notesBg:        { type: String, default: null },

  dayPlans:       { type: Object, default: {} },
  weekPlans:      { type: Object, default: {} },
  sportPlans:     { type: Array,  default: [] },
  nutritionPlans: { type: Array,  default: [] },
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
