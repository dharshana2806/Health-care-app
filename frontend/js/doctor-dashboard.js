// ─────────────────────────────────────────────────────────────
//  Doctor Dashboard — matches professional doctordashboard.html
// ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  applyTheme();
  loadDoctorProfile();
  loadOverviewData();
  setupNavigation();
  setupEventListeners();
});

/* ═══════════════════════════════════════════
   AUTH
═══════════════════════════════════════════ */
function checkAuth() {
  const token = localStorage.getItem('token');
  const user  = JSON.parse(localStorage.getItem('user') || '{}');
  if (!token || user.role !== 'doctor') {
    window.location.href = 'index.html';
  }
}


/* ════════════════════════════════════════════
   THEME — managed by main.js (single source of truth)
   This function only reads localStorage to set data-theme
   before paint. The click listener is wired by main.js.
═════════════════════════════════════════════ */
function applyTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}

/* ═══════════════════════════════════════════
   PROFILE
═══════════════════════════════════════════ */
async function loadDoctorProfile() {
  const token = localStorage.getItem('token');
  try {
    const res    = await fetch(`${API_URL}/doctor/profile`, { headers: { 'Authorization': `Bearer ${token}` } });
    const doctor = await res.json();

    document.getElementById('userName').textContent = doctor.name   || 'Doctor';
    document.getElementById('userSpec').textContent = doctor.specialization || 'Specialist';

    let photo = 'https://via.placeholder.com/60';
    if (doctor.profilePhoto) {
      let p = doctor.profilePhoto.replace(/\\/g, '/').replace(/backend\/uploads\//g, '');
      photo = `/backend/uploads/${p}`;
    }
    const img = document.getElementById('profilePhoto');
    img.src = photo;
    img.onerror = () => { img.src = 'https://via.placeholder.com/60'; };

    // Personalise greeting
    const h1 = document.querySelector('#overviewSection .page-header h1');
    if (h1) h1.textContent = `Good day, Dr. ${(doctor.name || '').split(' ')[0]}`;
  } catch (e) { console.error('Profile error:', e); }
}

/* ═══════════════════════════════════════════
   OVERVIEW
═══════════════════════════════════════════ */
async function loadOverviewData() {
  const token = localStorage.getItem('token');
  try {
    const [pRes, aRes] = await Promise.all([
      fetch(`${API_URL}/doctor/patients`,     { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(`${API_URL}/doctor/appointments`, { headers: { 'Authorization': `Bearer ${token}` } }),
    ]);
    const patients     = await pRes.json();
    const appointments = await aRes.json();

    document.getElementById('totalPatients').textContent       = patients.length;
    document.getElementById('pendingAppointments').textContent = appointments.filter(a => a.status === 'pending').length;
    document.getElementById('unreadMessages').textContent      = '0';

    let highRisk = 0;
    for (const p of patients) {
      try {
        const wRes    = await fetch(`${API_URL}/doctor/patient/${p._id}/history`, { headers: { 'Authorization': `Bearer ${token}` } });
        const wellness = await wRes.json();
        if (wellness.length > 0) {
          const recent = wellness.slice(0, 3);
          const avg    = recent.reduce((s, w) => s + w.stressLevel, 0) / recent.length;
          if (avg > 7) highRisk++;
        }
      } catch (_) {}
    }
    document.getElementById('highRiskPatients').textContent = highRisk;
  } catch (e) { console.error('Overview error:', e); }
}

/* ═══════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════ */
function setupNavigation() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      if (link.id === 'logoutBtn') { logout(); return; }
      const section = link.dataset.section;
      if (!section) return;
      showSection(section);
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      // Close mobile sidebar
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebarOverlay').classList.remove('show');
    });
  });
}

function showSection(section) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`${section}Section`);
  if (target) target.classList.add('active');

  if (section === 'patients')        loadPatients();
  if (section === 'patient-history') loadPatientHistorySelect();
  if (section === 'sentiment')       loadSentimentTrends();
  if (section === 'appointments')    loadAppointments();
  if (section === 'resources')       loadMyResources();
  if (section === 'complaint')       loadComplaintPatients();
  if (section === 'telecounseling')  initializeTelecounseling();
}

