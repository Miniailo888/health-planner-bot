// ═══════════════════════════════════════════════════════════
//   HEALTH PLANNER — TELEGRAM MINI APP  v2.0
// ═══════════════════════════════════════════════════════════

// ─── Telegram WebApp Init ────────────────────────────────────
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor('#0d0f14');
  tg.setBackgroundColor('#0d0f14');
}

const userId   = tg?.initDataUnsafe?.user?.id || 'demo_user';
const userName = tg?.initDataUnsafe?.user?.first_name || 'Користувач';

// ─── STATE ────────────────────────────────────────────────────
let userData = {
  savedNutrition: [],
  savedSport: [],
  savedWeek: null,
  mealTimes:    {},
  sportTimes:   {},
  weekTimes:    {},
  selectedSnacks: {},
  mealOptions:  {}, // { menuId: { mealKey: optionIndex } }
};

// profile data stored separately
let profile = {
  name:   '',
  gender: null,   // 'male' | 'female'
  age:    25,
  weight: 70,
  height: 175,
  goal:   'balance', // 'mass' | 'cut' | 'balance'
};

// onboarding temp state
let obTemp = { name: '', gender: null, age: null, weight: null, height: null };

let currentNutritionCat   = 'mass';
let currentNutritionLevel = 'all';
let currentSportCat       = 'mass';
let currentModal          = null;

// ─── STORAGE — синхронізація з сервером ──────────────────────
// Локальний кеш (localStorage) для швидкого старту
function loadData() {
  try {
    const raw = localStorage.getItem(`hp_${userId}`);
    if (raw) userData = { ...userData, ...JSON.parse(raw) };
  } catch {}
}
function saveData() {
  try {
    localStorage.setItem(`hp_${userId}`, JSON.stringify(userData));
    // Фоновий запис на сервер
    fetch(`/api/user/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...userData, profile }),
    }).catch(() => {});
  } catch {}
}
function loadProfile() {
  try {
    const raw = localStorage.getItem(`hp_profile_${userId}`);
    if (raw) profile = { ...profile, ...JSON.parse(raw) };
    return !!raw;
  } catch { return false; }
}
function saveProfile() {
  try {
    localStorage.setItem(`hp_profile_${userId}`, JSON.stringify(profile));
    // Фоновий запис на сервер
    fetch(`/api/user/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...userData, profile }),
    }).catch(() => {});
  } catch {}
}

// Завантаження з сервера (повна синхронізація між пристроями)
async function syncFromServer() {
  try {
    const res  = await fetch(`/api/user/${userId}`);
    const data = await res.json();
    if (data.error) return false;

    // Синхронізуємо userData
    const uKeys = ['savedNutrition','savedSport','savedWeek','mealTimes','sportTimes',
                   'weekTimes','selectedSnacks','mealOptions','notes','cycleData',
                   'notesBg','role','coachId','corrections'];
    uKeys.forEach(k => { if (data[k] !== undefined) userData[k] = data[k]; });

    // Синхронізуємо profile
    if (data.profile && data.profile.gender) {
      profile = { ...profile, ...data.profile };
      localStorage.setItem(`hp_profile_${userId}`, JSON.stringify(profile));
    }

    localStorage.setItem(`hp_${userId}`, JSON.stringify(userData));
    return !!data.profile?.gender;
  } catch {
    return false;
  }
}

// ─── BMR / TDEE ──────────────────────────────────────────────
function calcBMR(g, w, h, a) {
  if (g === 'male')   return Math.round(10 * w + 6.25 * h - 5 * a + 5);
  if (g === 'female') return Math.round(10 * w + 6.25 * h - 5 * a - 161);
  return Math.round(10 * w + 6.25 * h - 5 * a + 5);
}
function calcTDEE(bmr)  { return Math.round(bmr * 1.55); }
function calcLoss(tdee) { return tdee - 500; }
function calcGain(tdee) { return tdee + 400; }

function getProfileCalories() {
  const bmr  = calcBMR(profile.gender, profile.weight, profile.height, profile.age);
  const tdee = calcTDEE(bmr);
  return { bmr, tdee, loss: calcLoss(tdee), gain: calcGain(tdee) };
}

// ─── GENDER MENUS ────────────────────────────────────────────
function getNutritionMenus() {
  return profile.gender === 'female' ? NUTRITION_MENUS_FEMALE : NUTRITION_MENUS_MALE;
}

function getMealOptions(menu, mealKey) {
  const cat = menu.category || 'balance';
  const prefix = menu.gender === 'female' ? 'female_' : '';
  const bankKey = prefix + cat;
  const bank = MEAL_OPTIONS_BANK[bankKey] || MEAL_OPTIONS_BANK[cat] || {};
  const opts = bank[mealKey] || [];
  const mainText = menu.meals.find(m => m.key === mealKey)?.text || '';
  const merged = [mainText, ...opts.filter(o => o !== mainText)].slice(0, 6);
  return merged;
}

// ─── THEME ────────────────────────────────────────────────────
function applyTheme(gender) {
  document.body.classList.remove('theme-male', 'theme-female');
  if (gender === 'male')   document.body.classList.add('theme-male');
  if (gender === 'female') document.body.classList.add('theme-female');
}

// ─── INIT ─────────────────────────────────────────────────────
loadData();
const hasProfile = loadProfile();
document.getElementById('userBadge').textContent = profile.name || userName;

// Визначаємо роль і запускаємо відповідний флоу
appInit();

async function appInit() {
  // Синхронізуємо з сервером (це дає кросс-пристрою підтримку)
  const serverHasProfile = await syncFromServer();

  // Оновлюємо бейдж після синхронізації
  document.getElementById('userBadge').textContent = profile.name || userName;

  const role = userData.role || 'none';

  if (role === 'coach' && userData.coachId) {
    const coachRes = await fetch(`/api/coach/by-telegram/${userId}`);
    const coach = await coachRes.json();
    if (!coach.error) {
      hideAllOverlays();
      launchCoachDashboard(coach);
      return;
    }
  }

  if (role === 'student' && userData.coachId) {
    hideRoleOverlay();
    startStudentApp();
    return;
  }

  if (role === 'guest') {
    hideRoleOverlay();
    if (!profile.gender) {
      document.getElementById('onboardingOverlay').style.display = 'flex';
      document.getElementById('obNameInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') obNameNext();
      });
    } else {
      applyTheme(profile.gender);
      bootApp();
    }
    return;
  }

  // Нема ролі — показуємо вибір ролі
  document.getElementById('roleOverlay').style.display = 'flex';
}

function hideAllOverlays() {
  document.getElementById('roleOverlay').classList.add('hidden');
  document.getElementById('onboardingOverlay').classList.add('hidden');
}
function hideRoleOverlay() {
  document.getElementById('roleOverlay').classList.add('hidden');
}

function startStudentApp() {
  if (!profile.gender) {
    document.getElementById('onboardingOverlay').style.display = 'flex';
    document.getElementById('obNameInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') obNameNext();
    });
  } else {
    document.getElementById('onboardingOverlay').classList.add('hidden');
    applyTheme(profile.gender);
    bootApp();
  }
}

function bootApp() {
  renderNutritionCards();
  renderSportCards();
  updateNutritionHeroSubtitle();
  updateCycleTabVisibility();
  // Якщо учень — завантажуємо корективи тренера
  if (userData.role === 'student' && userData.coachId) {
    loadCoachCorrections();
  }
}

async function loadCoachCorrections() {
  try {
    const res = await fetch(`/api/user/${userId}`);
    const data = await res.json();
    if (data.corrections) {
      userData.corrections = data.corrections;
      // оновлюємо картки з призначеними планами тренера
      renderNutritionCards();
      renderSportCards();
      // показуємо банер якщо є нотатки
      const c = data.corrections;
      if (c.generalNote || c.nutritionNote || c.sportNote) {
        showCoachBanner(c);
      }
    }
  } catch {}
}

