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

const backToMain = Markup.inlineKeyboard([
  [Markup.button.callback('⬅️ Головне меню', 'main_menu')],
]);

module.exports = { mainMenu, backToMain, DAYS_UA };
