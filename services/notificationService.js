const Complaint = require('../models/Complaint');
const User = require('../models/User');
const nodemailer = require('nodemailer');

class NotificationService {
    static async createTransporter() {
        return nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER, // Your Gmail address
                pass: process.env.EMAIL_PASS  // App password (not regular password)
            }
        });
    }

    static async sendComplaintNotification(complaintId) {
        try {
            const complaint = await Complaint.findById(complaintId)
                .populate('submittedBy', 'name email');
            
            if (!complaint) {
                throw new Error('Complaint not found');
            }

            const transporter = await this.createTransporter();
            
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: complaint.submittedBy.email,
                subject: `Complaint Received - ${complaint.title}`,
                html: `
                    <h3>Dear ${complaint.submittedBy.name},</h3>
                    <p>Your complaint has been successfully submitted.</p>
                    <p><strong>Complaint ID:</strong> ${complaintId}</p>
                    <p><strong>Title:</strong> ${complaint.title}</p>
                    <p><strong>Status:</strong> ${complaint.status}</p>
                    <p><strong>Department:</strong> ${complaint.department}</p>
                    <br>
                    <p>We will update you on the progress soon.</p>
                    <p>Best regards,<br>ResolveAI Team</p>
                `
            };

            await transporter.sendMail(mailOptions);
            console.log(`Email sent to ${complaint.submittedBy.email}: Complaint ${complaintId} received`);
            
            return true;
        } catch (error) {
            console.error('Error sending email notification:', error);
            return false;
        }
    }

    static async sendStatusUpdateNotification(complaintId, newStatus, resolutionNote = '') {
        try {
            const complaint = await Complaint.findById(complaintId)
                .populate('submittedBy', 'name email');
            
            const transporter = await this.createTransporter();
            
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: complaint.submittedBy.email,
                subject: `Complaint Update - ${complaint.title}`,
                html: `
                    <h3>Dear ${complaint.submittedBy.name},</h3>
                    <p>Your complaint status has been updated.</p>
                    <p><strong>Complaint ID:</strong> ${complaintId}</p>
                    <p><strong>Title:</strong> ${complaint.title}</p>
                    <p><strong>New Status:</strong> ${newStatus}</p>
                    ${resolutionNote ? `<p><strong>Resolution Note:</strong> ${resolutionNote}</p>` : ''}
                    <br>
                    <p>Best regards,<br>ResolveAI Team</p>
                `
            };

            await transporter.sendMail(mailOptions);
            return true;
        } catch (error) {
            console.error('Error sending status update email:', error);
            return false;
        }
    }
}

module.exports = NotificationService;