function showCoachBanner(corrections) {
  if (!corrections.generalNote && !corrections.nutritionNote && !corrections.sportNote) return;
  const existing = document.getElementById('coachBanner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'coachBanner';
  banner.className = 'coach-banner';
  banner.innerHTML = `
    <div class="coach-banner-header">
      <span>🏋️ Повідомлення від тренера</span>
      <button onclick="document.getElementById('coachBanner').remove()">✕</button>
    </div>
    ${corrections.generalNote   ? `<div class="coach-banner-row"><b>📋 Загальне:</b> ${corrections.generalNote}</div>` : ''}
    ${corrections.nutritionNote ? `<div class="coach-banner-row"><b>🥗 Харчування:</b> ${corrections.nutritionNote}</div>` : ''}
    ${corrections.sportNote     ? `<div class="coach-banner-row"><b>💪 Тренування:</b> ${corrections.sportNote}</div>` : ''}
  `;
  document.getElementById('appMain').prepend(banner);
}

// ═══════════════════════════════════════════════════════════
//   ROLE SELECTION
// ═══════════════════════════════════════════════════════════
function showRoleScreen() {
  document.getElementById('roleScreen').classList.remove('hidden');
  document.getElementById('coachRegScreen').classList.add('hidden');
  document.getElementById('studentRegScreen').classList.add('hidden');
}

function selectRole(role) {
  if (role === 'guest') {
    // Зберігаємо як гість і запускаємо онбординг
    fetch(`/api/user/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'guest' }),
    });
    hideRoleOverlay();
    if (!hasProfile || !profile.gender) {
      document.getElementById('onboardingOverlay').style.display = 'flex';
      document.getElementById('obNameInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') obNameNext();
      });
    } else {
      applyTheme(profile.gender);
      bootApp();
    }
  } else if (role === 'coach') {
    document.getElementById('roleScreen').classList.add('hidden');
    document.getElementById('coachRegScreen').classList.remove('hidden');
  } else if (role === 'student') {
    document.getElementById('roleScreen').classList.add('hidden');
    document.getElementById('studentRegScreen').classList.remove('hidden');
  }
}

// ─── COACH REGISTRATION ───────────────────────────────────
async function registerCoach() {
  const name = document.getElementById('coachNameInput').value.trim();
  const errEl = document.getElementById('coachRegError');
  if (!name) {
    errEl.textContent = 'Введіть ім\'я';
    errEl.classList.remove('hidden');
    return;
  }
  errEl.classList.add('hidden');

  try {
    const res = await fetch('/api/coach/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId: userId, name }),
    });
    const data = await res.json();
    if (data.error) {
      errEl.textContent = data.error;
      errEl.classList.remove('hidden');
      return;
    }
    hideAllOverlays();
    launchCoachDashboard(data.coach);
  } catch {
    errEl.textContent = 'Помилка підключення';
    errEl.classList.remove('hidden');
  }
}

// ─── STUDENT INVITE ───────────────────────────────────────
let pendingCoachData = null;

async function validateInviteCode() {
  const code = document.getElementById('inviteCodeInput').value.trim().toUpperCase();
  const errEl  = document.getElementById('studentRegError');
  const foundEl = document.getElementById('inviteCoachFound');
  if (!code) {
    errEl.textContent = 'Введіть код';
    errEl.classList.remove('hidden');
    return;
  }
  errEl.classList.add('hidden');
  foundEl.classList.add('hidden');

  try {
    const res = await fetch('/api/invite/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (data.error) {
      errEl.textContent = data.error;
      errEl.classList.remove('hidden');
      return;
    }
    // Показуємо знайденого тренера і кнопку підтвердження
    pendingCoachData = data;
    foundEl.innerHTML = `
      <div class="invite-found-card">
        <div class="invite-found-icon">🏋️</div>
        <div class="invite-found-text">
          <div class="invite-found-name">Тренер: <b>${data.coachName}</b></div>
          <div class="invite-found-sub">Підключитись до цього тренера?</div>
        </div>
        <button class="invite-confirm-btn" onclick="confirmStudentLink()">Так, підключити ✓</button>
      </div>
    `;
    foundEl.classList.remove('hidden');
  } catch {
    errEl.textContent = 'Помилка підключення';
    errEl.classList.remove('hidden');
  }
}

async function confirmStudentLink() {
  if (!pendingCoachData) return;
  const errEl = document.getElementById('studentRegError');
  try {
    const res = await fetch('/api/student/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: String(userId), inviteCode: document.getElementById('inviteCodeInput').value.trim().toUpperCase() }),
    });
    const data = await res.json();
    if (data.error) {
      errEl.textContent = data.error;
      errEl.classList.remove('hidden');
      return;
    }
    // Прив'язано — запускаємо онбординг для учня
    hideRoleOverlay();
    if (!hasProfile || !profile.gender) {
      document.getElementById('onboardingOverlay').style.display = 'flex';
      document.getElementById('obNameInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') obNameNext();
      });
    } else {
      applyTheme(profile.gender);
      bootApp();
    }
    showToast(`✅ Підключено до тренера ${data.coach.name}!`);
  } catch {
    errEl.textContent = 'Помилка';
    errEl.classList.remove('hidden');
  }
}

// ═══════════════════════════════════════════════════════════
//   ONBOARDING
// ═══════════════════════════════════════════════════════════
let obCurrentStep = 1;

function obGoStep(n) {
  document.querySelectorAll('.ob-step').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(`ob-step-${n}`);
  if (el) el.classList.add('active');
  obCurrentStep = n;
}

function obBackToRole() {
  // Ховаємо онбординг, показуємо вибір ролі
  document.getElementById('onboardingOverlay').classList.add('hidden');
  const roleOverlay = document.getElementById('roleOverlay');
  roleOverlay.classList.remove('hidden');
  roleOverlay.style.display = 'flex';
  showRoleScreen();
}

function obNameNext() {
  const val = document.getElementById('obNameInput').value.trim();
  obTemp.name = val || (tg?.initDataUnsafe?.user?.first_name || '');
  obGoStep(2);
}

function selectGender(g) {
  obTemp.gender = g;
  document.querySelectorAll('.ob-gender-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.gender === g);
  });
  // apply preview theme during onboarding
  applyTheme(g);
  // Update start btn color
  const btn = document.querySelector('.ob-start-btn');
  if (btn) {
    btn.style.background = g === 'male'
      ? 'linear-gradient(135deg,#f97316,#ef4444)'
      : 'linear-gradient(135deg,#f43f5e,#a855f7)';
  }
  setTimeout(() => obGoStep(3), 320);
}

function selectAge(a) {
  obTemp.age = a;
  document.querySelectorAll('.ob-age-btn').forEach(b => {
    b.classList.toggle('selected', +b.dataset.age === a);
  });
  setTimeout(() => obGoStep(4), 250);
}

function selectWeight(w) {
  obTemp.weight = w;
  document.querySelectorAll('.ob-weight-btn').forEach(b => {
    b.classList.toggle('selected', +b.dataset.weight === w);
  });
  setTimeout(() => obGoStep(5), 250);
}

function selectHeight(h) {
  obTemp.height = h;
  document.querySelectorAll('.ob-height-btn').forEach(b => {
    b.classList.toggle('selected', +b.dataset.height === h);
  });
  setTimeout(() => {
    showObResults();
    obGoStep(6);
  }, 250);
}

function showObResults() {
  const g = obTemp.gender || 'male';
  const a = obTemp.age    || 25;
  const w = obTemp.weight || 70;
  const h = obTemp.height || 175;
  const n = obTemp.name   || '';

  const bmr  = calcBMR(g, w, h, a);
  const tdee = calcTDEE(bmr);
  const loss = calcLoss(tdee);
  const gain = calcGain(tdee);

  const genderLabel = g === 'male' ? '♂ Чоловік' : '♀ Жінка';

  document.getElementById('obResults').innerHTML = `
    ${n ? `<div class="ob-result-row">
      <span class="ob-result-label">Ім'я</span>
      <span class="ob-result-value">${n}</span>
    </div>` : ''}
    <div class="ob-result-row">
      <span class="ob-result-label">Стать</span>
      <span class="ob-result-value">${genderLabel}</span>
    </div>
    <div class="ob-result-row">
      <span class="ob-result-label">Вік / Вага / Зріст</span>
      <span class="ob-result-value">${a} р · ${w} кг · ${h} см</span>
    </div>
    <div class="ob-result-row">
      <span class="ob-result-label">🔥 Базовий обмін (BMR)</span>
      <span class="ob-result-value" style="color:var(--blue)">${bmr} ккал</span>
    </div>
    <div class="ob-result-row">
      <span class="ob-result-label">⚡ TDEE (помірна активність)</span>
      <span class="ob-result-value" style="color:var(--green)">${tdee} ккал</span>
    </div>
    <div class="ob-result-row">
      <span class="ob-result-label">🔥 Для схуднення</span>
      <span class="ob-result-value" style="color:var(--orange)">${loss} ккал</span>
    </div>
    <div class="ob-result-row">
      <span class="ob-result-label">💪 Для набору маси</span>
      <span class="ob-result-value" style="color:var(--purple)">${gain} ккал</span>
    </div>
  `;
}

function finishOnboarding() {
  profile.name   = obTemp.name   || '';
  profile.gender = obTemp.gender || 'male';
  profile.age    = obTemp.age    || 25;
  profile.weight = obTemp.weight || 70;
  profile.height = obTemp.height || 175;
  profile.goal   = 'balance';
  saveProfile();
  applyTheme(profile.gender);
  document.getElementById('userBadge').textContent = profile.name || userName;

  const overlay = document.getElementById('onboardingOverlay');
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity .4s';
  setTimeout(() => {
    overlay.classList.add('hidden');
    overlay.style.opacity = '';
    overlay.style.transition = '';
  }, 400);

  bootApp();
  showToast('🎉 Профіль збережено!');
}

// ═══════════════════════════════════════════════════════════
//   TAB NAVIGATION
// ═══════════════════════════════════════════════════════════
document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');

    if (tab === 'profile')  renderProfile();
    if (tab === 'vitamins') renderVitamins();
    if (tab === 'cycle')    renderCycleTab();
    if (tab === 'notes')    renderNotesTab();
  });
});

// ═══════════════════════════════════════════════════════════
//   NUTRITION TAB
// ═══════════════════════════════════════════════════════════
document.querySelectorAll('.pill[data-cat]').forEach((pill) => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.pill[data-cat]').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    currentNutritionCat = pill.dataset.cat;
    renderNutritionCards();
  });
});

document.querySelectorAll('.level-pill').forEach((pill) => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.level-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    currentNutritionLevel = pill.dataset.level;
    renderNutritionCards();
  });
});

function updateNutritionHeroSubtitle() {
  const el = document.getElementById('nutritionHeroSubtitle');
  if (!el || !profile.gender) return;
  const { tdee } = getProfileCalories();
  const count = profile.gender === 'female' ? 25 : 25;
  const gLabel = profile.gender === 'female' ? 'жіночих' : 'чоловічих';
  el.textContent = `${count} ${gLabel} меню · TDEE: ${tdee} ккал`;
}

function getRecommendedMenuId() {
  if (!profile.gender) return null;
  const { tdee, loss, gain } = getProfileCalories();
  const target = profile.goal === 'cut' ? loss : profile.goal === 'mass' ? gain : tdee;
  const menus = getNutritionMenus();
  const all = [...(menus.mass||[]), ...(menus.cut||[]), ...(menus.balance||[])];
  let best = null, bestDiff = Infinity;
  all.forEach(m => {
    if (!m.kcalNum) return;
    const diff = Math.abs(m.kcalNum - target);
    if (diff < bestDiff) { bestDiff = diff; best = m.id; }
  });
  return best;
}

function renderNutritionCards() {
  const container = document.getElementById('nutritionCards');
  container.innerHTML = '';

  const recommendedId   = getRecommendedMenuId();
  const allMenus        = getNutritionMenus();
  const assignedIds     = userData.corrections?.assignedNutrition || [];

  // ── Секція "Від тренера" (тільки якщо є і не у вкладці saved) ──
  if (assignedIds.length > 0 && currentNutritionCat !== 'saved') {
    const allFlat = [...(allMenus.mass||[]), ...(allMenus.cut||[]), ...(allMenus.balance||[])];
    const assignedMenus = assignedIds.map(id => allFlat.find(m => m.id === id)).filter(Boolean);
    if (assignedMenus.length > 0) {
      const section = document.createElement('div');
      section.className = 'coach-assigned-section';
      section.innerHTML = `<div class="coach-assigned-title">🏋️ Від тренера</div>`;
      assignedMenus.forEach(menu => {
        const card = buildNutritionCard(menu, recommendedId, true);
        section.appendChild(card);
      });
      container.appendChild(section);
    }
  }

  // ── Звичайні картки ──
  let menus = [];
  if (currentNutritionCat === 'saved') {
    const all = [...(allMenus.mass||[]), ...(allMenus.cut||[]), ...(allMenus.balance||[])];
    menus = all.filter(m => userData.savedNutrition.includes(m.id));
    if (menus.length === 0) {
      container.innerHTML += `<div class="empty-state"><div class="empty-state-icon">⭐</div><div class="empty-state-text">Збережених меню немає.<br>Натисни ⭐ щоб зберегти.</div></div>`;
      return;
    }
  } else {
    menus = allMenus[currentNutritionCat] || [];
  }

  if (currentNutritionLevel !== 'all') {
    menus = menus.filter(m => m.level === currentNutritionLevel);
  }

  menus.forEach(menu => container.appendChild(buildNutritionCard(menu, recommendedId, false)));
}

function buildNutritionCard(menu, recommendedId, isCoachAssigned) {
  const isSaved  = userData.savedNutrition.includes(menu.id);
  const times    = userData.mealTimes[menu.id] || {};
  const catClass = menu.category === 'mass' ? 'mass-card'
                 : menu.category === 'cut'  ? 'cut-card' : 'balance-card';
  const isRecommended = recommendedId === menu.id;

  const card = document.createElement('div');
  card.className = `nutrition-card ${catClass}${isCoachAssigned ? ' coach-assigned-card' : ''}`;
  card.innerHTML = `
    <div class="card-top">
      <div class="card-name">${menu.name}</div>
      <button class="card-saved-btn ${isSaved ? 'saved' : ''}" onclick="toggleSaveNutrition('${menu.id}',event)">
        ${isSaved ? '⭐' : '☆'}
      </button>
    </div>
    <div class="card-badges">
      <span class="badge badge-green">🔥 ${menu.kcal}</span>
      <span class="badge badge-blue">💪 ${menu.protein}</span>
      <span class="badge badge-orange">${menu.goal}</span>
      ${isRecommended   ? '<span class="badge badge-recommend">✅ Рекомендовано</span>' : ''}
      ${isCoachAssigned ? '<span class="badge badge-coach">🏋️ Тренер</span>' : ''}
    </div>
    <div class="card-meals">
      ${menu.meals.map(m => `
        <div class="meal-row">
          <span class="meal-icon">${m.icon}</span>
          <span class="meal-text">${m.label}</span>
          ${times[m.key] ? `<span class="meal-time">${times[m.key]}</span>` : ''}
        </div>
      `).join('')}
    </div>
  `;
  card.addEventListener('click', () => openNutritionModal(menu));
  return card;
}

function toggleSaveNutrition(id, event) {
  event.stopPropagation();
  const idx = userData.savedNutrition.indexOf(id);
  if (idx === -1) { userData.savedNutrition.push(id); showToast('✅ Меню збережено!'); }
  else            { userData.savedNutrition.splice(idx, 1); showToast('🗑 Меню видалено'); }
  saveData();
  renderNutritionCards();
}

// ─── NUTRITION MODAL ──────────────────────────────────────────
function openNutritionModal(menu) {
  currentModal = { type: 'nutrition', data: menu };
  const times = userData.mealTimes[menu.id] || {};
  const selectedSnacks = userData.selectedSnacks[menu.id] || [];

  document.getElementById('modalTitle').textContent = menu.name;

  // Build snack grid
  const snackItems = SNACK_OPTIONS.map(sk => {
    const sel = selectedSnacks.includes(sk.id);
    return `
      <div class="snack-item ${sel ? 'selected' : ''}" onclick="toggleSnack('${menu.id}','${sk.id}',this)">
        <span class="snack-icon">${sk.icon}</span>
        <div class="snack-name">${sk.name}</div>
        <div class="snack-kcal">${sk.kcal} ккал</div>
        <div class="snack-macros">Б: ${sk.protein} · В: ${sk.carbs}</div>
      </div>
    `;
  }).join('');

  const totalSnackKcal = SNACK_OPTIONS
    .filter(sk => selectedSnacks.includes(sk.id))
    .reduce((s, sk) => s + sk.kcal, 0);

  const mealOpts = userData.mealOptions[menu.id] || {};

  document.getElementById('modalBody').innerHTML = `
    <div class="modal-nutrition-header">
      <div class="modal-nutrition-icon">${menu.icon}</div>
      <div class="modal-nutrition-meta">
        <h4>${menu.goal}</h4>
        <p>🔥 ${menu.kcal} &nbsp;|&nbsp; 💪 ${menu.protein}</p>
      </div>
    </div>
    <div class="meals-schedule">
      ${menu.meals.map(m => {
        const opts = getMealOptions(menu, m.key);
        const selIdx = mealOpts[m.key] ?? 0;
        const selText = opts[selIdx] || m.text;
        return `
        <div class="meal-schedule-item">
          <div class="meal-schedule-top">
            <span class="meal-schedule-icon">${m.icon}</span>
            <span class="meal-schedule-label">${m.label}</span>
            <input class="meal-time-input" type="time" value="${times[m.key] || ''}"
              onchange="setMealTime('${menu.id}','${m.key}',this.value)"
              placeholder="--:--" />
          </div>
          <div class="meal-options-chips">
            ${opts.map((opt, idx) => `
              <button class="meal-opt-chip ${idx === selIdx ? 'selected' : ''}"
                onclick="setMealOption('${menu.id}','${m.key}',${idx},this)">
                ${idx === 0 ? '⭐' : (idx+1)}
              </button>
            `).join('')}
          </div>
          <div class="meal-schedule-text" id="mealText_${menu.id}_${m.key}">${selText}</div>
        </div>
      `}).join('')}
    </div>

    <div class="snack-section">
      <div class="snack-section-title">🍎 Перекуси дня</div>
      <div class="snack-section-sub">Оберіть перекуси на сьогодні (натисніть щоб вибрати)</div>
      <div class="snack-grid" id="snackGrid_${menu.id}">${snackItems}</div>
      <div class="snack-total-bar" id="snackTotalBar_${menu.id}">
        <span class="snack-total-label">Калорії перекусів:</span>
        <span class="snack-total-num" id="snackTotalNum_${menu.id}">${totalSnackKcal} ккал</span>
      </div>
    </div>
  `;

  const isSaved = userData.savedNutrition.includes(menu.id);
  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-secondary" onclick="toggleSaveFromModal('nutrition','${menu.id}')">
      ${isSaved ? '⭐ Збережено' : '☆ Зберегти'}
    </button>
    <button class="btn btn-primary" onclick="closeModal()">Готово</button>
  `;

  openModal();
}

function toggleSnack(menuId, snackId, el) {
  if (!userData.selectedSnacks[menuId]) userData.selectedSnacks[menuId] = [];
  const arr = userData.selectedSnacks[menuId];
  const idx = arr.indexOf(snackId);
  if (idx === -1) arr.push(snackId);
  else            arr.splice(idx, 1);
  saveData();
  el.classList.toggle('selected', arr.includes(snackId));
  // update total
  const total = SNACK_OPTIONS
    .filter(sk => arr.includes(sk.id))
    .reduce((s, sk) => s + sk.kcal, 0);
  const numEl = document.getElementById(`snackTotalNum_${menuId}`);
  if (numEl) numEl.textContent = `${total} ккал`;
}

function setMealTime(menuId, key, value) {
  if (!userData.mealTimes[menuId]) userData.mealTimes[menuId] = {};
  userData.mealTimes[menuId][key] = value;
  saveData();
}

function setMealOption(menuId, mealKey, optIdx, btn) {
  if (!userData.mealOptions[menuId]) userData.mealOptions[menuId] = {};
  userData.mealOptions[menuId][mealKey] = optIdx;
  saveData();
  // update chips active state
  btn.closest('.meal-options-chips')?.querySelectorAll('.meal-opt-chip').forEach((c,i) => {
    c.classList.toggle('selected', i === optIdx);
  });
  // update displayed text
  const menu = currentModal?.data;
  if (menu) {
    const opts = getMealOptions(menu, mealKey);
    const textEl = document.getElementById(`mealText_${menuId}_${mealKey}`);
    if (textEl) textEl.textContent = opts[optIdx] || opts[0];
  }
}

// ═══════════════════════════════════════════════════════════
//   SPORT TAB
// ═══════════════════════════════════════════════════════════
document.querySelectorAll('.pill[data-scat]').forEach((pill) => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.pill[data-scat]').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    currentSportCat = pill.dataset.scat;
    renderSportCards();
  });
});

