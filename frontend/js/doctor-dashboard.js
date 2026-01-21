// Doctor Dashboard JavaScript - FINAL COMPLETE FIX
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  loadTheme();
  loadDoctorProfile();
  loadOverviewData();
  setupNavigation();
  setupEventListeners();
});

function checkAuth() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (!token || user.role !== 'doctor') {
    window.location.href = 'index.html';
  }
}

function loadTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.getElementById('themeToggle').textContent = savedTheme === 'dark' ? '☀️' : '🌙';
  
  document.getElementById('themeToggle').addEventListener('click', () => {
    const curr = document.documentElement.getAttribute('data-theme');
    const newTheme = curr === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    document.getElementById('themeToggle').textContent = newTheme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('theme', newTheme);
  });
}

async function loadDoctorProfile() {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/doctor/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const doctor = await response.json();
    
    document.getElementById('userName').textContent = doctor.name;
    document.getElementById('userSpec').textContent = doctor.specialization;
    
    let photoPath = 'https://via.placeholder.com/60';
    if (doctor.profilePhoto) {
      let cleanPath = doctor.profilePhoto.replace(/\\/g, '/');
      cleanPath = cleanPath.replace(/backend\/uploads\//g, '');
      photoPath = `/backend/uploads/${cleanPath}`;
    }
    
    const profileImg = document.getElementById('profilePhoto');
    profileImg.src = photoPath;
    profileImg.onerror = function() {
      this.src = 'https://via.placeholder.com/60';
    };
  } catch (error) {
    console.error('Error:', error);
  }
}

async function loadOverviewData() {
  const token = localStorage.getItem('token');
  try {
    const [patientsRes, appointmentsRes] = await Promise.all([
      fetch(`${API_URL}/doctor/patients`, { headers: { 'Authorization': `Bearer ${token}` }}),
      fetch(`${API_URL}/doctor/appointments`, { headers: { 'Authorization': `Bearer ${token}` }})
    ]);
    
    const patients = await patientsRes.json();
    const appointments = await appointmentsRes.json();
    
    document.getElementById('totalPatients').textContent = patients.length;
    document.getElementById('pendingAppointments').textContent = 
      appointments.filter(a => a.status === 'pending').length;
    document.getElementById('unreadMessages').textContent = '0';
    
    let highRiskCount = 0;
    for (const patient of patients) {
      try {
        const wellnessRes = await fetch(`${API_URL}/doctor/patient/${patient._id}/history`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const wellness = await wellnessRes.json();
        if (wellness.length > 0) {
          const recentStress = wellness.slice(0, 3);
          const avgStress = recentStress.reduce((sum, w) => sum + w.stressLevel, 0) / recentStress.length;
          if (avgStress > 7) highRiskCount++;
        }
      } catch (e) {
        console.log('Could not load wellness for patient');
      }
    }
    document.getElementById('highRiskPatients').textContent = highRiskCount;
  } catch (error) {
    console.error('Error:', error);
  }
}

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

function showSection(section) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  document.getElementById(`${section}Section`).classList.add('active');
  
  if (section === 'patients') loadPatients();
  if (section === 'patient-history') loadPatientHistorySelect();
  if (section === 'sentiment') loadSentimentTrends();
  if (section === 'appointments') loadAppointments();
  if (section === 'resources') loadMyResources();
  if (section === 'complaint') loadComplaintPatients();
  if (section === 'telecounseling') initializeTelecounseling();
}

function setupEventListeners() {
  const resourceForm = document.getElementById('resourceUploadForm');
  if (resourceForm) {
    resourceForm.addEventListener('submit', uploadResource);
  }
  
  const complaintForm = document.getElementById('complaintForm');
  if (complaintForm) {
    complaintForm.addEventListener('submit', submitComplaint);
  }
  
  const complaintAgainst = document.getElementById('complaintAgainst');
  if (complaintAgainst) {
    complaintAgainst.addEventListener('change', (e) => {
      const group = document.getElementById('patientSelectGroup');
      if (group) {
        group.style.display = e.target.value === 'patient' ? 'block' : 'none';
      }
    });
  }
  
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const parentSection = this.closest('.content-section');
      if (parentSection) {
        parentSection.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      }
      this.classList.add('active');
      const filter = this.dataset.filter;
      if (this.closest('#appointmentsSection')) {
        filterAppointments(filter);
      }
    });
  });
}

