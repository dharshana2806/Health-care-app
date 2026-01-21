document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  loadTheme();
  loadAdminProfile();
  loadOverviewData();
  setupNavigation();
  setupEventListeners();
});

function checkAuth() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (!token || user.role !== 'admin') {
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

async function loadAdminProfile() {
  const user = JSON.parse(localStorage.getItem('user'));
  document.getElementById('userName').textContent = user.name || 'Admin';
  
  // Try to load admin profile with photo
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/admin/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      const admin = await response.json();
      if (admin.profilePhoto) {
        // Fix: Clean the path properly
        let cleanPath = admin.profilePhoto.replace(/\\/g, '/');
        // Remove 'backend/' prefix if it exists
        cleanPath = cleanPath.replace(/^backend\//, '');
        // Remove 'uploads/' prefix if it exists
        cleanPath = cleanPath.replace(/^uploads\//, '');
        // Now construct the correct path
        const photoPath = `/backend/uploads/${cleanPath}`;
        console.log('Admin photo path:', photoPath);
        
        const profileImg = document.getElementById('profilePhoto');
        profileImg.src = photoPath;
        profileImg.onerror = function() {
          console.log('Failed to load image, using placeholder');
          this.src = 'https://via.placeholder.com/60';
        };
      }
    }
  } catch (error) {
    console.log('Using default profile photo');
  }
}

async function loadOverviewData() {
  const token = localStorage.getItem('token');
  try {
    const [doctorsRes, resourcesRes, complaintsRes, patientsRes, approvedDoctorsRes] = await Promise.all([
      fetch(`${API_URL}/admin/doctors/pending`, { headers: { 'Authorization': `Bearer ${token}` }}),
      fetch(`${API_URL}/admin/resources/pending`, { headers: { 'Authorization': `Bearer ${token}` }}),
      fetch(`${API_URL}/admin/complaints`, { headers: { 'Authorization': `Bearer ${token}` }}),
      fetch(`${API_URL}/admin/patients/count`, { headers: { 'Authorization': `Bearer ${token}` }}),
      fetch(`${API_URL}/admin/doctors/approved/count`, { headers: { 'Authorization': `Bearer ${token}` }})
    ]);
    
    const doctors = await doctorsRes.json();
    const resources = await resourcesRes.json();
    const complaints = await complaintsRes.json();
    
    // Get counts - FIXED: Proper error handling
    let patientCount = 0;
    let doctorCount = 0;
    
    if (patientsRes.ok) {
      const patientsData = await patientsRes.json();
      patientCount = patientsData.count || 0;
    }
    
    if (approvedDoctorsRes.ok) {
      const doctorsData = await approvedDoctorsRes.json();
      doctorCount = doctorsData.count || 0;
    }
    
    document.getElementById('totalPatients').textContent = patientCount;
    document.getElementById('totalDoctors').textContent = doctorCount;
    document.getElementById('pendingRequests').textContent = doctors.length + resources.length;
    document.getElementById('openComplaints').textContent = 
      complaints.filter(c => c.status === 'pending').length;
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
  
  if (section === 'doctor-requests') loadDoctorRequests();
  if (section === 'resource-approvals') loadResourceApprovals();
  if (section === 'complaints') loadComplaints();
  if (section === 'users') loadAllUsers();
  if (section === 'statistics') loadStatistics();
}

function setupEventListeners() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const parent = this.closest('.resource-filters, .complaint-filters, .user-type-filters');
      parent.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      const filter = this.dataset.filter;
      if (this.closest('.resource-filters')) {
        filterResources(filter);
      } else if (this.closest('.complaint-filters')) {
        filterComplaints(filter);
      } else if (this.closest('.user-type-filters')) {
        loadUsersByType(filter);
      }
    });
  });
}