function renderSportCards() {
  const container  = document.getElementById('sportCards');
  container.innerHTML = '';

  const assignedIds = userData.corrections?.assignedSport || [];

  // ── Секція "Від тренера" ──
  if (assignedIds.length > 0 && currentSportCat !== 'saved') {
    const allFlat = [...SPORT_PROGRAMS.mass, ...SPORT_PROGRAMS.cut, ...SPORT_PROGRAMS.general];
    const assignedProgs = assignedIds.map(id => allFlat.find(p => p.id === id)).filter(Boolean);
    if (assignedProgs.length > 0) {
      const section = document.createElement('div');
      section.className = 'coach-assigned-section';
      section.innerHTML = `<div class="coach-assigned-title">🏋️ Від тренера</div>`;
      assignedProgs.forEach(prog => section.appendChild(buildSportCard(prog, true)));
      container.appendChild(section);
    }
  }

  // ── Звичайні картки ──
  let programs = [];
  if (currentSportCat === 'saved') {
    const all = [...SPORT_PROGRAMS.mass, ...SPORT_PROGRAMS.cut, ...SPORT_PROGRAMS.general];
    programs = all.filter(p => userData.savedSport.includes(p.id));
    if (programs.length === 0) {
      container.innerHTML += `<div class="empty-state"><div class="empty-state-icon">⭐</div><div class="empty-state-text">Збережених планів немає.<br>Натисни ⭐ щоб зберегти.</div></div>`;
      return;
    }
  } else {
    programs = SPORT_PROGRAMS[currentSportCat] || [];
  }

  programs.forEach(prog => container.appendChild(buildSportCard(prog, false)));
}

