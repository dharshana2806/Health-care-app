// ─────────────────────────────────────────────────────────────
//  Admin Dashboard — professional, no emoji, theme-aware charts
// ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  loadAdminProfile();
  loadOverviewData();
  setupNavigation();
  setupFilterListeners();
});

/* ═══════════════════════════════════════════
   AUTH
═══════════════════════════════════════════ */
function checkAuth() {
  const token = localStorage.getItem('token');
  const user  = JSON.parse(localStorage.getItem('user') || '{}');
  if (!token || user.role !== 'admin') {
    window.location.href = 'index.html';
  }
}

/* ═══════════════════════════════════════════
   PROFILE
═══════════════════════════════════════════ */
async function loadAdminProfile() {
  const token = localStorage.getItem('token');
  const user  = JSON.parse(localStorage.getItem('user') || '{}');
  document.getElementById('userName').textContent = user.name || 'Admin';

  try {
    const res   = await fetch(`${API_URL}/admin/profile`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) return;
    const admin = await res.json();
    if (admin.profilePhoto) {
      let p = admin.profilePhoto.replace(/\\/g, '/').replace(/^backend\//, '').replace(/^uploads\//, '');
      const img  = document.getElementById('profilePhoto');
      img.src    = `/backend/uploads/${p}`;
      img.onerror = () => { img.src = 'https://via.placeholder.com/60'; };
    }
  } catch (_) {}
}

/* ═══════════════════════════════════════════
   OVERVIEW
═══════════════════════════════════════════ */
async function loadOverviewData() {
  const token = localStorage.getItem('token');
  try {
    const [drRes, rrRes, crRes, prRes, adRes] = await Promise.all([
      fetch(`${API_URL}/admin/doctors/pending`,        { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(`${API_URL}/admin/resources/pending`,      { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(`${API_URL}/admin/complaints`,             { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(`${API_URL}/admin/patients/count`,         { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(`${API_URL}/admin/doctors/approved/count`, { headers: { 'Authorization': `Bearer ${token}` } }),
    ]);

    const doctors    = await drRes.json();
    const resources  = await rrRes.json();
    const complaints = await crRes.json();

    let patientCount = 0, doctorCount = 0;
    if (prRes.ok) { const d = await prRes.json(); patientCount = d.count || 0; }
    if (adRes.ok) { const d = await adRes.json(); doctorCount  = d.count || 0; }

    document.getElementById('totalPatients').textContent   = patientCount;
    document.getElementById('totalDoctors').textContent    = doctorCount;
    document.getElementById('pendingRequests').textContent = doctors.length + resources.length;
    document.getElementById('openComplaints').textContent  = complaints.filter(c => c.status === 'pending').length;

    // Nav badges
    updateNavBadge('doctorBadge',   doctors.length);
    updateNavBadge('resourceBadge', resources.length);

    // Recent activity
    renderRecentActivity(doctors, complaints);
  } catch (e) { console.error('Overview error:', e); }
}

function updateNavBadge(id, count) {
  const el = document.getElementById(id);
  if (!el) return;
  if (count > 0) { el.textContent = count; el.style.display = 'inline-flex'; }
  else { el.style.display = 'none'; }
}

function renderRecentActivity(doctors, complaints) {
  const container = document.getElementById('recentActivity');
  const items = [];

  doctors.slice(0, 3).forEach(d => {
    items.push({ icon: 'blue', svg: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>', text: `New doctor application from <strong>${d.name}</strong> — ${d.specialization}`, time: 'Pending' });
  });
  complaints.filter(c => c.status === 'pending').slice(0, 3).forEach(c => {
    items.push({ icon: 'amber', svg: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>', text: `Open complaint: <strong>${c.subject}</strong>`, time: new Date(c.createdAt).toLocaleDateString() });
  });

  if (!items.length) {
    container.innerHTML = `<div class="empty-state" style="padding:20px 0;"><div class="empty-state-icon"><svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div><p>No recent activity</p></div>`;
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="activity-item">
      <div class="activity-icon ${item.icon}">
        <svg viewBox="0 0 24 24">${item.svg}</svg>
      </div>
      <div class="activity-text">${item.text}</div>
      <div class="activity-time">${item.time}</div>
    </div>
  `).join('');
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
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebarOverlay').classList.remove('show');
    });
  });
}

function showSection(section) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`${section}Section`);
  if (target) target.classList.add('active');

  if (section === 'doctor-requests')   loadDoctorRequests();
  if (section === 'resource-approvals')loadResourceApprovals();
  if (section === 'complaints')        loadComplaints();
  if (section === 'users')             loadAllUsers();
  if (section === 'statistics')        loadStatistics();
}

/* ═══════════════════════════════════════════
   FILTER LISTENERS
═══════════════════════════════════════════ */
function setupFilterListeners() {
  // Resource filters
  document.getElementById('resourceFilterBar')?.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      document.getElementById('resourceFilterBar').querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      filterResources(this.dataset.filter);
    });
  });

  // Complaint filters
  document.getElementById('complaintFilterBar')?.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      document.getElementById('complaintFilterBar').querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      filterComplaints(this.dataset.filter);
    });
  });

  // User type filters
  document.getElementById('userFilterBar')?.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      document.getElementById('userFilterBar').querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      loadUsersByType(this.dataset.filter);
    });
  });
}

/* ═══════════════════════════════════════════
   DOCTOR REQUESTS
═══════════════════════════════════════════ */
async function loadDoctorRequests() {
  const token     = localStorage.getItem('token');
  const container = document.getElementById('doctorRequestsList');
  container.innerHTML = emptyHTML('loading', 'Loading requests...');

  try {
    const res     = await fetch(`${API_URL}/admin/doctors/pending`, { headers: { 'Authorization': `Bearer ${token}` } });
    const doctors = await res.json();

    if (!doctors.length) {
      container.innerHTML = emptyHTML('check', 'No pending doctor requests');
      return;
    }

    container.innerHTML = doctors.map(doc => {
      const photo = getPhoto(doc.profilePhoto, 60);
      const proof = doc.proof ? `/${doc.proof}` : '';
      return `
        <div class="request-card">
          <div class="request-header">
            <img src="${photo}" alt="${doc.name}" class="request-avatar" onerror="this.src='https://via.placeholder.com/56'">
            <div class="request-header-info">
              <h4>${doc.name}</h4>
              <p>${doc.specialization}</p>
            </div>
            <div style="margin-left:auto; flex-shrink:0;">
              <span class="status-pill pending">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Pending Review
              </span>
            </div>
          </div>
          <div class="request-details">
            <div class="request-detail-item">
              <p class="detail-label">Email</p>
              <p class="detail-value">${doc.email}</p>
            </div>
            <div class="request-detail-item">
              <p class="detail-label">Phone</p>
              <p class="detail-value">${doc.phone || '—'}</p>
            </div>
            <div class="request-detail-item">
              <p class="detail-label">Time Slot</p>
              <p class="detail-value">${doc.timeSlot || '—'}</p>
            </div>
            <div class="request-detail-item">
              <p class="detail-label">Credential Document</p>
              <p class="detail-value">
                ${proof ? `<a href="${proof}" target="_blank"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> View Document</a>` : 'Not uploaded'}
              </p>
            </div>
          </div>
          <div class="btn-group">
            <button class="btn btn-outline btn-sm" onclick="showDoctorDetails('${doc._id}')">
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Full Details
            </button>
            <button class="btn btn-success btn-sm" onclick="approveDoctor('${doc._id}')">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
              Approve
            </button>
            <button class="btn btn-danger btn-sm" onclick="rejectDoctor('${doc._id}')">
              <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Reject
            </button>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error(e);
    container.innerHTML = errorHTML('Error loading doctor requests');
  }
}

function showDoctorDetails(doctorId) {
  currentDoctorId = doctorId;
  const token = localStorage.getItem('token');

  fetch(`${API_URL}/admin/doctors/pending`, { headers: { 'Authorization': `Bearer ${token}` } })
    .then(r => r.json())
    .then(doctors => {
      const doc = doctors.find(d => d._id === doctorId);
      if (!doc) return;

      const proofPath  = doc.proof ? `/${doc.proof}` : '';
      const photoPath  = getPhoto(doc.profilePhoto, 120);

      document.getElementById('doctorDetailsContent').innerHTML = `
        <div style="text-align:center; margin-bottom:20px;">
          <img src="${photoPath}" alt="${doc.name}"
               style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid var(--border);"
               onerror="this.src='https://via.placeholder.com/100'">
          <h3 style="font-family:'DM Serif Display',serif;font-size:20px;color:var(--text-primary);margin:12px 0 4px;">${doc.name}</h3>
          <p style="font-size:13px;color:var(--text-muted);">${doc.specialization}</p>
        </div>
        <div class="detail-row"><div class="detail-row-label">Email</div><div class="detail-row-value">${doc.email}</div></div>
        <div class="detail-row"><div class="detail-row-label">Phone</div><div class="detail-row-value">${doc.phone || '—'}</div></div>
        <div class="detail-row"><div class="detail-row-label">Time Slot</div><div class="detail-row-value">${doc.timeSlot || '—'}</div></div>
        <div class="detail-row"><div class="detail-row-label">Date of Birth</div><div class="detail-row-value">${doc.dob ? new Date(doc.dob).toLocaleDateString() : '—'}</div></div>
        <div class="detail-row">
          <div class="detail-row-label">Credential Document</div>
          <div class="detail-row-value">
            ${proofPath ? `
              <a href="${proofPath}" target="_blank" class="btn btn-outline btn-sm" style="margin-bottom:12px;">
                <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Open Document
              </a>
              ${doc.proof?.endsWith('.pdf')
                ? `<iframe src="${proofPath}" style="width:100%;height:380px;border:1px solid var(--border);border-radius:var(--radius-sm);margin-top:8px;"></iframe>`
                : `<img src="${proofPath}" style="max-width:100%;border:1px solid var(--border);border-radius:var(--radius-sm);margin-top:8px;" alt="Credential">`
              }` : '<p style="color:var(--text-muted);">No document uploaded</p>'}
          </div>
        </div>
      `;
      document.getElementById('doctorDetailsModal').style.display = 'flex';
    });
}

async function approveDoctor(doctorId) {
  if (!confirm('Approve this doctor? They will gain access to the platform.')) return;
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/admin/doctor/${doctorId}/approve`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved: true }),
    });
    if (res.ok) { showNotification('Doctor approved successfully!', 'success'); loadDoctorRequests(); loadOverviewData(); }
  } catch (_) { showNotification('Error approving doctor', 'error'); }
}

async function rejectDoctor(doctorId) {
  if (!confirm('Reject this doctor? Their account and documents will be deleted.')) return;
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/admin/doctor/${doctorId}/approve`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved: false }),
    });
    if (res.ok) { showNotification('Doctor application rejected.', 'success'); loadDoctorRequests(); loadOverviewData(); }
  } catch (_) { showNotification('Error rejecting doctor', 'error'); }
}

function approveDoctorFromModal() { approveDoctor(currentDoctorId); closeModal('doctorDetailsModal'); }
function rejectDoctorFromModal()  { rejectDoctor(currentDoctorId);  closeModal('doctorDetailsModal'); }

/* ═══════════════════════════════════════════
   RESOURCE APPROVALS
═══════════════════════════════════════════ */
async function loadResourceApprovals() {
  const token     = localStorage.getItem('token');
  const container = document.getElementById('resourceApprovalsList');
  container.innerHTML = emptyHTML('loading', 'Loading resources...');
  try {
    const res       = await fetch(`${API_URL}/admin/resources/pending`, { headers: { 'Authorization': `Bearer ${token}` } });
    const resources = await res.json();
    displayResources(resources);
  } catch (e) { console.error(e); container.innerHTML = errorHTML('Error loading resources'); }
}

function displayResources(resources) {
  const container = document.getElementById('resourceApprovalsList');
  if (!resources.length) {
    container.innerHTML = emptyHTML('upload', 'No pending resources to review');
    return;
  }

  const iconMap = {
    audio:   { bg: 'linear-gradient(135deg,#7c3aed,#a855f7)', svg: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>' },
    video:   { bg: 'linear-gradient(135deg,#0891b2,#06b6d4)', svg: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>' },
    article: { bg: 'linear-gradient(135deg,#d97706,#f59e0b)', svg: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>' },
  };

  container.innerHTML = resources.map(r => {
    const cleanPath = (r.filePath || '').replace(/\\/g, '/').replace(/'/g, "\\'");
    const meta = iconMap[r.type] || iconMap.article;
    return `
      <div class="resource-card">
        <div class="resource-card-header">
          <div style="display:flex;align-items:center;gap:12px;flex:1;">
            <div style="width:44px;height:44px;border-radius:12px;background:${meta.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round">${meta.svg}</svg>
            </div>
            <div>
              <p class="resource-card-title">${r.title}</p>
              <span class="type-badge ${r.type}">${r.type}</span>
            </div>
          </div>
        </div>
        <p class="resource-card-desc">${r.description}</p>
        <div class="resource-card-meta">
          <span class="resource-meta-item">
            <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Uploaded by ${r.uploaderRole || 'Doctor'}
          </span>
          ${r.createdAt ? `<span class="resource-meta-item"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${new Date(r.createdAt).toLocaleDateString()}</span>` : ''}
        </div>
        <div class="btn-group">
          <button class="btn btn-outline btn-sm" onclick="previewResource('${r._id}','${cleanPath}','${r.type}')">
            <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Preview
          </button>
          <button class="btn btn-success btn-sm" onclick="approveResource('${r._id}')">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            Approve
          </button>
          <button class="btn btn-danger btn-sm" onclick="rejectResource('${r._id}')">
            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Reject
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function filterResources(filter) {
  const token = localStorage.getItem('token');
  fetch(`${API_URL}/admin/resources/pending`, { headers: { 'Authorization': `Bearer ${token}` } })
    .then(r => r.json())
    .then(resources => displayResources(filter === 'all' ? resources : resources.filter(r => r.type === filter)));
}

function previewResource(id, filePath, type) {
  currentResourceId = id;
  const content = document.getElementById('resourcePreviewContent');
  if (type === 'audio') {
    content.innerHTML = `
      <div style="background:var(--bg-panel);border-radius:var(--radius-sm);padding:24px;text-align:center;">
        <div style="width:64px;height:64px;background:linear-gradient(135deg,#7c3aed,#a855f7);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        </div>
        <audio controls style="width:100%;margin-top:8px;"><source src="${filePath}"></audio>
      </div>`;
  } else if (type === 'video') {
    content.innerHTML = `<video controls style="width:100%;border-radius:var(--radius-sm);background:#000;"><source src="${filePath}"></video>`;
  } else {
    content.innerHTML = `<iframe src="${filePath}" style="width:100%;height:480px;border:1px solid var(--border);border-radius:var(--radius-sm);"></iframe>`;
  }
  document.getElementById('resourcePreviewModal').style.display = 'flex';
}

async function approveResource(resourceId) {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/admin/resource/${resourceId}/approve`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved: true }),
    });
    if (res.ok) { showNotification('Resource approved and published!', 'success'); loadResourceApprovals(); loadOverviewData(); }
  } catch (_) { showNotification('Error approving resource', 'error'); }
}

async function rejectResource(resourceId) {
  if (!confirm('Reject and delete this resource?')) return;
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/admin/resource/${resourceId}/approve`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved: false }),
    });
    if (res.ok) { showNotification('Resource rejected and removed.', 'success'); loadResourceApprovals(); loadOverviewData(); }
  } catch (_) { showNotification('Error rejecting resource', 'error'); }
}

function approveResourceFromModal() { approveResource(currentResourceId); closeModal('resourcePreviewModal'); }
function rejectResourceFromModal()  { rejectResource(currentResourceId);  closeModal('resourcePreviewModal'); }

/* ═══════════════════════════════════════════
   COMPLAINTS
═══════════════════════════════════════════ */
async function loadComplaints() {
  const token     = localStorage.getItem('token');
  const container = document.getElementById('complaintsList');
  container.innerHTML = emptyHTML('loading', 'Loading complaints...');
  try {
    const res        = await fetch(`${API_URL}/admin/complaints`, { headers: { 'Authorization': `Bearer ${token}` } });
    const complaints = await res.json();
    displayComplaints(complaints);
  } catch (e) { console.error(e); container.innerHTML = errorHTML('Error loading complaints'); }
}

function displayComplaints(complaints) {
  const container = document.getElementById('complaintsList');
  if (!complaints.length) {
    container.innerHTML = emptyHTML('check', 'No complaints to display');
    return;
  }

  container.innerHTML = complaints.map(c => {
    const isPending = c.status === 'pending';
    return `
      <div class="complaint-card ${c.status}">
        <div class="complaint-card-header">
          <p class="complaint-card-title">${c.subject}</p>
          <span class="status-pill ${isPending ? 'pending' : 'resolved'}" style="flex-shrink:0;">
            <svg viewBox="0 0 24 24">${isPending ? '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' : '<polyline points="20 6 9 17 4 12"/>'}</svg>
            ${isPending ? 'Pending' : 'Resolved'}
          </span>
        </div>
        <p class="complaint-desc">${c.description.length > 160 ? c.description.substring(0, 160) + '...' : c.description}</p>
        <div class="complaint-meta">
          <span class="complaint-meta-item">
            <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            From: <strong style="color:var(--text-primary);">${c.complainerRole || '—'}</strong>
          </span>
          <span class="complaint-meta-item">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Against: <strong style="color:var(--text-primary);">${c.againstRole || '—'}</strong>
          </span>
          <span class="complaint-meta-item">
            <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            ${new Date(c.createdAt).toLocaleDateString()}
          </span>
        </div>
        <div class="btn-group">
          <button class="btn btn-outline btn-sm" onclick="showComplaintDetails('${c._id}')">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            View Details
          </button>
          ${isPending ? `
            <button class="btn btn-success btn-sm" onclick="markComplaintResolved('${c._id}')">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
              Mark Resolved
            </button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function filterComplaints(filter) {
  const token = localStorage.getItem('token');
  fetch(`${API_URL}/admin/complaints`, { headers: { 'Authorization': `Bearer ${token}` } })
    .then(r => r.json())
    .then(complaints => {
      let f = complaints;
      if (filter === 'patient')  f = complaints.filter(c => c.complainerRole === 'patient');
      if (filter === 'doctor')   f = complaints.filter(c => c.complainerRole === 'doctor');
      if (filter === 'pending')  f = complaints.filter(c => c.status === 'pending');
      if (filter === 'resolved') f = complaints.filter(c => c.status === 'resolved');
      displayComplaints(f);
    });
}

function showComplaintDetails(id) {
  currentComplaintId = id;
  const token = localStorage.getItem('token');
  fetch(`${API_URL}/admin/complaints`, { headers: { 'Authorization': `Bearer ${token}` } })
    .then(r => r.json())
    .then(complaints => {
      const c = complaints.find(x => x._id === id);
      if (!c) return;
      const isPending = c.status === 'pending';
      document.getElementById('complaintDetailsContent').innerHTML = `
        <div class="detail-row">
          <div class="detail-row-label">Subject</div>
          <div class="detail-row-value" style="font-weight:600;font-size:15px;">${c.subject}</div>
        </div>
        <div class="detail-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div><div class="detail-row-label">Filed By</div><div class="detail-row-value">${c.complainerRole || '—'}</div></div>
          <div><div class="detail-row-label">Against</div><div class="detail-row-value">${c.againstRole || '—'}</div></div>
        </div>
        <div class="detail-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div><div class="detail-row-label">Status</div>
            <div class="detail-row-value">
              <span class="status-pill ${isPending ? 'pending' : 'resolved'}">
                <svg viewBox="0 0 24 24">${isPending ? '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' : '<polyline points="20 6 9 17 4 12"/>'}</svg>
                ${isPending ? 'Pending Review' : 'Resolved'}
              </span>
            </div>
          </div>
          <div><div class="detail-row-label">Filed On</div><div class="detail-row-value">${new Date(c.createdAt).toLocaleString()}</div></div>
        </div>
        <div class="detail-row">
          <div class="detail-row-label">Full Description</div>
          <div class="detail-desc-box">${c.description}</div>
        </div>
      `;
      document.getElementById('complaintDetailsModal').style.display = 'flex';
    });
}

async function markComplaintResolved(complaintId = currentComplaintId) {
  if (!complaintId) return;
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/admin/complaint/${complaintId}/resolve`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' }),
    });
    if (res.ok) {
      showNotification('Complaint marked as resolved!', 'success');
      closeModal('complaintDetailsModal');
      loadComplaints(); loadOverviewData();
    }
  } catch (_) { showNotification('Error updating complaint', 'error'); }
}

/* ═══════════════════════════════════════════
   ALL USERS
═══════════════════════════════════════════ */
function loadAllUsers() { loadUsersByType('patients'); }

async function loadUsersByType(type) {
  const token     = localStorage.getItem('token');
  const container = document.getElementById('usersList');
  container.innerHTML = emptyHTML('loading', `Loading ${type}...`);

  try {
    const endpoint = type === 'patients' ? `${API_URL}/admin/users/patients` : `${API_URL}/admin/users/doctors`;
    const res      = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${token}` } });
    const users    = await res.json();

    if (!users.length) {
      container.innerHTML = emptyHTML('users', `No ${type} found`);
      return;
    }

    const isDoctor = type === 'doctors';
    container.innerHTML = `<div class="users-grid">${users.map(u => {
      const photo = getPhoto(u.profilePhoto, 80);
      const ringClass = isDoctor ? 'doctor-ring' : 'patient-ring';
      const roleColor = isDoctor ? 'var(--success-light)' : 'var(--primary-alpha)';
      const roleTxt   = isDoctor ? 'Doctor' : 'Patient';
      const roleClr   = isDoctor ? 'var(--success)' : 'var(--primary)';
      const extra     = isDoctor
        ? `<p style="color:var(--success);font-weight:600;font-size:13px;">${u.specialization}</p>
           <p style="font-size:12.5px;color:var(--text-muted);">${u.timeSlot || ''}</p>`
        : (u.selectedDoctor
            ? `<p style="font-size:12.5px;color:var(--text-muted);">Dr. ${u.selectedDoctor.name}</p>`
            : `<p style="font-size:12.5px;color:var(--text-muted);">No doctor assigned</p>`);
      return `
        <div class="user-card">
          <img src="${photo}" alt="${u.name}" class="user-card-avatar ${ringClass}"
               onerror="this.src='https://via.placeholder.com/72'">
          <h4>${u.name}</h4>
          <p>${u.email}</p>
          <p>${u.phone || ''}</p>
          ${extra}
          <span class="role-tag" style="background:${roleColor};color:${roleClr};">${roleTxt}</span>
          <p style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">Joined ${new Date(u.createdAt).toLocaleDateString()}</p>
        </div>
      `;
    }).join('')}</div>`;
  } catch (e) {
    console.error(e);
    container.innerHTML = errorHTML(`Error loading ${type}`);
  }
}

/* ═══════════════════════════════════════════
   STATISTICS & CHARTS
═══════════════════════════════════════════ */
function loadStatistics() {
  const token = localStorage.getItem('token');
  fetch(`${API_URL}/admin/statistics`, { headers: { 'Authorization': `Bearer ${token}` } })
    .then(r => r.json())
    .then(stats => {
      document.getElementById('totalSessions').textContent  = stats.totals.patients + stats.totals.doctors;
      document.getElementById('totalMessages').textContent  = '—';
      document.getElementById('totalCalls').textContent     = '—';
      document.getElementById('resourceViews').textContent  = stats.totals.resources;
      document.getElementById('monthlyPatients').textContent    = stats.monthly.patients;
      document.getElementById('monthlyDoctors').textContent     = stats.monthly.doctors;
      document.getElementById('monthlyAppointments').textContent= stats.monthly.appointments;
      document.getElementById('monthlyResources').textContent   = stats.monthly.resources;
      document.getElementById('monthlyComplaints').textContent  = stats.monthly.complaints;

      createRegistrationChart(stats.registrations);
      createAppointmentChart(stats.appointments);
      createResourceChart(stats.resources);
    })
    .catch(() => {
      createRegistrationChart({ patients: [], doctors: [] });
      createAppointmentChart({ pending: 0, approved: 0, rejected: 0, completed: 0 });
      createResourceChart({ audio: 0, video: 0, article: 0 });
    });
}

/* ── Chart theme helpers ── */
function chartColors() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    grid:     dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    text:     dark ? '#7aada7' : '#8aaba7',
    border:   dark ? '#1f3330' : '#d5e3e0',
  };
}

function baseChartOptions(extraOptions = {}) {
  const c = chartColors();
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: c.text, font: { family: 'DM Sans', size: 12 }, boxWidth: 12, padding: 16 } },
      ...extraOptions.plugins,
    },
    scales: extraOptions.scales !== false ? {
      x: { grid: { color: c.grid }, ticks: { color: c.text, font: { family: 'DM Sans', size: 12 } }, border: { color: c.border } },
      y: { beginAtZero: true, grid: { color: c.grid }, ticks: { color: c.text, font: { family: 'DM Sans', size: 12 }, stepSize: 1 }, border: { color: c.border } },
      ...extraOptions.scales,
    } : undefined,
    ...extraOptions,
  };
}

function createRegistrationChart(data) {
  const ctx = document.getElementById('registrationChart');
  if (window.registrationChart?.destroy) window.registrationChart.destroy();

  const months     = ['Jan','Feb','Mar','Apr','May','Jun'];
  const patientData= months.map((_,i) => (data.patients?.find(p => p._id === i+1)?.count || 0));
  const doctorData = months.map((_,i) => (data.doctors?.find(d => d._id === i+1)?.count  || 0));

  window.registrationChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Patients',
          data: patientData,
          borderColor: '#1a6b5a',
          backgroundColor: 'rgba(26,107,90,0.10)',
          tension: 0.4, fill: true,
          pointBackgroundColor: '#1a6b5a',
          pointRadius: 4, pointHoverRadius: 6, borderWidth: 2,
        },
        {
          label: 'Doctors',
          data: doctorData,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37,99,235,0.08)',
          tension: 0.4, fill: true,
          pointBackgroundColor: '#2563eb',
          pointRadius: 4, pointHoverRadius: 6, borderWidth: 2,
        },
      ],
    },
    options: baseChartOptions({ plugins: { legend: { position: 'top' } } }),
  });
}

function createAppointmentChart(data) {
  const ctx = document.getElementById('appointmentChart');
  if (window.appointmentChart?.destroy) window.appointmentChart.destroy();

  const c = chartColors();
  window.appointmentChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Pending','Approved','Rejected','Completed'],
      datasets: [{
        label: 'Appointments',
        data: [data.pending||0, data.approved||0, data.rejected||0, data.completed||0],
        backgroundColor: ['rgba(217,119,6,0.75)','rgba(22,163,74,0.75)','rgba(224,61,61,0.75)','rgba(26,107,90,0.75)'],
        borderColor:     ['#d97706','#16a34a','#e03d3d','#1a6b5a'],
        borderWidth: 2, borderRadius: 6,
      }],
    },
    options: baseChartOptions({
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: chartColors().grid }, ticks: { color: chartColors().text, font: { family: 'DM Sans', size: 12 } } },
        y: { beginAtZero: true, grid: { color: chartColors().grid }, ticks: { color: chartColors().text, font: { family: 'DM Sans', size: 12 }, stepSize: 1 } },
      },
    }),
  });
}

function createResourceChart(data) {
  const ctx = document.getElementById('resourceChart');
  if (window.resourceChart?.destroy) window.resourceChart.destroy();

  const c = chartColors();
  window.resourceChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Audio','Video','Articles'],
      datasets: [{
        data: [data.audio||0, data.video||0, data.article||0],
        backgroundColor: ['rgba(124,58,237,0.80)','rgba(37,99,235,0.80)','rgba(217,119,6,0.80)'],
        borderColor:     ['#7c3aed','#2563eb','#d97706'],
        borderWidth: 2, hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { color: c.text, font: { family: 'DM Sans', size: 12 }, boxWidth: 12, padding: 16 } },
      },
    },
  });
}

/* ═══════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════ */
function getPhoto(profilePhoto, size) {
  if (!profilePhoto) return `https://via.placeholder.com/${size}`;
  const p = profilePhoto.replace(/\\/g, '/').replace(/^backend\//, '').replace(/^uploads\//, '').replace(/backend\/uploads\//g, '');
  return `/backend/uploads/${p}`;
}

const emptyIcons = {
  loading: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.69"/>',
  check:   '<polyline points="20 6 9 17 4 12"/>',
  upload:  '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/>',
  users:   '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
};

function emptyHTML(icon, msg) {
  const svg = emptyIcons[icon] || emptyIcons.check;
  return `<div class="empty-state"><div class="empty-state-icon"><svg viewBox="0 0 24 24">${svg}</svg></div><p>${msg}</p></div>`;
}
function errorHTML(msg) {
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

function closeModal(id) { document.getElementById(id).style.display = 'none'; }

/* Global exports */
if (typeof window !== 'undefined') {
  window.showSection            = showSection;
  window.showDoctorDetails      = showDoctorDetails;
  window.approveDoctor          = approveDoctor;
  window.rejectDoctor           = rejectDoctor;
  window.approveDoctorFromModal = approveDoctorFromModal;
  window.rejectDoctorFromModal  = rejectDoctorFromModal;
  window.previewResource        = previewResource;
  window.approveResource        = approveResource;
  window.rejectResource         = rejectResource;
  window.approveResourceFromModal = approveResourceFromModal;
  window.rejectResourceFromModal  = rejectResourceFromModal;
  window.showComplaintDetails   = showComplaintDetails;
  window.markComplaintResolved  = markComplaintResolved;
  window.loadUsersByType        = loadUsersByType;
}