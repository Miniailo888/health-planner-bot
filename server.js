const express = require('express');
const path = require('path');
const {
  getUser, saveUser, deleteUser,
  createCoach, getCoachByTelegramId, getCoachByInviteCode,
  linkStudentToCoach, getCoachStudents,
  removeStudentFromCoach,
  saveCorrections, getStudentFull, saveStudentFull,
} = require('./storage');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── USER ────────────────────────────────────────────────────────────────────
app.get('/api/user/:userId', async (req, res) => {
  try { res.json(await getUser(req.params.userId)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/user/:userId', async (req, res) => {
  try {
    await saveUser(req.params.userId, req.body);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── COACH ───────────────────────────────────────────────────────────────────
app.post('/api/coach/register', async (req, res) => {
  try {
    const { telegramId, name } = req.body;
    if (!telegramId || !name) return res.json({ error: "Вкажіть ім'я" });
    const coach = await createCoach(telegramId, name);
    const userData = await getUser(String(telegramId));
    userData.role    = 'coach';
    userData.coachId = coach.id;
    await saveUser(String(telegramId), userData);
    res.json({ ok: true, coach });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/coach/by-telegram/:telegramId', async (req, res) => {
  try {
    const coach = await getCoachByTelegramId(req.params.telegramId);
    if (!coach) return res.json({ error: 'not_found' });
    res.json(coach);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/coach/:coachId/students', async (req, res) => {
  try { res.json(await getCoachStudents(req.params.coachId)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/coach/:coachId/student/:studentId', async (req, res) => {
  try { res.json(await getStudentFull(req.params.coachId, req.params.studentId)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/coach/:coachId/student/:studentId', async (req, res) => {
  try { res.json(await saveStudentFull(req.params.coachId, req.params.studentId, req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/coach/:coachId/corrections/:studentId', async (req, res) => {
  try { res.json(await saveCorrections(req.params.coachId, req.params.studentId, req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── INVITE ──────────────────────────────────────────────────────────────────
app.post('/api/invite/validate', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.json({ error: 'Введіть код' });
    const coach = await getCoachByInviteCode(code);
    if (!coach) return res.json({ error: 'Невірний код запрошення' });
    if (coach.students.length >= 10) return res.json({ error: 'Тренер вже має максимум учнів' });
    res.json({ ok: true, coachName: coach.name, coachId: coach.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/student/link', async (req, res) => {
  try {
    const { userId, inviteCode } = req.body;
    if (!userId || !inviteCode) return res.json({ error: 'Missing data' });
    res.json(await linkStudentToCoach(userId, inviteCode));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── DELETE USER ─────────────────────────────────────────────────────────────
app.delete('/api/user/:userId', async (req, res) => {
  try {
    await deleteUser(req.params.userId);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── REMOVE STUDENT FROM COACH ───────────────────────────────────────────────
app.delete('/api/coach/:coachId/student/:studentId', async (req, res) => {
  try {
    res.json(await removeStudentFromCoach(req.params.coachId, req.params.studentId));
  } catch (e) { res.status(500).json({ error: e.message }); }
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