function buildSportCard(prog, isCoachAssigned) {
  const isSaved = userData.savedSport.includes(prog.id);
  const days = DAY_KEYS.map(d => {
    const focus  = prog.week[d]?.focus || '';
    const isRest = focus.includes('Відпочинок') || focus.includes('😴');
    return `<span class="day-chip ${isRest ? 'rest' : ''}">${getDayShort(d)}</span>`;
  }).join('');

  const card = document.createElement('div');
  card.className = `sport-card${isCoachAssigned ? ' coach-assigned-card' : ''}`;
  card.innerHTML = `
    <div class="card-top">
      <div class="card-name">${prog.name}</div>
      <button class="card-saved-btn ${isSaved ? 'saved' : ''}" onclick="toggleSaveSport('${prog.id}',event)">
        ${isSaved ? '⭐' : '☆'}
      </button>
    </div>
    <div class="card-badges">
      <span class="badge badge-orange">📊 ${prog.level}</span>
      <span class="badge badge-blue">⏱ ${prog.duration}</span>
      <span class="badge badge-green">😴 Відпочинок ${prog.rest}</span>
      ${isCoachAssigned ? '<span class="badge badge-coach">🏋️ Тренер</span>' : ''}
    </div>
    <div class="sport-days-row">${days}</div>
    <div class="sport-info-row">
      <div class="sport-info-item">📅 <span>${prog.days}</span></div>
    </div>
  `;
  card.addEventListener('click', () => openSportModal(prog));
  return card;
}

function getDayShort(d) {
  return { mon:'Пн', tue:'Вт', wed:'Ср', thu:'Чт', fri:'Пт', sat:'Сб', sun:'Нд' }[d] || d;
}
function getDayFull(d) {
  return { mon:'Понеділок', tue:'Вівторок', wed:'Середа', thu:'Четвер', fri:'П\'ятниця', sat:'Субота', sun:'Неділя' }[d] || d;
}

function toggleSaveSport(id, event) {
  event.stopPropagation();
  const idx = userData.savedSport.indexOf(id);
  if (idx === -1) { userData.savedSport.push(id); showToast('✅ Програму збережено!'); }
  else            { userData.savedSport.splice(idx, 1); showToast('🗑 Програму видалено'); }
  saveData();
  renderSportCards();
}

