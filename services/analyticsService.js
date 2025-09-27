const Complaint = require('../models/Complaint');
const User = require('../models/User');

class AnalyticsService {
  static async generateDailyReport() {
    try {
      console.log('📊 Generating daily analytics report...');
      
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      // Get complaints created in last 24 hours
      const newComplaints = await Complaint.countDocuments({
        createdAt: { $gte: yesterday }
      });

      // Get resolved complaints in last 24 hours
      const resolvedComplaints = await Complaint.countDocuments({
        status: 'resolved',
        updatedAt: { $gte: yesterday }
      });

      // Get pending complaints by department
      const pendingByDept = await Complaint.aggregate([
        { $match: { status: { $in: ['pending', 'in-progress'] } } },
        { $group: { _id: '$department', count: { $sum: 1 } } }
      ]);

      // Get average resolution time
      const avgResolutionTime = await this.calculateAverageResolutionTime();

      const report = {
        date: today.toISOString().split('T')[0],
        newComplaints,
        resolvedComplaints,
        pendingByDept,
        avgResolutionTime,
        timestamp: new Date()
      };

      console.log('📈 Daily Report:', JSON.stringify(report, null, 2));
      
      // You can save this to database or send via email
      return report;
    } catch (error) {
      console.error('❌ Analytics error:', error);
      return null;
    }
  }

  static async calculateAverageResolutionTime() {
    try {
      const resolvedComplaints = await Complaint.find({
        status: 'resolved',
        updatedAt: { $exists: true }
      });

      if (resolvedComplaints.length === 0) return 0;

      const totalTime = resolvedComplaints.reduce((sum, complaint) => {
        const resolutionTime = complaint.updatedAt - complaint.createdAt;
        return sum + resolutionTime;
      }, 0);

      return Math.round(totalTime / resolvedComplaints.length / (1000 * 60 * 60)); // in hours
    } catch (error) {
      console.error('❌ Error calculating resolution time:', error);
      return 0;
    }
  }
}

module.exports = AnalyticsService;