require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

const auth = require('./middleware/auth');
const Complaint = require('./models/Complaint');

const NotificationService = require('./services/notificationService');
const BackgroundScheduler = require('./schedulers/backgroundScheduler');
const telegramService = require('./services/telegramService');
const telegramBot = require('./services/telegramChatBot');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }))

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/ResolveAI' , {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB Connected Successfully');
  BackgroundScheduler.start();
})

.catch((err) => console.error('❌ MongoDB Connection Error:', err));

// Test route
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Backend server is running!',
    timestamp: new Date().toISOString()
  });
});

// User Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role, department, studentId, staffId } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      department,
      studentId: role === 'student' ? studentId : undefined,
      staffId: role === 'staff' ? staffId : undefined
    });
    
    await user.save();
    
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role, department: user.department },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      }
    });
    console.log(`User ${user.email} logged in.`);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new complaint (Students only)
app.post('/api/complaints', auth, async (req, res) => {
  try {
    const { title, description, category, department, academic_department, priority } = req.body;

    const complaint = new Complaint({
      title,
      description,
      category,
      department,
      priority,
      submittedBy: req.user._id,
    });

    if (department === 'academic' && academic_department) {
      complaint.academic_department = academic_department;
    }
    else {
      complaint.academic_department = null;
    }
    
    await complaint.save();
    await complaint.populate('submittedBy', 'name email role');

    await NotificationService.sendComplaintNotification(complaint._id);
    
    res.status(201).json(complaint);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get complaints (Role-based access)
app.get('/api/complaints', auth, async (req, res) => {
  try {
    let filter = {};
    
    // Students can only see their own complaints
    if (req.user.role === 'student') {
      filter.submittedBy = req.user._id;
    }
    // Staff can see complaints from their department
    else if (req.user.role === 'staff') {
      filter.academic_department = req.user.department;
    }
    else if (req.user.role === 'admin') {
      // Admin can see all complaints
    }
    
    const complaints = await Complaint.find(filter)
      .populate('submittedBy', 'name email role')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const { spawn } = require('child_process');
const path = require('path');
const TelegramService = require('./services/telegramService');
const { env } = require('process');

// Process complaint using AI (Staff/Admin only)
app.post('/api/complaints/process', auth, async (req, res) => {
  try {
    // // Check if user has permission to process complaints
    // if (req.user.role === 'student') {
    //   return res.status(403).json({ error: 'Not authorized' });
    // }

    const { complaintText } = req.body;
    
    if (!complaintText || complaintText.trim() === '') {
      return res.status(400).json({ error: 'Complaint text is required' });
    }

    // Use virtual environment Python
    const pythonPath = path.join(__dirname, '.venv', 'bin', 'python');
    const pythonProcess = spawn(pythonPath, [
      path.join(__dirname, 'input_processor.py'),
      complaintText
    ]);

    let result = '';
    let error = '';

    pythonProcess.stdout.on('data', (data) => {
      result += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Python process error:', error);
        return res.status(500).json({ error: 'Failed to process complaint' });
      }

      try {
        const processedData = JSON.parse(result);
        
        if (processedData.error) {
          return res.status(500).json({ error: processedData.error });
        }

        res.json({
          success: true,
          processedComplaint: processedData
        });
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        res.status(500).json({ error: 'Failed to parse processed data' });
      }
    });

  } catch (error) {
    console.error('Process complaint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update complaint status (Staff/Admin only)
app.put('/api/complaints/:id/status', auth, async (req, res) => {
  try {
    // Check if user has permission to update
    if (req.user.role === 'student') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const { status, assignedTo } = req.body;
    const complaint = await Complaint.findById(req.params.id);
    
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    
    // Staff can only update complaints from their department
    if (req.user.role === 'staff' && complaint.department !== req.user.department) {
      return res.status(403).json({ error: 'Not authorized for this department' });
    }
    
    complaint.status = status;
    if (assignedTo) complaint.assignedTo = assignedTo;
    
    await complaint.save();
    await complaint.populate('submittedBy', 'name email role');
    await complaint.populate('assignedTo', 'name email');
    
    res.json(complaint);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Get single complaint details
app.get('/api/complaints/:id', auth, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('submittedBy', 'name email role')
      .populate('assignedTo', 'name email');
    
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    
    // Check access permissions
    if (req.user.role === 'student' && complaint.submittedBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    if (req.user.role === 'staff' && complaint.department !== req.user.department) {
      return res.status(403).json({ error: 'Not authorized for this department' });
    }
    
    res.json(complaint);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Forwarding complaint to another department
app.post('/api/complaints/:id/forward', auth, async (req, res) => {
  try {
    // Check if user has permission to forward complaints
    if (req.user.role === 'student') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { department } = req.body;
    const { academic_department } = req.body;
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    // Staff can only forward complaints from their department
    if (req.user.role === 'staff' && (complaint.department !== req.user.department && complaint.academic_department !== req.user.department)) {
      return res.status(403).json({ error: 'Not authorized for this department' });
    }

    complaint.department = department;
    complaint.academic_department = academic_department;
    complaint.updatedBy = req.user._id;

    await complaint.save();
    await complaint.populate('updatedBy', 'name email');

    res.json({ success: true, complaint });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Complaint Status
app.post('/api/complaints/status/:id', auth, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    if (req.user.role === 'staff' && (complaint.department !== req.user.department && complaint.academic_department !== req.user.department)) {
      return res.status(403).json({ error: 'Not authorized for this department' });
    }

    const {status} = req.body;
    complaint.status = status;
    complaint.updatedBy.push(req.user._id);

    await complaint.save();
    await complaint.populate('updatedBy', 'name email');
    await telegramService.sendMessageToUser(process.env.USERID, `Your complaint titled "${complaint.title}" has been updated to status: ${complaint.status}`);

    res.json(complaint);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
