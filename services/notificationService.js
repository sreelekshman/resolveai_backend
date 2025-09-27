const Complaint = require('../models/Complaint');
const User = require('../models/User');

class NotificationService {
    static async sendComplaintNotification(complaintId) {
        try {
            const complaint = await Complaint.findById(complaintId);
            if (!complaint) {
                throw new Error('Complaint not found');
            }

            const userid = complaint.submittedBy;
            const user = await User.findById(userid);
            if (!user) {
                throw new Error('User not found');
            }

            // Simulate sending notification (e.g., email, SMS)
            console.log(`Notification sent to ${user.email}: Your complaint with ID ${complaintId} has been received.`);

            return true;
        } catch (error) {
            console.error('Error sending notification:', error);
            return false;
        }
    }
}

module.exports = NotificationService;