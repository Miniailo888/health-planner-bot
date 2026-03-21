const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}));
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getUser(userId) {
  const data = loadData();
  if (!data[userId]) {
    data[userId] = {
      dayPlans: {},
      weekPlans: {},
      sportPlans: [],
      nutritionPlans: [],
    };
    saveData(data);
  }
  return data[userId];
}

function saveUser(userId, userData) {
  const data = loadData();
  data[userId] = userData;
  saveData(data);
}

module.exports = { getUser, saveUser };
