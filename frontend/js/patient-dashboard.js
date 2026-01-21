// Patient Dashboard JavaScript
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  loadTheme();
  loadPatientProfile(); // This will load doctor photo properly
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
    return;
  }
}
function loadTheme() {
  // Get unique tab ID
  const tabId = sessionStorage.getItem('currentTabId') || 
                ('tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9));
  
  // Save tab ID if not exists
  if (!sessionStorage.getItem('currentTabId')) {
    sessionStorage.setItem('currentTabId', tabId);
  }
  
  // Get theme for THIS tab only - Default to light
  let savedTheme = sessionStorage.getItem(`theme_${tabId}`);
  
  // If no theme set for this tab, default to light
  if (!savedTheme) {
    savedTheme = 'light';
    sessionStorage.setItem(`theme_${tabId}`, 'light');
  }
  
  // Apply theme
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  const themeToggleBtn = document.getElementById('themeToggle');
  if (themeToggleBtn) {
    themeToggleBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
  }
  
  console.log('✅ Dashboard theme loaded for tab:', tabId, '- Theme:', savedTheme);
  
  // Setup theme toggle
  setupDashboardThemeToggle(tabId);
}
function setupDashboardThemeToggle(tabId) {
  const themeToggleBtn = document.getElementById('themeToggle');
  
  if (themeToggleBtn) {
    // Remove existing listeners
    const newBtn = themeToggleBtn.cloneNode(true);
    themeToggleBtn.parentNode.replaceChild(newBtn, themeToggleBtn);
    
    // Add new listener
    newBtn.addEventListener('click', () => {
      // Get current theme for THIS tab
      const currentTheme = sessionStorage.getItem(`theme_${tabId}`) || 'light';
      
      // Toggle theme
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      // Save to sessionStorage (per-tab only)
      sessionStorage.setItem(`theme_${tabId}`, newTheme);
      
      // Apply theme
      document.documentElement.setAttribute('data-theme', newTheme);
      
      // Update button icon
      newBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
      
      console.log('✅ Theme toggled for tab:', tabId, '- New theme:', newTheme);
    });
    
    console.log('✅ Theme toggle setup complete for dashboard');
  }
}


// Patient Dashboard - FIXED loadPatientProfile Function

async function loadPatientProfile() {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/patient/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const patient = await response.json();
    
    console.log('✅ Full patient data:', patient);
    console.log('✅ Selected doctor object:', patient.selectedDoctor);
    
    document.getElementById('userName').textContent = patient.name;
    document.getElementById('userEmail').textContent = patient.email;
    
    // Patient profile photo
    if (patient.profilePhoto) {
      let patientPhotoPath = patient.profilePhoto.replace(/\\/g, '/');
      patientPhotoPath = patientPhotoPath.replace(/^backend\//, '').replace(/^uploads\//, '');
      patientPhotoPath = `/backend/uploads/profiles/${patientPhotoPath.split('/').pop()}`;
      
      const profileImg = document.getElementById('profilePhoto');
      profileImg.src = patientPhotoPath;
      profileImg.onerror = function() {
        this.src = 'https://via.placeholder.com/60?text=Patient';
      };
    }
    
    if (patient.selectedDoctor) {
      console.log('✅ Selected doctor found:', patient.selectedDoctor);
      
      // Update doctor info
      const doctorName = patient.selectedDoctor.name || 'Doctor';
      const doctorSpec = patient.selectedDoctor.specialization || 'Specialist';
      
      document.getElementById('doctorName').textContent = doctorName;
      document.getElementById('doctorSpec').textContent = doctorSpec;
      document.getElementById('doctorNameChat').textContent = doctorName;
      document.getElementById('doctorSpecChat').textContent = doctorSpec;
      
      // CRITICAL FIX: Doctor photo path
      let doctorPhotoPath = 'https://via.placeholder.com/60?text=Dr';
      
      if (patient.selectedDoctor.profilePhoto) {
        console.log('✅ Raw doctor photo path:', patient.selectedDoctor.profilePhoto);
        
        // Clean the path completely
        let cleanPath = patient.selectedDoctor.profilePhoto.replace(/\\/g, '/');
        
        // Remove any backend/ or uploads/ or profiles/ prefixes
        cleanPath = cleanPath.replace(/^backend\//, '')
                             .replace(/^uploads\//, '')
                             .replace(/^profiles\//, '');
        
        // Extract just the filename
        const filename = cleanPath.split('/').pop();
        
        // CRITICAL: Construct proper path to profiles folder
        doctorPhotoPath = `/backend/uploads/profiles/${filename}`;
        
        console.log('✅ Final doctor photo path:', doctorPhotoPath);
      } else {
        console.warn('⚠️ Doctor profilePhoto field is missing or empty');
      }
      
      // CRITICAL: Set doctor photo in telecounseling chat header
      const doctorPhotoElement = document.getElementById('doctorPhotoChat');
      if (doctorPhotoElement) {
        doctorPhotoElement.src = doctorPhotoPath;
        
        // FIXED: Error handler with cleanPath defined in scope
        doctorPhotoElement.onerror = function() {
          console.warn('⚠️ Failed to load doctor photo from:', this.src);
          
          // Try alternative paths
          const alternativePaths = [
            `/backend/uploads/${patient.selectedDoctor.profilePhoto}`,
            `/backend/${patient.selectedDoctor.profilePhoto}`,
            `/${patient.selectedDoctor.profilePhoto}`
          ];
          
          // Try first alternative
          if (alternativePaths.length > 0 && this.src !== alternativePaths[0]) {
            console.log('🔄 Trying alternative path:', alternativePaths[0]);
            this.onerror = function() {
              // Try second alternative
              if (alternativePaths.length > 1 && this.src !== alternativePaths[1]) {
                console.log('🔄 Trying alternative path:', alternativePaths[1]);
                this.onerror = function() {
                  // All failed, use placeholder
                  console.log('❌ All paths failed, using placeholder');
                  this.onerror = null;
                  this.src = 'https://via.placeholder.com/60?text=Dr';
                };
                this.src = alternativePaths[1];
              } else {
                this.onerror = null;
                this.src = 'https://via.placeholder.com/60?text=Dr';
              }
            };
            this.src = alternativePaths[0];
          } else {
            // Use placeholder
            this.onerror = null;
            this.src = 'https://via.placeholder.com/60?text=Dr';
          }
        };
        
        doctorPhotoElement.onload = function() {
          console.log('✅ Doctor photo loaded successfully from:', this.src);
        };
      }
      
      // Store globally for calls
      window.selectedDoctorInfo = {
        id: patient.selectedDoctor._id,
        name: doctorName,
        photo: doctorPhotoPath
      };
      
      console.log('✅ Stored doctor info globally:', window.selectedDoctorInfo);
      
      // Initialize chat
      if (typeof window.loadChatHistory === 'function') {
        window.currentChatUser = patient.selectedDoctor._id;
        window.loadChatHistory(patient.selectedDoctor._id);
      }
    } else {
      console.warn('❌ No selected doctor');
    }
  } catch (error) {
    console.error('❌ Error loading profile:', error);
    showNotification('Error loading profile', 'error');
  }
}

// Load Overview Data
async function loadOverviewData() {
  await loadTodayTasks();
  await loadWellnessStreak();
  await loadWeeklyStress();
}

async function loadTodayTasks() {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/patient/todo/today`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const todo = await response.json();
    const pendingTasks = todo.tasks?.filter(t => !t.completed).length || 0;
    document.getElementById('todayTasksCount').textContent = pendingTasks;
  } catch (error) {
    console.error('Error:', error);
  }
}
async function loadWellnessStreak() {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/patient/wellness/history?period=month`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const history = await response.json();
    
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const hasEntry = history.some(h => {
        const entryDate = new Date(h.date);
        return entryDate.toDateString() === checkDate.toDateString();
      });
      if (hasEntry) streak++;
      else break;
    }
    
    document.getElementById('wellnessStreak').textContent = streak;
  } catch (error) {
    console.error('Error:', error);
  }
}
async function loadWeeklyStress() {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/patient/progress`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    document.getElementById('weeklyStress').textContent = data.weeklyAvgStress.toFixed(1);
  } catch (error) {
    console.error('Error:', error);
  }
}
// Navigation Setup
function setupNavigation() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (link.id === 'logoutBtn') {
        logout();
        return;
      }
      
      const section = link.dataset.section;
      showSection(section);
      
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });
}
// IMPORTANT: Call loadChatHistory when telecounseling section is opened
function showSection(section) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  document.getElementById(`${section}Section`).classList.add('active');
  
  if (section === 'todo') loadTodoList();
  if (section === 'wellness') loadRecentWellness();
  if (section === 'resources') loadResources();
  if (section === 'appointments') loadAppointments();
  if (section === 'progress') loadProgressCharts();
  if (section === 'complaint') loadComplaints();
  
  if (section === 'telecounseling') {
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/patient/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(patient => {
      if (patient.selectedDoctor && patient.selectedDoctor._id) {
        if (typeof loadChatHistory === 'function') {
          loadChatHistory(patient.selectedDoctor._id);
        }
      }
    })
    .catch(err => console.error('Error:', err));
  }
}


// Event Listeners Setup
function setupEventListeners() {
  document.getElementById('addTodoBtn')?.addEventListener('click', () => {
    document.getElementById('todoForm').style.display = 'block';
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
}

// Todo List Functions
function addTaskInput() {
  const container = document.getElementById('taskInputs');
  const taskDiv = document.createElement('div');
  taskDiv.className = 'form-group';
  taskDiv.innerHTML = `
    <input type="text" placeholder="Task ${taskCount}" class="task-input" required>
    <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">Remove</button>
  `;
  container.appendChild(taskDiv);
  taskCount++;
}

async function saveTodoList() {
  const token = localStorage.getItem('token');
  const taskInputs = document.querySelectorAll('.task-input');
  const tasks = Array.from(taskInputs).map(input => ({
    task: input.value,
    completed: false,
    reason: ''
  }));
  
  try {
    const response = await fetch(`${API_URL}/patient/todo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tasks })
    });
    
    if (response.ok) {
      showNotification('To-do list created!', 'success');
      document.getElementById('todoForm').style.display = 'none';
      document.getElementById('taskInputs').innerHTML = '';
      taskCount = 1;
      loadTodoList();
    }
  } catch (error) {
    showNotification('Error saving tasks', 'error');
  }
}

