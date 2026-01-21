console.log("🔥 server.js loaded");

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: '*' } });

// Middleware - FIXED: Set charset for JSON responses
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(express.static('frontend'));
app.use('/backend/uploads', express.static('backend/uploads'));

// Set UTF-8 charset for all responses
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// MongoDB Connection - FIXED: Emojis in console
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// Gemini AI Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Database Schemas
const patientSchema = new mongoose.Schema({
  name: String,
  dob: Date,
  gender: String,
  address: String,
  phone: String,
  email: { type: String, unique: true },
  password: String,
  profilePhoto: String,
  stressAssessment: Object,
  selectedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
  role: { type: String, default: 'patient' },
  registrationCompleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const doctorSchema = new mongoose.Schema({
  name: String,
  specialization: String,
  proof: String,
  timeSlot: String,
  dob: Date,
  phone: String,
  email: { type: String, unique: true },
  password: String,
  profilePhoto: String,
  approved: { type: Boolean, default: false },
  role: { type: String, default: 'doctor' },
  createdAt: { type: Date, default: Date.now }
});

const adminSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  profilePhoto: String,
  role: { type: String, default: 'admin' },
  createdAt: { type: Date, default: Date.now }
});

const todoSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  date: { type: Date, default: Date.now },
  tasks: [{
    task: String,
    completed: Boolean,
    reason: String
  }]
});

const wellnessSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  date: { type: Date, default: Date.now },
  mood: String,
  sleepHours: Number,
  stressLevel: Number,
  notes: String,
  todoCompleted: Boolean
});

const resourceSchema = new mongoose.Schema({
  uploadedBy: { type: mongoose.Schema.Types.ObjectId },
  uploaderRole: String,
  type: String, // audio, video, article
  fileName: String,
  filePath: String,
  title: String,
  description: String,
  approved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const appointmentSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
  date: Date,
  time: String,
  reason: String,
  status: { type: String, default: 'pending' }, // pending, approved, rejected
  createdAt: { type: Date, default: Date.now }
});

const complaintSchema = new mongoose.Schema({
  complainerId: { type: mongoose.Schema.Types.ObjectId },
  complainerRole: String,
  againstId: { type: mongoose.Schema.Types.ObjectId },
  againstRole: String,
  subject: String,
  description: String,
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId },
  receiverId: { type: mongoose.Schema.Types.ObjectId },
  messageType: String, // text, voice
  content: String,
  seen: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});

// Models
const Patient = mongoose.model('Patient', patientSchema);
const Doctor = mongoose.model('Doctor', doctorSchema);
const Admin = mongoose.model('Admin', adminSchema);
const Todo = mongoose.model('Todo', todoSchema);
const Wellness = mongoose.model('Wellness', wellnessSchema);
const Resource = mongoose.model('Resource', resourceSchema);
const Appointment = mongoose.model('Appointment', appointmentSchema);
const Complaint = mongoose.model('Complaint', complaintSchema);
const Message = mongoose.model('Message', messageSchema);

// ============================================
// PART 1: FIX FOR server.js - Multer Configuration
// ============================================

