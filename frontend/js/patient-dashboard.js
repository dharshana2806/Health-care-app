// Patient Dashboard JavaScript
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  loadPatientProfile();
  loadOverviewData();
  setupNavigation();
  setupEventListeners();
});

// Check Authentication
function checkAuth() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (!token || user.role !== 'patient') {
    window.location.href = 'index.html';
  }
}

// ---- Patient Profile ----
async function loadPatientProfile() {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/patient/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const patient = await response.json();

    document.getElementById('userName').textContent = patient.name;
    document.getElementById('userEmail').textContent = patient.email;

    if (patient.profilePhoto) {
      let path = patient.profilePhoto.replace(/\\/g, '/').replace(/^backend\//, '').replace(/^uploads\//, '');
      const profileImg = document.getElementById('profilePhoto');
      profileImg.src = `/backend/uploads/profiles/${path.split('/').pop()}`;
      profileImg.onerror = function() { this.src = 'https://via.placeholder.com/60?text=P'; };
    }

    if (patient.selectedDoctor) {
      const d = patient.selectedDoctor;
      document.getElementById('doctorName').textContent = d.name || 'Doctor';
      document.getElementById('doctorSpec').textContent = d.specialization || 'Specialist';
      document.getElementById('doctorNameChat').textContent = d.name || 'Doctor';
      document.getElementById('doctorSpecChat').textContent = d.specialization || 'Specialist';

      let doctorPhoto = 'https://via.placeholder.com/60?text=Dr';
      if (d.profilePhoto) {
        let clean = d.profilePhoto.replace(/\\/g, '/').replace(/^backend\//, '').replace(/^uploads\//, '').replace(/^profiles\//, '');
        doctorPhoto = `/backend/uploads/profiles/${clean.split('/').pop()}`;
      }

      const el = document.getElementById('doctorPhotoChat');
      if (el) {
        el.src = doctorPhoto;
        el.onerror = function() { this.onerror = null; this.src = 'https://via.placeholder.com/60?text=Dr'; };
      }

      window.selectedDoctorInfo = { id: d._id, name: d.name, photo: doctorPhoto };

      if (typeof window.loadChatHistory === 'function') {
        window.currentChatUser = d._id;
        window.loadChatHistory(d._id);
      }
    }
  } catch (error) {
    console.error('Error loading profile:', error);
    showNotification('Error loading profile', 'error');
  }
}

// ---- Overview ----
async function loadOverviewData() {
  await loadTodayTasks();
  await loadWellnessStreak();
  await loadWeeklyStress();
}

async function loadTodayTasks() {
  const token = localStorage.getItem('token');
  try {
    const r = await fetch(`${API_URL}/patient/todo/today`, { headers: { 'Authorization': `Bearer ${token}` } });
    const todo = await r.json();
    const pending = todo.tasks?.filter(t => !t.completed).length || 0;
    document.getElementById('todayTasksCount').textContent = pending;
  } catch (e) { console.error(e); }
}

async function loadWellnessStreak() {
  const token = localStorage.getItem('token');
  try {
    const r = await fetch(`${API_URL}/patient/wellness/history?period=month`, { headers: { 'Authorization': `Bearer ${token}` } });
    const history = await r.json();
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      if (history.some(h => new Date(h.date).toDateString() === d.toDateString())) streak++;
      else break;
    }
    document.getElementById('wellnessStreak').textContent = streak;
  } catch (e) { console.error(e); }
}