async function loadTodoList() {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/patient/todo/today`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const todo = await response.json();
    
    const container = document.getElementById('todoList');
    if (!todo.tasks || todo.tasks.length === 0) {
      container.innerHTML = '<p class="empty-state">No tasks for today</p>';
      return;
    }
    
    container.innerHTML = todo.tasks.map((task, index) => `
      <div class="todo-item ${task.completed ? 'completed' : ''}" style="padding: 15px; margin-bottom: 10px; border: 1px solid var(--border-color); border-radius: 8px; display: flex; align-items: center; gap: 10px;">
        <input type="checkbox" 
               id="task-${index}"
               ${task.completed ? 'checked' : ''} 
               onchange="toggleTask('${todo._id}', ${index}, this.checked)"
               style="width: 20px; height: 20px; cursor: pointer;">
        <label for="task-${index}" style="flex: 1; cursor: pointer; ${task.completed ? 'text-decoration: line-through; color: var(--text-secondary);' : ''}">${task.task}</label>
        ${task.reason ? `<small style="color: var(--danger-color); font-style: italic;">Not completed: ${task.reason}</small>` : ''}
      </div>
    `).join('');
  } catch (error) {
    console.error('Error:', error);
  }
}

async function toggleTask(todoId, taskIndex, completed) {
  const token = localStorage.getItem('token');
  
  if (!completed) {
    const reason = prompt('Why couldn\'t you complete this task?');
    if (!reason) return;
    
    try {
      await fetch(`${API_URL}/patient/todo/${todoId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ taskIndex, completed: false, reason })
      });
      
      loadTodoList();
      loadTodayTasks();
    } catch (error) {
      showNotification('Error updating task', 'error');
    }
  } else {
    try {
      await fetch(`${API_URL}/patient/todo/${todoId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ taskIndex, completed: true })
      });
      
      loadTodoList();
      loadTodayTasks();
    } catch (error) {
      showNotification('Error updating task', 'error');
    }
  }
}

// Wellness Tracker Functions
async function saveWellness(e) {
  e.preventDefault();
  
  if (!selectedMood) {
    showNotification('Please select your mood', 'error');
    return;
  }
  
  const token = localStorage.getItem('token');
  const data = {
    mood: selectedMood,
    sleepHours: parseFloat(document.getElementById('sleepHours').value),
    stressLevel: parseInt(document.getElementById('stressLevel').value),
    notes: document.getElementById('wellnessNotes').value,
    todoCompleted: document.getElementById('todoCompleted').checked
  };
  
  try {
    const response = await fetch(`${API_URL}/patient/wellness`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      showNotification('Wellness entry saved!', 'success');
      document.getElementById('wellnessForm').reset();
      selectedMood = '';
      document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
      loadRecentWellness();
      loadOverviewData();
    }
  } catch (error) {
    showNotification('Error saving entry', 'error');
  }
}

async function loadRecentWellness() {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/patient/wellness/history?period=month`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const wellness = await response.json();
    
    const container = document.getElementById('recentWellness');
    if (wellness.length === 0) {
      container.innerHTML = '<p class="empty-state">No wellness entries yet. Start tracking today!</p>';
      return;
    }
    
    container.innerHTML = wellness.map(entry => `
      <div class="wellness-entry" style="border: 1px solid var(--border-color); padding: 15px; border-radius: 8px; margin-bottom: 10px;">
        <div class="wellness-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span class="wellness-date" style="font-weight: 600; color: var(--text-primary);">
            ${new Date(entry.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
          <span class="wellness-mood" style="font-size: 24px;">${entry.mood}</span>
        </div>
        <div class="wellness-details" style="display: flex; gap: 20px; margin-bottom: 10px;">
          <span style="color: var(--text-secondary);">🛌 Sleep: ${entry.sleepHours}h</span>
          <span style="color: var(--text-secondary);">📊 Stress: ${entry.stressLevel}/10</span>
          <span style="color: var(--text-secondary);">${entry.todoCompleted ? '✅ Tasks Done' : '⚠ Tasks Pending'}</span>
        </div>
        ${entry.notes ? `<p class="wellness-notes" style="color: var(--text-secondary); font-style: italic; border-left: 3px solid var(--primary-color); padding-left: 10px; margin: 10px 0 0 0;">${entry.notes}</p>` : ''}
      </div>
    `).join('');
  } catch (error) {
    console.error('Error:', error);
  }
}
function sendQuickReply(message) {
  const input = document.getElementById('chatbotInput');
  if (input) {
    input.value = message;
    sendChatbotMessage();
  }
}

// Chatbot Functions
async function sendChatbotMessage() {
  const input = document.getElementById('chatbotInput');
  const message = input.value.trim();
  if (!message) return;
  
  // Clear welcome message if exists
  const welcome = document.querySelector('.chatbot-welcome');
  if (welcome) welcome.remove();
  
  // Display user message
  appendChatbotMessage(message, true);
  input.value = '';
  
  // Show typing indicator
  const typingDiv = document.createElement('div');
  typingDiv.className = 'typing-indicator';
  typingDiv.id = 'typingIndicator';
  typingDiv.innerHTML = `
    <span>MindCare is typing</span>
    <div class="typing-dots">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;
  
  const container = document.getElementById('chatbotMessages');
  container.appendChild(typingDiv);
  container.scrollTop = container.scrollHeight;
  
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/chatbot`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message })
    });
    
    const data = await response.json();
    
    // Remove typing indicator
    const typing = document.getElementById('typingIndicator');
    if (typing) typing.remove();
    
    // Display bot response
    appendChatbotMessage(data.response, false);
  } catch (error) {
    // Remove typing indicator
    const typing = document.getElementById('typingIndicator');
    if (typing) typing.remove();
    
    appendChatbotMessage('Sorry, I encountered an error. Please try again.', false);
  }
}
function appendChatbotMessage(message, isUser) {
  const container = document.getElementById('chatbotMessages');
  const msgDiv = document.createElement('div');
  msgDiv.className = isUser ? 'user-message' : 'bot-message';
  msgDiv.innerHTML = `<div class="message-bubble"><p>${message}</p></div>`;
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}
if (typeof window !== 'undefined') {
  window.sendQuickReply = sendQuickReply;
}