// CRITICAL FIX: Use multer.diskStorage with file extension detection
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = 'backend/uploads/';
    
    console.log('Multer - File fieldname:', file.fieldname);
    console.log('Multer - File mimetype:', file.mimetype);
    
    // Check fieldname first
    if (file.fieldname === 'profilePhoto') {
      uploadPath += 'profiles/';
    } else if (file.fieldname === 'proof') {
      uploadPath += 'doctor-proofs/';
    } 
    // CRITICAL FIX: For resources, detect type from MIMETYPE
    else if (file.fieldname === 'file') {
      // Use mimetype to determine folder since req.body is not available yet
      if (file.mimetype.startsWith('audio/')) {
        uploadPath += 'audio/';
        console.log('✅ Detected AUDIO from mimetype');
      } else if (file.mimetype.startsWith('video/')) {
        uploadPath += 'video/';
        console.log('✅ Detected VIDEO from mimetype');
      } else if (file.mimetype === 'application/pdf') {
        uploadPath += 'pdfarticle/';
        console.log('✅ Detected PDF from mimetype');
      } else {
        uploadPath += 'profiles/';
        console.log('⚠️ Unknown type, defaulting to profiles');
      }
    } else {
      uploadPath += 'profiles/';
    }
    
    console.log('✅ Final upload path:', uploadPath);
    
    // Ensure directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
      console.log('📁 Created directory:', uploadPath);
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.]/g, '-');
    const finalFilename = uniqueSuffix + '-' + sanitizedFilename;
    console.log('✅ Generated filename:', finalFilename);
    cb(null, finalFilename);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    console.log('File filter - mimetype:', file.mimetype);
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
      'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3', 'audio/x-m4a',
      'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
      'application/pdf'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}`));
    }
  }
});

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// ============ REGISTRATION ENDPOINTS ============

// Patient Registration - Step 1: Basic Info
app.post('/api/patient/register/step1', async (req, res) => {
  try {
    const { name, dob, gender, address, phone, email, password } = req.body;
    const existingPatient = await Patient.findOne({ email });
    if (existingPatient) return res.status(400).json({ error: 'Email already exists' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const patient = new Patient({
      name, dob, gender, address, phone, email,
      password: hashedPassword
    });
    await patient.save();
    res.json({ success: true, patientId: patient._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Patient Registration - Step 2: Profile Photo
app.post('/api/patient/register/step2', upload.single('profilePhoto'), async (req, res) => {
  try {
    const { patientId } = req.body;
    const patient = await Patient.findById(patientId);
    patient.profilePhoto = req.file.path;
    await patient.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Patient Registration - Step 3: Assessment & Doctor Selection
app.post('/api/patient/register/step3', async (req, res) => {
  try {
    const { patientId, stressAssessment, selectedDoctor } = req.body;
    const patient = await Patient.findById(patientId);
    patient.stressAssessment = stressAssessment;
    patient.selectedDoctor = selectedDoctor;
    patient.registrationCompleted = true;
    await patient.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Doctor Registration Request - Step 1: Basic Info
app.post('/api/doctor/register/step1', async (req, res) => {
  try {
    const { name, specialization, timeSlot, dob, phone, email, password } = req.body;
    const existingDoctor = await Doctor.findOne({ email });
    if (existingDoctor) return res.status(400).json({ error: 'Email already exists' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const doctor = new Doctor({
      name, specialization, timeSlot, dob, phone, email,
      password: hashedPassword
    });
    await doctor.save();
    res.json({ success: true, doctorId: doctor._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Doctor Registration - Step 2: Profile & Proof
app.post('/api/doctor/register/step2', upload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'proof', maxCount: 1 }
]), async (req, res) => {
  try {
    const { doctorId } = req.body;
    const doctor = await Doctor.findById(doctorId);
    doctor.profilePhoto = req.files.profilePhoto[0].path;
    doctor.proof = req.files.proof[0].path;
    await doctor.save();
    res.json({ success: true, message: 'Registration request sent to admin' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin Registration - Step 1: Basic Info
app.post('/api/admin/register/step1', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) return res.status(400).json({ error: 'Email already exists' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = new Admin({ name, email, password: hashedPassword });
    await admin.save();
    res.json({ success: true, adminId: admin._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin Registration - Step 2: Profile Photo
app.post('/api/admin/register/step2', upload.single('profilePhoto'), async (req, res) => {
  try {
    const { adminId } = req.body;
    const admin = await Admin.findById(adminId);
    admin.profilePhoto = req.file.path;
    await admin.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin Registration - Step 3: Secret Key
app.post('/api/admin/register/step3', async (req, res) => {
  try {
    const { adminId, secretKey } = req.body;
    if (secretKey !== process.env.ADMIN_SECRET_KEY) {
      return res.status(403).json({ error: 'Invalid secret key' });
    }
    res.json({ success: true, message: 'Admin registration completed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ LOGIN ENDPOINT ============
app.post('/api/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    let user;
    
    if (role === 'patient') user = await Patient.findOne({ email });
    else if (role === 'doctor') user = await Doctor.findOne({ email });
    else if (role === 'admin') user = await Admin.findOne({ email });
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid password' });
    
    if (role === 'doctor' && !user.approved) {
      return res.status(403).json({ error: 'Account pending admin approval' });
    }
    
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({ success: true, token, user: { id: user._id, name: user.name, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PATIENT ENDPOINTS ============

// Get Patient Profile
// ============================================
// CRITICAL FIX: Get Patient Profile - Populate Doctor with Photo
// ============================================

// Replace this endpoint in server.js:
app.get('/api/patient/profile', authenticateToken, async (req, res) => {
  try {
    const patient = await Patient.findById(req.user.id)
      .select('-password')
      .populate('selectedDoctor', 'name specialization profilePhoto'); // FIXED: Added profilePhoto
    
    console.log('✅ Patient found:', patient.name);
    console.log('✅ Selected doctor:', patient.selectedDoctor);
    
    res.json(patient);
  } catch (error) {
    console.error('❌ Error fetching patient profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// Todo List
app.post('/api/patient/todo', authenticateToken, async (req, res) => {
  try {
    const { tasks } = req.body;
    const todo = new Todo({
      patientId: req.user.id,
      tasks
    });
    await todo.save();
    res.json({ success: true, todo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patient/todo/today', authenticateToken, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todo = await Todo.findOne({
      patientId: req.user.id,
      date: { $gte: today }
    });
    res.json(todo || { tasks: [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/patient/todo/:id', authenticateToken, async (req, res) => {
  try {
    const { taskIndex, completed, reason } = req.body;
    const todo = await Todo.findById(req.params.id);
    
    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    
    if (taskIndex !== undefined && todo.tasks[taskIndex]) {
      todo.tasks[taskIndex].completed = completed;
      if (reason) {
        todo.tasks[taskIndex].reason = reason;
      }
      await todo.save();
      res.json({ success: true, todo });
    } else {
      res.status(400).json({ error: 'Invalid task index' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Daily Wellness Tracker
app.post('/api/patient/wellness', authenticateToken, async (req, res) => {
  try {
    const { mood, sleepHours, stressLevel, notes, todoCompleted } = req.body;
    const wellness = new Wellness({
      patientId: req.user.id,
      mood, sleepHours, stressLevel, notes, todoCompleted
    });
    await wellness.save();
    res.json({ success: true, wellness });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patient/wellness/history', authenticateToken, async (req, res) => {
  try {
    const { period } = req.query; // week, month
    const date = new Date();
    if (period === 'week') date.setDate(date.getDate() - 7);
    else date.setMonth(date.getMonth() - 1);
    
    const wellness = await Wellness.find({
      patientId: req.user.id,
      date: { $gte: date }
    }).sort({ date: 1 });
    res.json(wellness);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Progress Overview
app.get('/api/patient/progress', authenticateToken, async (req, res) => {
  try {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    const wellness = await Wellness.find({
      patientId: req.user.id,
      date: { $gte: lastWeek }
    }).sort({ date: 1 });
    
    const weeklyAvgStress = wellness.reduce((sum, w) => sum + w.stressLevel, 0) / wellness.length || 0;
    
    res.json({ wellness, weeklyAvgStress });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Appointments
app.post('/api/patient/appointment', authenticateToken, async (req, res) => {
  try {
    const patient = await Patient.findById(req.user.id);
    const appointment = new Appointment({
      patientId: req.user.id,
      doctorId: patient.selectedDoctor,
      ...req.body
    });
    await appointment.save();
    res.json({ success: true, appointment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patient/appointments', authenticateToken, async (req, res) => {
  try {
    const appointments = await Appointment.find({ patientId: req.user.id })
      .populate('doctorId', 'name specialization')
      .sort({ createdAt: -1 });
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Gemini Chatbot
app.post('/api/chatbot', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `You are a kind and empathetic mental health support chatbot. Validate the user's feelings, respond with emotional support and gentle motivation, avoid judgment or medical advice, and limit your reply to a shourt and. User message: ${message}`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    res.json({ response: text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ DOCTOR ENDPOINTS ============

