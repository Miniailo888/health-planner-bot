const express = require('express');
const path = require('path');
const {
  getUser, saveUser,
  createCoach, getCoachByTelegramId, getCoachByInviteCode,
  linkStudentToCoach, getCoachStudents,
  saveCorrections, getStudentFull, saveStudentFull,
} = require('./storage');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── USER ────────────────────────────────────────────────────────────────────
app.get('/api/user/:userId', (req, res) => {
  res.json(getUser(req.params.userId));
});
app.post('/api/user/:userId', (req, res) => {
  saveUser(req.params.userId, req.body);
  res.json({ ok: true });
});

// ─── COACH ───────────────────────────────────────────────────────────────────
// Реєстрація / отримання тренера
app.post('/api/coach/register', (req, res) => {
  const { telegramId, name } = req.body;
  if (!telegramId || !name) return res.json({ error: 'Вкажіть ім\'я' });
  const coach = createCoach(telegramId, name);

  // зберігаємо роль у userData
  const userData = getUser(String(telegramId));
  userData.role = 'coach';
  userData.coachId = coach.id;
  saveUser(String(telegramId), userData);

  res.json({ ok: true, coach });
});

app.get('/api/coach/by-telegram/:telegramId', (req, res) => {
  const coach = getCoachByTelegramId(req.params.telegramId);
  if (!coach) return res.json({ error: 'not_found' });
  res.json(coach);
});

// Список учнів
app.get('/api/coach/:coachId/students', (req, res) => {
  res.json(getCoachStudents(req.params.coachId));
});

// Повні дані учня (для тренера)
app.get('/api/coach/:coachId/student/:studentId', (req, res) => {
  const result = getStudentFull(req.params.coachId, req.params.studentId);
  res.json(result);
});

// Зберегти повні дані учня (тренер редагує)
app.post('/api/coach/:coachId/student/:studentId', (req, res) => {
  const result = saveStudentFull(req.params.coachId, req.params.studentId, req.body);
  res.json(result);
});

// Зберегти лише корективи
app.post('/api/coach/:coachId/corrections/:studentId', (req, res) => {
  res.json(saveCorrections(req.params.coachId, req.params.studentId, req.body));
});

// ─── INVITE ──────────────────────────────────────────────────────────────────
// Перевірити код запрошення
app.post('/api/invite/validate', (req, res) => {
  const { code } = req.body;
  if (!code) return res.json({ error: 'Введіть код' });
  const coach = getCoachByInviteCode(code);
  if (!coach) return res.json({ error: 'Невірний код запрошення' });
  if (coach.students.length >= 10) return res.json({ error: 'Тренер вже має максимум учнів' });
  res.json({ ok: true, coachName: coach.name, coachId: coach.id });
});

// Прив'язати учня до тренера
app.post('/api/student/link', (req, res) => {
  const { userId, inviteCode } = req.body;
  if (!userId || !inviteCode) return res.json({ error: 'Missing data' });
  res.json(linkStudentToCoach(userId, inviteCode));
});

// ─── SPA fallback ────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Web server: http://localhost:${PORT}`);
});

module.exports = app;
