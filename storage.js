const User  = require('./models/User');
const Coach = require('./models/Coach');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'HP-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ─── Users ────────────────────────────────────────────────────────────────────
async function getUser(userId) {
  const tid = String(userId);
  let user = await User.findOne({ telegramId: tid }).lean();
  if (!user) {
    const created = await User.create({ telegramId: tid });
    user = created.toObject();
  }
  return user;
}

async function saveUser(userId, data) {
  // Видаляємо _id щоб не перезаписувати
  // Видаляємо corrections — ними керує тренер через окремий endpoint
  const { _id, __v, corrections, ...payload } = data;
  await User.findOneAndUpdate(
    { telegramId: String(userId) },
    { $set: payload },
    { upsert: true, new: true }
  );
}

// ─── Coaches ──────────────────────────────────────────────────────────────────
async function getCoachByTelegramId(telegramId) {
  return await Coach.findOne({ telegramId: String(telegramId) }).lean();
}

async function getCoachByInviteCode(code) {
  return await Coach.findOne({ inviteCode: code.toUpperCase() }).lean();
}

async function getCoachById(coachId) {
  return await Coach.findOne({ id: coachId }).lean();
}

async function createCoach(telegramId, name) {
  const existing = await Coach.findOne({ telegramId: String(telegramId) }).lean();
  if (existing) return existing;

  let code;
  do { code = generateInviteCode(); }
  while (await Coach.findOne({ inviteCode: code }));

  const coachId = `coach_${telegramId}`;
  const coach = await Coach.create({
    id: coachId,
    telegramId: String(telegramId),
    name,
    inviteCode: code,
    students: [],
    createdAt: new Date().toISOString(),
  });
  return coach.toObject();
}

async function linkStudentToCoach(studentId, inviteCode) {
  const coach = await getCoachByInviteCode(inviteCode);
  if (!coach) return { error: 'Невірний код запрошення' };
  if (coach.students.length >= 10) return { error: 'Тренер вже має максимум учнів (10)' };

  await Coach.updateOne(
    { id: coach.id },
    { $addToSet: { students: String(studentId) } }
  );

  const userData = await getUser(studentId);
  userData.role    = 'student';
  userData.coachId = coach.id;
  await saveUser(studentId, userData);

  return { ok: true, coach: { id: coach.id, name: coach.name, inviteCode: coach.inviteCode } };
}

async function getCoachStudents(coachId) {
  const coach = await getCoachById(coachId);
  if (!coach) return [];

  const students = await User.find(
    { telegramId: { $in: coach.students } },
    { telegramId: 1, profile: 1, corrections: 1 }
  ).lean();

  return coach.students.map(sid => {
    const u = students.find(s => s.telegramId === sid) || {};
    return { id: sid, profile: u.profile || {}, corrections: u.corrections || {} };
  });
}

async function saveCorrections(coachId, studentId, corrections) {
  const coach = await getCoachById(coachId);
  if (!coach || !coach.students.includes(String(studentId))) return { error: 'Немає доступу' };
  await User.findOneAndUpdate(
    { telegramId: String(studentId) },
    { $set: { corrections } },
    { upsert: true }
  );
  return { ok: true };
}

async function getStudentFull(coachId, studentId) {
  const coach = await getCoachById(coachId);
  if (!coach || !coach.students.includes(String(studentId))) return { error: 'Немає доступу' };
  return await getUser(studentId);
}

async function saveStudentFull(coachId, studentId, studentData) {
  const coach = await getCoachById(coachId);
  if (!coach || !coach.students.includes(String(studentId))) return { error: 'Немає доступу' };
  await saveUser(studentId, studentData);
  return { ok: true };
}

async function deleteUser(userId) {
  const tid = String(userId);
  await User.deleteOne({ telegramId: tid });
  // Якщо це тренер — видаляємо його Coach запис
  await Coach.deleteOne({ telegramId: tid });
}

async function removeStudentFromCoach(coachId, studentId) {
  const coach = await getCoachById(coachId);
  if (!coach || !coach.students.includes(String(studentId))) return { error: 'Немає доступу' };
  await Coach.updateOne({ id: coachId }, { $pull: { students: String(studentId) } });
  // Знімаємо прив'язку до тренера з боку учня
  await User.findOneAndUpdate(
    { telegramId: String(studentId) },
    { $set: { role: 'guest', coachId: null, corrections: {} } }
  );
  return { ok: true };
}

module.exports = {
  getUser, saveUser, deleteUser,
  createCoach, getCoachByTelegramId, getCoachByInviteCode, getCoachById,
  linkStudentToCoach, getCoachStudents,
  removeStudentFromCoach,
  saveCorrections, getStudentFull, saveStudentFull,
};
