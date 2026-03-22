require('dotenv').config();
const { connectDB } = require('./db');
const { Telegraf }  = require('telegraf');
const { mainMenu }  = require('./keyboards');

const BOT_TOKEN  = process.env.BOT_TOKEN  || '8273043198:AAF5jP22NngrrujV9jOmhgGCZqRGygSwZxo';
const WEB_APP_URL = process.env.WEB_APP_URL || 'http://localhost:3000';

(async () => {
  await connectDB();       // підключаємо MongoDB
  require('./server');     // запускаємо Express

  const bot = new Telegraf(BOT_TOKEN);

  const welcomeText = (name) =>
    `👋 Привіт, *${name}*!\n\n` +
    `🏋️ *Health Planner* — твій персональний помічник:\n\n` +
    `🥗 20 збалансованих меню харчування\n` +
    `💪 9 планів тренувань (маса / схуднення / форма)\n` +
    `📅 Готові тижневі програми\n` +
    `⏰ Розклад часу для кожної активності\n\n` +
    `Натисни кнопку нижче щоб відкрити додаток 👇`;

  bot.start((ctx) => {
    ctx.reply(welcomeText(ctx.from.first_name), {
      parse_mode: 'Markdown',
      ...mainMenu(WEB_APP_URL),
    });
  });

  bot.command('app',  (ctx) => ctx.reply('Відкрий свій планувальник:', mainMenu(WEB_APP_URL)));
  bot.command('menu', (ctx) => ctx.reply(welcomeText(ctx.from.first_name), {
    parse_mode: 'Markdown',
    ...mainMenu(WEB_APP_URL),
  }));

  bot.launch().then(() => {
    console.log('🤖 Health Planner Bot запущено!');
    console.log(`🌐 Webapp URL: ${WEB_APP_URL}`);
  });

  process.once('SIGINT',  () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
})();
