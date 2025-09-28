require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const langgraphService = require('./langgraphService');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Telegram Handler
bot.on('message', async (msg) => {
    if (!msg.text) return;
    
    try {
        const threadId = msg.chat.id.toString();
        const result = await langgraphService.LLMResponse(msg.text, threadId);

        bot.sendMessage(msg.chat.id, result);
    } catch (error) {
        bot.sendMessage(msg.chat.id, `Error processing message: ${error.message}`);
    }
});

console.log('Bot running...');
