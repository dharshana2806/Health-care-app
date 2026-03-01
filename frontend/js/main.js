// API Base URL - Only declare if not already defined
if (typeof API_URL === 'undefined') {
  var API_URL = 'http://localhost:3000/api';
}

// Global variables
let currentStep = 1;
let currentRole = '';
let tempUserId = '';
let selectedDoctorId = '';
let currentLanguage = 'en';
const tabId = 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
sessionStorage.setItem('currentTabId', tabId);

// ─────────────────────────────────────────
// THEME  — single source of truth
// localStorage key: 'theme' → 'light' | 'dark'
// The HTML button contains SVG sun/moon icons.
// CSS [data-theme="light"] shows sun, hides moon.
// CSS [data-theme="dark"]  shows moon, hides sun.
// We ONLY flip data-theme — never touch innerHTML.
// ─────────────────────────────────────────

// Called synchronously at parse time so the correct
// theme is applied before the first paint.
(function applyThemeImmediately() {
  var saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
})();

function toggleTheme() {
  var html = document.documentElement;
  var next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}

function setupThemeToggle() {
  var btn = document.getElementById('themeToggle');
  if (!btn) return;
  // Guard: only wire once no matter how many scripts call this
  if (btn._themeWired) return;
  btn._themeWired = true;
  btn.addEventListener('click', toggleTheme);
}

document.addEventListener('DOMContentLoaded', setupThemeToggle);

// ─────────────────────────────────────────
// LOGIN / REGISTER toggle
// ─────────────────────────────────────────
const showRegisterBtn = document.getElementById('showRegister');
if (showRegisterBtn) {
  showRegisterBtn.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('loginSection').classList.remove('active');
    document.getElementById('registerSection').classList.add('active');
  });
}

const showLoginBtn = document.getElementById('showLogin');
if (showLoginBtn) {
  showLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('registerSection').classList.remove('active');
    document.getElementById('loginSection').classList.add('active');
    resetRegistrationForms();
  });
}

// Role Selection
document.querySelectorAll('.role-card').forEach(card => {
  card.addEventListener('click', () => {
    currentRole = card.dataset.role;
    document.getElementById('roleSelection').style.display = 'none';
    document.getElementById(`${currentRole}Register`).style.display = 'block';
    if (currentRole === 'patient') {
      loadDoctors();
      loadAssessmentQuestions();
    }
  });
});

// ─────────────────────────────────────────
// ASSESSMENT QUESTIONS
// ─────────────────────────────────────────
const assessmentQuestions = {
  en: [
    { question: "How often do you feel overwhelmed by daily tasks?",     options: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
    { question: "Do you have trouble sleeping?",                          options: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
    { question: "How often do you feel anxious?",                         options: ["Never", "Rarely", "Sometimes", "Often", "Always"] }
  ],
  ta: [
    { question: "தினசரி பணிகளால் எவ்வளவு அடிக்கடி நீங்கள் அழுத்தம் உணர்கிறீர்கள்?", options: ["ஒருபோதும் இல்லை", "அரிதாக", "சில நேரங்களில்", "அடிக்கடி", "எப்போதும்"] },
    { question: "உங்களுக்கு தூங்குவதில் சிரமம் உள்ளதா?",              options: ["ஒருபோதும் இல்லை", "அரிதாக", "சில நேரங்களில்", "அடிக்கடி", "எப்போதும்"] },
    { question: "எவ்வளவு அடிக்கடி நீங்கள் கவலையாக உணர்கிறீர்கள்?",  options: ["ஒருபோதும் இல்லை", "அரிதாக", "சில நேரங்களில்", "அடிக்கடி", "எப்போதும்"] }
  ]
};

function loadAssessmentQuestions() {
  const container = document.getElementById('assessmentQuestions');
  if (!container) return;
  const questions = assessmentQuestions[currentLanguage];
  container.innerHTML = questions.map((q, index) => `
    <div class="question-card">
      <h4>${index + 1}. ${q.question}</h4>
      <div class="options-grid">
        ${q.options.map((opt, optIndex) => `
          <label class="option-label">
            <input type="radio" name="q${index}" value="${optIndex}" required>
            <span class="option-chip">${opt}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// Language Toggle
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('lang-btn')) {
    document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    currentLanguage = e.target.dataset.lang;
    loadAssessmentQuestions();
  }
});

// Load Available Doctors
async function loadDoctors() {
  try {
    const response = await fetch(`${API_URL}/doctors/available`);
    const doctors = await response.json();
    const container = document.getElementById('doctorsList');
    if (!container) return;
    container.innerHTML = doctors.map(doctor => `
      <div class="doctor-card" data-doctor-id="${doctor._id}">
        <img src="${doctor.profilePhoto}" alt="${doctor.name}" class="doctor-photo" onerror="this.style.display='none'">
        <h4>${doctor.name}</h4>
        <p>${doctor.specialization}</p>
        <p><small>${doctor.timeSlot}</small></p>
      </div>
    `).join('');
    document.querySelectorAll('.doctor-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.doctor-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedDoctorId = card.dataset.doctorId;
      });
    });
  } catch (error) {
    showNotification('Error loading doctors', 'error');
  }
}

