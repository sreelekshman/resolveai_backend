const Complaint = require('../models/Complaint');
const User = require('../models/User');
const NotificationService = require('./notificationService');

class EscalationService {
  // Define escalation hierarchy
  static ESCALATION_LEVELS = [
    { level: 1, department: 'department', role: 'staff' },      // Department level
    { level: 2, department: 'administration', role: 'staff' },  // Administration level  
    { level: 3, department: 'management', role: 'staff' }       // Management level
  ];

  static async checkForEscalations() {
    try {
      console.log('🔍 Checking for complaints that need escalation...');
      
      const now = new Date();
      
      // Find complaints that need escalation based on time and priority
      const overdueComplaints = await Complaint.find({
        status: { $in: ['pending', 'in-progress'] },
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
      }).populate('submittedBy assignedTo');

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
      // Determine current escalation level
      const currentLevel = complaint.escalationLevel || 0;
      const nextLevel = currentLevel + 1;

      // Find next level in hierarchy
      if (nextLevel > this.ESCALATION_LEVELS.length) {
        console.log(`⚠️ Complaint ${complaint._id} already at highest escalation level`);
        return false;
      }

      const escalationTarget = this.ESCALATION_LEVELS[nextLevel - 1];
      
      // Find appropriate person to escalate to
      let assignee;
      
      if (escalationTarget.level === 1) {
        // Level 1: Department staff (current department)
        assignee = await this.findDepartmentStaff(complaint.department, complaint.academic_department);
      } else if (escalationTarget.level === 2) {
        // Level 2: Administration
        assignee = await this.findAdministrationStaff();
      } else if (escalationTarget.level === 3) {
        // Level 3: Management  
        assignee = await this.findManagementStaff();
      }

      if (!assignee) {
        console.log(`⚠️ No assignee found for escalation level ${nextLevel}`);
        return false;
      }

      // Update complaint with escalation info
      complaint.escalationLevel = nextLevel;
      complaint.escalatedAt = new Date();
      complaint.assignedTo = assignee._id;
      complaint.escalationHistory = complaint.escalationHistory || [];
      complaint.escalationHistory.push({
        level: nextLevel,
        assignedTo: assignee._id,
        escalatedAt: new Date(),
        reason: 'Time-based escalation due to inactivity'
      });

      await complaint.save();

      console.log(`📈 Escalated complaint ${complaint._id} to level ${nextLevel} (${assignee.name})`);

      // Send escalation notification
      await this.sendEscalationNotification(complaint, assignee, nextLevel);

      return true;
    } catch (error) {
      console.error('❌ Error escalating complaint:', error);
      return false;
    }
  }

  static async findDepartmentStaff(department, academicDepartment = null) {
    try {
      // For academic complaints, look for staff in specific academic department first
      if (department === 'academic' && academicDepartment) {
        const academicStaff = await User.findOne({
          role: 'staff',
          department: academicDepartment
        });
        if (academicStaff) return academicStaff;
      }

      // Fallback to general department staff
      return await User.findOne({
        role: 'staff', 
        department: department
      });
    } catch (error) {
      console.error('Error finding department staff:', error);
      return null;
    }
  }

  static async findAdministrationStaff() {
    try {
      return await User.findOne({
        role: 'staff',
        department: 'administration'
      });
    } catch (error) {
      console.error('Error finding administration staff:', error);
      return null;
    }
  }

  static async findManagementStaff() {
    try {
      return await User.findOne({
        role: 'staff', 
        department: 'management'
      });
    } catch (error) {
      console.error('Error finding management staff:', error);
      return null;
    }
  }

  static async sendEscalationNotification(complaint, assignee, level) {
    try {
      // You can implement email/notification logic here
      console.log(`📧 Sending escalation notification for complaint ${complaint._id} to ${assignee.name} (Level ${level})`);
      
      // Example notification logic
      await NotificationService.sendEscalationNotification({
        complaint,
        assignee, 
        escalationLevel: level
      });
    } catch (error) {
      console.error('Error sending escalation notification:', error);
    }
  }
}

module.exports = EscalationService;