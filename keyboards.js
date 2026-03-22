const { Markup } = require('telegraf');

const DAYS_UA = {
  mon: 'Понеділок',
  tue: 'Вівторок',
  wed: 'Середа',
  thu: 'Четвер',
  fri: 'П\'ятниця',
  sat: 'Субота',
  sun: 'Неділя',
};

function mainMenu(webAppUrl) {
  return Markup.inlineKeyboard([
    [Markup.button.webApp('🚀 Відкрити додаток', webAppUrl)],
  ]);
}

const roleSelect = Markup.inlineKeyboard([
  [Markup.button.callback('👤 Гість',  'role_guest')],
  [Markup.button.callback('🏋️ Тренер', 'role_coach')],
  [Markup.button.callback('🎓 Учень',  'role_student')],
]);

function openAppBtn(webAppUrl, role) {
  const url = `${webAppUrl.trim()}?role=${role}`;
  return Markup.inlineKeyboard([
    [Markup.button.webApp('🚀 Відкрити додаток', url)],
  ]);
}

const backToMain = Markup.inlineKeyboard([
  [Markup.button.callback('⬅️ Головне меню', 'main_menu')],
]);

module.exports = { mainMenu, backToMain, roleSelect, openAppBtn, DAYS_UA };