// ─────────────────────────────────────────
// PATIENT REGISTRATION
// ─────────────────────────────────────────
const patientStep1Form = document.getElementById('patientStep1');
if (patientStep1Form) {
  patientStep1Form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name:     document.getElementById('patientName').value,
      dob:      document.getElementById('patientDob').value,
      gender:   document.getElementById('patientGender').value,
      address:  document.getElementById('patientAddress').value,
      phone:    document.getElementById('patientPhone').value,
      email:    document.getElementById('patientEmail').value,
      password: document.getElementById('patientPassword').value
    };
    try {
      const response = await fetch(`${API_URL}/patient/register/step1`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      });
      const result = await response.json();
      if (result.success) { tempUserId = result.patientId; nextStep(); }
      else showNotification(result.error, 'error');
    } catch { showNotification('Registration failed', 'error'); }
  });
}

const patientStep2Form = document.getElementById('patientStep2');
if (patientStep2Form) {
  patientStep2Form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('patientPhoto');
    if (!fileInput.files || !fileInput.files[0]) { showNotification('Please select a profile photo', 'error'); return; }
    const formData = new FormData();
    formData.append('patientId', tempUserId);
    formData.append('uploadType', 'profile');
    formData.append('profilePhoto', fileInput.files[0]);
    try {
      const response = await fetch(`${API_URL}/patient/register/step2`, { method: 'POST', body: formData });
      const result = await response.json();
      if (result.success) { showNotification('Profile photo uploaded!', 'success'); nextStep(); }
      else showNotification(result.error, 'error');
    } catch { showNotification('Upload failed. Please try again.', 'error'); }
  });
}

const patientStep3Form = document.getElementById('patientStep3');
if (patientStep3Form) {
  patientStep3Form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedDoctorId) { showNotification('Please select a doctor', 'error'); return; }
    const answers = {};
    document.querySelectorAll('[name^="q"]').forEach(input => { if (input.checked) answers[input.name] = input.value; });
    const data = { patientId: tempUserId, stressAssessment: answers, selectedDoctor: selectedDoctorId };
    try {
      const response = await fetch(`${API_URL}/patient/register/step3`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      });
      const result = await response.json();
      if (result.success) {
        showNotification('Registration completed successfully!', 'success');
        setTimeout(() => {
          document.getElementById('registerSection').classList.remove('active');
          document.getElementById('loginSection').classList.add('active');
          resetRegistrationForms();
        }, 2000);
      }
    } catch { showNotification('Registration failed', 'error'); }
  });
}