async function loadDoctorRequests() {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/admin/doctors/pending`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const doctors = await response.json();
    
    const container = document.getElementById('doctorRequestsList');
    if (doctors.length === 0) {
      container.innerHTML = '<p class="empty-state">No pending requests</p>';
      return;
    }
    
    container.innerHTML = doctors.map(doctor => `
      <div class="card doctor-request-card">
        <div class="request-header">
          <img src="${doctor.profilePhoto || 'https://via.placeholder.com/60'}" 
               alt="${doctor.name}" class="profile-photo-small">
          <div>
            <h4>${doctor.name}</h4>
            <p>${doctor.specialization}</p>
          </div>
        </div>
        <div class="request-details">
          <p><strong>Email:</strong> ${doctor.email}</p>
          <p><strong>Phone:</strong> ${doctor.phone}</p>
          <p><strong>Time Slot:</strong> ${doctor.timeSlot}</p>
          <p><strong>Proof:</strong> <a href="${doctor.proof}" target="_blank">View Document</a></p>
        </div>
        <div class="btn-group">
          <button class="btn btn-primary btn-sm" 
                  onclick="showDoctorDetails('${doctor._id}')">View Details</button>
          <button class="btn btn-success btn-sm" 
                  onclick="approveDoctor('${doctor._id}')">✅ Approve</button>
          <button class="btn btn-danger btn-sm" 
                  onclick="rejectDoctor('${doctor._id}')">❌ Reject</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error:', error);
  }
}

function showDoctorDetails(doctorId) {
  currentDoctorId = doctorId;
  const token = localStorage.getItem('token');
  
  fetch(`${API_URL}/admin/doctors/pending`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(r => r.json())
  .then(doctors => {
    const doctor = doctors.find(d => d._id === doctorId);
    if (!doctor) return;
    
    const proofPath = doctor.proof ? `/${doctor.proof}` : '';
    const photoPath = doctor.profilePhoto ? `/${doctor.profilePhoto}` : 'https://via.placeholder.com/150';
    
    document.getElementById('doctorDetailsContent').innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="${photoPath}" alt="${doctor.name}" style="width: 150px; height: 150px; border-radius: 50%; object-fit: cover; border: 3px solid var(--primary-color);">
      </div>
      <h3 style="text-align: center; margin-bottom: 20px;">${doctor.name}</h3>
      <div style="margin: 15px 0;">
        <strong>Specialization:</strong> ${doctor.specialization}
      </div>
      <div style="margin: 15px 0;">
        <strong>Email:</strong> ${doctor.email}
      </div>
      <div style="margin: 15px 0;">
        <strong>Phone:</strong> ${doctor.phone}
      </div>
      <div style="margin: 15px 0;">
        <strong>Time Slot:</strong> ${doctor.timeSlot}
      </div>
      <div style="margin: 15px 0;">
        <strong>Date of Birth:</strong> ${new Date(doctor.dob).toLocaleDateString()}
      </div>
      <div style="margin: 20px 0;">
        <strong>Doctor Proof/Certificate:</strong><br>
        ${proofPath ? `
          <a href="${proofPath}" target="_blank" class="btn btn-primary" style="margin-top: 10px; display: inline-block; padding: 10px 20px; text-decoration: none;">
            📄 View Certificate/Proof
          </a>
          <br>
          ${doctor.proof.endsWith('.pdf') ? 
            `<iframe src="${proofPath}" style="width: 100%; height: 400px; margin-top: 15px; border: 1px solid var(--border-color);"></iframe>` :
            `<img src="${proofPath}" style="max-width: 100%; margin-top: 15px; border: 1px solid var(--border-color);" alt="Doctor Proof">`
          }
        ` : 'No proof uploaded'}
      </div>
    `;
    
    document.getElementById('doctorDetailsModal').style.display = 'block';
  });
}

async function approveDoctor(doctorId) {
  if (!confirm('Approve this doctor?')) return;
  
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/admin/doctor/${doctorId}/approve`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ approved: true })
    });
    
    if (response.ok) {
      showNotification('Doctor approved!', 'success');
      loadDoctorRequests();
      loadOverviewData();
    }
  } catch (error) {
    showNotification('Error approving doctor', 'error');
  }
}