// ─── SPORT MODAL ──────────────────────────────────────────────
function openSportModal(prog) {
  currentModal = { type: 'sport', data: prog };
  const times = userData.sportTimes[prog.id] || {};

  document.getElementById('modalTitle').textContent = prog.name;
  document.getElementById('modalBody').innerHTML = `
    <div class="sport-modal-header">
      <div>
        <div class="card-badges" style="margin:0 0 6px">
          <span class="badge badge-orange">📊 ${prog.level}</span>
          <span class="badge badge-blue">⏱ ${prog.duration}</span>
        </div>
        <div style="font-size:13px;color:var(--tg-hint)">😴 Відпочинок між підходами: ${prog.rest}</div>
        <div style="font-size:12px;margin-top:6px;color:var(--yellow)">💡 ${prog.tip}</div>
      </div>
    </div>
    <div class="sport-week-schedule">
      ${DAY_KEYS.map(d => {
        const day = prog.week[d];
        if (!day) return '';
        const isRest = day.focus.includes('Відпочинок') || day.focus.includes('😴');
        return `
          <div class="sport-day-item">
            <div class="sport-day-top">
              <span class="sport-day-name">${getDayFull(d)}</span>
              <span class="sport-day-focus" style="${isRest ? 'background:rgba(138,138,154,0.1);color:var(--tg-hint);border-color:rgba(138,138,154,0.2)' : ''}">${day.focus}</span>
            </div>
            ${!isRest ? `
              <div class="sport-day-time-row">
                <span class="sport-day-time-label">⏰ Час тренування:</span>
                <input class="meal-time-input" type="time" value="${times[d] || ''}"
                  onchange="setSportTime('${prog.id}','${d}',this.value)" />
              </div>
            ` : ''}
            <div class="sport-exercises">
              ${day.exercises.map(ex => `<div class="sport-exercise">${ex}</div>`).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  const isSaved = userData.savedSport.includes(prog.id);
  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-secondary" onclick="toggleSaveFromModal('sport','${prog.id}')">
      ${isSaved ? '⭐ Збережено' : '☆ Зберегти'}
    </button>
    <button class="btn btn-primary" onclick="closeModal()">Готово</button>
  `;

  openModal();
}

function setSportTime(progId, day, value) {
  if (!userData.sportTimes[progId]) userData.sportTimes[progId] = {};
  userData.sportTimes[progId][day] = value;
  saveData();
}

// ═══════════════════════════════════════════════════════════
//   WEEK TAB
// ═══════════════════════════════════════════════════════════
document.querySelectorAll('.goal-card').forEach(btn => {
  btn.addEventListener('click', () => renderWeekPlan(btn.dataset.goal));
});

function renderWeekPlan(goal) {
  const template = WEEK_TEMPLATES[goal];
  if (!template) return;

  document.getElementById('weekGoalSelector').classList.add('hidden');
  const display = document.getElementById('weekPlanDisplay');
  display.classList.remove('hidden');

  const times = userData.weekTimes || {};

  display.innerHTML = `
    <div class="week-plan-header">
      <div class="week-plan-title">${template.name}</div>
      <button class="week-change-btn" onclick="changeWeekGoal()">↩ Змінити</button>
    </div>
    ${DAY_KEYS.map(d => {
      const day = template.schedule[d];
      if (!day) return '';
      const t = times[d] || {};
      return `
        <div class="week-day-card" id="wd_${d}">
          <div class="week-day-header" onclick="toggleWeekDay('${d}')">
            <span class="week-day-name">${day.label}</span>
            <span class="week-day-sport-label">${day.sport.substring(0,25)}${day.sport.length>25?'…':''}</span>
            <span class="week-day-chevron">▼</span>
          </div>
          <div class="week-day-body">
            <div class="day-detail-row">
              <span class="day-detail-icon">💪</span>
              <div class="day-detail-content">
                <div class="day-detail-label">Тренування</div>
                <div class="day-detail-value">${day.sport}</div>
              </div>
              <input class="meal-time-input" type="time" value="${t.sport || ''}"
                onchange="setWeekTime('${d}','sport',this.value)" style="flex-shrink:0" />
            </div>
            <div class="day-detail-row">
              <span class="day-detail-icon">🥗</span>
              <div class="day-detail-content">
                <div class="day-detail-label">Харчування</div>
                <div class="day-detail-value">${day.nutrition}</div>
              </div>
              <input class="meal-time-input" type="time" value="${t.nutrition || ''}"
                onchange="setWeekTime('${d}','nutrition',this.value)" style="flex-shrink:0" />
            </div>
            <div class="day-tip">${day.tip}</div>
          </div>
        </div>
      `;
    }).join('')}
    <button class="week-save-btn" onclick="saveWeekPlan('${goal}')">
      💾 Зберегти тижневий план
    </button>
  `;
}

function toggleWeekDay(d) {
  document.getElementById(`wd_${d}`)?.classList.toggle('open');
}
function changeWeekGoal() {
  document.getElementById('weekGoalSelector').classList.remove('hidden');
  const disp = document.getElementById('weekPlanDisplay');
  disp.classList.add('hidden');
  disp.innerHTML = '';
}
function setWeekTime(day, key, value) {
  if (!userData.weekTimes)       userData.weekTimes = {};
  if (!userData.weekTimes[day])  userData.weekTimes[day] = {};
  userData.weekTimes[day][key] = value;
  saveData();
}
function saveWeekPlan(goal) {
  userData.savedWeek = { goal, savedAt: new Date().toLocaleDateString('uk-UA') };
  saveData();
  showToast('✅ Тижневий план збережено!');
  if (tg) tg.HapticFeedback?.impactOccurred('medium');
}

// ═══════════════════════════════════════════════════════════
//   VITAMINS TAB
// ═══════════════════════════════════════════════════════════
function renderVitamins() {
  const container = document.getElementById('vitaminsContent');
  if (!profile.gender) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">💊</div><div class="empty-state-text">Заповніть профіль<br>для персональних рекомендацій</div></div>`;
    return;
  }

  const g = profile.gender;
  const a = profile.age;
  const w = profile.weight;

  const baseList   = VITAMINS[g] || [];
  const age30List  = a >= 30 ? VITAMINS.age30plus : [];
  const weight90List = w >= 90 ? VITAMINS.weight90plus : [];

  const genderLabel = g === 'male' ? `♂ Чоловік, ${a} р, ${w} кг` : `♀ Жінка, ${a} р, ${w} кг`;

  const renderCard = (vit) => {
    const priorityLabel = vit.priority === 'high' ? 'ОБОВ\'ЯЗКОВО' : vit.priority === 'medium' ? 'РЕКОМЕНДОВАНО' : 'ДОДАТКОВО';
    const priorityClass = vit.priority === 'high' ? 'priority-high' : vit.priority === 'medium' ? 'priority-medium' : 'priority-extra';
    return `
      <div class="vitamin-card" style="--vit-color:${vit.color}">
        <div class="vitamin-card-top">
          <div class="vitamin-icon-wrap">${vit.icon}</div>
          <div class="vitamin-info">
            <div class="vitamin-name-row">
              <span class="vitamin-name">${vit.name}</span>
              <span class="vitamin-priority-badge ${priorityClass}">${priorityLabel}</span>
            </div>
            <div class="vitamin-dose">${vit.dose}</div>
            <div class="vitamin-why">${vit.why}</div>
          </div>
        </div>
      </div>
    `;
  };

  let html = `
    <div class="vitamins-wrapper">
      <div class="vitamins-profile-bar">
        <span class="vitamins-profile-item">👤 <strong>${genderLabel}</strong></span>
        <span class="vitamins-profile-item">📏 ${profile.height} см</span>
      </div>

      <div class="vitamins-section-title">⭐ Основні вітаміни</div>
      ${baseList.map(renderCard).join('')}
  `;

  if (age30List.length) {
    html += `<div class="vitamins-section-title">🕐 30+ — Антивікові добавки</div>`;
    html += age30List.map(renderCard).join('');
  }

  if (weight90List.length) {
    html += `<div class="vitamins-section-title">⚖️ Метаболічна підтримка (90+ кг)</div>`;
    html += weight90List.map(renderCard).join('');
  }

  html += `
      <div class="vitamins-disclaimer">
        ⚠️ <span>Перед прийомом будь-яких добавок проконсультуйтесь з лікарем або нутриціологом. Дозування залежить від індивідуального стану здоров\'я.</span>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════
//   PROFILE TAB
// ═══════════════════════════════════════════════════════════
function renderProfile() {
  const container = document.getElementById('profileContent');
  const { bmr, tdee, loss, gain } = getProfileCalories();

  const heroText  = profile.gender === 'male' ? 'Сила. Результат. Прогрес.' : 'Краса. Здоров\'я. Баланс.';
  const genderIcon = profile.gender === 'male' ? '♂' : '♀';

  const goalLabel = { mass: '💪 Набір маси', cut: '🔥 Схуднення', balance: '⚖️ Підтримка форми' };
  const targetCal = profile.goal === 'mass' ? gain : profile.goal === 'cut' ? loss : tdee;

  // Weight quick btns
  const weightQuick = [50,60,70,80,90,100,110,120];
  // Height quick btns
  const heightQuick = [150,155,160,165,170,175,180,185,190,195,200];
  // Age quick btns
  const ageQuick = [18,20,25,30,35,40,45,50];

  container.innerHTML = `
    <div class="profile-wrapper">
      <div class="profile-hero-quote">${genderIcon} ${heroText}</div>

      <div class="profile-stats-grid">
        <div class="profile-stat-card">
          <div class="profile-stat-icon">🔥</div>
          <div class="profile-stat-value">${bmr}</div>
          <div class="profile-stat-label">BMR (ккал)</div>
        </div>
        <div class="profile-stat-card">
          <div class="profile-stat-icon">⚡</div>
          <div class="profile-stat-value">${tdee}</div>
          <div class="profile-stat-label">TDEE (ккал)</div>
        </div>
        <div class="profile-stat-card">
          <div class="profile-stat-icon">⚖️</div>
          <div class="profile-stat-value">${profile.weight}</div>
          <div class="profile-stat-label">Вага (кг)</div>
        </div>
        <div class="profile-stat-card">
          <div class="profile-stat-icon">📏</div>
          <div class="profile-stat-value">${profile.height}</div>
          <div class="profile-stat-label">Зріст (см)</div>
        </div>
      </div>

      <div class="profile-calorie-card">
        <div class="profile-calorie-title">Калорії для вашої цілі</div>
        <div class="profile-calorie-rows">
          <div class="profile-calorie-row">
            <span class="profile-calorie-label">🔥 Базовий обмін (BMR)</span>
            <span class="profile-calorie-value bmr">${bmr} ккал</span>
          </div>
          <div class="profile-calorie-row">
            <span class="profile-calorie-label">⚡ TDEE (помірна активність)</span>
            <span class="profile-calorie-value tdee">${tdee} ккал</span>
          </div>
          <div class="profile-calorie-row">
            <span class="profile-calorie-label">🔥 Для схуднення</span>
            <span class="profile-calorie-value loss">${loss} ккал</span>
          </div>
          <div class="profile-calorie-row">
            <span class="profile-calorie-label">💪 Для набору маси</span>
            <span class="profile-calorie-value gain">${gain} ккал</span>
          </div>
          <div class="profile-calorie-row" style="border-top:1px solid var(--card-border);padding-top:10px;margin-top:4px">
            <span class="profile-calorie-label">🎯 Ціль: ${goalLabel[profile.goal] || ''}</span>
            <span class="profile-calorie-value" style="color:var(--accent)">${targetCal} ккал</span>
          </div>
        </div>
      </div>

      <div class="profile-edit-section">
        <div class="profile-edit-title">✏️ Редагувати профіль</div>

        <!-- Name -->
        <div class="profile-edit-row">
          <div class="profile-edit-label">Ім'я</div>
          <div class="profile-name-wrap">
            <input class="profile-name-input" id="profileNameInput" type="text"
              value="${profile.name || ''}" maxlength="30" placeholder="Введіть ім'я..."
              onchange="profileSetName(this.value)" />
          </div>
        </div>

        <!-- Gender -->
        <div class="profile-edit-row">
          <div class="profile-edit-label">Стать</div>
          <div class="gender-toggle">
            <button class="gender-toggle-btn ${profile.gender === 'male' ? 'active' : ''}"
              onclick="profileSetGender('male',this)">♂ Чоловік</button>
            <button class="gender-toggle-btn ${profile.gender === 'female' ? 'active' : ''}"
              onclick="profileSetGender('female',this)">♀ Жінка</button>
          </div>
        </div>

        <!-- Age -->
        <div class="profile-edit-row">
          <div class="profile-edit-label">Вік</div>
          <div class="val-selector">
            <div class="val-selector-btns">
              <button class="val-btn" onclick="profileAdjust('age',-1)">−</button>
              <span class="val-display" id="profileAgeVal">${profile.age}</span>
              <button class="val-btn" onclick="profileAdjust('age',1)">+</button>
            </div>
          </div>
          <div class="val-quick-btns" style="margin-top:8px">
            ${ageQuick.map(v => `<button class="val-quick-btn ${profile.age === v ? 'active' : ''}" onclick="profileSetVal('age',${v})">${v}</button>`).join('')}
          </div>
        </div>

        <!-- Weight -->
        <div class="profile-edit-row">
          <div class="profile-edit-label">Вага (кг)</div>
          <div class="val-selector">
            <div class="val-selector-btns">
              <button class="val-btn" onclick="profileAdjust('weight',-1)">−</button>
              <span class="val-display" id="profileWeightVal">${profile.weight}</span>
              <button class="val-btn" onclick="profileAdjust('weight',1)">+</button>
            </div>
          </div>
          <div class="val-quick-btns" style="margin-top:8px">
            ${weightQuick.map(v => `<button class="val-quick-btn ${profile.weight === v ? 'active' : ''}" onclick="profileSetVal('weight',${v})">${v}</button>`).join('')}
          </div>
        </div>

        <!-- Height -->
        <div class="profile-edit-row">
          <div class="profile-edit-label">Зріст (см)</div>
          <div class="val-selector">
            <div class="val-selector-btns">
              <button class="val-btn" onclick="profileAdjust('height',-1)">−</button>
              <span class="val-display" id="profileHeightVal">${profile.height}</span>
              <button class="val-btn" onclick="profileAdjust('height',1)">+</button>
            </div>
          </div>
          <div class="val-quick-btns" style="margin-top:8px">
            ${heightQuick.map(v => `<button class="val-quick-btn ${profile.height === v ? 'active' : ''}" onclick="profileSetVal('height',${v})">${v}</button>`).join('')}
          </div>
        </div>

        <!-- Goal -->
        <div class="profile-edit-row">
          <div class="profile-edit-label">Ціль</div>
          <div class="goal-selector-row">
            <button class="goal-selector-btn ${profile.goal === 'mass' ? 'active' : ''}" onclick="profileSetGoal('mass',this)">💪 Набір маси</button>
            <button class="goal-selector-btn ${profile.goal === 'cut' ? 'active' : ''}" onclick="profileSetGoal('cut',this)">🔥 Схуднення</button>
            <button class="goal-selector-btn ${profile.goal === 'balance' ? 'active' : ''}" onclick="profileSetGoal('balance',this)">⚖️ Підтримка</button>
          </div>
        </div>

        <button class="profile-save-btn" onclick="saveProfileAndRefresh()">💾 Зберегти зміни</button>
      </div>
    </div>
  `;
}

function profileSetName(val) {
  profile.name = val.trim();
  saveProfile();
  document.getElementById('userBadge').textContent = profile.name || userName;
}

function profileSetGender(g, btn) {
  profile.gender = g;
  btn.closest('.gender-toggle').querySelectorAll('.gender-toggle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyTheme(g);
}

function profileAdjust(key, delta) {
  const min = { age: 10, weight: 30, height: 130 }[key] || 0;
  const max = { age: 99, weight: 250, height: 230 }[key] || 300;
  profile[key] = Math.min(max, Math.max(min, (profile[key] || 0) + delta));
  const el = document.getElementById(`profile${key.charAt(0).toUpperCase() + key.slice(1)}Val`);
  if (el) el.textContent = profile[key];
}

function profileSetVal(key, val) {
  profile[key] = val;
  const el = document.getElementById(`profile${key.charAt(0).toUpperCase() + key.slice(1)}Val`);
  if (el) el.textContent = val;
  // update active state of quick buttons
  document.querySelectorAll(`[onclick="profileSetVal('${key}',${val})"]`).forEach(b => {
    b.closest('.val-quick-btns')?.querySelectorAll('.val-quick-btn').forEach(qb => qb.classList.remove('active'));
    b.classList.add('active');
  });
}

function profileSetGoal(goal, btn) {
  profile.goal = goal;
  btn.closest('.goal-selector-row').querySelectorAll('.goal-selector-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function saveProfileAndRefresh() {
  saveProfile();
  showToast('✅ Профіль збережено!');
  if (tg) tg.HapticFeedback?.impactOccurred('medium');
  renderProfile();
  updateNutritionHeroSubtitle();
  updateCycleTabVisibility();
  renderNutritionCards();
}

// ═══════════════════════════════════════════════════════════
//   MODAL HELPERS
// ═══════════════════════════════════════════════════════════
function openModal() {
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('detailModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.getElementById('detailModal').classList.remove('open');
  document.body.style.overflow = '';
  currentModal = null;
  renderNutritionCards();
}

function toggleSaveFromModal(type, id) {
  if (type === 'nutrition') {
    const idx = userData.savedNutrition.indexOf(id);
    if (idx === -1) { userData.savedNutrition.push(id); showToast('✅ Збережено!'); }
    else            { userData.savedNutrition.splice(idx, 1); showToast('🗑 Видалено'); }
    saveData();
    const btn = document.querySelector('#modalFooter .btn-secondary');
    if (btn) btn.textContent = userData.savedNutrition.includes(id) ? '⭐ Збережено' : '☆ Зберегти';
  } else if (type === 'sport') {
    const idx = userData.savedSport.indexOf(id);
    if (idx === -1) { userData.savedSport.push(id); showToast('✅ Збережено!'); }
    else            { userData.savedSport.splice(idx, 1); showToast('🗑 Видалено'); }
    saveData();
    const btn = document.querySelector('#modalFooter .btn-secondary');
    if (btn) btn.textContent = userData.savedSport.includes(id) ? '⭐ Збережено' : '☆ Зберегти';
  }
  renderSportCards();
}

// ═══════════════════════════════════════════════════════════
//   TOAST
// ═══════════════════════════════════════════════════════════
let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  if (tg) tg.HapticFeedback?.impactOccurred('light');
}

// ═══════════════════════════════════════════════════════════
//   NAV: показати/сховати таб "Цикл" залежно від статі
// ═══════════════════════════════════════════════════════════
function updateCycleTabVisibility() {
  const btn = document.getElementById('navCycle');
  if (!btn) return;
  if (profile.gender === 'female') {
    btn.classList.remove('hidden');
  } else {
    btn.classList.add('hidden');
  }
}

// ═══════════════════════════════════════════════════════════
//   MENSTRUAL CALENDAR
// ═══════════════════════════════════════════════════════════
const CYCLE_SYMPTOMS = [
  { id: 'cramps',    icon: '😣', label: 'Спазми' },
  { id: 'headache',  icon: '🤕', label: 'Головний біль' },
  { id: 'bloating',  icon: '😮', label: 'Здуття' },
  { id: 'mood',      icon: '😢', label: 'Перепади настрою' },
  { id: 'fatigue',   icon: '😴', label: 'Втома' },
  { id: 'spotting',  icon: '🩸', label: 'Мазня' },
  { id: 'tender',    icon: '💛', label: 'Чутливість грудей' },
  { id: 'acne',      icon: '😬', label: 'Висипання' },
];

const CYCLE_PHASES = [
  { name: 'Менструація', color: '#ef4444', desc: 'Відпочинок, залізо, тепло. Уникай інтенсивних тренувань.' },
  { name: 'Фолікулярна', color: '#22c55e', desc: 'Енергія росте. Час для нових починань і тренувань.' },
  { name: 'Овуляція', color: '#eab308', desc: 'Пік енергії. Найкращий час для важливих справ.' },
  { name: 'Лютеїнова', color: '#a855f7', desc: 'Відновлення. Більше сну, магнію, спокою.' },
];

let currentCycleDay = null; // { date: 'YYYY-MM-DD', dayOfCycle: N }

function getCycleData() {
  if (!userData.cycle) {
    userData.cycle = {
      lastPeriod: null,
      cycleLength: 28,
      periodLength: 5,
      symptoms: {},
      notes: {},
    };
  }
  return userData.cycle;
}

function getCycleDayPhase(dayNum, cycleLen, periodLen) {
  if (dayNum <= periodLen) return 0; // menstruation
  if (dayNum <= 13) return 1;         // follicular
  if (dayNum === 14) return 2;        // ovulation
  return 3;                           // luteal
}

function renderCycleTab() {
  const container = document.getElementById('cycleContent');
  if (!container) return;
  const cd = getCycleData();

  // Setup bar
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  let setupHtml = '';
  if (!cd.lastPeriod) {
    setupHtml = `
      <div class="cycle-setup-card">
        <div class="cycle-setup-icon">🌸</div>
        <div class="cycle-setup-title">Налаштуйте цикл</div>
        <p class="cycle-setup-sub">Вкажіть перший день останньої менструації</p>
        <label class="cycle-label">Перший день менструації</label>
        <input type="date" class="cycle-date-input" id="cycleLastPeriodInput" value="${todayStr}" max="${todayStr}">
        <div class="cycle-row">
          <div>
            <label class="cycle-label">Тривалість циклу (дні)</label>
            <input type="number" class="cycle-num-input" id="cycleLengthInput" value="${cd.cycleLength}" min="21" max="45">
          </div>
          <div>
            <label class="cycle-label">Тривалість менструації</label>
            <input type="number" class="cycle-num-input" id="cyclePeriodInput" value="${cd.periodLength}" min="2" max="10">
          </div>
        </div>
        <button class="cycle-save-setup-btn" onclick="saveCycleSetup()">💾 Зберегти та почати</button>
      </div>
    `;
    container.innerHTML = setupHtml;
    return;
  }

  // Calculate current day of cycle
  const lastPeriod = new Date(cd.lastPeriod);
  const diffDays = Math.floor((today - lastPeriod) / 86400000);
  const currentDayOfCycle = (diffDays % cd.cycleLength) + 1;
  const phaseIdx = getCycleDayPhase(currentDayOfCycle, cd.cycleLength, cd.periodLength);
  const phase = CYCLE_PHASES[phaseIdx];

  // Next period prediction
  const daysToNext = cd.cycleLength - currentDayOfCycle;
  const nextPeriod = new Date(today);
  nextPeriod.setDate(nextPeriod.getDate() + daysToNext);
  const nextStr = nextPeriod.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });

  // Next ovulation
  const daysToOvulation = 14 - currentDayOfCycle;
  let ovulationStr = '';
  if (daysToOvulation > 0) {
    ovulationStr = `через ${daysToOvulation} дн.`;
  } else if (daysToOvulation === 0) {
    ovulationStr = 'сьогодні';
  } else {
    ovulationStr = 'вже минула';
  }

  // Build calendar grid (current month)
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const adjustedFirst = (firstDay + 6) % 7; // Mon=0

  const monthName = today.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });

  let calDays = '';
  // empty cells
  for (let i = 0; i < adjustedFirst; i++) {
    calDays += `<div class="cal-day empty"></div>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayDiff = Math.floor((new Date(dateStr) - lastPeriod) / 86400000);
    const dayOfCycle = ((dayDiff % cd.cycleLength) + cd.cycleLength) % cd.cycleLength + 1;
    const pi = getCycleDayPhase(dayOfCycle, cd.cycleLength, cd.periodLength);
    const isToday = dateStr === todayStr;
    const hasSymptoms = cd.symptoms[dateStr] && cd.symptoms[dateStr].length > 0;
    const hasNote = cd.notes[dateStr];
    calDays += `
      <div class="cal-day ${isToday ? 'cal-today' : ''}"
           style="--phase-color:${CYCLE_PHASES[pi].color}"
           onclick="openCycleDayModal('${dateStr}',${dayOfCycle})">
        <div class="cal-day-num">${d}</div>
        <div class="cal-day-phase-dot" style="background:${CYCLE_PHASES[pi].color}"></div>
        ${hasSymptoms ? '<div class="cal-day-sym">●</div>' : ''}
        ${hasNote ? '<div class="cal-day-note-dot">✏</div>' : ''}
      </div>`;
  }

  container.innerHTML = `
    <div class="cycle-status-card" style="--phase-color:${phase.color}">
      <div class="cycle-status-top">
        <div class="cycle-day-big">${currentDayOfCycle}</div>
        <div class="cycle-status-info">
          <div class="cycle-phase-name" style="color:${phase.color}">${phase.name}</div>
          <div class="cycle-phase-desc">${phase.desc}</div>
        </div>
      </div>
      <div class="cycle-predictions">
        <div class="cycle-pred-item">
          <span class="cycle-pred-icon">🩸</span>
          <span class="cycle-pred-label">Наступна менструація</span>
          <span class="cycle-pred-val">${nextStr} (через ${daysToNext} дн.)</span>
        </div>
        <div class="cycle-pred-item">
          <span class="cycle-pred-icon">🥚</span>
          <span class="cycle-pred-label">Овуляція</span>
          <span class="cycle-pred-val">${ovulationStr}</span>
        </div>
      </div>
    </div>

    <div class="cycle-legend">
      ${CYCLE_PHASES.map(p => `<span class="cycle-legend-item"><span style="background:${p.color}" class="cycle-legend-dot"></span>${p.name}</span>`).join('')}
    </div>

    <div class="cycle-calendar">
      <div class="cycle-cal-header">${monthName.charAt(0).toUpperCase() + monthName.slice(1)}</div>
      <div class="cal-weekdays">
        <span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Нд</span>
      </div>
      <div class="cal-grid">${calDays}</div>
    </div>

    <button class="cycle-reset-btn" onclick="resetCycleSetup()">⚙️ Налаштувати цикл</button>
  `;
}

