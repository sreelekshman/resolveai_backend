const TelegramBot = require('node-telegram-bot-api');

const botToken = process.env.TELEGRAM_BOT_TOKEN;

class TelegramService {
    constructor(botToken) {
        this.bot = new TelegramBot(botToken, { polling: false });
    }

    async sendMessage(chatId, message, options = {}) {
        try {
            const result = await this.bot.sendMessage(chatId, message, options);
            return { success: true, messageId: result.message_id };
        } catch (error) {
            console.error('Error sending Telegram message:', error);
            return { success: false, error: error.message };
        }
    }

    async sendMessageToUser(userId, message, options = {}) {
        return await this.sendMessage(userId, message, options);
    }

    async sendFormattedMessage(chatId, message, parseMode = 'HTML') {
        return await this.sendMessage(chatId, message, { parse_mode: parseMode });
    }
}

// Create and export a singleton instance
const telegramService = new TelegramService(botToken);
module.exports = telegramService;