async function loadWeeklyStress() {
  const token = localStorage.getItem('token');
  try {
    const r = await fetch(`${API_URL}/patient/progress`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await r.json();
    document.getElementById('weeklyStress').textContent = data.weeklyAvgStress.toFixed(1);
  } catch (e) { console.error(e); }
}

// ---- Navigation ----
function setupNavigation() {
  // Navigation is handled inline in the HTML script block
}

function showSection(section) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(`${section}Section`);
  if (el) el.classList.add('active');

  document.querySelectorAll('.nav-link').forEach(l => {
    if (l.dataset.section === section) l.classList.add('active');
    else if (l.dataset.section) l.classList.remove('active');
  });

  if (section === 'todo') loadTodoList();
  if (section === 'wellness') loadRecentWellness();
  if (section === 'resources') loadResources();
  if (section === 'appointments') loadAppointments();
  if (section === 'progress') loadProgressCharts();
  if (section === 'complaint') loadComplaints();

  if (section === 'telecounseling') {
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/patient/profile`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(patient => {
        if (patient.selectedDoctor?._id && typeof loadChatHistory === 'function') {
          loadChatHistory(patient.selectedDoctor._id);
        }
      }).catch(console.error);
  }
}

// ---- Event Listeners ----
function setupEventListeners() {
  document.getElementById('addTodoBtn')?.addEventListener('click', () => {
    const card = document.getElementById('todoFormCard');
    card.style.display = 'block';
    addTaskInput();
  });

  document.getElementById('wellnessForm')?.addEventListener('submit', saveWellness);

  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedMood = btn.dataset.mood;
    });
  });

  document.getElementById('stressLevel')?.addEventListener('input', (e) => {
    document.getElementById('stressLevelValue').textContent = e.target.value;
  });

  document.getElementById('sendChatbotBtn')?.addEventListener('click', sendChatbotMessage);
  document.getElementById('chatbotInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatbotMessage();
  });

  document.getElementById('bookAppointmentBtn')?.addEventListener('click', () => {
    document.getElementById('appointmentForm').style.display = 'block';
    document.getElementById('appointmentDate').min = new Date().toISOString().split('T')[0];
  });

  document.getElementById('newAppointmentForm')?.addEventListener('submit', bookAppointment);
  document.getElementById('complaintForm')?.addEventListener('submit', submitComplaint);

  // Resource filter buttons
  document.querySelectorAll('.resource-filters .filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.resource-filters .filter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      loadResources(this.dataset.filter);
    });
  });
}

// ---- TODO LIST ----
function addTaskInput() {
  const container = document.getElementById('taskInputs');
  const row = document.createElement('div');
  row.className = 'task-input-row';
  row.innerHTML = `
    <input type="text" placeholder="Enter task ${taskCount}" class="task-input" required>
    <button type="button" class="btn btn-secondary btn-sm" onclick="this.parentElement.remove()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;
  container.appendChild(row);
  taskCount++;
}

async function saveTodoList() {
  const token = localStorage.getItem('token');
  const tasks = Array.from(document.querySelectorAll('.task-input')).map(i => ({ task: i.value, completed: false, reason: '' }));
  if (tasks.length === 0 || tasks.some(t => !t.task.trim())) { showNotification('Please enter at least one task', 'error'); return; }
  try {
    const r = await fetch(`${API_URL}/patient/todo`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks })
    });
    if (r.ok) {
      showNotification('To-do list saved!', 'success');
      document.getElementById('todoFormCard').style.display = 'none';
      document.getElementById('taskInputs').innerHTML = '';
      taskCount = 1;
      loadTodoList();
    }
  } catch (e) { showNotification('Error saving tasks', 'error'); }
}