function saveCycleSetup() {
  const cd = getCycleData();
  cd.lastPeriod  = document.getElementById('cycleLastPeriodInput')?.value || null;
  cd.cycleLength = parseInt(document.getElementById('cycleLengthInput')?.value) || 28;
  cd.periodLength= parseInt(document.getElementById('cyclePeriodInput')?.value) || 5;
  userData.cycle = cd;
  saveData();
  renderCycleTab();
  showToast('✅ Цикл збережено!');
}

function resetCycleSetup() {
  userData.cycle = null;
  saveData();
  renderCycleTab();
}

// --- Day modal ---
let currentCycleDateStr = null;
function openCycleDayModal(dateStr, dayOfCycle) {
  currentCycleDateStr = dateStr;
  const cd = getCycleData();
  const symptoms = cd.symptoms[dateStr] || [];
  const note = cd.notes[dateStr] || '';
  const dateLabel = new Date(dateStr).toLocaleDateString('uk-UA', { day:'numeric', month:'long' });

  document.getElementById('cycleDayTitle').textContent = `${dateLabel} · День ${dayOfCycle}`;
  document.getElementById('cycleDayNote').value = note;
  document.getElementById('cycleSymptomsGrid').innerHTML = CYCLE_SYMPTOMS.map(s => `
    <label class="cycle-symptom-item ${symptoms.includes(s.id) ? 'active' : ''}">
      <input type="checkbox" value="${s.id}" ${symptoms.includes(s.id) ? 'checked' : ''}
        onchange="toggleCycleSymptom(this)">
      <span class="cycle-sym-icon">${s.icon}</span>
      <span class="cycle-sym-label">${s.label}</span>
    </label>
  `).join('');

  document.getElementById('cycleDayOverlay').classList.remove('hidden');
  document.getElementById('cycleDayModal').classList.remove('hidden');
}

