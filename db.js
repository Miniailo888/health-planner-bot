const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('[db] MONGODB_URI не задано — запуск без MongoDB');
    return false;
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('[db] ✅ MongoDB Atlas підключено');
    return true;
  } catch (err) {
    console.error('[db] ❌ Помилка підключення MongoDB:', err.message);
    return false;
  }
}

module.exports = { connectDB, mongoose };