async function loadTodoList() {
  const token = localStorage.getItem('token');
  try {
    const r = await fetch(`${API_URL}/patient/todo/today`, { headers: { 'Authorization': `Bearer ${token}` } });
    const todo = await r.json();
    const container = document.getElementById('todoList');
    if (!todo.tasks || todo.tasks.length === 0) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div>
        <p>No tasks for today. Click "Add Task" to create your list.</p></div>`;
      return;
    }
    container.innerHTML = todo.tasks.map((task, idx) => `
      <div class="todo-item ${task.completed ? 'completed' : ''}">
        <input type="checkbox" class="todo-checkbox" id="task-${idx}" ${task.completed ? 'checked' : ''}
          onchange="toggleTask('${todo._id}', ${idx}, this.checked)">
        <label class="todo-label" for="task-${idx}">${task.task}</label>
        ${task.reason ? `<span class="todo-reason">Incomplete: ${task.reason}</span>` : ''}
      </div>
    `).join('');
  } catch (e) { console.error(e); }
}

async function toggleTask(todoId, taskIndex, completed) {
  const token = localStorage.getItem('token');
  if (!completed) {
    const reason = prompt("Why couldn't you complete this task?");
    if (!reason) { loadTodoList(); return; }
    try {
      await fetch(`${API_URL}/patient/todo/${todoId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIndex, completed: false, reason })
      });
      loadTodoList(); loadTodayTasks();
    } catch (e) { showNotification('Error updating task', 'error'); }
  } else {
    try {
      await fetch(`${API_URL}/patient/todo/${todoId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIndex, completed: true })
      });
      loadTodoList(); loadTodayTasks();
    } catch (e) { showNotification('Error updating task', 'error'); }
  }
}

// ---- WELLNESS ----
async function saveWellness(e) {
  e.preventDefault();
  if (!selectedMood) { showNotification('Please select your mood', 'error'); return; }
  const token = localStorage.getItem('token');
  const data = {
    mood: selectedMood,
    sleepHours: parseFloat(document.getElementById('sleepHours').value),
    stressLevel: parseInt(document.getElementById('stressLevel').value),
    notes: document.getElementById('wellnessNotes').value,
    todoCompleted: document.getElementById('todoCompleted').checked
  };
  try {
    const r = await fetch(`${API_URL}/patient/wellness`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (r.ok) {
      showNotification('Wellness entry saved!', 'success');
      document.getElementById('wellnessForm').reset();
      document.getElementById('stressLevelValue').textContent = '5';
      selectedMood = '';
      document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
      loadRecentWellness(); loadOverviewData();
    }
  } catch (e) { showNotification('Error saving entry', 'error'); }
}

const moodMeta = {
  'Happy':   { color: '#d97706', bg: 'rgba(217,119,6,0.08)' },
  'Neutral': { color: '#6366f1', bg: 'rgba(99,102,241,0.08)' },
  'Sad':     { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
  'Stressed':{ color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
  'Tired':   { color: '#6b7280', bg: 'rgba(107,114,128,0.08)' }
};

// Legacy emoji → label map
const moodEmojiMap = {
  '😊': 'Happy', '😐': 'Neutral', '😢': 'Sad', '😰': 'Stressed', '😔': 'Tired'
};

function normalizeMood(m) {
  return moodEmojiMap[m] || m;
}

async function loadRecentWellness() {
  const token = localStorage.getItem('token');
  try {
    const r = await fetch(`${API_URL}/patient/wellness/history?period=month`, { headers: { 'Authorization': `Bearer ${token}` } });
    const wellness = await r.json();
    const container = document.getElementById('recentWellness');
    if (wellness.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div><p>No entries yet. Start tracking today!</p></div>`;
      return;
    }
    container.innerHTML = wellness.map(entry => {
      const moodLabel = normalizeMood(entry.mood);
      const meta = moodMeta[moodLabel] || { color: '#8aaba7', bg: 'rgba(138,171,167,0.08)' };
      return `
      <div class="wellness-entry">
        <div class="wellness-entry-header">
          <span class="wellness-date">${new Date(entry.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
          <span class="mood-chip" style="background:${meta.bg}; color:${meta.color};">${moodLabel}</span>
        </div>
        <div class="wellness-stats-row">
          <span class="wellness-stat">
            <svg viewBox="0 0 24 24"><path d="M17 7l-1.41-1.41-4.24 4.24-4.24-4.24L6 7l4.24 4.24L6 15.48l1.41 1.41 4.24-4.24 4.24 4.24L17 15.48l-4.24-4.24L17 7z"/></svg>
            Sleep: ${entry.sleepHours}h
          </span>
          <span class="wellness-stat">
            <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            Stress: ${entry.stressLevel}/10
          </span>
          <span class="wellness-stat" style="color:${entry.todoCompleted ? 'var(--success)' : 'var(--text-muted)'};">
            <svg viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            Tasks ${entry.todoCompleted ? 'Completed' : 'Pending'}
          </span>
        </div>
        ${entry.notes ? `<p class="wellness-notes-text">${entry.notes}</p>` : ''}
      </div>`;
    }).join('');
  } catch (e) { console.error(e); }
}