function toggleCycleSymptom(el) {
  el.closest('.cycle-symptom-item').classList.toggle('active', el.checked);
}

function saveCycleDayData() {
  const cd = getCycleData();
  const checkboxes = document.querySelectorAll('#cycleSymptomsGrid input[type="checkbox"]');
  const selected = [...checkboxes].filter(c => c.checked).map(c => c.value);
  const note = document.getElementById('cycleDayNote').value.trim();

  if (selected.length > 0) cd.symptoms[currentCycleDateStr] = selected;
  else delete cd.symptoms[currentCycleDateStr];

  if (note) cd.notes[currentCycleDateStr] = note;
  else delete cd.notes[currentCycleDateStr];

  userData.cycle = cd;
  saveData();
  closeCycleDayModal();
  renderCycleTab();
  showToast('✅ Збережено!');
}

function closeCycleDayModal() {
  document.getElementById('cycleDayOverlay').classList.add('hidden');
  document.getElementById('cycleDayModal').classList.add('hidden');
}

// ═══════════════════════════════════════════════════════════
//   NOTEPAD
// ═══════════════════════════════════════════════════════════
let currentNoteId = null;
let currentNoteColor = '#ff6b6b';

function getNotes() {
  if (!userData.notes) userData.notes = [];
  return userData.notes;
}

function renderNotesTab() {
  const grid = document.getElementById('notesGrid');
  if (!grid) return;
  const notes = getNotes();

  // Apply saved background
  const bg = localStorage.getItem(`hp_notesbg_${userId}`);
  const section = document.getElementById('tab-notes');
  if (bg && section) section.style.backgroundImage = `url(${bg})`;

  if (notes.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">📓</div><div class="empty-state-text">Нотаток немає.<br>Натисни "+ Нова нотатка"</div></div>`;
    return;
  }

  grid.innerHTML = notes.map(note => `
    <div class="note-card" style="background:${note.color}" onclick="openNoteModal('${note.id}')">
      <div class="note-card-title">${note.title || 'Без назви'}</div>
      <div class="note-card-text">${note.text ? note.text.slice(0, 80) + (note.text.length > 80 ? '…' : '') : ''}</div>
      <div class="note-card-date">${note.createdAt || ''}</div>
    </div>
  `).join('');
}

function setNotesBg(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    localStorage.setItem(`hp_notesbg_${userId}`, e.target.result);
    const section = document.getElementById('tab-notes');
    if (section) section.style.backgroundImage = `url(${e.target.result})`;
    showToast('✅ Фон оновлено!');
  };
  reader.readAsDataURL(file);
}

function openNoteModal(noteId) {
  currentNoteId = noteId || null;
  const notes = getNotes();
  const note = noteId ? notes.find(n => n.id === noteId) : null;

  document.getElementById('noteModalTitle').textContent = note ? 'Редагувати' : 'Нова нотатка';
  document.getElementById('noteTitleInput').value = note?.title || '';
  document.getElementById('noteTextInput').value = note?.text || '';
  document.getElementById('noteDeleteBtn').classList.toggle('hidden', !note);

  const color = note?.color || '#ff6b6b';
  currentNoteColor = color;
  document.querySelectorAll('.note-color-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.color === color);
  });

  document.getElementById('noteModalOverlay').classList.remove('hidden');
  document.getElementById('noteModal').classList.remove('hidden');
}

function closeNoteModal() {
  document.getElementById('noteModalOverlay').classList.add('hidden');
  document.getElementById('noteModal').classList.add('hidden');
  currentNoteId = null;
}

