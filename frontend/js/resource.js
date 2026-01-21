// Resource Management JavaScript

// Load Resources
async function loadResources(filter = 'all') {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/resources`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const resources = await response.json();
    
    const container = document.getElementById('resourcesList');
    if (!container) return;
    
    const filtered = filter === 'all' ? resources : resources.filter(r => r.type === filter);
    
    if (filtered.length === 0) {
      container.innerHTML = '<p class="empty-state">No resources available</p>';
      return;
    }
    
    container.innerHTML = filtered.map(resource => `
      <div class="card resource-card" data-type="${resource.type}">
        <div class="resource-icon">${getResourceIcon(resource.type)}</div>
        <h4>${resource.title}</h4>
        <p class="resource-description">${resource.description}</p>
        <div class="resource-meta">
          <span class="resource-type-badge">${resource.type.toUpperCase()}</span>
          <span class="resource-date">${new Date(resource.createdAt).toLocaleDateString()}</span>
        </div>
        <button class="btn btn-primary btn-block" onclick="viewResource('${resource._id}', '${resource.filePath.replace(/\\/g, '/')}', '${resource.type}', '${escapeHtml(resource.title).replace(/'/g, "\\'")}')">
          ${resource.type === 'audio' ? '🎵 Listen' : resource.type === 'video' ? '🎬 Watch' : '📄 Read'}
        </button>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading resources:', error);
    const container = document.getElementById('resourcesList');
    if (container) {
      container.innerHTML = '<p class="empty-state">Error loading resources</p>';
    }
  }
}

// Get Resource Icon
function getResourceIcon(type) {
  const icons = {
    audio: '🎵',
    video: '🎬',
    article: '📄'
  };
  return icons[type] || '📁';
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Filter Resources
document.querySelectorAll('.resource-filters .filter-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    // Remove active from all
    document.querySelectorAll('.resource-filters .filter-btn').forEach(b => 
      b.classList.remove('active')
    );
    // Add active to clicked
    this.classList.add('active');
    
    // Load filtered resources
    loadResources(this.dataset.filter);
  });
});