// Get Doctor Profile
app.get('/api/doctor/profile', authenticateToken, async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.user.id).select('-password');
    res.json(doctor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Assigned Patients
app.get('/api/doctor/patients', authenticateToken, async (req, res) => {
  try {
    const patients = await Patient.find({ selectedDoctor: req.user.id })
      .select('-password');
    res.json(patients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Patient History
app.get('/api/doctor/patient/:patientId/history', authenticateToken, async (req, res) => {
  try {
    const wellness = await Wellness.find({ patientId: req.params.patientId })
      .sort({ date: -1 })
      .limit(30);
    res.json(wellness);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Patient Sentiment Trends
app.get('/api/doctor/patients/sentiment', authenticateToken, async (req, res) => {
  try {
    const patients = await Patient.find({ selectedDoctor: req.user.id });
    const trends = [];
    
    for (const patient of patients) {
      const wellness = await Wellness.find({ patientId: patient._id })
        .sort({ date: -1 })
        .limit(7);
      const avgStress = wellness.reduce((sum, w) => sum + w.stressLevel, 0) / wellness.length || 0;
      trends.push({ patientName: patient.name, avgStress });
    }
    
    trends.sort((a, b) => b.avgStress - a.avgStress);
    res.json(trends);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Appointments
app.get('/api/doctor/appointments', authenticateToken, async (req, res) => {
  try {
    const appointments = await Appointment.find({ doctorId: req.user.id })
      .populate('patientId', 'name phone')
      .sort({ createdAt: -1 });
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/doctor/appointment/:id', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    res.json(appointment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ADMIN ENDPOINTS ============

// Get Admin Profile
app.get('/api/admin/profile', authenticateToken, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id).select('-password');
    res.json(admin);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Pending Doctor Approvals
app.get('/api/admin/doctors/pending', authenticateToken, async (req, res) => {
  try {
    const doctors = await Doctor.find({ approved: false });
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve/Reject Doctor
app.put('/api/admin/doctor/:id/approve', authenticateToken, async (req, res) => {
  try {
    const { approved } = req.body;
    if (approved) {
      await Doctor.findByIdAndUpdate(req.params.id, { approved: true });
      res.json({ success: true });
    } else {
      const doctor = await Doctor.findById(req.params.id);
      if (doctor.proof) fs.unlinkSync(doctor.proof);
      if (doctor.profilePhoto) fs.unlinkSync(doctor.profilePhoto);
      await Doctor.findByIdAndDelete(req.params.id);
      res.json({ success: true });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Pending Resources
app.get('/api/admin/resources/pending', authenticateToken, async (req, res) => {
  try {
    const resources = await Resource.find({ approved: false });
    res.json(resources);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve/Reject Resource
app.put('/api/admin/resource/:id/approve', authenticateToken, async (req, res) => {
  try {
    const { approved } = req.body;
    if (approved) {
      await Resource.findByIdAndUpdate(req.params.id, { approved: true });
      res.json({ success: true });
    } else {
      const resource = await Resource.findById(req.params.id);
      if (resource.filePath) fs.unlinkSync(resource.filePath);
      await Resource.findByIdAndDelete(req.params.id);
      res.json({ success: true });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Complaints
app.get('/api/admin/complaints', authenticateToken, async (req, res) => {
  try {
    const complaints = await Complaint.find().sort({ createdAt: -1 });
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get patient count
app.get('/api/admin/patients/count', authenticateToken, async (req, res) => {
  try {
    const count = await Patient.countDocuments({ registrationCompleted: true });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get approved doctor count
app.get('/api/admin/doctors/approved/count', authenticateToken, async (req, res) => {
  try {
    const count = await Doctor.countDocuments({ approved: true });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get System Statistics
app.get('/api/admin/statistics', authenticateToken, async (req, res) => {
  try {
    // Get counts
    const totalPatients = await Patient.countDocuments({ registrationCompleted: true });
    const totalDoctors = await Doctor.countDocuments({ approved: true });
    const totalAppointments = await Appointment.countDocuments();
    const totalResources = await Resource.countDocuments({ approved: true });
    const totalComplaints = await Complaint.countDocuments();
    const pendingComplaints = await Complaint.countDocuments({ status: 'pending' });
    
    // Get appointment statistics
    const appointmentStats = {
      pending: await Appointment.countDocuments({ status: 'pending' }),
      approved: await Appointment.countDocuments({ status: 'approved' }),
      rejected: await Appointment.countDocuments({ status: 'rejected' }),
      completed: totalAppointments - await Appointment.countDocuments({ status: { $in: ['pending', 'approved', 'rejected'] } })
    };
    
    // Get resource distribution
    const resourceStats = {
      audio: await Resource.countDocuments({ type: 'audio', approved: true }),
      video: await Resource.countDocuments({ type: 'video', approved: true }),
      article: await Resource.countDocuments({ type: 'article', approved: true })
    };
    
    // Get monthly registrations (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const monthlyPatients = await Patient.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo }, registrationCompleted: true } },
      { $group: { 
        _id: { $month: '$createdAt' },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);
    
    const monthlyDoctors = await Doctor.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo }, approved: true } },
      { $group: { 
        _id: { $month: '$createdAt' },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);
    
    // Get this month's statistics
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    const monthlyStats = {
      patients: await Patient.countDocuments({ 
        createdAt: { $gte: thisMonth },
        registrationCompleted: true 
      }),
      doctors: await Doctor.countDocuments({ 
        createdAt: { $gte: thisMonth },
        approved: true 
      }),
      appointments: await Appointment.countDocuments({ 
        createdAt: { $gte: thisMonth }
      }),
      resources: await Resource.countDocuments({ 
        createdAt: { $gte: thisMonth },
        approved: true 
      }),
      complaints: await Complaint.countDocuments({ 
        createdAt: { $gte: thisMonth },
        status: 'resolved'
      })
    };
    
    res.json({
      totals: {
        patients: totalPatients,
        doctors: totalDoctors,
        appointments: totalAppointments,
        resources: totalResources,
        complaints: totalComplaints,
        pendingComplaints
      },
      appointments: appointmentStats,
      resources: resourceStats,
      registrations: {
        patients: monthlyPatients,
        doctors: monthlyDoctors
      },
      monthly: monthlyStats
    });
  } catch (error) {
    console.error('Statistics error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all patients for user management
app.get('/api/admin/users/patients', authenticateToken, async (req, res) => {
  try {
    const patients = await Patient.find({ registrationCompleted: true })
      .select('-password')
      .populate('selectedDoctor', 'name')
      .sort({ createdAt: -1 });
    res.json(patients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/user/info/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    let user = await Patient.findById(userId).select('name profilePhoto');
    
    if (!user) {
      user = await Doctor.findById(userId).select('name profilePhoto');
    }
    
    if (!user) {
      user = await Admin.findById(userId).select('name profilePhoto');
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all doctors for user management
app.get('/api/admin/users/doctors', authenticateToken, async (req, res) => {
  try {
    const doctors = await Doctor.find({ approved: true })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ RESOURCE ENDPOINTS ============
// ============================================
// PART 2: FIX Resource Upload Endpoint - Prevent Duplicates
// ============================================

// CRITICAL FIX: Upload Resource - Single upload, no duplicates
app.post('/api/resource/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    console.log('📤 Resource upload request received');
    console.log('Body:', req.body);
    console.log('File:', req.file);
    
    // Validate file exists
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { title, description, type } = req.body;
    
    // Validate type
    if (!type) {
      // Delete uploaded file if type is missing
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ error: 'Resource type is required' });
    }
    
    // CRITICAL: Check if resource already exists to prevent duplicates
    const existingResource = await Resource.findOne({
      uploadedBy: req.user.id,
      fileName: req.file.originalname,
      type: type,
      createdAt: { $gte: new Date(Date.now() - 5000) } // Within last 5 seconds
    });
    
    if (existingResource) {
      console.log('⚠️ Duplicate upload detected, deleting file and rejecting');
      // Delete the duplicate file
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      // Return the existing resource
      return res.json({ 
        success: true, 
        message: 'Resource already uploaded.',
        resourceId: existingResource._id
      });
    }
    
    // Create new resource
    const resource = new Resource({
      uploadedBy: req.user.id,
      uploaderRole: req.user.role,
      type,
      fileName: req.file.originalname,
      filePath: req.file.path,
      title,
      description,
      approved: false
    });
    
    await resource.save();
    console.log('✅ Resource saved to database:', resource._id);
    
    res.json({ 
      success: true, 
      message: 'Resource uploaded successfully. Pending admin approval.',
      resourceId: resource._id
    });
  } catch (error) {
    console.error('❌ Resource upload error:', error);
    
    // Clean up uploaded file on error
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        console.log('🗑️ Cleaned up uploaded file due to error');
      } catch (unlinkError) {
        console.error('Failed to delete file:', unlinkError);
      }
    }
    
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/resources', authenticateToken, async (req, res) => {
  try {
    const resources = await Resource.find({ approved: true }).sort({ createdAt: -1 });
    res.json(resources);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Track Resource View (for analytics)
app.post('/api/resource/:id/view', authenticateToken, async (req, res) => {
  try {
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ COMPLAINT ENDPOINTS ============
app.post('/api/complaint', authenticateToken, async (req, res) => {
  try {
    const complaint = new Complaint({
      complainerId: req.user.id,
      complainerRole: req.user.role,
      ...req.body
    });
    await complaint.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Resolve complaint
app.put('/api/admin/complaint/:id/resolve', authenticateToken, async (req, res) => {
  try {
    await Complaint.findByIdAndUpdate(req.params.id, { status: 'resolved' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ MESSAGING ENDPOINTS ============
app.get('/api/messages/:receiverId', authenticateToken, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { senderId: req.user.id, receiverId: req.params.receiverId },
        { senderId: req.params.receiverId, receiverId: req.user.id }
      ]
    }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/message', authenticateToken, async (req, res) => {
  try {
    const message = new Message({
      senderId: req.user.id,
      ...req.body
    });
    await message.save();
    io.emit('newMessage', message);
    res.json({ success: true, message });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/message/:id/seen', authenticateToken, async (req, res) => {
  try {
    const message = await Message.findByIdAndUpdate(
      req.params.id,
      { seen: true },
      { new: true }
    );
    
    if (message) {
      // Emit event to sender to update tick color to blue
      io.to(message.senderId.toString()).emit('messageSeen', {
        messageId: message._id,
        seenBy: req.user.id
      });
      
      console.log('Message marked as seen:', message._id);
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/user/info/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Try to find user in all collections
    let user = await Patient.findById(userId).select('name profilePhoto');
    
    if (!user) {
      user = await Doctor.findById(userId).select('name profilePhoto');
    }
    
    if (!user) {
      user = await Admin.findById(userId).select('name profilePhoto');
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Available Doctors
app.get('/api/doctors/available', async (req, res) => {
  try {
    const doctors = await Doctor.find({ approved: true })
      .select('name specialization profilePhoto timeSlot');
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ SOCKET.IO ============
// Add this to your server.js - Replace the Socket.IO section

// ============ SOCKET.IO - FIXED WEBRTC SIGNALING ============
io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);
  
  socket.on('joinRoom', (userId) => {
    socket.join(userId);
    console.log(`✅ User ${userId} joined room`);
  });
  // Chat Messages
  socket.on('sendMessage', async (data) => {
    try {
      console.log('📤 Sending message from:', data.senderId, 'to:', data.receiverId);
      
      // Send to receiver immediately
      io.to(data.receiverId).emit('receiveMessage', data);
      console.log('✅ Message sent to receiver:', data.receiverId);
      
    } catch (error) {
      console.error('❌ Error sending message:', error);
    }
  });
  socket.on('messageSeen', (data) => {
    console.log('👁️ Message seen:', data.messageId, 'by:', data.seenBy, 'notify:', data.senderId);
    
    // Notify sender that message was seen
    io.to(data.senderId).emit('messageSeenUpdate', {
      messageId: data.messageId,
      seenBy: data.seenBy
    });
    console.log('✅ Seen notification sent to sender:', data.senderId);
  });
  
  // WebRTC Call Signaling - FIXED
  socket.on('callUser', (data) => {
    console.log('📞 Call initiated:', data.from, '->', data.to, 'Type:', data.callType);
    io.to(data.to).emit('incomingCall', {
      from: data.from,
      to: data.to,
      callType: data.callType,
      offer: data.offer
    });
  });
  
  socket.on('answerCall', (data) => {
    console.log('📞 Call answered:', data.answer, 'from:', data.from, 'to:', data.to);
    io.to(data.to).emit('callAnswered', {
      from: data.from,
      to: data.to,
      answer: data.answer,
      answerSDP: data.answerSDP
    });
  });

  
  socket.on('iceCandidate', (data) => {
    console.log('🧊 ICE candidate from:', socket.id, 'to:', data.to);
    io.to(data.to).emit('iceCandidate', {
      candidate: data.candidate
    });
  });

  socket.on('callEnded', (data) => {
    console.log('📴 Call ended, notifying:', data.to);
    io.to(data.to).emit('callEnded', {
      from: data.from || socket.id
    });
  });
  // FIXED: Cancel call (when caller ends before answer)
  socket.on('cancelCall', (data) => {
    console.log('🚫 Call cancelled, notifying:', data.to);
    io.to(data.to).emit('callCancelled', {
      from: data.from
    });
  });
  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
  });
});
  
  
  
console.log("🚀 About to start server...");

// Start Server
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