function selectNoteColor(color, btn) {
  currentNoteColor = color;
  document.querySelectorAll('.note-color-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function saveCurrentNote() {
  const title = document.getElementById('noteTitleInput').value.trim();
  const text  = document.getElementById('noteTextInput').value.trim();
  if (!title && !text) { showToast('⚠️ Введіть текст або заголовок'); return; }

  const notes = getNotes();
  if (currentNoteId) {
    const idx = notes.findIndex(n => n.id === currentNoteId);
    if (idx !== -1) {
      notes[idx].title = title;
      notes[idx].text  = text;
      notes[idx].color = currentNoteColor;
    }
  } else {
    notes.unshift({
      id: 'note_' + Date.now(),
      title, text,
      color: currentNoteColor,
      createdAt: new Date().toLocaleDateString('uk-UA'),
    });
  }
  userData.notes = notes;
  saveData();
  closeNoteModal();
  renderNotesTab();
  showToast('✅ Нотатку збережено!');
}

function deleteCurrentNote() {
  if (!currentNoteId) return;
  userData.notes = getNotes().filter(n => n.id !== currentNoteId);
  saveData();
  closeNoteModal();
  renderNotesTab();
  showToast('🗑 Нотатку видалено');
}

// ═══════════════════════════════════════════════════════════
//   COACH DASHBOARD
// ═══════════════════════════════════════════════════════════
let currentCoach = null;
let currentStudentId = null;

function launchCoachDashboard(coach) {
  currentCoach = coach;
  document.getElementById('coachDashboard').classList.remove('hidden');
  document.getElementById('appMain').classList.add('hidden');
  document.getElementById('bottomNav').classList.add('hidden');
  document.getElementById('appHeader') && document.getElementById('appHeader').classList.add('hidden');

  document.getElementById('coachHeaderName').textContent = coach.name;
  document.getElementById('coachInviteCode').textContent = coach.inviteCode;

  loadStudentsList();
}

async function loadStudentsList() {
  const listEl = document.getElementById('coachStudentsList');
  listEl.innerHTML = '<div class="coach-loading">Завантаження...</div>';

  try {
    const res = await fetch(`/api/coach/${currentCoach.id}/students`);
    const students = await res.json();

    if (!students.length) {
      listEl.innerHTML = `
        <div class="coach-empty">
          <div class="coach-empty-icon">👥</div>
          <div class="coach-empty-title">Учнів поки немає</div>
          <div class="coach-empty-sub">Поділіться кодом запрошення з учнями</div>
          <div class="coach-invite-big" onclick="copyInviteCode()">
            🔗 ${currentCoach.inviteCode}
            <span class="coach-invite-hint">Натисніть, щоб скопіювати</span>
          </div>
        </div>
      `;
      return;
    }

    listEl.innerHTML = `
      <div class="coach-section-title">👥 Мої учні (${students.length}/10)</div>
      <div class="coach-invite-bar" onclick="copyInviteCode()">
        🔗 Код запрошення: <b>${currentCoach.inviteCode}</b>
        <span class="coach-copy-hint">скопіювати</span>
      </div>
      <div class="coach-students-list">
        ${students.map(s => renderStudentCard(s)).join('')}
      </div>
    `;
  } catch {
    listEl.innerHTML = '<div class="coach-error">Помилка завантаження</div>';
  }
}

function renderStudentCard(student) {
  const p = student.profile || {};
  const name = p.name || `Учень`;
  const gender = p.gender === 'female' ? '♀' : '♂';
  const stats = p.weight ? `${p.weight} кг · ${p.height} см · ${p.age} р` : 'Профіль не заповнено';
  const hasCorrections = student.corrections && (
    student.corrections.nutritionNote || student.corrections.sportNote
  );

  return `
    <div class="coach-student-card" onclick="openStudent('${student.id}')">
      <div class="coach-student-avatar">${gender}</div>
      <div class="coach-student-info">
        <div class="coach-student-name">${name}</div>
        <div class="coach-student-stats">${stats}</div>
      </div>
      <div class="coach-student-right">
        ${hasCorrections ? '<span class="coach-correction-badge">✏️</span>' : ''}
        <span class="coach-student-arrow">›</span>
      </div>
    </div>
  `;
}

// ─── Поточні дані відкритого учня ─────────────────────────
let currentStudentData  = null;
let currentStudentTab   = 'notes'; // 'notes' | 'nutrition' | 'sport'
// Тимчасовий стан вибору планів тренером
let draftNutrition = [];
let draftSport     = [];

async function openStudent(studentId) {
  currentStudentId = studentId;
  document.getElementById('coachStudentsList').classList.add('hidden');
  document.getElementById('coachStudentView').classList.remove('hidden');

  const contentEl = document.getElementById('coachStudentContent');
  contentEl.innerHTML = '<div class="coach-loading">Завантаження...</div>';

  try {
    const res = await fetch(`/api/coach/${currentCoach.id}/student/${studentId}`);
    const studentData = await res.json();
    if (studentData.error) {
      contentEl.innerHTML = `<div class="coach-error">${studentData.error}</div>`;
      return;
    }
    currentStudentData = studentData;
    const p = studentData.profile || {};
    document.getElementById('coachStudentName').textContent = p.name || 'Учень';

    // ініціалізуємо чернетки з поточних корективів
    const corr = studentData.corrections || {};
    draftNutrition = [...(corr.assignedNutrition || [])];
    draftSport     = [...(corr.assignedSport || [])];

    currentStudentTab = 'notes';
    renderStudentView();
  } catch {
    contentEl.innerHTML = '<div class="coach-error">Помилка завантаження</div>';
  }
}

function renderStudentView() {
  if (!currentStudentData) return;
  const contentEl = document.getElementById('coachStudentContent');
  const p = currentStudentData.profile || {};
  const corr = currentStudentData.corrections || {};

  const tabs = [
    { id: 'notes',     label: '📋 Нотатки' },
    { id: 'nutrition', label: '🥗 Харчування' },
    { id: 'sport',     label: '💪 Тренування' },
  ];

  contentEl.innerHTML = `
    <div class="coach-student-profile-card">
      <div class="coach-sp-row"><span>Ім'я</span><b>${p.name || '—'}</b></div>
      <div class="coach-sp-row"><span>Стать</span><b>${p.gender === 'female' ? '♀ Жінка' : '♂ Чоловік'}</b></div>
      <div class="coach-sp-row"><span>Вік / Вага / Зріст</span><b>${p.age || '—'} р · ${p.weight || '—'} кг · ${p.height || '—'} см</b></div>
    </div>

    <div class="coach-tabs">
      ${tabs.map(t => `
        <button class="coach-tab ${currentStudentTab === t.id ? 'active' : ''}"
          onclick="switchStudentTab('${t.id}')">${t.label}</button>
      `).join('')}
    </div>

    <div id="coachTabContent"></div>
  `;

  renderStudentTab();
}

function switchStudentTab(tab) {
  currentStudentTab = tab;
  document.querySelectorAll('.coach-tab').forEach(b => {
    b.classList.toggle('active', b.textContent.includes(
      tab === 'notes' ? 'Нотатки' : tab === 'nutrition' ? 'Харчування' : 'Тренування'
    ));
  });
  renderStudentTab();
}

function renderStudentTab() {
  const el = document.getElementById('coachTabContent');
  if (!el) return;
  if      (currentStudentTab === 'notes')     renderNotesTab_coach(el);
  else if (currentStudentTab === 'nutrition') renderNutritionPicker(el);
  else if (currentStudentTab === 'sport')     renderSportPicker(el);
}

// ── Вкладка Нотатки ──────────────────────────────────────
function renderNotesTab_coach(el) {
  const corr = currentStudentData.corrections || {};
  el.innerHTML = `
    <div class="coach-corrections-section">
      <p class="coach-corrections-hint">Нотатки відображаються учню в банері при вході в додаток.</p>

      <div class="coach-corr-block">
        <label class="coach-corr-label">📋 Загальне повідомлення</label>
        <textarea class="coach-corr-textarea" id="corrGeneral"
          placeholder="Мотивація, загальні рекомендації...">${corr.generalNote || ''}</textarea>
      </div>
      <div class="coach-corr-block">
        <label class="coach-corr-label">🥗 Нотатка щодо харчування</label>
        <textarea class="coach-corr-textarea" id="corrNutrition"
          placeholder="Напр.: виключити глютен, більше білка ввечері...">${corr.nutritionNote || ''}</textarea>
      </div>
      <div class="coach-corr-block">
        <label class="coach-corr-label">💪 Нотатка щодо тренувань</label>
        <textarea class="coach-corr-textarea" id="corrSport"
          placeholder="Напр.: збільшити кількість підходів у присіданнях...">${corr.sportNote || ''}</textarea>
      </div>

      <button class="coach-save-btn" onclick="saveStudentNotes()">💾 Зберегти нотатки</button>
    </div>
  `;
}

async function saveStudentNotes() {
  const corr = currentStudentData.corrections || {};
  corr.generalNote   = document.getElementById('corrGeneral').value.trim();
  corr.nutritionNote = document.getElementById('corrNutrition').value.trim();
  corr.sportNote     = document.getElementById('corrSport').value.trim();
  corr.updatedAt     = new Date().toISOString();
  await patchCorrections(corr);
}

// ── Вкладка Харчування ────────────────────────────────────
function renderNutritionPicker(el) {
  const p = currentStudentData.profile || {};
  const gender = p.gender || 'male';
  const allMenus = gender === 'female' ? NUTRITION_MENUS_FEMALE : NUTRITION_MENUS_MALE;
  const allFlat  = [...(allMenus.mass||[]), ...(allMenus.cut||[]), ...(allMenus.balance||[])];

  const count = draftNutrition.length;
  el.innerHTML = `
    <div class="coach-corrections-section">
      <p class="coach-corrections-hint">Оберіть меню харчування для учня. Вибрані плани з'являться у нього у секції "Від тренера 🏋️".</p>
      <div class="coach-pick-counter">${count > 0 ? `✅ Обрано: ${count}` : 'Нічого не обрано'}</div>
      <div class="coach-pick-list">
        ${allFlat.map(m => renderPickCard(m, draftNutrition.includes(m.id), 'nutrition')).join('')}
      </div>
      <button class="coach-save-btn" style="margin-top:16px" onclick="saveStudentNutrition()">
        💾 Зберегти харчування (${count})
      </button>
    </div>
  `;
}

function renderPickCard(item, selected, type) {
  const isMenu = type === 'nutrition';
  const badge  = isMenu
    ? `<span class="badge badge-green">🔥 ${item.kcal}</span><span class="badge badge-blue">💪 ${item.protein}</span>`
    : `<span class="badge badge-orange">📊 ${item.level}</span><span class="badge badge-blue">⏱ ${item.duration}</span>`;

  return `
    <div class="coach-pick-card ${selected ? 'selected' : ''}"
         onclick="togglePickItem('${item.id}','${type}')">
      <div class="coach-pick-check">${selected ? '✅' : '○'}</div>
      <div class="coach-pick-info">
        <div class="coach-pick-name">${item.name}</div>
        <div class="coach-pick-badges">${badge}</div>
      </div>
    </div>
  `;
}

function togglePickItem(id, type) {
  const arr = type === 'nutrition' ? draftNutrition : draftSport;
  const idx = arr.indexOf(id);
  if (idx === -1) arr.push(id);
  else arr.splice(idx, 1);
  // перерендеримо лише вкладку
  renderStudentTab();
}

async function saveStudentNutrition() {
  const corr = currentStudentData.corrections || {};
  corr.assignedNutrition = [...draftNutrition];
  corr.updatedAt = new Date().toISOString();
  await patchCorrections(corr);
}

// ── Вкладка Тренування ────────────────────────────────────
function renderSportPicker(el) {
  const allFlat = [...SPORT_PROGRAMS.mass, ...SPORT_PROGRAMS.cut, ...SPORT_PROGRAMS.general];
  const count = draftSport.length;
  el.innerHTML = `
    <div class="coach-corrections-section">
      <p class="coach-corrections-hint">Оберіть програми тренувань для учня. Вибрані програми з'являться у нього у секції "Від тренера 🏋️".</p>
      <div class="coach-pick-counter">${count > 0 ? `✅ Обрано: ${count}` : 'Нічого не обрано'}</div>
      <div class="coach-pick-list">
        ${allFlat.map(p => renderPickCard(p, draftSport.includes(p.id), 'sport')).join('')}
      </div>
      <button class="coach-save-btn" style="margin-top:16px" onclick="saveStudentSport()">
        💾 Зберегти тренування (${count})
      </button>
    </div>
  `;
}

async function saveStudentSport() {
  const corr = currentStudentData.corrections || {};
  corr.assignedSport = [...draftSport];
  corr.updatedAt = new Date().toISOString();
  await patchCorrections(corr);
}

// ── Спільна функція збереження корективів ─────────────────
async function patchCorrections(corr) {
  try {
    const res = await fetch(`/api/coach/${currentCoach.id}/corrections/${currentStudentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corr),
    });
    const data = await res.json();
    if (data.ok) {
      currentStudentData.corrections = corr;
      showToast('✅ Збережено!');
    } else {
      showToast('❌ Помилка збереження');
    }
  } catch {
    showToast('❌ Помилка');
  }
}

function backToStudentsList() {
  currentStudentId = null;
  document.getElementById('coachStudentView').classList.add('hidden');
  document.getElementById('coachStudentsList').classList.remove('hidden');
  loadStudentsList();
}

function copyInviteCode() {
  if (!currentCoach) return;
  const code = currentCoach.inviteCode;
  navigator.clipboard.writeText(code).then(() => {
    showToast(`📋 Код ${code} скопійовано!`);
  }).catch(() => {
    showToast(`Код: ${code}`);
  });
}

// ─── QR Modal ────────────────────────────────────────────────
function openQrModal() {
  if (!currentCoach) return;
  const code = currentCoach.inviteCode;

  // Генеруємо QR через безкоштовний API
  const qrData = encodeURIComponent(code);
  const qrUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${qrData}`;

  document.getElementById('qrCodeWrap').innerHTML =
    `<img src="${qrUrl}" alt="QR" class="qr-image" />`;
  document.getElementById('qrInviteCodeText').textContent = code;

  document.getElementById('qrOverlay').classList.remove('hidden');
  document.getElementById('qrModal').classList.remove('hidden');
}

function closeQrModal() {
  document.getElementById('qrOverlay').classList.add('hidden');
  document.getElementById('qrModal').classList.add('hidden');
}
