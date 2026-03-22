require('dotenv').config();
const { connectDB } = require('./db');
const { Telegraf }  = require('telegraf');
const { mainMenu, roleSelect, openAppBtn } = require('./keyboards');

const BOT_TOKEN  = process.env.BOT_TOKEN  || '8273043198:AAF5jP22NngrrujV9jOmhgGCZqRGygSwZxo';
const WEB_APP_URL = process.env.WEB_APP_URL || 'http://localhost:3000';

(async () => {
  await connectDB();       // підключаємо MongoDB
  require('./server');     // запускаємо Express

  const bot = new Telegraf(BOT_TOKEN);

  const roleText = (name) =>
    `👋 Привіт, *${name}*!\n\n` +
    `🏋️ Ласкаво просимо до *Health Planner*!\n\n` +
    `Оберіть тип акаунту:`;

  const welcomeText = (name, roleLabel) =>
    `✅ Ви обрали: *${roleLabel}*\n\n` +
    `👋 Привіт, *${name}*!\n\n` +
    `🏋️ *Health Planner* — твій персональний помічник:\n\n` +
    `🥗 20 збалансованих меню харчування\n` +
    `💪 9 планів тренувань (маса / схуднення / форма)\n` +
    `📅 Готові тижневі програми\n` +
    `⏰ Розклад часу для кожної активності\n\n` +
    `Натисни кнопку нижче щоб відкрити додаток 👇`;

  bot.start((ctx) => {
    ctx.reply(roleText(ctx.from.first_name), {
      parse_mode: 'Markdown',
      ...roleSelect,
    });
  });

  const roleLabels = { role_guest: '👤 Гість', role_coach: '🏋️ Тренер', role_student: '🎓 Учень' };
  const roleKeys   = { role_guest: 'guest',    role_coach: 'coach',      role_student: 'student' };

  ['role_guest', 'role_coach', 'role_student'].forEach((action) => {
    bot.action(action, (ctx) => {
      ctx.answerCbQuery();
      const name  = ctx.from.first_name;
      const role  = roleKeys[action];
      const label = roleLabels[action];
      ctx.editMessageText(welcomeText(name, label), {
        parse_mode: 'Markdown',
        ...openAppBtn(WEB_APP_URL, role),
      });
    });
  });

  bot.command('app',  (ctx) => ctx.reply('Відкрий свій планувальник:', mainMenu(WEB_APP_URL)));
  bot.command('menu', (ctx) => ctx.reply(roleText(ctx.from.first_name), {
    parse_mode: 'Markdown',
    ...roleSelect,
  }));

  bot.launch().then(() => {
    console.log('🤖 Health Planner Bot запущено!');
    console.log(`🌐 Webapp URL: ${WEB_APP_URL}`);
  });

  process.once('SIGINT',  () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
})();
