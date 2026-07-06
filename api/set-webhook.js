const TelegramBot = require("node-telegram-bot-api");
const BOT_TOKEN = "8724667418:AAFSz9FkGQd0DlyCf6TnrsVKdke-4xnx1Aw";
const bot = new TelegramBot(BOT_TOKEN);

module.exports = async (req, res) => {
  try {
    const webhookUrl = `https://${req.headers.host}/api/telegram-webhook`;
    await bot.setWebHook(webhookUrl);
    res.status(200).send(`Webhook successfully configured to: ${webhookUrl}`);
  } catch (err) {
    res.status(500).send(`Failed to configure Telegram webhook: ${err.message}`);
  }
};