// ---- RESOURCES ----
async function loadResources(filter = 'all') {
  const token = localStorage.getItem('token');
  const container = document.getElementById('resourcesList');
  if (!container) return;
  container.innerHTML = '<p style="color:var(--text-muted);font-size:14px;">Loading resources...</p>';
  try {
    const r = await fetch(`${API_URL}/resources`, { headers: { 'Authorization': `Bearer ${token}` } });
    const resources = await r.json();
    const filtered = filter === 'all' ? resources : resources.filter(res => res.type === filter);
    if (filtered.length === 0) {
      container.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></div>
        <p>No resources available${filter !== 'all' ? ' for this type' : ''}.</p></div>`;
      return;
    }

    const iconMap = {
      audio: `<svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
      video: `<svg viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`,
      article: `<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`
    };

    const actionLabel = { audio: 'Listen Now', video: 'Watch Now', article: 'Read Now' };

    container.innerHTML = filtered.map(res => {
      const cleanPath = res.filePath.replace(/\\/g, '/');
      const safeTitle = cleanPath.replace(/'/g, "\\'");
      return `
      <div class="resource-card">
        <div class="resource-meta">
          <div class="resource-type-icon ${res.type}-icon">${iconMap[res.type] || iconMap.article}</div>
          <span class="resource-badge ${res.type}">${res.type.toUpperCase()}</span>
        </div>
        <div>
          <p class="resource-title">${res.title}</p>
          <p class="resource-date">${new Date(res.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <p class="resource-desc">${res.description}</p>
        <button class="btn btn-outline" style="width:100%;margin-top:auto;" onclick="viewResource('${res._id}', '${safeTitle}', '${res.type}', '${res.title.replace(/'/g,"\\'")}')">
          ${actionLabel[res.type] || 'Open'}
        </button>
      </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = '<p style="color:var(--text-muted);">Error loading resources. Please try again.</p>';
  }
}

// ---- CHATBOT ----
function sendQuickReply(message) {
  const input = document.getElementById('chatbotInput');
  if (input) { input.value = message; sendChatbotMessage(); }
}

async function sendChatbotMessage() {
  const input = document.getElementById('chatbotInput');
  const message = input.value.trim();
  if (!message) return;

  const welcome = document.querySelector('.chatbot-welcome-card');
  if (welcome) welcome.remove();

  appendChatbotMessage(message, true);
  input.value = '';

  const container = document.getElementById('chatbotMessages');
  const typingDiv = document.createElement('div');
  typingDiv.id = 'typingIndicator';
  typingDiv.className = 'bot-msg-row';
  typingDiv.innerHTML = `
    <div class="bot-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><circle cx="15.5" cy="10" r="1.5"/></svg></div>
    <div class="typing-dots"><span></span><span></span><span></span></div>`;
  container.appendChild(typingDiv);
  container.scrollTop = container.scrollHeight;

  const token = localStorage.getItem('token');
  try {
    const r = await fetch(`${API_URL}/chatbot`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    const data = await r.json();
    document.getElementById('typingIndicator')?.remove();
    appendChatbotMessage(data.response, false);
  } catch (e) {
    document.getElementById('typingIndicator')?.remove();
    appendChatbotMessage('Sorry, I encountered an error. Please try again.', false);
  }
}

function appendChatbotMessage(message, isUser) {
  const container = document.getElementById('chatbotMessages');
  const row = document.createElement('div');
  row.className = isUser ? 'user-msg-row' : 'bot-msg-row';
  if (isUser) {
    row.innerHTML = `<div class="user-bubble">${message}</div>`;
  } else {
    row.innerHTML = `
      <div class="bot-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><circle cx="15.5" cy="10" r="1.5"/></svg></div>
      <div class="bot-bubble">${message}</div>`;
  }
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

if (typeof window !== 'undefined') { window.sendQuickReply = sendQuickReply; }

// ---- APPOINTMENTS ----
async function bookAppointment(e) {
  e.preventDefault();
  const token = localStorage.getItem('token');
  const data = {
    date: document.getElementById('appointmentDate').value,
    time: document.getElementById('appointmentTime').value,
    reason: document.getElementById('appointmentReason').value
  };
  try {
    const r = await fetch(`${API_URL}/patient/appointment`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (r.ok) {
      showNotification('Appointment request sent!', 'success');
      document.getElementById('appointmentForm').style.display = 'none';
      document.getElementById('newAppointmentForm').reset();
      loadAppointments();
    }
  } catch (e) { showNotification('Error booking appointment', 'error'); }
}

async function loadAppointments() {
  const token = localStorage.getItem('token');
  try {
    const r = await fetch(`${API_URL}/patient/appointments`, { headers: { 'Authorization': `Bearer ${token}` } });
    const appointments = await r.json();
    const container = document.getElementById('appointmentsList');
    if (appointments.length === 0) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
        <p>No appointments scheduled yet.</p></div>`;
      return;
    }
    container.innerHTML = appointments.map(apt => {
      const d = new Date(apt.date);
      const month = d.toLocaleDateString('en-US', { month: 'short' });
      const day = d.getDate();
      return `
      <div class="appointment-card">
        <div class="appt-date-block">
          <p class="appt-date-month">${month}</p>
          <p class="appt-date-day">${day}</p>
        </div>
        <div class="appt-info">
          <h4>${apt.reason || 'Consultation'}</h4>
          <div class="appt-meta">
            <span class="appt-meta-item">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${apt.time}
            </span>
            <span class="appt-meta-item">
              <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ${apt.doctorId?.name || 'Doctor'}
            </span>
          </div>
          <span class="status-pill ${apt.status}">${apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}</span>
        </div>
      </div>`;
    }).join('');
  } catch (e) { console.error(e); }
}

// ---- PROGRESS CHARTS ----
function getChartDefaults() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    textColor: isDark ? '#8aaba7' : '#4a6260',
    gridColor: isDark ? 'rgba(31,51,48,0.8)' : 'rgba(213,227,224,0.8)',
    tooltipBg: isDark ? '#131f1c' : '#ffffff',
    tooltipText: isDark ? '#e2eeec' : '#111c1a',
  };
}

