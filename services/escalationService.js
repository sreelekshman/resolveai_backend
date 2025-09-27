const Complaint = require('../models/Complaint');
const User = require('../models/User');
const NotificationService = require('./notificationService');

class EscalationService {
  static async checkForEscalations() {
    try {
      console.log('🔍 Checking for complaints that need escalation...');
      
      const now = new Date();
      
      // Find complaints that need escalation based on time and priority
      const overdueComplaints = await Complaint.find({
        status: { $in: ['pending', 'in-progress'] },
        escalated: { $ne: true },
        $or: [
          {
            priority: 'urgent',
            createdAt: { $lt: new Date(now.getTime() - 2 * 60 * 60 * 1000) } // 2 hours
          },
          {
            priority: 'high',
            createdAt: { $lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } // 24 hours
          },
          {
            priority: 'medium',
            createdAt: { $lt: new Date(now.getTime() - 72 * 60 * 60 * 1000) } // 72 hours
          },
          {
            priority: 'low',
            createdAt: { $lt: new Date(now.getTime() - 168 * 60 * 60 * 1000) } // 1 week
          }
        ]
      }).populate('submittedBy');

      console.log(`⚡ Found ${overdueComplaints.length} complaints for escalation`);

      for (const complaint of overdueComplaints) {
        await this.escalateComplaint(complaint);
      }

      return overdueComplaints.length;
    } catch (error) {
      console.error('❌ Escalation check error:', error);
      return 0;
    }
  }

  static async escalateComplaint(complaint) {
    try {
      // Find department head or management
      const departmentHead = await User.findOne({
        department: complaint.department,
        role: 'staff'
      });

      // Mark as escalated
      complaint.escalated = true;
      complaint.escalatedAt = new Date();
      if (departmentHead) {
        complaint.assignedTo = departmentHead._id;
      }
      await complaint.save();

      console.log(`📈 Escalated complaint: ${complaint.title} (ID: ${complaint._id})`);

      // Send escalation notification
      await NotificationService.sendEscalationNotification(complaint);

      return true;
    } catch (error) {
      console.error('❌ Error escalating complaint:', error);
      return false;
    }
  }
}

module.exports = EscalationService;