// View Resource in Modal
function viewResource(resourceId, filePath, type, title) {
  // Fix file path - handle various formats
  let cleanPath = filePath.replace(/\\/g, '/'); // Replace backslashes with forward slashes
  
  // Remove any leading slashes or 'backend/' prefix
  cleanPath = cleanPath.replace(/^\//, '');
  cleanPath = cleanPath.replace(/^backend\//, '');
  
  // Build the correct path - keep the structure as stored
  // If path already has 'uploads/', use it directly
  // Otherwise, it's likely just the filename with timestamp
  let fullPath;
  if (cleanPath.includes('uploads/')) {
    fullPath = `/backend/${cleanPath}`;
  } else {
    // Path doesn't have uploads/ - means it's stored directly under a subfolder
    // Try to find the file in the correct folder based on type
    const typeFolder = type === 'audio' ? 'audio' : 
                       type === 'video' ? 'video' : 
                       type === 'article' ? 'pdfarticle' : 'profiles';
    fullPath = `/backend/uploads/${typeFolder}/${cleanPath}`;
  }
  
  console.log('Original path:', filePath);
  console.log('Loading resource from:', fullPath);
  
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'modal resource-modal';
  modal.id = 'resourceViewModal';
  modal.style.display = 'block';
  modal.style.position = 'fixed';
  modal.style.zIndex = '1000';
  modal.style.left = '0';
  modal.style.top = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.backgroundColor = 'rgba(0,0,0,0.7)';
  modal.style.overflow = 'auto';
  
  let content = '';
  
  if (type === 'audio') {
    content = `
      <div class="audio-player" style="text-align: center;">
        <h3 style="color: var(--text-primary); margin-bottom: 20px;">${title}</h3>
        <audio controls autoplay style="width: 100%; max-width: 500px;">
          <source src="${fullPath}" type="audio/mpeg">
          <source src="${fullPath}" type="audio/wav">
          <source src="${fullPath}" type="audio/ogg">
          <source src="${fullPath}" type="audio/mp3">
          Your browser does not support the audio element.
        </audio>
        <p style="color: var(--text-secondary); margin-top: 10px; font-size: 12px;">
          If audio doesn't play, the file may be in the wrong folder. Check: ${fullPath}
        </p>
      </div>
    `;
  } else if (type === 'video') {
    content = `
      <div class="video-player" style="text-align: center;">
        <h3 style="color: var(--text-primary); margin-bottom: 20px;">${title}</h3>
        <video controls autoplay style="width: 100%; max-width: 800px; max-height: 60vh;">
          <source src="${fullPath}" type="video/mp4">
          <source src="${fullPath}" type="video/webm">
          <source src="${fullPath}" type="video/ogg">
          Your browser does not support the video element.
        </video>
      </div>
    `;
  } else if (type === 'article') {
    content = `
      <div class="article-viewer" style="text-align: center;">
        <h3 style="color: var(--text-primary); margin-bottom: 20px;">${title}</h3>
        <iframe src="${fullPath}" style="width: 100%; height: 70vh; border: none; background: white;"></iframe>
        <div style="margin-top: 10px;">
          <a href="${fullPath}" target="_blank" class="btn btn-primary" style="display: inline-block; padding: 10px 20px; margin: 10px; text-decoration: none;">
            📄 Open in New Tab
          </a>
        </div>
      </div>
    `;
  }
  
  modal.innerHTML = `
    <div class="modal-content resource-modal-content" style="background: var(--bg-card); margin: 5% auto; padding: 30px; border-radius: 15px; max-width: 90%; box-shadow: var(--shadow);">
      <span class="close" onclick="closeResourceModal()" style="color: var(--text-primary); float: right; font-size: 28px; font-weight: bold; cursor: pointer;">&times;</span>
      ${content}
      <div style="margin-top: 20px; text-align: center;">
        <button class="btn btn-secondary" onclick="closeResourceModal()" style="padding: 10px 20px;">Close</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Track view
  trackResourceView(resourceId);
  
  // Close on outside click
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeResourceModal();
    }
  });
}

// Close Resource Modal
function closeResourceModal() {
  const modal = document.getElementById('resourceViewModal');
  if (modal) {
    // Stop any playing media
    const audio = modal.querySelector('audio');
    const video = modal.querySelector('video');
    if (audio) audio.pause();
    if (video) video.pause();
    
    modal.remove();
  }
}

// Track Resource View (for analytics)
async function trackResourceView(resourceId) {
  const token = localStorage.getItem('token');
  try {
    await fetch(`${API_URL}/resource/${resourceId}/view`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    // Silently fail - this is just for analytics
    console.log('Could not track view');
  }
}

// Upload Resource (for Doctor Dashboard)
async function uploadResourceForm() {
  const form = document.getElementById('resourceUploadForm');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fileInput = document.getElementById('resourceFile');
    const file = fileInput.files[0];
    
    if (!file) {
      showNotification('Please select a file', 'error');
      return;
    }
    
    // Check file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      showNotification('File size exceeds 50MB limit', 'error');
      return;
    }
    
    // Validate file type
    const type = document.getElementById('resourceType').value;
    const validTypes = {
      audio: ['audio/mpeg', 'audio/wav', 'audio/ogg'],
      video: ['video/mp4', 'video/webm', 'video/ogg'],
      article: ['application/pdf']
    };
    
    if (!validTypes[type].includes(file.type)) {
      showNotification(`Invalid file type for ${type}`, 'error');
      return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', document.getElementById('resourceTitle').value);
    formData.append('description', document.getElementById('resourceDescription').value);
    formData.append('type', type);
    formData.append('uploadType', type);
    
    const token = localStorage.getItem('token');
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    
    try {
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ Uploading...';
      
      const response = await fetch(`${API_URL}/resource/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      const result = await response.json();
      
      if (response.ok) {
        showNotification('Resource uploaded successfully! Pending admin approval.', 'success');
        form.reset();
        
        // Reload resources list if on resources section
        if (typeof loadMyResources === 'function') {
          loadMyResources();
        }
      } else {
        showNotification(result.error || 'Upload failed', 'error');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showNotification('Upload failed. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  });
}

// Load My Uploaded Resources (for Doctor)
async function loadMyResources() {
  const container = document.getElementById('myResourcesList');
  if (!container) return;
  
  container.innerHTML = '<p class="empty-state">Loading your resources...</p>';
  
  // This would fetch doctor's uploaded resources
  // For now, showing placeholder
  setTimeout(() => {
    container.innerHTML = '<p class="empty-state">No resources uploaded yet</p>';
  }, 500);
}

// Download Resource
function downloadResource(filePath, fileName) {
  const link = document.createElement('a');
  link.href = filePath;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Initialize resource functionality
document.addEventListener('DOMContentLoaded', () => {
  // Load resources if on patient dashboard
  if (document.getElementById('resourcesList')) {
    loadResources();
  }
  
  // Setup upload form if on doctor dashboard
  if (document.getElementById('resourceUploadForm')) {
    uploadResourceForm();
  }
  
  // Close modal with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeResourceModal();
    }
  });
});

// Export functions for global use
if (typeof window !== 'undefined') {
  window.loadResources = loadResources;
  window.viewResource = viewResource;
  window.closeResourceModal = closeResourceModal;
  window.downloadResource = downloadResource;
}