// ─────────────────────────────────────────
// DOCTOR REGISTRATION
// ─────────────────────────────────────────
const doctorStep1Form = document.getElementById('doctorStep1');
if (doctorStep1Form) {
  doctorStep1Form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name:           document.getElementById('doctorName').value,
      specialization: document.getElementById('doctorSpec').value,
      timeSlot:       document.getElementById('doctorTimeSlot').value,
      dob:            document.getElementById('doctorDob').value,
      phone:          document.getElementById('doctorPhone').value,
      email:          document.getElementById('doctorEmail').value,
      password:       document.getElementById('doctorPassword').value
    };
    try {
      const response = await fetch(`${API_URL}/doctor/register/step1`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      });
      const result = await response.json();
      if (result.success) { tempUserId = result.doctorId; nextStep(); }
      else showNotification(result.error, 'error');
    } catch { showNotification('Registration failed', 'error'); }
  });
}

const doctorStep2Form = document.getElementById('doctorStep2');
if (doctorStep2Form) {
  doctorStep2Form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const photoInput = document.getElementById('doctorPhoto');
    const proofInput = document.getElementById('doctorProof');
    if (!photoInput.files || !photoInput.files[0]) { showNotification('Please select a profile photo', 'error'); return; }
    if (!proofInput.files || !proofInput.files[0]) { showNotification('Please select your doctor proof document', 'error'); return; }
    const formData = new FormData();
    formData.append('doctorId', tempUserId);
    formData.append('profilePhoto', photoInput.files[0]);
    formData.append('proof', proofInput.files[0]);
    try {
      const response = await fetch(`${API_URL}/doctor/register/step2`, { method: 'POST', body: formData });
      const result = await response.json();
      if (result.success) {
        showNotification('Registration request sent to admin for approval!', 'success');
        setTimeout(() => {
          document.getElementById('registerSection').classList.remove('active');
          document.getElementById('loginSection').classList.add('active');
          resetRegistrationForms();
        }, 2000);
      } else showNotification(result.error || 'Registration failed', 'error');
    } catch { showNotification('Upload failed. Please try again.', 'error'); }
  });
}

// ─────────────────────────────────────────
// ADMIN REGISTRATION
// ─────────────────────────────────────────
const adminStep1Form = document.getElementById('adminStep1');
if (adminStep1Form) {
  adminStep1Form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name:     document.getElementById('adminName').value,
      email:    document.getElementById('adminEmail').value,
      password: document.getElementById('adminPassword').value
    };
    try {
      const response = await fetch(`${API_URL}/admin/register/step1`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      });
      const result = await response.json();
      if (result.success) { tempUserId = result.adminId; nextStep(); }
      else showNotification(result.error, 'error');
    } catch { showNotification('Registration failed', 'error'); }
  });
}

const adminStep2Form = document.getElementById('adminStep2');
if (adminStep2Form) {
  adminStep2Form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('adminPhoto');
    if (!fileInput.files || !fileInput.files[0]) { showNotification('Please select a profile photo', 'error'); return; }
    const formData = new FormData();
    formData.append('adminId', tempUserId);
    formData.append('uploadType', 'profile');
    formData.append('profilePhoto', fileInput.files[0]);
    try {
      const response = await fetch(`${API_URL}/admin/register/step2`, { method: 'POST', body: formData });
      const result = await response.json();
      if (result.success) { showNotification('Profile photo uploaded!', 'success'); nextStep(); }
      else showNotification(result.error || 'Upload failed', 'error');
    } catch { showNotification('Upload failed. Please try again.', 'error'); }
  });
}

const adminStep3Form = document.getElementById('adminStep3');
if (adminStep3Form) {
  adminStep3Form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = { adminId: tempUserId, secretKey: document.getElementById('adminSecret').value };
    try {
      const response = await fetch(`${API_URL}/admin/register/step3`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      });
      const result = await response.json();
      if (result.success) {
        showNotification('Admin registration completed!', 'success');
        setTimeout(() => {
          document.getElementById('registerSection').classList.remove('active');
          document.getElementById('loginSection').classList.add('active');
          resetRegistrationForms();
        }, 2000);
      } else showNotification(result.error, 'error');
    } catch { showNotification('Invalid secret key', 'error'); }
  });
}

