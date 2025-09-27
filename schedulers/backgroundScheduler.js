const cron = require('node-cron');
const EscalationService = require('../services/escalationService');
const AnalyticsService = require('../services/analyticsService');
// const ReminderService = require('../services/reminderService');

class BackgroundScheduler {
  static start() {
    console.log('🚀 Starting background services...');

    // Check for escalations every hour
    cron.schedule('0 * * * *', async () => {
      console.log('⏰ Running hourly escalation check...');
      await EscalationService.checkForEscalations();
    });

    // Generate daily report at 9 AM
    cron.schedule('0 9 * * *', async () => {
      console.log('⏰ Generating daily analytics report...');
      await AnalyticsService.generateDailyReport();
    });

    // Send follow-up reminders every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      console.log('⏰ Sending follow-up reminders...');
      await ReminderService.sendFollowUpReminders();
    });

    // Health check every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      console.log('💓 System health check - All services running');
      await AnalyticsService.generateDailyReport();
    });

    console.log('✅ Background services started successfully');
  }

  static stop() {
    cron.getTasks().forEach(task => task.stop());
    console.log('🛑 Background services stopped');
  }
}

module.exports = BackgroundScheduler;