async function rejectDoctor(doctorId) {
  if (!confirm('Reject this doctor? This will delete their account and documents.')) return;
  
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/admin/doctor/${doctorId}/approve`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ approved: false })
    });
    
    if (response.ok) {
      showNotification('Doctor rejected and removed', 'success');
      loadDoctorRequests();
      loadOverviewData();
    }
  } catch (error) {
    showNotification('Error rejecting doctor', 'error');
  }
}

function approveDoctorFromModal() {
  approveDoctor(currentDoctorId);
  document.getElementById('doctorDetailsModal').style.display = 'none';
}

function rejectDoctorFromModal() {
  rejectDoctor(currentDoctorId);
  document.getElementById('doctorDetailsModal').style.display = 'none';
}

async function loadResourceApprovals() {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/admin/resources/pending`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const resources = await response.json();
    
    displayResources(resources);
  } catch (error) {
    console.error('Error:', error);
  }
}

function displayResources(resources) {
  const container = document.getElementById('resourceApprovalsList');
  if (resources.length === 0) {
    container.innerHTML = '<p class="empty-state">No pending resources</p>';
    return;
  }
  
  container.innerHTML = resources.map(resource => {
    const cleanPath = resource.filePath.replace(/\\/g, '/').replace(/'/g, "\\'");
    
    return `
    <div class="card resource-approval-card">
      <div class="resource-type-badge ${resource.type}">${resource.type.toUpperCase()}</div>
      <h4>${resource.title}</h4>
      <p>${resource.description}</p>
      <p><small>Uploaded by: ${resource.uploaderRole}</small></p>
      <div class="btn-group">
        <button class="btn btn-primary btn-sm" 
                onclick="previewResource('${resource._id}', '${cleanPath}', '${resource.type}')">
          ➡️ Preview
        </button>
        <button class="btn btn-success btn-sm" 
                onclick="approveResource('${resource._id}')">✅ Approve</button>
        <button class="btn btn-danger btn-sm" 
                onclick="rejectResource('${resource._id}')">❌ Reject</button>
      </div>
    </div>
  `}).join('');
}

function filterResources(filter) {
  const token = localStorage.getItem('token');
  fetch(`${API_URL}/admin/resources/pending`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(r => r.json())
  .then(resources => {
    const filtered = filter === 'all' ? resources : 
                     resources.filter(r => r.type === filter);
    displayResources(filtered);
  });
}

function previewResource(id, filePath, type) {
  currentResourceId = id;
  const modal = document.getElementById('resourcePreviewModal');
  const content = document.getElementById('resourcePreviewContent');
  
  if (type === 'audio') {
    content.innerHTML = `<audio controls style="width:100%;"><source src="${filePath}"></audio>`;
  } else if (type === 'video') {
    content.innerHTML = `<video controls style="width:100%;"><source src="${filePath}"></video>`;
  } else {
    content.innerHTML = `<iframe src="${filePath}" style="width:100%;height:500px;"></iframe>`;
  }
  
  modal.style.display = 'block';
}

async function approveResource(resourceId) {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/admin/resource/${resourceId}/approve`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ approved: true })
    });
    
    if (response.ok) {
      showNotification('Resource approved!', 'success');
      loadResourceApprovals();
      loadOverviewData();
    }
  } catch (error) {
    showNotification('Error approving resource', 'error');
  }
}

async function rejectResource(resourceId) {
  if (!confirm('Reject and delete this resource?')) return;
  
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/admin/resource/${resourceId}/approve`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ approved: false })
    });
    
    if (response.ok) {
      showNotification('Resource rejected and deleted', 'success');
      loadResourceApprovals();
      loadOverviewData();
    }
  } catch (error) {
    showNotification('Error rejecting resource', 'error');
  }
}

function approveResourceFromModal() {
  approveResource(currentResourceId);
  document.getElementById('resourcePreviewModal').style.display = 'none';
}

function rejectResourceFromModal() {
  rejectResource(currentResourceId);
  document.getElementById('resourcePreviewModal').style.display = 'none';
}

