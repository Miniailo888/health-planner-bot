const express = require('express');
const path = require('path');
const { getUser, saveUser } = require('./storage');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── API: отримати дані юзера ────────────────────────────────────────────────
app.get('/api/user/:userId', (req, res) => {
  const user = getUser(req.params.userId);
  res.json(user);
});

// ─── API: зберегти дані юзера ────────────────────────────────────────────────
app.post('/api/user/:userId', (req, res) => {
  saveUser(req.params.userId, req.body);
  res.json({ ok: true });
});

// ─── Всі інші маршрути → index.html ─────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Web server: http://localhost:${PORT}`);
});

module.exports = app;
