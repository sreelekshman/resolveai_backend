const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['student', 'staff', 'admin'],
    default: 'student'
  },
  department: {
    type: String,
    enum: ['academic', 'administration', 'hostel', 'technical', 'canteen', 'security', 'management', 'emergency', 'housekeeping', 'other', "additional_languages", "animation", "cinema_and_television", "design", "economics", "english", "journalism", "social_work", "sociology", "aquaculture", "botany", "environmental_studies", "chemistry", "computer_science", "mathematics", "physics", "psychology", "zoology", "commerce", "management", "physical_education"],
    required: function() {return this.role != 'admin'; }
  },
  studentId: {
    type: String,
    required: function() { return this.role === 'student'; }
  },
  staffId: {
    type: String,
    required: function() { return this.role === 'staff'; }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