async function loadProgressCharts() {
  const token = localStorage.getItem('token');
  try {
    const r = await fetch(`${API_URL}/patient/progress`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await r.json();
    createMoodChart(data.wellness);
    createStressChart(data.wellness);
    updateSummaries(data);
  } catch (e) { console.error('Error loading progress:', e); }
}

function createMoodChart(wellness) {
  const ctx = document.getElementById('moodChart');
  if (!wellness || wellness.length === 0) {
    ctx.parentElement.innerHTML = '<div class="empty-state"><p>No mood data yet. Start tracking your wellness!</p></div>';
    return;
  }

  const moodCounts = {};
  wellness.forEach(w => {
    const label = normalizeMood(w.mood);
    if (label) moodCounts[label] = (moodCounts[label] || 0) + 1;
  });

  if (window.moodChartInstance) window.moodChartInstance.destroy();

  const ch = getChartDefaults();
  const labels = Object.keys(moodCounts);
  const bgColors = labels.map(l => {
    const map = { Happy: '#fef3c7', Neutral: '#ede9fe', Sad: '#dbeafe', Stressed: '#fee2e2', Tired: '#f3f4f6' };
    return map[l] || '#e5e7eb';
  });
  const borderColors = labels.map(l => {
    const m = moodMeta[l] || { color: '#8aaba7' };
    return m.color;
  });

  window.moodChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Days',
        data: Object.values(moodCounts),
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: ch.tooltipBg,
          titleColor: ch.tooltipText,
          bodyColor: ch.textColor,
          borderColor: 'rgba(0,0,0,0.08)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y} day${ctx.parsed.y !== 1 ? 's' : ''}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, color: ch.textColor, font: { size: 12 } },
          grid: { color: ch.gridColor },
          border: { display: false },
          title: { display: true, text: 'Days', color: ch.textColor, font: { size: 12 } }
        },
        x: {
          ticks: { color: ch.textColor, font: { size: 12 } },
          grid: { display: false },
          border: { display: false },
        }
      }
    }
  });
}