/* ═══════════════════════════════════════════
   EVENT LISTENERS
═══════════════════════════════════════════ */
function setupEventListeners() {
  document.getElementById('resourceUploadForm')?.addEventListener('submit', uploadResource);
  document.getElementById('complaintForm')?.addEventListener('submit', submitComplaint);

  document.getElementById('complaintAgainst')?.addEventListener('change', e => {
    document.getElementById('patientSelectGroup').style.display =
      e.target.value === 'patient' ? 'block' : 'none';
  });

  // Appointment filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      this.closest('.filter-bar').querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      filterAppointments(this.dataset.filter);
    });
  });
}

/* ═══════════════════════════════════════════
   GLOBAL HELPERS (called from HTML onclick attrs)
═══════════════════════════════════════════ */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
}

function selectResourceType(type, el) {
  document.querySelectorAll('.resource-type-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('resourceType').value = type;
  const acceptMap = { audio: 'audio/*', video: 'video/*', article: '.pdf,application/pdf' };
  document.getElementById('resourceFile').accept = acceptMap[type] || '*';
  document.getElementById('resourceFile').value = '';
  document.getElementById('fileUploadArea').classList.remove('has-file');
  document.getElementById('fileUploadName').textContent = '';
}

function handleFileSelect(input) {
  const area   = document.getElementById('fileUploadArea');
  const nameEl = document.getElementById('fileUploadName');
  if (input.files && input.files[0]) {
    area.classList.add('has-file');
    nameEl.textContent = input.files[0].name;
  } else {
    area.classList.remove('has-file');
    nameEl.textContent = '';
  }
}

/* ═══════════════════════════════════════════
   MY PATIENTS
═══════════════════════════════════════════ */
async function loadPatients() {
  const token = localStorage.getItem('token');
  const container = document.getElementById('patientsList');
  container.innerHTML = emptyStateHTML('loading');

  try {
    const res      = await fetch(`${API_URL}/doctor/patients`, { headers: { 'Authorization': `Bearer ${token}` } });
    const patients = await res.json();

    if (!patients.length) {
      container.innerHTML = emptyStateHTML('no-patients');
      return;
    }

    container.className = 'patients-grid';
    container.innerHTML = patients.map(p => {
      const photo = getPhotoPath(p.profilePhoto, 80);
      return `
        <div class="patient-card" onclick="viewPatientDetails('${p._id}')">
          <img src="${photo}" alt="${p.name}" class="patient-card-photo"
               onerror="this.src='https://via.placeholder.com/80'">
          <h4>${p.name}</h4>
          <p>${p.email}</p>
          <p>${p.phone || '—'}</p>
          <button class="btn btn-primary btn-sm" style="margin-top:4px;">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            View Details
          </button>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error(e);
    container.innerHTML = errorStateHTML('Failed to load patients');
  }
}

/* ═══════════════════════════════════════════
   PATIENT DETAIL MODAL
═══════════════════════════════════════════ */
async function viewPatientDetails(patientId) {
  const token = localStorage.getItem('token');
  try {
    const [pRes, wRes] = await Promise.all([
      fetch(`${API_URL}/doctor/patients`,                        { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(`${API_URL}/doctor/patient/${patientId}/history`,   { headers: { 'Authorization': `Bearer ${token}` } }),
    ]);
    const patients = await pRes.json();
    const wellness = await wRes.json();
    const patient  = patients.find(p => p._id === patientId);
    if (!patient) return;

    const avgStress = wellness.length
      ? (wellness.reduce((s, w) => s + w.stressLevel, 0) / wellness.length).toFixed(1) : 'N/A';
    const avgSleep  = wellness.length
      ? (wellness.reduce((s, w) => s + w.sleepHours,  0) / wellness.length).toFixed(1) : 'N/A';

    const photo = getPhotoPath(patient.profilePhoto, 120);

    const overlay = document.createElement('div');
    overlay.className = 'patient-modal-overlay';
    overlay.innerHTML = `
      <div class="patient-modal">
        <div class="patient-modal-header">
          <h2>Patient Details</h2>
          <button class="modal-close-btn" onclick="this.closest('.patient-modal-overlay').remove()">
            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="patient-modal-body">
          <img src="${photo}" alt="${patient.name}" class="patient-modal-avatar"
               onerror="this.src='https://via.placeholder.com/100'">
          <h3 style="text-align:center; font-family:'DM Serif Display',serif; font-size:20px; color:var(--text-primary); margin-bottom:4px;">${patient.name}</h3>
          <p style="text-align:center; font-size:13px; color:var(--text-muted); margin-bottom:20px;">${patient.email}</p>
          <div class="patient-detail-grid">
            <div class="patient-detail-item">
              <p class="patient-detail-label">Phone</p>
              <p class="patient-detail-value">${patient.phone || '—'}</p>
            </div>
            <div class="patient-detail-item">
              <p class="patient-detail-label">Gender</p>
              <p class="patient-detail-value">${patient.gender || '—'}</p>
            </div>
            <div class="patient-detail-item">
              <p class="patient-detail-label">Date of Birth</p>
              <p class="patient-detail-value">${patient.dob ? new Date(patient.dob).toLocaleDateString() : '—'}</p>
            </div>
            <div class="patient-detail-item">
              <p class="patient-detail-label">Wellness Entries</p>
              <p class="patient-detail-value">${wellness.length} records</p>
            </div>
            <div class="patient-detail-item">
              <p class="patient-detail-label">Avg Stress Level</p>
              <p class="patient-detail-value" style="color:${parseFloat(avgStress)>7?'var(--danger)':parseFloat(avgStress)>5?'var(--warning)':'var(--success)'};">${avgStress}/10</p>
            </div>
            <div class="patient-detail-item">
              <p class="patient-detail-label">Avg Sleep</p>
              <p class="patient-detail-value">${avgSleep} hrs/night</p>
            </div>
          </div>
          ${patient.address ? `<div style="margin-top:16px; background:var(--bg-panel); border-radius:var(--radius-sm); padding:12px 14px;">
            <p style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--text-muted); margin-bottom:4px;">Address</p>
            <p style="font-size:14px; color:var(--text-primary);">${patient.address}</p>
          </div>` : ''}
          <div style="text-align:center; margin-top:22px;">
            <button class="btn btn-primary" onclick="this.closest('.patient-modal-overlay').remove()">Close</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  } catch (e) {
    console.error(e);
    showNotification('Error loading patient details', 'error');
  }
}

/* ═══════════════════════════════════════════
   PATIENT HISTORY
═══════════════════════════════════════════ */
async function loadPatientHistorySelect() {
  const token  = localStorage.getItem('token');
  const select = document.getElementById('patientSelect');
  if (!select) return;

  try {
    const res      = await fetch(`${API_URL}/doctor/patients`, { headers: { 'Authorization': `Bearer ${token}` } });
    const patients = await res.json();
    select.innerHTML = '<option value="">Choose a patient...</option>' +
      patients.map(p => `<option value="${p._id}">${p.name}</option>`).join('');

    // Rebind to avoid duplicate listeners
    const fresh = select.cloneNode(true);
    select.parentNode.replaceChild(fresh, select);
    fresh.addEventListener('change', function () {
      if (this.value) loadPatientHistory(this.value);
      else document.getElementById('patientHistoryContent').style.display = 'none';
    });
  } catch (e) {
    console.error(e);
    select.innerHTML = '<option value="">Error loading patients</option>';
  }
}

async function loadPatientHistory(patientId) {
  if (!patientId) {
    document.getElementById('patientHistoryContent').style.display = 'none';
    return;
  }
  const token = localStorage.getItem('token');

  try {
    const [pRes, hRes] = await Promise.all([
      fetch(`${API_URL}/doctor/patients`,                      { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(`${API_URL}/doctor/patient/${patientId}/history`, { headers: { 'Authorization': `Bearer ${token}` } }),
    ]);
    const patients = await pRes.json();
    const history  = await hRes.json();
    const patient  = patients.find(p => p._id === patientId);

    document.getElementById('patientHistoryContent').style.display = 'block';

    // Patient info card
    if (patient) {
      const photo = getPhotoPath(patient.profilePhoto, 80);
      document.getElementById('patientInfo').innerHTML = `
        <div style="display:flex; align-items:center; gap:18px; flex-wrap:wrap;">
          <img src="${photo}" alt="${patient.name}"
               style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid var(--border);"
               onerror="this.src='https://via.placeholder.com/72'">
          <div>
            <h3 style="font-size:17px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">${patient.name}</h3>
            <p style="font-size:13px;color:var(--text-muted);">${patient.email}</p>
            <p style="font-size:13px;color:var(--text-muted);margin-top:2px;">Phone: ${patient.phone || '—'}</p>
          </div>
        </div>
      `;
    }

    // Chart
    const ctx = document.getElementById('patientHistoryChart');
    if (window.patientChart?.destroy) window.patientChart.destroy();
    if (history.length) {
      window.patientChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: history.map(h => new Date(h.date).toLocaleDateString()),
          datasets: [{
            label: 'Stress Level',
            data: history.map(h => h.stressLevel),
            borderColor: '#e03d3d',
            backgroundColor: 'rgba(224,61,61,0.08)',
            tension: 0.4, fill: true,
            pointBackgroundColor: '#e03d3d',
            pointRadius: 4, pointHoverRadius: 6,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, max: 10, grid: { color: 'rgba(0,0,0,0.05)' } },
            x: { grid: { display: false } },
          },
        },
      });
    }

    // Wellness entries
    const entries = document.getElementById('patientWellnessEntries');
    if (!history.length) {
      entries.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div><p>No wellness data yet</p></div>`;
      return;
    }
    entries.innerHTML = history.map(entry => {
      const stressColor = entry.stressLevel > 7 ? 'var(--danger)' : entry.stressLevel > 5 ? 'var(--warning)' : 'var(--success)';
      return `
        <div class="wellness-entry">
          <div class="wellness-entry-header">
            <span class="wellness-date">${new Date(entry.date).toLocaleDateString('en-US',{weekday:'short',year:'numeric',month:'short',day:'numeric'})}</span>
            <span class="mood-chip" style="background:var(--primary-alpha);color:var(--primary);">${entry.mood || '—'}</span>
          </div>
          <div class="wellness-stats-row">
            <span class="wellness-stat">
              <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10c0-.5-.1-1.1-.2-1.6L12 12V2z"/></svg>
              Sleep: <strong>${entry.sleepHours}h</strong>
            </span>
            <span class="wellness-stat" style="color:${stressColor}">
              <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              Stress: <strong style="color:${stressColor}">${entry.stressLevel}/10</strong>
            </span>
            <span class="wellness-stat">
              <svg viewBox="0 0 24 24">${entry.todoCompleted ? '<polyline points="20 6 9 17 4 12"/>' : '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'}</svg>
              Tasks: <strong>${entry.todoCompleted ? 'Done' : 'Pending'}</strong>
            </span>
          </div>
          ${entry.notes ? `<p class="wellness-notes">${entry.notes}</p>` : ''}
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error(e);
    showNotification('Error loading patient history', 'error');
  }
}

/* ═══════════════════════════════════════════
   SENTIMENT TRENDS
═══════════════════════════════════════════ */
async function loadSentimentTrends() {
  const token = localStorage.getItem('token');
  const container = document.getElementById('sentimentTrends');

  container.innerHTML = `<div class="empty-state"><p>Loading sentiment data...</p></div>`;

  try {
    const res    = await fetch(`${API_URL}/doctor/patients/sentiment`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error('Failed');
    const trends = await res.json();

    if (!trends.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div><p>No data available</p></div>`;
      return;
    }

    container.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="sentiment-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Avg Stress</th>
              <th>Risk Level</th>
            </tr>
          </thead>
          <tbody>
            ${trends.map(t => {
              const isHigh = t.avgStress > 7;
              const isMed  = t.avgStress > 5;
              const riskClass = isHigh ? 'risk-high' : isMed ? 'risk-medium' : 'risk-low';
              const riskLabel = isHigh ? 'High Risk' : isMed ? 'Moderate' : 'Low Risk';
              const riskIcon  = isHigh
                ? '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
                : isMed
                  ? '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
                  : '<polyline points="20 6 9 17 4 12"/>';
              return `
                <tr>
                  <td style="font-weight:500;">${t.patientName}</td>
                  <td style="font-weight:700;">${t.avgStress.toFixed(1)} / 10</td>
                  <td>
                    <span class="risk-pill ${riskClass}">
                      <svg viewBox="0 0 24 24">${riskIcon}</svg>
                      ${riskLabel}
                    </span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    console.error(e);
    container.innerHTML = errorStateHTML('Error loading sentiment data');
  }
}

/* ═══════════════════════════════════════════
   TELECOUNSELING — patient list + chat wiring
═══════════════════════════════════════════ */
async function initializeTelecounseling() {
  const token     = localStorage.getItem('token');
  const container = document.getElementById('chatPatientsList');
  if (!container) return;

  container.innerHTML = `<div class="empty-state" style="padding:24px;"><p>Loading patients...</p></div>`;

  try {
    const res      = await fetch(`${API_URL}/doctor/patients`, { headers: { 'Authorization': `Bearer ${token}` } });
    const patients = await res.json();

    if (!patients.length) {
      container.innerHTML = `<div class="empty-state" style="padding:24px;"><div class="empty-state-icon"><svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div><p>No patients assigned yet</p></div>`;
      return;
    }

    container.innerHTML = patients.map(p => {
      const photo = getPhotoPath(p.profilePhoto, 50);
      return `
        <div class="chat-patient-item"
             data-patient-id="${p._id}"
             data-patient-name="${p.name.replace(/"/g,'&quot;')}"
             data-patient-photo="${photo}">
          <img src="${photo}" class="chat-patient-avatar"
               onerror="this.src='https://via.placeholder.com/40'" alt="${p.name}">
          <div class="chat-patient-info">
            <h4>${p.name}</h4>
            <p>Tap to start chat</p>
          </div>
        </div>
      `;
    }).join('');

    // Click handlers
    container.querySelectorAll('.chat-patient-item').forEach(item => {
      item.addEventListener('click', function () {
        container.querySelectorAll('.chat-patient-item').forEach(i => i.classList.remove('active'));
        this.classList.add('active');
        selectPatientChat(
          this.dataset.patientId,
          this.dataset.patientName,
          this.dataset.patientPhoto,
        );
      });
    });
  } catch (e) {
    console.error(e);
    container.innerHTML = errorStateHTML('Error loading patients');
  }
}

function selectPatientChat(patientId, patientName, patientPhoto) {
  // Wire up telecounseling.js's global
  if (typeof window !== 'undefined') window.currentChatUser = patientId;

  // Hide empty state, show chat UI
  const emptyState = document.getElementById('chatEmptyState');
  const header     = document.getElementById('chatHeaderDoctor');
  const messages   = document.getElementById('chatMessagesDoctor');
  const inputBar   = document.getElementById('chatInputDoctor');

  if (emptyState) emptyState.style.display = 'none';
  if (header)   { header.style.display   = 'flex'; }
  if (messages) { messages.style.display = 'flex'; }
  if (inputBar) { inputBar.style.display = 'flex'; }

  // Update header
  const nameEl  = document.getElementById('patientNameChat');
  const photoEl = document.getElementById('patientPhotoChat');
  if (nameEl)  nameEl.textContent = patientName;
  if (photoEl) {
    photoEl.src = patientPhoto;
    photoEl.onerror = () => { photoEl.src = 'https://via.placeholder.com/40'; };
  }

  // Clear messages
  if (messages) messages.innerHTML = `<p style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px;">Loading messages...</p>`;

  // Load history via telecounseling.js
  if (typeof loadChatHistory === 'function') loadChatHistory(patientId);
}

/* ═══════════════════════════════════════════
   APPOINTMENTS
═══════════════════════════════════════════ */
async function loadAppointments() {
  const token = localStorage.getItem('token');
  try {
    const res  = await fetch(`${API_URL}/doctor/appointments`, { headers: { 'Authorization': `Bearer ${token}` } });
    const apts = await res.json();
    displayAppointments(apts);
  } catch (e) { console.error(e); }
}

function displayAppointments(appointments) {
  const container = document.getElementById('appointmentsList');

  if (!appointments.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
        <p>No appointments in this category</p>
      </div>`;
    return;
  }

  container.innerHTML = appointments.map(apt => {
    const d     = new Date(apt.date);
    const month = d.toLocaleString('default', { month: 'short' }).toUpperCase();
    const day   = d.getDate();

    const statusClass = apt.status === 'approved' ? 'approved' : apt.status === 'rejected' ? 'rejected' : 'pending';

    const actionBtns = apt.status === 'pending' ? `
      <div class="appt-actions">
        <button class="btn btn-success btn-sm" onclick="updateAppointment('${apt._id}','approved')">
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Approve
        </button>
        <button class="btn btn-danger btn-sm" onclick="updateAppointment('${apt._id}','rejected')">
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Reject
        </button>
      </div>` : '';

    return `
      <div class="appointment-card">
        <div class="appt-date-block">
          <p class="appt-date-month">${month}</p>
          <p class="appt-date-day">${day}</p>
        </div>
        <div class="appt-info">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px;">
            <h4>${apt.patientId?.name || 'Unknown Patient'}</h4>
            <span class="status-pill ${statusClass}">${apt.status}</span>
          </div>
          <div class="appt-meta">
            <span class="appt-meta-item">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${apt.time || '—'}
            </span>
            <span class="appt-meta-item">
              <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12"/></svg>
              ${apt.patientId?.phone || '—'}
            </span>
          </div>
          <p style="font-size:13.5px;color:var(--text-secondary);line-height:1.5;">
            <strong style="color:var(--text-primary);">Reason:</strong> ${apt.reason}
          </p>
          ${actionBtns}
        </div>
      </div>
    `;
  }).join('');
}

function filterAppointments(filter) {
  const token = localStorage.getItem('token');
  fetch(`${API_URL}/doctor/appointments`, { headers: { 'Authorization': `Bearer ${token}` } })
    .then(r => r.json())
    .then(apts => {
      displayAppointments(filter === 'all' ? apts : apts.filter(a => a.status === filter));
    })
    .catch(console.error);
}

async function updateAppointment(id, status) {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/doctor/appointment/${id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      showNotification(`Appointment ${status}!`, 'success');
      loadAppointments();
      loadOverviewData();
    }
  } catch (e) { showNotification('Error updating appointment', 'error'); }
}

/* ═══════════════════════════════════════════
   UPLOAD RESOURCES
═══════════════════════════════════════════ */
async function uploadResource(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('uploadSubmitBtn');
  if (submitBtn.disabled) return;

  const file = document.getElementById('resourceFile').files[0];
  const type = document.getElementById('resourceType').value;
  const title = document.getElementById('resourceTitle').value;
  const desc  = document.getElementById('resourceDescription').value;

  if (!file) { showNotification('Please select a file', 'error'); return; }
  if (!type) { showNotification('Please select a resource type', 'error'); return; }
  if (file.size > 50 * 1024 * 1024) { showNotification('File size exceeds 50 MB limit', 'error'); return; }

  const validTypes = {
    audio:   ['audio/mpeg','audio/wav','audio/ogg','audio/mp3','audio/x-m4a'],
    video:   ['video/mp4','video/webm','video/ogg','video/quicktime'],
    article: ['application/pdf'],
  };
  if (!validTypes[type]?.includes(file.type)) {
    showNotification(`Invalid file type for ${type}`, 'error');
    return;
  }

  const formData = new FormData();
  formData.append('file',        file);
  formData.append('title',       title);
  formData.append('description', desc);
  formData.append('type',        type);
  formData.append('uploadType',  type);

  const token = localStorage.getItem('token');
  const originalHTML = submitBtn.innerHTML;

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<svg viewBox="0 0 24 24" style="animation:spin 1s linear infinite;"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.69"/></svg> Uploading...`;
  submitBtn.style.opacity = '0.7';

  try {
    const res = await fetch(`${API_URL}/resource/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    const result = await res.json();
    if (res.ok) {
      showNotification('Resource uploaded! Pending admin approval.', 'success');
      e.target.reset();
      document.getElementById('fileUploadArea').classList.remove('has-file');
      document.getElementById('fileUploadName').textContent = '';
      // Reset type tabs
      document.querySelectorAll('.resource-type-tab').forEach((t,i) => { t.classList.toggle('active', i===0); });
      document.getElementById('resourceType').value = 'audio';
      loadMyResources();
      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
        submitBtn.style.opacity = '1';
      }, 2000);
    } else { throw new Error(result.error || 'Upload failed'); }
  } catch (err) {
    showNotification('Upload failed: ' + err.message, 'error');
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalHTML;
    submitBtn.style.opacity = '1';
  }
}

// Spinner keyframes injected once
if (!document.getElementById('spinStyle')) {
  const s = document.createElement('style');
  s.id = 'spinStyle';
  s.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(s);
}

/* ═══════════════════════════════════════════
   MY UPLOADED RESOURCES
═══════════════════════════════════════════ */
async function loadMyResources() {
  const token     = localStorage.getItem('token');
  const container = document.getElementById('myResourcesList');
  if (!container) return;

  container.innerHTML = `<p style="color:var(--text-muted);font-size:13.5px;padding:10px 0;">Loading resources...</p>`;

  try {
    const [pendRes, appRes] = await Promise.all([
      fetch(`${API_URL}/admin/resources/pending`, { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(`${API_URL}/resources`,               { headers: { 'Authorization': `Bearer ${token}` } }),
    ]);
    const pending  = await pendRes.json();
    const approved = await appRes.json();
    const user     = JSON.parse(localStorage.getItem('user'));

    const mine = [
      ...pending.filter(r => r.uploadedBy === user.id).map(r => ({ ...r, _approved: false })),
      ...approved.filter(r => r.uploadedBy === user.id).map(r => ({ ...r, _approved: true })),
    ];

    if (!mine.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/></svg></div>
          <p>No resources uploaded yet. Upload your first resource above.</p>
        </div>`;
      return;
    }

    // Icon & color per type
    const meta = {
      audio:   { bg: 'linear-gradient(135deg,#7c3aed,#a855f7)', icon: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>' },
      video:   { bg: 'linear-gradient(135deg,#0891b2,#06b6d4)', icon: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>' },
      article: { bg: 'linear-gradient(135deg,#d97706,#f59e0b)', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>' },
    };

    container.innerHTML = mine.map(r => {
      const m   = meta[r.type] || meta.article;
      const cls = r._approved ? 'approved' : 'pending';
      const pill = r._approved
        ? `<span class="status-pill approved">Approved</span>`
        : `<span class="status-pill pending">Pending Review</span>`;

      return `
        <div class="my-resource-card ${cls}">
          <div class="resource-icon" style="background:${m.bg};">
            <svg viewBox="0 0 24 24">${m.icon}</svg>
          </div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:6px;">
              <h4 style="font-size:14px;font-weight:600;color:var(--text-primary);line-height:1.3;">${r.title}</h4>
              ${pill}
            </div>
            <p style="font-size:13px;color:var(--text-secondary);line-height:1.5;margin-bottom:8px;">${r.description}</p>
            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
              <span style="background:var(--bg-panel);color:var(--text-muted);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:3px 10px;border-radius:100px;">${r.type}</span>
              <span style="font-size:12px;color:var(--text-muted);">Uploaded ${new Date(r.createdAt).toLocaleDateString()}</span>
              ${r._approved ? '<span style="font-size:12px;color:var(--success);font-weight:600;">Visible to patients</span>' : '<span style="font-size:12px;color:var(--warning);font-weight:600;">Awaiting admin approval</span>'}
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error(e);
    container.innerHTML = errorStateHTML('Error loading resources');
  }
}

/* ═══════════════════════════════════════════
   COMPLAINTS
═══════════════════════════════════════════ */
async function loadComplaintPatients() {
  const token = localStorage.getItem('token');
  try {
    const res      = await fetch(`${API_URL}/doctor/patients`, { headers: { 'Authorization': `Bearer ${token}` } });
    const patients = await res.json();
    const select   = document.getElementById('complaintPatientId');
    if (select) {
      select.innerHTML = '<option value="">Choose patient...</option>' +
        patients.map(p => `<option value="${p._id}">${p.name}</option>`).join('');
    }
    await loadDoctorComplaints();
  } catch (e) { console.error(e); }
}

async function loadDoctorComplaints() {
  const token     = localStorage.getItem('token');
  const container = document.getElementById('complaintsList');
  if (!container) return;

  try {
    const res  = await fetch(`${API_URL}/admin/complaints`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error('Failed');
    const all  = await res.json();
    const user = JSON.parse(localStorage.getItem('user'));
    const mine = all.filter(c => c.complainerId === user.id);

    if (!mine.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
          <p>No complaints filed yet</p>
        </div>`;
      return;
    }

    container.innerHTML = mine.map(c => {
      const isPending   = c.status === 'pending';
      const cardClass   = isPending ? 'pending' : 'resolved';
      const pillClass   = isPending ? 'pending' : 'approved';
      const pillLabel   = isPending ? 'Under Review' : 'Resolved';
      return `
        <div class="complaint-card ${cardClass}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:10px;">
            <h4 style="font-size:14.5px;font-weight:600;color:var(--text-primary);">${c.subject}</h4>
            <span class="status-pill ${pillClass}" style="flex-shrink:0;">${pillLabel}</span>
          </div>
          <div style="background:var(--bg-panel);border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:10px;">
            <p style="font-size:13.5px;color:var(--text-secondary);line-height:1.65;margin:0;">${c.description}</p>
          </div>
          <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12.5px;color:var(--text-muted);">
            <span><strong style="color:var(--text-primary);">Against:</strong> ${c.againstRole || 'System'}</span>
            <span><strong style="color:var(--text-primary);">Filed:</strong> ${new Date(c.createdAt).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'})}</span>
            ${!isPending ? '<span style="color:var(--success);font-weight:600;">Resolved by admin</span>' : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error(e);
    container.innerHTML = errorStateHTML('Error loading complaints');
  }
}

async function submitComplaint(e) {
  e.preventDefault();
  const token      = localStorage.getItem('token');
  const againstType = document.getElementById('complaintAgainst').value;

  const data = {
    againstId:   againstType === 'patient' ? document.getElementById('complaintPatientId')?.value : null,
    againstRole: againstType === 'patient' ? 'patient' : againstType,
    subject:     document.getElementById('complaintSubject').value,
    description: document.getElementById('complaintDescription').value,
  };

  try {
    const res = await fetch(`${API_URL}/complaint`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      showNotification('Complaint submitted successfully!', 'success');
      document.getElementById('complaintForm').reset();
      document.getElementById('patientSelectGroup').style.display = 'none';
      await loadDoctorComplaints();
    } else {
      const err = await res.json();
      showNotification(err.message || 'Failed to submit complaint', 'error');
    }
  } catch (e) {
    console.error(e);
    showNotification('Error submitting complaint', 'error');
  }
}

/* ═══════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════ */
function getPhotoPath(profilePhoto, size) {
  if (!profilePhoto) return `https://via.placeholder.com/${size}`;
  let p = profilePhoto.replace(/\\/g, '/').replace(/backend\/uploads\//g, '');
  return `/backend/uploads/${p}`;
}

function emptyStateHTML(type) {
  const icons = {
    loading:     '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.69"/>',
    'no-patients':'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
  };
  const labels = { loading: 'Loading...', 'no-patients': 'No patients assigned yet' };
  return `
    <div class="empty-state">
      <div class="empty-state-icon"><svg viewBox="0 0 24 24">${icons[type] || icons.loading}</svg></div>
      <p>${labels[type] || 'No data available'}</p>
    </div>`;
}

function errorStateHTML(msg) {
  return `<div class="empty-state"><div class="empty-state-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><p style="color:var(--danger);">${msg}</p></div>`;
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'index.html';
}

function showNotification(message, type) {
  const n = document.getElementById('notification');
  if (!n) return;
  n.textContent = message;
  n.className   = `notification ${type} show`;
  setTimeout(() => n.classList.remove('show'), 3200);
}

/* ═══════════════════════════════════════════
   GLOBAL EXPORTS
═══════════════════════════════════════════ */
if (typeof window !== 'undefined') {
  window.showSection          = showSection;
  window.viewPatientDetails   = viewPatientDetails;
  window.selectPatientChat    = selectPatientChat;
  window.initializeTelecounseling = initializeTelecounseling;
  window.updateAppointment    = updateAppointment;
  window.loadMyResources      = loadMyResources;
  window.loadDoctorComplaints = loadDoctorComplaints;
  window.loadComplaintPatients= loadComplaintPatients;
  window.submitComplaint      = submitComplaint;
  window.loadPatientHistory   = loadPatientHistory;
}