// Appointments Functions
async function bookAppointment(e) {
  e.preventDefault();
  
  const token = localStorage.getItem('token');
  const data = {
    date: document.getElementById('appointmentDate').value,
    time: document.getElementById('appointmentTime').value,
    reason: document.getElementById('appointmentReason').value
  };
  
  try {
    const response = await fetch(`${API_URL}/patient/appointment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      showNotification('Appointment request sent!', 'success');
      document.getElementById('appointmentForm').style.display = 'none';
      document.getElementById('newAppointmentForm').reset();
      loadAppointments();
    }
  } catch (error) {
    showNotification('Error booking appointment', 'error');
  }
}

async function loadAppointments() {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/patient/appointments`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const appointments = await response.json();
    
    const container = document.getElementById('appointmentsList');
    if (appointments.length === 0) {
      container.innerHTML = '<p class="empty-state">No appointments</p>';
      return;
    }
    
    container.innerHTML = appointments.map(apt => `
      <div class="card appointment-card">
        <div class="appointment-header">
          <h4>${new Date(apt.date).toLocaleDateString()} at ${apt.time}</h4>
          <span class="status-badge ${apt.status}">${apt.status}</span>
        </div>
        <p><strong>Doctor:</strong> ${apt.doctorId?.name || 'N/A'}</p>
        <p><strong>Reason:</strong> ${apt.reason}</p>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Progress Charts
async function loadProgressCharts() {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/patient/progress`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    
    console.log('📊 Progress data loaded:', data);
    
    // Create charts with REAL data
    createMoodChart(data.wellness);
    createStressChart(data.wellness);
    updateSummaries(data);
  } catch (error) {
    console.error('❌ Error loading progress:', error);
  }
}

// CRITICAL FIX: Mood chart with real wellness data
function createMoodChart(wellness) {
  const ctx = document.getElementById('moodChart');
  
  if (!wellness || wellness.length === 0) {
    ctx.parentElement.innerHTML = '<p class="empty-state">No wellness data available. Start tracking your mood!</p>';
    return;
  }
  
  // Count mood frequencies from REAL data
  const moodCounts = {};
  wellness.forEach(w => {
    if (w.mood) {
      moodCounts[w.mood] = (moodCounts[w.mood] || 0) + 1;
    }
  });
  
  console.log('📊 Mood counts:', moodCounts);
  
  // Destroy existing chart if it exists
  if (window.moodChartInstance) {
    window.moodChartInstance.destroy();
  }
  
  window.moodChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(moodCounts),
      datasets: [{
        label: 'Mood Frequency',
        data: Object.values(moodCounts),
        backgroundColor: [
          'rgba(255, 206, 86, 0.6)',  // Happy - Yellow
          'rgba(54, 162, 235, 0.6)',  // Neutral - Blue
          'rgba(153, 102, 255, 0.6)', // Sad - Purple
          'rgba(255, 99, 132, 0.6)',  // Stressed - Red
          'rgba(201, 203, 207, 0.6)'  // Tired - Gray
        ],
        borderColor: [
          'rgba(255, 206, 86, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 99, 132, 1)',
          'rgba(201, 203, 207, 1)'
        ],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Your Mood Distribution',
          font: { size: 16 }
        },
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          },
          title: {
            display: true,
            text: 'Number of Days'
          }
        }
      }
    }
  });
}
function createStressChart(wellness) {
  const ctx = document.getElementById('stressChart');
  
  if (!wellness || wellness.length === 0) {
    ctx.parentElement.innerHTML = '<p class="empty-state">No wellness data available. Start tracking your stress!</p>';
    return;
  }
  
  // Sort by date (oldest first)
  const sortedWellness = wellness.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Extract dates and stress levels
  const dates = sortedWellness.map(w => {
    const date = new Date(w.date);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  
  const stressLevels = sortedWellness.map(w => w.stressLevel);
  
  console.log('📊 Stress data:', { dates, stressLevels });
  
  // Destroy existing chart if it exists
  if (window.stressChartInstance) {
    window.stressChartInstance.destroy();
  }
  
  window.stressChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [{
        label: 'Stress Level',
        data: stressLevels,
        borderColor: 'rgba(220, 53, 69, 1)',
        backgroundColor: 'rgba(220, 53, 69, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: 'rgba(220, 53, 69, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Stress Level Over Time',
          font: { size: 16 }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 10,
          ticks: {
            stepSize: 1
          },
          title: {
            display: true,
            text: 'Stress Level (1-10)'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Date'
          }
        }
      }
    }
  });
}

