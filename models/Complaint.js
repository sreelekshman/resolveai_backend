const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['academic', 'facilities', 'hostel', 'transport', 'food', 'other'],
    required: true
  },
  department: {
    type: String,
    enum: ['academic', 'administration', 'hostel', 'technical', 'canteen', 'security', 'management', 'emergency', 'housekeeping', 'other'],
    required: true
  },
  academic_department: {
    type: String,
    enum: ["additional_languages", "animation", "cinema_and_television", "design", "economics", "english", "journalism", "social_work", "sociology", "aquaculture", "botany", "environmental_studies", "chemistry", "computer_science", "mathematics", "physics", "psychology", "zoology", "commerce", "management", "physical_education"],
    required: function() {
      return this.department === 'academic';
    }
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'resolved', 'closed'],
    default: 'pending'
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  resolutionNotes: String,

  attachments: [{
    filename: String,
    path: String,
    mimetype: String
  }],
  comments: [{
    text: String,
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Complaint', complaintSchema);