// ─────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      email:    document.getElementById('loginEmail').value,
      password: document.getElementById('loginPassword').value,
      role:     document.getElementById('loginRole').value
    };
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      });
      const result = await response.json();
      if (result.success) {
        localStorage.setItem('token', result.token);
        localStorage.setItem('user', JSON.stringify(result.user));
        showNotification('Login successful!', 'success');
        setTimeout(() => {
          if (data.role === 'patient')      window.location.href = 'patientdashboard.html';
          else if (data.role === 'doctor')  window.location.href = 'doctordashboard.html';
          else if (data.role === 'admin')   window.location.href = 'admin.html';
        }, 1000);
      } else showNotification(result.error, 'error');
    } catch { showNotification('Login failed', 'error'); }
  });
}

// ─────────────────────────────────────────
// STEP NAVIGATION
// ─────────────────────────────────────────
function nextStep() {
  const currentForm = document.querySelector(`#${currentRole}Register .step-form.active`);
  const nextForm = currentForm?.nextElementSibling;
  if (nextForm && nextForm.classList.contains('step-form')) {
    currentForm.classList.remove('active');
    nextForm.classList.add('active');
    currentStep++;
    updateStepIndicator();
  }
}

function previousStep() {
  const currentForm = document.querySelector(`#${currentRole}Register .step-form.active`);
  const previousForm = currentForm?.previousElementSibling;
  if (previousForm && previousForm.classList.contains('step-form')) {
    currentForm.classList.remove('active');
    previousForm.classList.add('active');
    currentStep--;
    updateStepIndicator();
  }
}

function updateStepIndicator() {
  document.querySelectorAll(`#${currentRole}Register .step`).forEach((step, index) => {
    if (index < currentStep) {
      step.classList.add('completed');
      step.classList.remove('active');
    } else if (index === currentStep - 1) {
      step.classList.add('active');
      step.classList.remove('completed');
    } else {
      step.classList.remove('active', 'completed');
    }
  });
}

function resetRegistrationForms() {
  currentStep = 1; currentRole = ''; tempUserId = ''; selectedDoctorId = '';
  document.querySelectorAll('.register-form').forEach(f => f.style.display = 'none');
  document.querySelectorAll('.step-form').forEach(f => f.classList.remove('active'));
  document.querySelectorAll('form').forEach(f => f.reset());
  const rs = document.getElementById('roleSelection');
  if (rs) rs.style.display = 'block';
}

// ─────────────────────────────────────────
// FILE PREVIEWS
// ─────────────────────────────────────────
function setupFilePreview(inputId, previewId, maxMB) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > maxMB * 1024 * 1024) {
      showNotification(`File size must be less than ${maxMB}MB`, 'error');
      this.value = ''; return;
    }
    const preview = document.getElementById(previewId);
    if (!preview) return;
    const reader = new FileReader();
    reader.onload = (ev) => { preview.src = ev.target.result; preview.style.display = 'block'; };
    reader.readAsDataURL(file);
  });
}
setupFilePreview('patientPhoto', 'photoPreview', 5);
setupFilePreview('adminPhoto',   'adminPhotoPreview', 5);
setupFilePreview('doctorPhoto',  'doctorPhotoPreview', 5);

const doctorProofInput = document.getElementById('doctorProof');
if (doctorProofInput) {
  doctorProofInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showNotification('File size must be less than 10MB', 'error');
      this.value = ''; return;
    }
    const display = document.getElementById('doctorProofName');
    if (display) { display.textContent = file.name; display.style.display = 'block'; }
  });
}

// ─────────────────────────────────────────
// NOTIFICATION
// ─────────────────────────────────────────
function showNotification(message, type) {
  const notification = document.getElementById('notification');
  if (!notification) return;
  notification.textContent = message;
  notification.className = `notification ${type} show`;
  setTimeout(() => notification.classList.remove('show'), 3000);
}

// ─────────────────────────────────────────
// AUTH GUARD
// ─────────────────────────────────────────
function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token && !window.location.pathname.includes('index.html')) {
    window.location.href = 'index.html';
  }
}