const fs = require('fs');
const path = require('path');

const DATA_FILE    = path.join(__dirname, 'data.json');
const COACHES_FILE = path.join(__dirname, 'coaches.json');

// ─── Helpers ─────────────────────────────────────────────────────────────────
function readJSON(file) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, '{}');
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ─── Users ────────────────────────────────────────────────────────────────────
function getUser(userId) {
  const data = readJSON(DATA_FILE);
  if (!data[userId]) {
    data[userId] = { role: 'guest', dayPlans: {}, weekPlans: {}, sportPlans: [], nutritionPlans: [] };
    writeJSON(DATA_FILE, data);
  }
  return data[userId];
}
function saveUser(userId, userData) {
  const data = readJSON(DATA_FILE);
  data[userId] = userData;
  writeJSON(DATA_FILE, data);
}

// ─── Coaches ─────────────────────────────────────────────────────────────────
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'HP-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getCoachByTelegramId(telegramId) {
  const coaches = readJSON(COACHES_FILE);
  return Object.values(coaches).find(c => c.telegramId === String(telegramId)) || null;
}

function getCoachByInviteCode(code) {
  const coaches = readJSON(COACHES_FILE);
  return Object.values(coaches).find(c => c.inviteCode === code.toUpperCase()) || null;
}

function getCoachById(coachId) {
  const coaches = readJSON(COACHES_FILE);
  return coaches[coachId] || null;
}

function createCoach(telegramId, name) {
  const coaches = readJSON(COACHES_FILE);
  // already registered?
  const existing = Object.values(coaches).find(c => c.telegramId === String(telegramId));
  if (existing) return existing;

  // unique invite code
  let code;
  do { code = generateInviteCode(); }
  while (Object.values(coaches).some(c => c.inviteCode === code));

  const coachId = `coach_${telegramId}`;
  coaches[coachId] = {
    id: coachId,
    telegramId: String(telegramId),
    name,
    inviteCode: code,
    students: [],
    createdAt: new Date().toISOString(),
  };
  writeJSON(COACHES_FILE, coaches);
  return coaches[coachId];
}

function linkStudentToCoach(studentId, inviteCode) {
  const coach = getCoachByInviteCode(inviteCode);
  if (!coach) return { error: 'Невірний код запрошення' };
  if (coach.students.length >= 10) return { error: 'Тренер вже має максимум учнів (10)' };

  const coaches = readJSON(COACHES_FILE);
  if (!coaches[coach.id].students.includes(studentId)) {
    coaches[coach.id].students.push(studentId);
    writeJSON(COACHES_FILE, coaches);
  }

  const userData = getUser(studentId);
  userData.role    = 'student';
  userData.coachId = coach.id;
  saveUser(studentId, userData);

  return { ok: true, coach: { id: coach.id, name: coach.name, inviteCode: coach.inviteCode } };
}

function getCoachStudents(coachId) {
  const coach = getCoachById(coachId);
  if (!coach) return [];
  const data = readJSON(DATA_FILE);
  return coach.students.map(sid => {
    const u = data[sid] || {};
    return {
      id: sid,
      profile: u.profile || {},
      corrections: u.corrections || {},
    };
  });
}

function saveCorrections(coachId, studentId, corrections) {
  const coach = getCoachById(coachId);
  if (!coach || !coach.students.includes(studentId)) return { error: 'Немає доступу' };
  const userData = getUser(studentId);
  userData.corrections = corrections;
  saveUser(studentId, userData);
  return { ok: true };
}

function getStudentFull(coachId, studentId) {
  const coach = getCoachById(coachId);
  if (!coach || !coach.students.includes(studentId)) return { error: 'Немає доступу' };
  return getUser(studentId);
}

function saveStudentFull(coachId, studentId, studentData) {
  const coach = getCoachById(coachId);
  if (!coach || !coach.students.includes(studentId)) return { error: 'Немає доступу' };
  saveUser(studentId, studentData);
  return { ok: true };
}

module.exports = {
  getUser, saveUser,
  createCoach, getCoachByTelegramId, getCoachByInviteCode, getCoachById,
  linkStudentToCoach, getCoachStudents,
  saveCorrections, getStudentFull, saveStudentFull,
};
