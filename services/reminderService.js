const Complaint = require('../models/Complaint');
const NotificationService = require('./notificationService');

class ReminderService {
  static async sendFollowUpReminders() {
    try {
      console.log('📅 Checking for follow-up reminders...');
      
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      
      // Find complaints that haven't been updated in 2 days
      const staleComplaints = await Complaint.find({
        status: { $in: ['pending', 'in-progress'] },
        updatedAt: { $lt: twoDaysAgo },
        lastReminderSent: { $ne: true }
      }).populate('submittedBy assignedTo');

      console.log(`📬 Found ${staleComplaints.length} complaints needing reminders`);

      for (const complaint of staleComplaints) {
        await NotificationService.sendReminderNotification(complaint);
        
        // Mark reminder as sent
        complaint.lastReminderSent = true;
        await complaint.save();
      }

      return staleComplaints.length;
    } catch (error) {
      console.error('❌ Reminder service error:', error);
      return 0;
    }
  }

  static async notifyStatusUpdates() {
    try {
      console.log('🔔 Checking for status updates to notify users...');
    }
  }
    
}

module.exports = ReminderService;