async function loadComplaints() {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/admin/complaints`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const complaints = await response.json();
    
    displayComplaints(complaints);
  } catch (error) {
    console.error('Error:', error);
  }
}

function displayComplaints(complaints) {
  const container = document.getElementById('complaintsList');
  if (complaints.length === 0) {
    container.innerHTML = '<p class="empty-state">No complaints</p>';
    return;
  }
  
  container.innerHTML = complaints.map(complaint => `
    <div class="card complaint-card">
      <div class="complaint-header">
        <h4>${complaint.subject}</h4>
        <span class="status-badge ${complaint.status}">${complaint.status}</span>
      </div>
      <p><strong>From:</strong> ${complaint.complainerRole}</p>
      <p><strong>Against:</strong> ${complaint.againstRole}</p>
      <p class="complaint-desc">${complaint.description.substring(0, 150)}...</p>
      <small>Filed: ${new Date(complaint.createdAt).toLocaleDateString()}</small>
      <div class="btn-group">
        <button class="btn btn-primary btn-sm" 
                onclick="showComplaintDetails('${complaint._id}')">View Details</button>
        ${complaint.status === 'pending' ? `
          <button class="btn btn-success btn-sm" 
                  onclick="markComplaintResolved('${complaint._id}')">Mark Resolved</button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

function filterComplaints(filter) {
  const token = localStorage.getItem('token');
  fetch(`${API_URL}/admin/complaints`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(r => r.json())
  .then(complaints => {
    let filtered = complaints;
    if (filter === 'patient') filtered = complaints.filter(c => c.complainerRole === 'patient');
    else if (filter === 'doctor') filtered = complaints.filter(c => c.complainerRole === 'doctor');
    else if (filter === 'pending') filtered = complaints.filter(c => c.status === 'pending');
    else if (filter === 'resolved') filtered = complaints.filter(c => c.status === 'resolved');
    
    displayComplaints(filtered);
  });
}

function showComplaintDetails(id) {
  currentComplaintId = id;
  const token = localStorage.getItem('token');
  
  fetch(`${API_URL}/admin/complaints`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(r => r.json())
  .then(complaints => {
    const complaint = complaints.find(c => c._id === id);
    if (!complaint) return;
    
    document.getElementById('complaintDetailsContent').innerHTML = `
      <div style="margin: 20px 0;">
        <h3>${complaint.subject}</h3>
        <div style="margin: 15px 0;">
          <strong>From:</strong> ${complaint.complainerRole} 
          <span style="color: var(--text-secondary);">(ID: ${complaint.complainerId})</span>
        </div>
        <div style="margin: 15px 0;">
          <strong>Against:</strong> ${complaint.againstRole}
          ${complaint.againstId ? `<span style="color: var(--text-secondary);"> (ID: ${complaint.againstId})</span>` : ''}
        </div>
        <div style="margin: 15px 0;">
          <strong>Status:</strong> 
          <span class="status-badge ${complaint.status}" style="padding: 5px 15px; border-radius: 5px; margin-left: 10px;">
            ${complaint.status === 'pending' ? '⚠️ Pending' : '✅ Resolved'}
          </span>
        </div>
        <div style="margin: 15px 0;">
          <strong>Filed on:</strong> ${new Date(complaint.createdAt).toLocaleString()}
        </div>
        <div style="margin: 20px 0; padding: 15px; background: var(--bg-secondary); border-radius: 8px; border-left: 4px solid var(--primary-color);">
          <strong>Description:</strong><br><br>
          ${complaint.description}
        </div>
      </div>
    `;
    
    document.getElementById('complaintDetailsModal').style.display = 'block';
  });
}

async function markComplaintResolved(complaintId = currentComplaintId) {
  if (!complaintId) return;
  
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/admin/complaint/${complaintId}/resolve`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'resolved' })
    });
    
    if (response.ok) {
      showNotification('Complaint marked as resolved', 'success');
      document.getElementById('complaintDetailsModal').style.display = 'none';
      loadComplaints();
      loadOverviewData();
    }
  } catch (error) {
    showNotification('Error updating complaint', 'error');
  }
}