function createStressChart(wellness) {
  const ctx = document.getElementById('stressChart');
  if (!wellness || wellness.length === 0) {
    ctx.parentElement.innerHTML = '<div class="empty-state"><p>No stress data yet. Start tracking your wellness!</p></div>';
    return;
  }

  const sorted = [...wellness].sort((a, b) => new Date(a.date) - new Date(b.date));
  const labels = sorted.map(w => new Date(w.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  const values = sorted.map(w => w.stressLevel);

  if (window.stressChartInstance) window.stressChartInstance.destroy();

  const ch = getChartDefaults();

  window.stressChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Stress Level',
        data: values,
        borderColor: '#e03d3d',
        backgroundColor: 'rgba(224,61,61,0.08)',
        tension: 0.4,
        fill: true,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: '#e03d3d',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: ch.tooltipBg,
          titleColor: ch.tooltipText,
          bodyColor: ch.textColor,
          borderColor: 'rgba(0,0,0,0.08)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => ` Stress: ${ctx.parsed.y}/10`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          min: 1,
          max: 10,
          ticks: { stepSize: 1, color: ch.textColor, font: { size: 12 } },
          grid: { color: ch.gridColor },
          border: { display: false },
          title: { display: true, text: 'Stress (1–10)', color: ch.textColor, font: { size: 12 } }
        },
        x: {
          ticks: { color: ch.textColor, font: { size: 12 }, maxTicksLimit: 10 },
          grid: { display: false },
          border: { display: false },
          title: { display: true, text: 'Date', color: ch.textColor, font: { size: 12 } }
        }
      }
    }
  });
}

function updateSummaries(data) {
  const wellness = data.wellness || [];

  if (wellness.length === 0) {
    document.getElementById('weeklySummary').innerHTML = '<div class="empty-state"><p>No data yet. Start tracking!</p></div>';
    document.getElementById('monthlySummary').innerHTML = '<div class="empty-state"><p>No data yet.</p></div>';
    return;
  }

  const weeklyData = wellness.slice(-7);
  const weeklyAvgStress = weeklyData.length ? (weeklyData.reduce((s, w) => s + (w.stressLevel || 0), 0) / weeklyData.length).toFixed(1) : '0';
  const weeklyAvgSleep = weeklyData.length ? (weeklyData.reduce((s, w) => s + (w.sleepHours || 0), 0) / weeklyData.length).toFixed(1) : '0';

  const avgStress = wellness.length ? (wellness.reduce((s, w) => s + (w.stressLevel || 0), 0) / wellness.length).toFixed(1) : '0';
  const avgSleep = wellness.length ? (wellness.reduce((s, w) => s + (w.sleepHours || 0), 0) / wellness.length).toFixed(1) : '0';
  const todosCompleted = wellness.filter(w => w.todoCompleted).length;

  const moodCounts = {};
  wellness.forEach(w => {
    const l = normalizeMood(w.mood);
    if (l) moodCounts[l] = (moodCounts[l] || 0) + 1;
  });
  const mostCommonMood = Object.keys(moodCounts).length
    ? Object.keys(moodCounts).reduce((a, b) => moodCounts[a] > moodCounts[b] ? a : b)
    : 'N/A';

  function stressClass(val) {
    return parseFloat(val) > 7 ? 'val-bad' : parseFloat(val) > 5 ? 'val-warn' : 'val-good';
  }

  const row = (label, value, cls) => `
    <div class="summary-stat-row">
      <span class="summary-stat-label">${label}</span>
      <strong class="summary-stat-value ${cls}">${value}</strong>
    </div>`;

  document.getElementById('weeklySummary').innerHTML = `
    ${row('Average Stress', `${weeklyAvgStress}/10`, stressClass(weeklyAvgStress))}
    ${row('Average Sleep', `${weeklyAvgSleep}h`, 'val-primary')}
    ${row('Entries Logged', `${weeklyData.length} days`, 'val-good')}`;

  document.getElementById('monthlySummary').innerHTML = `
    ${row('Total Entries', `${wellness.length} days`, 'val-primary')}
    ${row('Most Common Mood', mostCommonMood, 'val-primary')}
    ${row('Tasks Completed', `${todosCompleted}/${wellness.length}`, 'val-good')}
    ${row('Overall Avg Stress', `${avgStress}/10`, stressClass(avgStress))}
    ${row('Overall Avg Sleep', `${avgSleep}h`, 'val-primary')}`;
}