async function loadPatients() {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/doctor/patients`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const patients = await response.json();
    
    const container = document.getElementById('patientsList');
    if (patients.length === 0) {
      container.innerHTML = '<p class="empty-state">No patients assigned yet</p>';
      return;
    }
    
    container.innerHTML = patients.map(patient => {
      let photoPath = 'https://via.placeholder.com/80';
      if (patient.profilePhoto) {
        let cleanPath = patient.profilePhoto.replace(/\\/g, '/');
        cleanPath = cleanPath.replace(/backend\/uploads\//g, '');
        photoPath = `/backend/uploads/${cleanPath}`;
      }
      
      return `
      <div class="card patient-card" style="text-align: center; padding: 20px;">
        <img src="${photoPath}" 
             alt="${patient.name}" class="patient-photo" 
             style="width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 15px; object-fit: cover; border: 3px solid var(--primary-color);"
             onerror="this.src='https://via.placeholder.com/80'">
        <h4>${patient.name}</h4>
        <p style="color: var(--text-secondary); margin: 5px 0;">${patient.email}</p>
        <p style="color: var(--text-secondary); margin: 5px 0;"><small>Phone: ${patient.phone}</small></p>
        <button class="btn btn-primary btn-sm" style="margin-top: 10px;"
                onclick="viewPatientDetails('${patient._id}')">View Details</button>
      </div>
    `}).join('');
  } catch (error) {
    console.error('Error:', error);
  }
}

async function viewPatientDetails(patientId) {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/doctor/patients`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const patients = await response.json();
    const patient = patients.find(p => p._id === patientId);
    
    if (!patient) return;
    
    const wellnessRes = await fetch(`${API_URL}/doctor/patient/${patientId}/history`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const wellness = await wellnessRes.json();
    
    const avgStress = wellness.length > 0 
      ? (wellness.reduce((sum, w) => sum + w.stressLevel, 0) / wellness.length).toFixed(1)
      : 'N/A';
    
    const avgSleep = wellness.length > 0
      ? (wellness.reduce((sum, w) => sum + w.sleepHours, 0) / wellness.length).toFixed(1)
      : 'N/A';
    
    let photoPath = 'https://via.placeholder.com/120';
    if (patient.profilePhoto) {
      let cleanPath = patient.profilePhoto.replace(/\\/g, '/');
      cleanPath = cleanPath.replace(/backend\/uploads\//g, '');
      photoPath = `/backend/uploads/${cleanPath}`;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 700px;">
        <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
        <h2>Patient Details</h2>
        <div style="text-align: center; margin: 20px 0;">
          <img src="${photoPath}" style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 3px solid var(--primary-color);"
               onerror="this.src='https://via.placeholder.com/120'">
        </div>
        <h3 style="text-align: center; margin-bottom: 20px;">${patient.name}</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0;">
          <div><strong>Email:</strong> ${patient.email}</div>
          <div><strong>Phone:</strong> ${patient.phone}</div>
          <div><strong>Gender:</strong> ${patient.gender || 'N/A'}</div>
          <div><strong>DOB:</strong> ${patient.dob ? new Date(patient.dob).toLocaleDateString() : 'N/A'}</div>
          <div><strong>Avg Stress:</strong> ${avgStress}/10</div>
          <div><strong>Avg Sleep:</strong> ${avgSleep} hours</div>
        </div>
        <div style="margin-top: 20px;">
          <strong>Address:</strong><br>
          ${patient.address || 'Not provided'}
        </div>
        <div style="margin-top: 20px;">
          <strong>Recent Wellness Entries:</strong> ${wellness.length} entries
        </div>
        <div style="text-align: center; margin-top: 20px;">
          <button class="btn btn-primary" onclick="this.closest('.modal').remove()">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  } catch (error) {
    console.error('Error:', error);
    showNotification('Error loading patient details', 'error');
  }
}

// FIXED: Initialize telecounseling and populate patient list
 // Also update initializeTelecounseling to make items clickable properly
async function initializeTelecounseling() {
  const token = localStorage.getItem('token');
  const container = document.getElementById('chatPatientsList');
  
  if (!container) {
    console.error('Chat patients list container not found');
    return;
  }
  
  container.innerHTML = '<p class="empty-state">Loading patients...</p>';
  
  try {
    const response = await fetch(`${API_URL}/doctor/patients`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const patients = await response.json();
    
    console.log('Loaded patients for telecounseling:', patients.length);
    
    if (patients.length === 0) {
      container.innerHTML = '<p class="empty-state">No patients assigned yet</p>';
      return;
    }
    
    container.innerHTML = patients.map(patient => {
      let photoPath = 'https://via.placeholder.com/50';
      if (patient.profilePhoto) {
        let cleanPath = patient.profilePhoto.replace(/\\/g, '/');
        cleanPath = cleanPath.replace(/backend\/uploads\//g, '');
        photoPath = `/backend/uploads/${cleanPath}`;
      }
      
      return `
      <div class="chat-patient-item" 
           data-patient-id="${patient._id}"
           data-patient-name="${patient.name.replace(/"/g, '&quot;')}"
           data-patient-photo="${photoPath}"
           style="padding: 15px; border-bottom: 1px solid var(--border-color); cursor: pointer; display: flex; align-items: center; gap: 10px; transition: background 0.3s;">
        <img src="${photoPath}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;"
             onerror="this.src='https://via.placeholder.com/50'" alt="${patient.name}">
        <div style="flex: 1;">
          <h4 style="margin: 0; font-size: 14px; color: var(--text-primary);">${patient.name}</h4>
          <small style="color: var(--text-secondary); font-size: 12px;">Click to start chat</small>
        </div>
      </div>
    `}).join('');
    
    // Add click event listeners to patient items
    document.querySelectorAll('.chat-patient-item').forEach(item => {
      item.addEventListener('mouseenter', function() {
        this.style.background = 'var(--bg-secondary)';
      });
      item.addEventListener('mouseleave', function() {
        // Don't remove background if this is the selected item
        if (this.dataset.patientId !== window.currentChatUser) {
          this.style.background = 'transparent';
        }
      });
      item.addEventListener('click', function() {
        const patientId = this.dataset.patientId;
        const patientName = this.dataset.patientName;
        const patientPhoto = this.dataset.patientPhoto;
        selectPatientChat(patientId, patientName, patientPhoto);
      });
    });
  } catch (error) {
    console.error('Error loading patients for chat:', error);
    container.innerHTML = '<p class="empty-state" style="color: var(--danger-color);">Error loading patients</p>';
  }
}

// Make sure to export the function
if (typeof window !== 'undefined') {
  window.selectPatientChat = selectPatientChat;
  window.initializeTelecounseling = initializeTelecounseling;
}

// FIXED: Select patient for chat
// Doctor Dashboard - Chat Selection Fix
// Replace the selectPatientChat function in doctor-dashboard.js

function selectPatientChat(patientId, patientName, patientPhoto) {
  // Set global chat user in telecommunication.js
  if (typeof window !== 'undefined') {
    window.currentChatUser = patientId;
  }
  
  console.log('Doctor selected patient for chat:', patientName, patientId);
  
  const chatHeader = document.getElementById('chatHeaderDoctor');
  const chatInput = document.getElementById('chatInputDoctor');
  const patientNameEl = document.getElementById('patientNameChat');
  const patientPhotoEl = document.getElementById('patientPhotoChat');
  const chatMessages = document.getElementById('chatMessagesDoctor');
  
  if (chatHeader) chatHeader.style.display = 'flex';
  if (chatInput) chatInput.style.display = 'flex';
  if (patientNameEl) patientNameEl.textContent = patientName;
  if (patientPhotoEl) {
    patientPhotoEl.src = patientPhoto;
    patientPhotoEl.onerror = function() {
      this.src = 'https://via.placeholder.com/50';
    };
  }
  
  // Clear messages and show loading
  if (chatMessages) {
    chatMessages.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">Loading messages...</p>';
  }
  
  // Highlight selected patient
  document.querySelectorAll('.chat-patient-item').forEach(item => {
    item.style.background = 'transparent';
  });
  event.currentTarget.style.background = 'var(--bg-secondary)';
  
  // Load chat history
  if (typeof loadChatHistory === 'function') {
    console.log('Loading chat history for patient:', patientId);
    loadChatHistory(patientId);
  } else {
    console.error('loadChatHistory function not found');
  }
}

// FIXED: Patient History Select
async function loadPatientHistorySelect() {
  const token = localStorage.getItem('token');
  const select = document.getElementById('patientSelect');
  
  if (!select) {
    console.error('Patient select element not found');
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/doctor/patients`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load patients');
    }
    
    const patients = await response.json();
    console.log('Loaded patients for history:', patients.length);
    
    select.innerHTML = '<option value="">Choose a patient...</option>' +
      patients.map(p => `<option value="${p._id}">${p.name}</option>`).join('');
    
    // Remove old listeners and add fresh one
    const newSelect = select.cloneNode(true);
    select.parentNode.replaceChild(newSelect, select);
    
    newSelect.addEventListener('change', function() {
      console.log('Patient selected:', this.value);
      if (this.value) {
        loadPatientHistory(this.value);
      } else {
        document.getElementById('patientHistoryContent').style.display = 'none';
      }
    });
  } catch (error) {
    console.error('Error loading patients:', error);
    select.innerHTML = '<option value="">Error loading patients</option>';
  }
}

async function loadPatientHistory(patientId) {
  if (!patientId) {
    document.getElementById('patientHistoryContent').style.display = 'none';
    return;
  }
  
  console.log('Loading history for patient:', patientId);
  const token = localStorage.getItem('token');
  
  try {
    const patientsResponse = await fetch(`${API_URL}/doctor/patients`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const patients = await patientsResponse.json();
    const patient = patients.find(p => p._id === patientId);
    
    if (patient) {
      let photoPath = 'https://via.placeholder.com/80';
      if (patient.profilePhoto) {
        let cleanPath = patient.profilePhoto.replace(/\\/g, '/');
        cleanPath = cleanPath.replace(/backend\/uploads\//g, '');
        photoPath = `/backend/uploads/${cleanPath}`;
      }
      
      document.getElementById('patientInfo').innerHTML = `
        <div style="display: flex; align-items: center; gap: 20px;">
          <img src="${photoPath}" 
               style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;"
               onerror="this.src='https://via.placeholder.com/80'" alt="${patient.name}">
          <div>
            <h3 style="margin: 0 0 5px 0;">${patient.name}</h3>
            <p style="margin: 0; color: var(--text-secondary);">${patient.email}</p>
            <p style="margin: 5px 0 0 0; color: var(--text-secondary);">Phone: ${patient.phone}</p>
          </div>
        </div>
      `;
    }
    
    const response = await fetch(`${API_URL}/doctor/patient/${patientId}/history`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load wellness history');
    }
    
    const history = await response.json();
    console.log('Loaded wellness history:', history.length, 'entries');
    
    document.getElementById('patientHistoryContent').style.display = 'block';
    
    const ctx = document.getElementById('patientHistoryChart');
    if (window.patientChart && typeof window.patientChart.destroy === 'function') {
      window.patientChart.destroy();
    }
    
    if (history.length > 0) {
      window.patientChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: history.map(h => new Date(h.date).toLocaleDateString()),
          datasets: [{
            label: 'Stress Level',
            data: history.map(h => h.stressLevel),
            borderColor: 'rgba(220, 53, 69, 1)',
            backgroundColor: 'rgba(220, 53, 69, 0.1)',
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              max: 10,
              title: {
                display: true,
                text: 'Stress Level'
              }
            }
          }
        }
      });
    }
    
    const entriesContainer = document.getElementById('patientWellnessEntries');
    if (history.length === 0) {
      entriesContainer.innerHTML = '<p class="empty-state">No wellness data available for this patient</p>';
    } else {
      entriesContainer.innerHTML = history.map(entry => `
        <div class="wellness-entry" style="border: 1px solid var(--border-color); padding: 15px; border-radius: 8px; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <strong style="color: var(--text-primary);">${new Date(entry.date).toLocaleDateString()}</strong>
            <span style="font-size: 24px;">${entry.mood}</span>
          </div>
          <div style="display: flex; gap: 20px; color: var(--text-secondary);">
            <span>💤 Sleep: ${entry.sleepHours}h</span>
            <span>📊 Stress: ${entry.stressLevel}/10</span>
            <span>${entry.todoCompleted ? '✅ Tasks Done' : '⏳ Tasks Pending'}</span>
          </div>
          ${entry.notes ? `<p style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-color); color: var(--text-secondary); font-style: italic;">${entry.notes}</p>` : ''}
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('Error loading patient history:', error);
    showNotification('Error loading patient history', 'error');
    document.getElementById('patientHistoryContent').style.display = 'none';
  }
}

// FIXED: Sentiment Trends
async function loadSentimentTrends() {
  const token = localStorage.getItem('token');
  const container = document.getElementById('sentimentTrends');
  
  if (!container) {
    console.error('Sentiment trends container not found');
    return;
  }
  
  container.innerHTML = '<p class="empty-state">Loading sentiment data...</p>';
  
  try {
    const response = await fetch(`${API_URL}/doctor/patients/sentiment`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load sentiment data');
    }
    
    const trends = await response.json();
    console.log('Loaded sentiment trends:', trends.length);
    
    if (trends.length === 0) {
      container.innerHTML = '<p class="empty-state">No data available</p>';
      return;
    }
    
    container.innerHTML = `
      <table class="sentiment-table" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: var(--bg-secondary); text-align: left;">
            <th style="padding: 12px; border-bottom: 2px solid var(--border-color);">Patient Name</th>
            <th style="padding: 12px; border-bottom: 2px solid var(--border-color);">Avg Stress Level</th>
            <th style="padding: 12px; border-bottom: 2px solid var(--border-color);">Status</th>
          </tr>
        </thead>
        <tbody>
          ${trends.map(trend => `
            <tr style="border-bottom: 1px solid var(--border-color);">
              <td style="padding: 12px;">${trend.patientName}</td>
              <td style="padding: 12px; font-weight: 600;">${trend.avgStress.toFixed(1)}/10</td>
              <td style="padding: 12px;">
                <span class="status-badge ${trend.avgStress > 7 ? 'danger' : trend.avgStress > 5 ? 'warning' : 'success'}"
                      style="padding: 5px 12px; border-radius: 5px; font-size: 12px; font-weight: 600;">
                  ${trend.avgStress > 7 ? '⚠️ High Risk' : trend.avgStress > 5 ? '⚡ Moderate' : '✅ Good'}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error('Error loading sentiment trends:', error);
    container.innerHTML = '<p class="empty-state" style="color: var(--danger-color);">Error loading sentiment data</p>';
  }
}

async function loadAppointments() {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/doctor/appointments`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const appointments = await response.json();
    
    displayAppointments(appointments);
  } catch (error) {
    console.error('Error:', error);
  }
}

function displayAppointments(appointments) {
  const container = document.getElementById('appointmentsList');
  if (appointments.length === 0) {
    container.innerHTML = '<p class="empty-state">No appointments</p>';
    return;
  }
  
  container.innerHTML = appointments.map(apt => `
    <div class="card appointment-card">
      <div class="appointment-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h4 style="margin: 0;">${new Date(apt.date).toLocaleDateString()} at ${apt.time}</h4>
        <span class="status-badge ${apt.status}" style="padding: 5px 15px; border-radius: 5px; font-size: 12px; font-weight: 600;">${apt.status}</span>
      </div>
      <p><strong>Patient:</strong> ${apt.patientId?.name || 'N/A'}</p>
      <p><strong>Phone:</strong> ${apt.patientId?.phone || 'N/A'}</p>
      <p><strong>Reason:</strong> ${apt.reason}</p>
      ${apt.status === 'pending' ? `
        <div class="btn-group" style="margin-top: 15px;">
          <button class="btn btn-success btn-sm" onclick="updateAppointment('${apt._id}', 'approved')">✅ Approve</button>
          <button class="btn btn-danger btn-sm" onclick="updateAppointment('${apt._id}', 'rejected')">❌ Reject</button>
        </div>
      ` : ''}
    </div>
  `).join('');
}

function filterAppointments(filter) {
  const token = localStorage.getItem('token');
  fetch(`${API_URL}/doctor/appointments`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(r => r.json())
  .then(appointments => {
    const filtered = filter === 'all' ? appointments : 
                     appointments.filter(a => a.status === filter);
    displayAppointments(filtered);
  });
}

async function updateAppointment(id, status) {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/doctor/appointment/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });
    
    if (response.ok) {
      showNotification(`Appointment ${status}!`, 'success');
      loadAppointments();
      loadOverviewData();
    }
  } catch (error) {
    showNotification('Error updating appointment', 'error');
  }
}
// CRITICAL FIX: Prevent double submission
async function uploadResource(e) {
  e.preventDefault();
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  
  // CRITICAL: Check if already uploading
  if (submitBtn.disabled) {
    console.log('⚠️ Upload already in progress, ignoring duplicate click');
    return;
  }
  
  const fileInput = document.getElementById('resourceFile');
  const file = fileInput.files[0];
  
  if (!file) {
    showNotification('Please select a file', 'error');
    return;
  }
  
  if (file.size > 50 * 1024 * 1024) {
    showNotification('File size exceeds 50MB limit', 'error');
    return;
  }
  
  const type = document.getElementById('resourceType').value;
  
  if (!type) {
    showNotification('Please select resource type', 'error');
    return;
  }
  
  const validTypes = {
    audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3', 'audio/x-m4a'],
    video: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
    article: ['application/pdf']
  };
  
  if (!validTypes[type].includes(file.type)) {
    showNotification(`Invalid file type for ${type}. Please select: ${validTypes[type].join(', ')}`, 'error');
    return;
  }
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', document.getElementById('resourceTitle').value);
  formData.append('description', document.getElementById('resourceDescription').value);
  formData.append('type', type);
  formData.append('uploadType', type);
  
  const token = localStorage.getItem('token');
  const originalBtnText = submitBtn.textContent;
  
  try {
    // CRITICAL: Disable button IMMEDIATELY
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Uploading...';
    submitBtn.style.opacity = '0.6';
    submitBtn.style.cursor = 'not-allowed';
    
    console.log('📤 Starting upload...');
    
    const response = await fetch(`${API_URL}/resource/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Non-JSON response:', text);
      throw new Error('Server returned invalid response. Check server logs.');
    }
    
    const result = await response.json();
    
    if (response.ok) {
      showNotification('Resource uploaded successfully! Pending admin approval.', 'success');
      
      // Reset form
      e.target.reset();
      fileInput.value = '';
      
      loadMyResources();
      
      // Re-enable button after 2 seconds
      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
      }, 2000);
    } else {
      throw new Error(result.error || 'Upload failed');
    }
  } catch (error) {
    console.error('Upload error:', error);
    showNotification('Upload failed: ' + error.message, 'error');
    
    // Re-enable button immediately on error
    submitBtn.disabled = false;
    submitBtn.textContent = originalBtnText;
    submitBtn.style.opacity = '1';
    submitBtn.style.cursor = 'pointer';
  }
}