async function loadAllUsers() {
  loadUsersByType('patients');
}

async function loadUsersByType(type) {
  const token = localStorage.getItem('token');
  const container = document.getElementById('usersList');
  container.innerHTML = '<p class="empty-state">Loading users...</p>';
  
  try {
    const endpoint = type === 'patients' ? 
      `${API_URL}/admin/users/patients` : 
      `${API_URL}/admin/users/doctors`;
    
    const response = await fetch(endpoint, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const users = await response.json();
    
    if (users.length === 0) {
      container.innerHTML = `<p class="empty-state">No ${type} found</p>`;
      return;
    }
    
    if (type === 'patients') {
      container.innerHTML = `
        <div class="cards-grid">
          ${users.map(user => {
            const photoPath = user.profilePhoto ? 
              `/backend/uploads/${user.profilePhoto.replace(/\\/g, '/').replace(/backend\/uploads\//g, '')}` :
              'https://via.placeholder.com/80';
            
            return `
              <div class="card" style="text-align: center; padding: 20px;">
                <img src="${photoPath}" 
                     style="width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 15px; object-fit: cover; border: 3px solid var(--primary-color);"
                     alt="${user.name}"
                     onerror="this.src='https://via.placeholder.com/80'">
                <h4 style="margin: 10px 0 5px 0;">${user.name}</h4>
                <p style="color: var(--text-secondary); margin: 5px 0;">${user.email}</p>
                <p style="color: var(--text-secondary); margin: 5px 0;"><small>${user.phone}</small></p>
                ${user.selectedDoctor ? 
                  `<p style="color: var(--success-color); margin-top: 10px;"><small>👨‍⚕️ ${user.selectedDoctor.name}</small></p>` :
                  `<p style="color: var(--text-secondary); margin-top: 10px;"><small>No doctor assigned</small></p>`
                }
                <small style="color: var(--text-secondary); display: block; margin-top: 10px;">
                  Joined: ${new Date(user.createdAt).toLocaleDateString()}
                </small>
              </div>
            `}).join('')}
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="cards-grid">
          ${users.map(user => {
            const photoPath = user.profilePhoto ? 
              `/backend/uploads/${user.profilePhoto.replace(/\\/g, '/').replace(/backend\/uploads\//g, '')}` :
              'https://via.placeholder.com/80';
            
            return `
              <div class="card" style="text-align: center; padding: 20px;">
                <img src="${photoPath}" 
                     style="width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 15px; object-fit: cover; border: 3px solid var(--success-color);"
                     alt="${user.name}"
                     onerror="this.src='https://via.placeholder.com/80'">
                <h4 style="margin: 10px 0 5px 0;">${user.name}</h4>
                <p style="color: var(--text-secondary); margin: 5px 0;">${user.email}</p>
                <p style="color: var(--success-color); margin: 5px 0; font-weight: 600;">${user.specialization}</p>
                <p style="color: var(--text-secondary); margin: 5px 0;"><small>🕐 ${user.timeSlot}</small></p>
                <small style="color: var(--text-secondary); display: block; margin-top: 10px;">
                  Joined: ${new Date(user.createdAt).toLocaleDateString()}
                </small>
              </div>
            `}).join('')}
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading users:', error);
    container.innerHTML = `<p class="empty-state">Error loading ${type}</p>`;
  }
}

function loadStatistics() {
  const token = localStorage.getItem('token');
  
  fetch(`${API_URL}/admin/statistics`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(r => r.json())
  .then(stats => {
    console.log('Statistics loaded:', stats);
    
    // Update system usage with real data
    document.getElementById('totalSessions').textContent = stats.totals.patients + stats.totals.doctors;
    document.getElementById('totalMessages').textContent = '-';
    document.getElementById('totalCalls').textContent = '-';
    document.getElementById('resourceViews').textContent = stats.totals.resources;
    
    // Update monthly overview with real data
    document.getElementById('monthlyPatients').textContent = stats.monthly.patients;
    document.getElementById('monthlyDoctors').textContent = stats.monthly.doctors;
    document.getElementById('monthlyAppointments').textContent = stats.monthly.appointments;
    document.getElementById('monthlyResources').textContent = stats.monthly.resources;
    document.getElementById('monthlyComplaints').textContent = stats.monthly.complaints;
    
    // Create charts with real data
    createRegistrationChart(stats.registrations);
    createAppointmentChart(stats.appointments);
    createResourceChart(stats.resources);
  })
  .catch(error => {
    console.error('Error loading statistics:', error);
    // Fallback to sample data if error
    createRegistrationChart({ patients: [], doctors: [] });
    createAppointmentChart({ pending: 5, approved: 15, rejected: 3, completed: 20 });
    createResourceChart({ audio: 15, video: 10, article: 25 });
  });
}

// FIXED: Chart destroy errors
function createRegistrationChart(data) {
  const ctx = document.getElementById('registrationChart');
  
  // Fix: Only destroy if chart exists
  if (window.registrationChart && typeof window.registrationChart.destroy === 'function') {
    window.registrationChart.destroy();
  }
  
  // Create month labels
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  
  // Process patient data
  const patientData = months.map((_, index) => {
    const monthData = data.patients.find(p => p._id === index + 1);
    return monthData ? monthData.count : 0;
  });
  
  // Process doctor data
  const doctorData = months.map((_, index) => {
    const monthData = data.doctors.find(d => d._id === index + 1);
    return monthData ? monthData.count : 0;
  });
  
  window.registrationChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months,
      datasets: [{
        label: 'Patients',
        data: patientData,
        borderColor: 'rgba(74, 144, 226, 1)',
        backgroundColor: 'rgba(74, 144, 226, 0.1)',
        tension: 0.4,
        fill: true
      }, {
        label: 'Doctors',
        data: doctorData,
        borderColor: 'rgba(40, 167, 69, 1)',
        backgroundColor: 'rgba(40, 167, 69, 0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'User Registrations (Last 6 Months)'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    }
  });
}

function createAppointmentChart(data) {
  const ctx = document.getElementById('appointmentChart');
  
  // Fix: Only destroy if chart exists
  if (window.appointmentChart && typeof window.appointmentChart.destroy === 'function') {
    window.appointmentChart.destroy();
  }
  
  window.appointmentChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Pending', 'Approved', 'Rejected', 'Completed'],
      datasets: [{
        label: 'Appointments',
        data: [data.pending || 0, data.approved || 0, data.rejected || 0, data.completed || 0],
        backgroundColor: [
          'rgba(255, 193, 7, 0.7)',
          'rgba(40, 167, 69, 0.7)',
          'rgba(220, 53, 69, 0.7)',
          'rgba(74, 144, 226, 0.7)'
        ],
        borderColor: [
          'rgba(255, 193, 7, 1)',
          'rgba(40, 167, 69, 1)',
          'rgba(220, 53, 69, 1)',
          'rgba(74, 144, 226, 1)'
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
          text: 'Appointment Status Distribution'
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
          }
        }
      }
    }
  });
}

function createResourceChart(data) {
  const ctx = document.getElementById('resourceChart');
  
  // Fix: Only destroy if chart exists
  if (window.resourceChart && typeof window.resourceChart.destroy === 'function') {
    window.resourceChart.destroy();
  }
  
  window.resourceChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Audio', 'Video', 'Articles'],
      datasets: [{
        data: [data.audio || 0, data.video || 0, data.article || 0],
        backgroundColor: [
          'rgba(255, 193, 7, 0.7)',
          'rgba(74, 144, 226, 0.7)',
          'rgba(40, 167, 69, 0.7)'
        ],
        borderColor: [
          'rgba(255, 193, 7, 1)',
          'rgba(74, 144, 226, 1)',
          'rgba(40, 167, 69, 1)'
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
          text: 'Resource Type Distribution'
        },
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'index.html';
}

function showNotification(message, type) {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className = `notification ${type} show`;
  setTimeout(() => notification.classList.remove('show'), 3000);
}