// ---- COMPLAINTS ----
async function loadComplaints() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const container = document.getElementById('complaintsList');
  container.innerHTML = '<p style="color:var(--text-muted);font-size:14px;">Loading...</p>';
  try {
    const r = await fetch(`${API_URL}/admin/complaints`, { headers: { 'Authorization': `Bearer ${token}` } });
    const all = await r.json();
    const mine = all.filter(c => c.complainerId === user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (mine.length === 0) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
        <p>No complaints filed yet.</p></div>`;
      return;
    }

    container.innerHTML = mine.map(c => `
      <div class="complaint-card ${c.status}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:10px;">
          <div>
            <h4 style="font-size:14.5px; font-weight:600; color:var(--text-primary); margin-bottom:4px;">${c.subject}</h4>
            <p style="font-size:12.5px; color:var(--text-muted);">Against: ${c.againstRole === 'doctor' ? 'Your Doctor' : c.againstRole}</p>
          </div>
          <span class="status-pill ${c.status}">${c.status === 'pending' ? 'Pending' : 'Resolved'}</span>
        </div>
        <p style="font-size:13.5px; color:var(--text-secondary); line-height:1.6; margin-bottom:10px;">${c.description}</p>
        <p style="font-size:12px; color:var(--text-muted);">Filed: ${new Date(c.createdAt).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</p>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = '<p style="color:var(--text-muted);">Error loading complaints. Please try again.</p>';
  }
}

async function submitComplaint(e) {
  e.preventDefault();
  const token = localStorage.getItem('token');
  let againstId = null;
  const againstType = document.getElementById('complaintAgainst').value;

  if (againstType === 'doctor') {
    try {
      const r = await fetch(`${API_URL}/patient/profile`, { headers: { 'Authorization': `Bearer ${token}` } });
      const profile = await r.json();
      againstId = profile.selectedDoctor?._id || null;
    } catch (e) { console.error(e); }
  }

  const data = {
    againstId,
    againstRole: againstType,
    subject: document.getElementById('complaintSubject').value,
    description: document.getElementById('complaintDescription').value
  };

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Submitting...';

  try {
    const r = await fetch(`${API_URL}/complaint`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (r.ok) {
      showNotification('Complaint submitted successfully!', 'success');
      document.getElementById('complaintForm').reset();
      loadComplaints();
    } else {
      const err = await r.json();
      showNotification(err.message || 'Failed to submit complaint', 'error');
    }
  } catch (e) {
    showNotification('Error submitting complaint. Please try again.', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Submit Complaint';
  }
}

// ---- LOGOUT ----
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'index.html';
}

// ---- NOTIFICATION ----
function showNotification(message, type) {
  const n = document.getElementById('notification');
  if (!n) return;
  n.textContent = message;
  n.className = `notification ${type} show`;
  setTimeout(() => n.classList.remove('show'), 3500);
}