// FIXED: Doctor Dashboard - Show Uploaded Resources and Complaints

// Add this to doctor-dashboard.js - Replace loadMyResources function
async function loadMyResources() {
  const token = localStorage.getItem('token');
  const myResourcesContainer = document.getElementById('myResourcesList');
  
  if (!myResourcesContainer) {
    console.error('My resources container not found');
    return;
  }
  
  myResourcesContainer.innerHTML = '<p class="empty-state">Loading your resources...</p>';
  
  try {
    // Get ALL resources (both pending and approved)
    const [pendingRes, approvedRes] = await Promise.all([
      fetch(`${API_URL}/admin/resources/pending`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }),
      fetch(`${API_URL}/resources`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
    ]);
    
    const pendingResources = await pendingRes.json();
    const approvedResources = await approvedRes.json();
    
    // Get current user ID
    const user = JSON.parse(localStorage.getItem('user'));
    
    // Filter resources uploaded by current doctor
    const myPendingResources = pendingResources.filter(r => r.uploadedBy === user.id);
    const myApprovedResources = approvedResources.filter(r => r.uploadedBy === user.id);
    
    // Combine all resources
    const allMyResources = [
      ...myPendingResources.map(r => ({...r, approved: false})),
      ...myApprovedResources.map(r => ({...r, approved: true}))
    ];
    
    console.log('Doctor uploaded resources:', allMyResources.length);
    
    if (allMyResources.length === 0) {
      myResourcesContainer.innerHTML = '<p class="empty-state">No resources uploaded yet. Upload your first resource above!</p>';
      return;
    }
    
    // Display resources with status
    myResourcesContainer.innerHTML = `
      <div style="display: grid; gap: 15px;">
        ${allMyResources.map(resource => {
          const statusBadge = resource.approved ? 
            '<span class="status-badge approved" style="background: rgba(40, 167, 69, 0.2); color: #28a745; padding: 5px 12px; border-radius: 5px; font-size: 12px; font-weight: 600;">✅ Approved</span>' :
            '<span class="status-badge pending" style="background: rgba(255, 193, 7, 0.2); color: #ffc107; padding: 5px 12px; border-radius: 5px; font-size: 12px; font-weight: 600;">⏳ Pending Approval</span>';
          
          const icon = resource.type === 'audio' ? '🎵' : 
                      resource.type === 'video' ? '🎬' : '📄';
          
          return `
            <div class="card" style="padding: 15px; border-left: 4px solid ${resource.approved ? 'var(--success-color)' : 'var(--warning-color)'};">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                <div style="flex: 1;">
                  <div style="font-size: 24px; margin-bottom: 5px;">${icon}</div>
                  <h4 style="margin: 0 0 5px 0; color: var(--text-primary);">${resource.title}</h4>
                  <p style="color: var(--text-secondary); font-size: 14px; margin: 5px 0;">${resource.description}</p>
                </div>
                <div>
                  ${statusBadge}
                </div>
              </div>
              <div style="display: flex; gap: 10px; align-items: center; color: var(--text-secondary); font-size: 12px; margin-top: 10px;">
                <span style="background: var(--bg-secondary); padding: 4px 10px; border-radius: 4px; text-transform: uppercase; font-weight: 600;">${resource.type}</span>
                <span>📅 ${new Date(resource.createdAt).toLocaleDateString()}</span>
                ${resource.approved ? '<span style="color: var(--success-color); font-weight: 600;">✓ Visible to patients</span>' : '<span style="color: var(--warning-color); font-weight: 600;">⏳ Awaiting admin approval</span>'}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (error) {
    console.error('Error loading resources:', error);
    myResourcesContainer.innerHTML = '<p class="empty-state" style="color: var(--danger-color);">Error loading your resources. Please try again.</p>';
  }
}

async function loadComplaintPatients() {
  const token = localStorage.getItem('token');
  
  try {
    // Load patients for complaint dropdown
    const patientsResponse = await fetch(`${API_URL}/doctor/patients`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const patients = await patientsResponse.json();
    
    const select = document.getElementById('complaintPatientId');
    if (select) {
      select.innerHTML = '<option value="">Choose patient...</option>' +
        patients.map(p => `<option value="${p._id}">${p.name}</option>`).join('');
    }
    
    // CRITICAL FIX: Load and display previous complaints
    await loadDoctorComplaints();
    
  } catch (error) {
    console.error('Error:', error);
  }
}
async function loadDoctorComplaints() {
  const token = localStorage.getItem('token');
  const complaintsContainer = document.getElementById('complaintsList');
  
  if (!complaintsContainer) {
    console.error('Complaints list container not found');
    return;
  }
  
  try {
    // Get all complaints
    const response = await fetch(`${API_URL}/admin/complaints`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load complaints');
    }
    
    const allComplaints = await response.json();
    const user = JSON.parse(localStorage.getItem('user'));
    
    // Filter complaints filed by current doctor
    const myComplaints = allComplaints.filter(c => c.complainerId === user.id);
    
    console.log('Doctor complaints:', myComplaints.length);
    
    if (myComplaints.length === 0) {
      complaintsContainer.innerHTML = '<p class="empty-state">No complaints filed yet</p>';
      return;
    }
    
    // Display complaints with status
    complaintsContainer.innerHTML = `
      <div style="display: grid; gap: 15px; margin-top: 20px;">
        ${myComplaints.map(complaint => {
          const isPending = complaint.status === 'pending';
          const statusBadge = isPending ?
            '<span class="status-badge pending" style="background: rgba(255, 193, 7, 0.2); color: #ffc107; padding: 5px 15px; border-radius: 5px; font-size: 12px; font-weight: 600;">⚠ Pending</span>' :
            '<span class="status-badge success" style="background: rgba(40, 167, 69, 0.2); color: #28a745; padding: 5px 15px; border-radius: 5px; font-size: 12px; font-weight: 600;">✅ Resolved</span>';
          
          return `
            <div class="card" style="padding: 20px; border-left: 4px solid ${isPending ? 'var(--warning-color)' : 'var(--success-color)'};">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                <div style="flex: 1;">
                  <h4 style="margin: 0 0 10px 0; color: var(--text-primary);">${complaint.subject}</h4>
                </div>
                <div>
                  ${statusBadge}
                </div>
              </div>
              
              <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                <p style="color: var(--text-secondary); margin: 0; line-height: 1.6;">${complaint.description}</p>
              </div>
              
              <div style="display: flex; gap: 15px; flex-wrap: wrap; color: var(--text-secondary); font-size: 13px; margin-top: 10px;">
                <span><strong>Against:</strong> ${complaint.againstRole || 'System'}</span>
                <span><strong>Filed:</strong> ${new Date(complaint.createdAt).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })}</span>
                ${!isPending ? `<span style="color: var(--success-color); font-weight: 600;">✓ Resolved by admin</span>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    
  } catch (error) {
    console.error('Error loading complaints:', error);
    complaintsContainer.innerHTML = '<p class="empty-state" style="color: var(--danger-color);">Error loading complaints. Please try again.</p>';
  }
}

async function submitComplaint(e) {
  e.preventDefault();
  
  const token = localStorage.getItem('token');
  const againstType = document.getElementById('complaintAgainst').value;
  
  const data = {
    againstId: againstType === 'patient' ? document.getElementById('complaintPatientId')?.value : null,
    againstRole: againstType === 'patient' ? 'patient' : againstType,
    subject: document.getElementById('complaintSubject').value,
    description: document.getElementById('complaintDescription').value
  };
  
  try {
    const response = await fetch(`${API_URL}/complaint`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      showNotification('Complaint submitted successfully! Admin will review it.', 'success');
      document.getElementById('complaintForm').reset();
      document.getElementById('patientSelectGroup').style.display = 'none';
      
      // CRITICAL: Reload complaints list to show the new complaint
      await loadDoctorComplaints();
      
    } else {
      const error = await response.json();
      showNotification(error.message || 'Failed to submit complaint', 'error');
    }
  } catch (error) {
    console.error('Error submitting complaint:', error);
    showNotification('Error submitting complaint. Please try again.', 'error');
  }
}

// Make sure these functions are called when complaint section is opened
// Update the showSection function to include complaint loading
const originalShowSection = showSection;
window.showSection = function(section) {
  originalShowSection(section);
  
  // Load complaints when complaint section is opened
  if (section === 'complaint') {
    loadComplaintPatients();
  }
  
  // Load resources when resources section is opened
  if (section === 'resources') {
    loadMyResources();
  }
};

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

// Make functions globally available
if (typeof window !== 'undefined') {
  window.viewPatientDetails = viewPatientDetails;
  window.selectPatientChat = selectPatientChat;
  window.updateAppointment = updateAppointment;
  window.loadMyResources = loadMyResources;
  window.loadDoctorComplaints = loadDoctorComplaints;
  window.loadComplaintPatients = loadComplaintPatients;
  window.submitComplaint = submitComplaint;
}