function updateSummaries(data) {
  const wellness = data.wellness || [];
  
  if (wellness.length === 0) {
    document.getElementById('weeklySummary').innerHTML = '<p class="empty-state">No data available yet. Start tracking your wellness!</p>';
    document.getElementById('monthlySummary').innerHTML = '<p class="empty-state">No data available yet.</p>';
    return;
  }
  
  // Calculate averages from REAL data
  const avgStress = data.weeklyAvgStress ? data.weeklyAvgStress.toFixed(1) : 
                    (wellness.reduce((sum, w) => sum + (w.stressLevel || 0), 0) / wellness.length).toFixed(1);
  
  const avgSleep = wellness.length > 0 ? 
                   (wellness.reduce((sum, w) => sum + (w.sleepHours || 0), 0) / wellness.length).toFixed(1) : '0';
  
  // Count completed todos
  const todosCompleted = wellness.filter(w => w.todoCompleted).length;
  
  // Get most common mood
  const moodCounts = {};
  wellness.forEach(w => {
    if (w.mood) {
      moodCounts[w.mood] = (moodCounts[w.mood] || 0) + 1;
    }
  });
  
  const mostCommonMood = Object.keys(moodCounts).length > 0 ?
    Object.keys(moodCounts).reduce((a, b) => moodCounts[a] > moodCounts[b] ? a : b) : 
    'N/A';
  
  // Weekly summary (last 7 days)
  const weeklyData = wellness.slice(-7);
  const weeklyAvgStress = weeklyData.length > 0 ?
    (weeklyData.reduce((sum, w) => sum + (w.stressLevel || 0), 0) / weeklyData.length).toFixed(1) : '0';
  
  const weeklyAvgSleep = weeklyData.length > 0 ?
    (weeklyData.reduce((sum, w) => sum + (w.sleepHours || 0), 0) / weeklyData.length).toFixed(1) : '0';
  
  document.getElementById('weeklySummary').innerHTML = `
    <div style="padding: 15px;">
      <div style="margin-bottom: 15px;">
        <strong style="color: var(--text-primary);">📊 Last 7 Days</strong>
      </div>
      <div style="display: grid; gap: 10px;">
        <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--bg-secondary); border-radius: 5px;">
          <span>Average Stress:</span>
          <strong style="color: ${weeklyAvgStress > 7 ? 'var(--danger-color)' : weeklyAvgStress > 5 ? 'var(--warning-color)' : 'var(--success-color)'}">
            ${weeklyAvgStress}/10
          </strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--bg-secondary); border-radius: 5px;">
          <span>Average Sleep:</span>
          <strong style="color: var(--primary-color)">${weeklyAvgSleep} hours</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--bg-secondary); border-radius: 5px;">
          <span>Entries Logged:</span>
          <strong style="color: var(--success-color)">${weeklyData.length} days</strong>
        </div>
      </div>
    </div>
  `;
  
  // Monthly summary (all data)
  document.getElementById('monthlySummary').innerHTML = `
    <div style="padding: 15px;">
      <div style="margin-bottom: 15px;">
        <strong style="color: var(--text-primary);">📈 Overall Stats</strong>
      </div>
      <div style="display: grid; gap: 10px;">
        <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--bg-secondary); border-radius: 5px;">
          <span>Total Entries:</span>
          <strong style="color: var(--primary-color)">${wellness.length} days</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--bg-secondary); border-radius: 5px;">
          <span>Most Common Mood:</span>
          <strong style="font-size: 20px;">${mostCommonMood}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--bg-secondary); border-radius: 5px;">
          <span>Tasks Completed:</span>
          <strong style="color: var(--success-color)">${todosCompleted}/${wellness.length}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--bg-secondary); border-radius: 5px;">
          <span>Overall Avg Stress:</span>
          <strong style="color: ${avgStress > 7 ? 'var(--danger-color)' : avgStress > 5 ? 'var(--warning-color)' : 'var(--success-color)'}">
            ${avgStress}/10
          </strong>
        </div>
      </div>
    </div>
  `;
}
async function loadComplaints() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user'));
  const complaintsContainer = document.getElementById('complaintsList');
  
  if (!complaintsContainer) {
    console.error('Complaints list container not found');
    return;
  }
  
  complaintsContainer.innerHTML = '<p class="empty-state">Loading your complaints...</p>';
  
  try {
    const response = await fetch(`${API_URL}/admin/complaints`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load complaints');
    }
    
    const allComplaints = await response.json();
    
    // Filter complaints filed by current patient
    const myComplaints = allComplaints.filter(c => c.complainerId === user.id);
    
    console.log('Patient complaints:', myComplaints.length);
    
    if (myComplaints.length === 0) {
      complaintsContainer.innerHTML = '<p class="empty-state">No complaints filed yet</p>';
      return;
    }
    
    // Sort by date (newest first)
    myComplaints.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Display complaints with beautiful styling
    complaintsContainer.innerHTML = `
      <div style="display: grid; gap: 15px; margin-top: 20px;">
        ${myComplaints.map(complaint => {
          const isPending = complaint.status === 'pending';
          const isResolved = complaint.status === 'resolved';
          
          const statusBadge = isPending ?
            '<span class="status-badge pending" style="background: rgba(255, 193, 7, 0.2); color: #ffc107; border: 1px solid #ffc107; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 5px;"><span>⏳</span> Pending Review</span>' :
            '<span class="status-badge success" style="background: rgba(40, 167, 69, 0.2); color: #28a745; border: 1px solid #28a745; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 5px;"><span>✅</span> Resolved</span>';
          
          const borderColor = isPending ? 'var(--warning-color)' : 'var(--success-color)';
          
          return `
            <div class="card" style="padding: 20px; border-left: 4px solid ${borderColor}; transition: transform 0.2s ease, box-shadow 0.2s ease;">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px; gap: 15px;">
                <div style="flex: 1;">
                  <h4 style="margin: 0 0 8px 0; color: var(--text-primary); font-size: 18px; font-weight: 600;">${complaint.subject}</h4>
                  <div style="color: var(--text-secondary); font-size: 13px;">
                    <span style="font-weight: 500;">Against:</span> ${complaint.againstRole === 'doctor' ? 'Your Doctor' : complaint.againstRole}
                  </div>
                </div>
                <div style="flex-shrink: 0;">
                  ${statusBadge}
                </div>
              </div>
              
              <div style="background: var(--bg-secondary); padding: 15px; border-radius: 10px; margin-bottom: 15px; border: 1px solid var(--border-color);">
                <div style="color: var(--text-secondary); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Description</div>
                <p style="color: var(--text-primary); margin: 0; line-height: 1.7; font-size: 14px;">${complaint.description}</p>
              </div>
              
              <div style="display: flex; gap: 20px; flex-wrap: wrap; align-items: center; padding-top: 10px; border-top: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; gap: 6px; color: var(--text-secondary); font-size: 13px;">
                  <span style="font-size: 16px;">📅</span>
                  <span><strong>Filed:</strong> ${new Date(complaint.createdAt).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</span>
                </div>
                
                ${isResolved ? `
                  <div style="display: flex; align-items: center; gap: 6px; color: var(--success-color); font-size: 13px; font-weight: 600;">
                    <span style="font-size: 16px;">✓</span>
                    <span>Resolved by admin</span>
                  </div>
                ` : `
                  <div style="display: flex; align-items: center; gap: 6px; color: var(--warning-color); font-size: 13px; font-weight: 600;">
                    <span style="font-size: 16px;">⏳</span>
                    <span>Under admin review</span>
                  </div>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
      
      <div style="margin-top: 20px; padding: 15px; background: var(--bg-secondary); border-radius: 10px; border-left: 4px solid var(--primary-color);">
        <div style="display: flex; align-items: start; gap: 10px;">
          <span style="font-size: 20px;">ℹ️</span>
          <div style="flex: 1;">
            <strong style="color: var(--text-primary);">About Complaints</strong>
            <p style="color: var(--text-secondary); margin: 5px 0 0 0; font-size: 14px; line-height: 1.6;">
              Your complaints are reviewed by the admin team. You'll be notified when your complaint is resolved. 
              ${myComplaints.filter(c => c.status === 'pending').length > 0 ? 
                `You currently have ${myComplaints.filter(c => c.status === 'pending').length} pending complaint${myComplaints.filter(c => c.status === 'pending').length > 1 ? 's' : ''}.` : 
                'All your complaints have been resolved!'}
            </p>
          </div>
        </div>
      </div>
    `;
    
  } catch (error) {
    console.error('Error loading complaints:', error);
    complaintsContainer.innerHTML = `
      <div style="text-align: center; padding: 40px 20px;">
        <div style="font-size: 48px; margin-bottom: 15px;">⚠️</div>
        <p style="color: var(--danger-color); font-weight: 600; margin-bottom: 10px;">Error Loading Complaints</p>
        <p style="color: var(--text-secondary); font-size: 14px;">Unable to load your complaints. Please try again later.</p>
        <button class="btn btn-primary" onclick="loadComplaints()" style="margin-top: 15px;">
          🔄 Retry
        </button>
      </div>
    `;
  }
}

// Complaint Functions
async function submitComplaint(e) {
  e.preventDefault();
  
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user'));
  
  // Get selected doctor from patient profile
  let againstId = null;
  try {
    const profileResponse = await fetch(`${API_URL}/patient/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const profile = await profileResponse.json();
    againstId = profile.selectedDoctor?._id || null;
  } catch (error) {
    console.error('Could not get doctor ID:', error);
  }
  
  const againstType = document.getElementById('complaintAgainst').value;
  
  const data = {
    againstId: againstType === 'doctor' ? againstId : null,
    againstRole: againstType === 'doctor' ? 'doctor' : againstType,
    subject: document.getElementById('complaintSubject').value,
    description: document.getElementById('complaintDescription').value
  };
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.textContent;
  
  try {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Submitting...';
    
    const response = await fetch(`${API_URL}/complaint`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      showNotification('✅ Complaint submitted successfully! Admin will review it.', 'success');
      document.getElementById('complaintForm').reset();
      
      // CRITICAL: Reload complaints list to show the new complaint
      await loadComplaints();
      
      // Scroll to complaints list
      const complaintsList = document.getElementById('complaintsList');
      if (complaintsList) {
        complaintsList.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      
    } else {
      const error = await response.json();
      showNotification(error.message || '❌ Failed to submit complaint', 'error');
    }
  } catch (error) {
    console.error('Error submitting complaint:', error);
    showNotification('❌ Error submitting complaint. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalBtnText;
  }
}
async function loadComplaints() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user'));
  
  try {
    const response = await fetch(`${API_URL}/admin/complaints`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const allComplaints = await response.json();
    
    // Filter complaints by current user
    const myComplaints = allComplaints.filter(c => c.complainerId === user.id);
    
    const container = document.getElementById('complaintsList');
    if (myComplaints.length === 0) {
      container.innerHTML = '<p class="empty-state">No complaints filed</p>';
      return;
    }
    
    container.innerHTML = myComplaints.map(complaint => `
      <div class="card" style="margin-top: 15px; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <h4 style="margin: 0;">${complaint.subject}</h4>
          <span class="status-badge ${complaint.status}" style="padding: 5px 15px; border-radius: 5px; font-size: 12px; font-weight: 600;">
            ${complaint.status === 'pending' ? '⚠ Pending' : '✅ Resolved'}
          </span>
        </div>
        <p style="color: var(--text-secondary); margin: 10px 0;">${complaint.description}</p>
        <small style="color: var(--text-secondary);">Filed on: ${new Date(complaint.createdAt).toLocaleDateString()}</small>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading complaints:', error);
    document.getElementById('complaintsList').innerHTML = '<p class="empty-state">Error loading complaints</p>';
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'index.html';
}

function showNotification(message, type) {
  const notification = document.getElementById('notification');
  if (notification) {
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    setTimeout(() => notification.classList.remove('show'), 3000);
  }
}