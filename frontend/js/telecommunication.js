// Telecommunication.js - IMPROVED VIDEO QUALITY & UI
let socket;
let localStream;
let remoteStream;
let peerConnection;
let mediaRecorder;
let audioChunks = [];
let currentChatUser = null;
let currentUserId = null;
let currentUserRole = null;
let ringtoneInterval;
let iceCandidatesQueue = [];
let isCallActive = false;
let currentCallType = null;
let incomingCallData = null;
let currentCallTo = null;
let otherUserInfo = null;

// IMPROVED: Better ICE configuration with multiple STUN servers
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceTransportPolicy: 'all'
};

// IMPROVED: Higher quality video constraints
const getMediaConstraints = (type) => {
  if (type === 'video') {
    return {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 1
      },
      video: {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 60 }, // Increased to 60 FPS
        facingMode: 'user',
        aspectRatio: { ideal: 16/9 }
      }
    };
  } else {
    return {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 1
      },
      video: false
    };
  }
};

// ============ SOCKET INITIALIZATION ============
function initializeSocket() {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user) return;
  
  currentUserId = user.id;
  currentUserRole = user.role;
  
  console.log('📌 Socket init:', currentUserId);
  
  if (!socket || !socket.connected) {
    socket = io('http://localhost:3000');
  }
  
  socket.off('connect');
  socket.off('receiveMessage');
  socket.off('messageSeenUpdate');
  socket.off('incomingCall');
  socket.off('callAnswered');
  socket.off('iceCandidate');
  socket.off('callEnded');
  socket.off('callCancelled');
  
  socket.on('connect', () => {
    console.log('✅ Connected:', socket.id);
    socket.emit('joinRoom', user.id);
  });
  
  socket.on('receiveMessage', (message) => {
    console.log('📩 Message received');
    if (currentChatUser && (message.senderId === currentChatUser || message.receiverId === currentChatUser)) {
      const isSent = message.senderId === currentUserId;
      if (document.getElementById('chatMessages')) {
        displayMessage(message, isSent);
      } else if (document.getElementById('chatMessagesDoctor')) {
        displayMessageDoctor(message, isSent);
      }
      if (!isSent && message._id) {
        setTimeout(() => markMessageAsSeen(message._id, message.senderId), 500);
      }
    }
    playNotificationSound();
  });
  
  socket.on('messageSeenUpdate', (data) => {
    console.log('👁️ Seen update:', data.messageId);
    updateMessageSeenStatus(data.messageId);
  });
  
  socket.on('incomingCall', async (data) => {
    console.log('📞 Incoming call');
    await handleIncomingCall(data);
  });
  
  socket.on('callAnswered', (data) => {
    console.log('📞 Answered');
    handleCallAnswered(data);
  });
  
  socket.on('iceCandidate', async (data) => {
    if (peerConnection && data.candidate) {
      try {
        if (peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } else {
          iceCandidatesQueue.push(data.candidate);
        }
      } catch (error) {
        console.error('❌ ICE error:', error);
      }
    }
  });
  
  socket.on('callEnded', () => {
    console.log('🔴 Call ended');
    if (isCallActive) {
      showNotification('Call ended', 'info');
      endCall(true);
    }
  });
  
  socket.on('callCancelled', () => {
    console.log('🚫 Call cancelled');
    stopRingtone();
    const modal = document.getElementById('incomingCallModal');
    if (modal) modal.remove();
    showNotification('Call cancelled', 'info');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initializeSocket();
});

// ============ TEXT MESSAGING ============
document.getElementById('sendMessageBtn')?.addEventListener('click', sendMessage);
document.getElementById('messageInput')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

document.getElementById('sendMessageBtnDoctor')?.addEventListener('click', sendMessageDoctor);
document.getElementById('messageInputDoctor')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessageDoctor();
});

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const message = input.value.trim();
  if (!message || !currentChatUser) return;

  const messageData = {
    senderId: currentUserId,
    receiverId: currentChatUser,
    messageType: 'text',
    content: message,
    timestamp: new Date(),
    seen: false
  };

  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/message`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(messageData)
    });
    
    if (response.ok) {
      const result = await response.json();
      messageData._id = result.message._id;
      displayMessage(messageData, true);
      input.value = '';
      socket.emit('sendMessage', messageData);
    }
  } catch (error) {
    console.error('❌ Send error:', error);
    showNotification('Failed to send', 'error');
  }
}

async function sendMessageDoctor() {
  const input = document.getElementById('messageInputDoctor');
  const message = input.value.trim();
  if (!message || !currentChatUser) return;

  const messageData = {
    senderId: currentUserId,
    receiverId: currentChatUser,
    messageType: 'text',
    content: message,
    timestamp: new Date(),
    seen: false
  };

  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/message`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(messageData)
    });
    
    if (response.ok) {
      const result = await response.json();
      messageData._id = result.message._id;
      displayMessageDoctor(messageData, true);
      input.value = '';
      socket.emit('sendMessage', messageData);
    }
  } catch (error) {
    console.error('❌ Send error:', error);
    showNotification('Failed to send', 'error');
  }
}

function displayMessage(message, isSent) {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  
  const emptyState = container.querySelector('.empty-state');
  if (emptyState) emptyState.remove();
  
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${isSent ? 'sent' : 'received'}`;
  msgDiv.dataset.messageId = message._id;
  
  const time = new Date(message.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  
  if (message.messageType === 'voice') {
    msgDiv.innerHTML = `
      <div class="message-bubble">
        <audio controls style="max-width: 280px; width: 100%;">
          <source src="${message.content}" type="audio/wav">
        </audio>
        <div class="message-meta" style="display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 5px; font-size: 11px;">
          <span class="timestamp" style="color: rgba(0,0,0,0.45);">${time}</span>
          ${isSent ? `<span class="status ${message.seen ? 'seen' : ''}" style="color: ${message.seen ? '#4fc3f7' : '#999'}; transition: all 0.3s ease; font-size: 16px;">✓✓</span>` : ''}
        </div>
      </div>
    `;
  } else {
    msgDiv.innerHTML = `
      <div class="message-bubble">
        <p style="margin: 0; word-wrap: break-word; line-height: 1.4;">${message.content}</p>
        <div class="message-meta" style="display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 5px; font-size: 11px;">
          <span class="timestamp" style="color: rgba(0,0,0,0.45);">${time}</span>
          ${isSent ? `<span class="status ${message.seen ? 'seen' : ''}" style="color: ${message.seen ? '#4fc3f7' : '#999'}; transition: all 0.3s ease; font-size: 16px;">✓✓</span>` : ''}
        </div>
      </div>
    `;
  }
  
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

function displayMessageDoctor(message, isSent) {
  const container = document.getElementById('chatMessagesDoctor');
  if (!container) return;
  
  const emptyState = container.querySelector('.empty-state');
  if (emptyState) emptyState.remove();
  
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${isSent ? 'sent' : 'received'}`;
  msgDiv.dataset.messageId = message._id;
  
  const time = new Date(message.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  
  if (message.messageType === 'voice') {
    msgDiv.innerHTML = `
      <div class="message-bubble">
        <audio controls style="max-width: 280px; width: 100%;">
          <source src="${message.content}" type="audio/wav">
        </audio>
        <div class="message-meta" style="display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 5px; font-size: 11px;">
          <span class="timestamp" style="color: rgba(0,0,0,0.45);">${time}</span>
          ${isSent ? `<span class="status ${message.seen ? 'seen' : ''}" style="color: ${message.seen ? '#4fc3f7' : '#999'}; transition: all 0.3s ease; font-size: 16px;">✓✓</span>` : ''}
        </div>
      </div>
    `;
  } else {
    msgDiv.innerHTML = `
      <div class="message-bubble">
        <p style="margin: 0; word-wrap: break-word; line-height: 1.4;">${message.content}</p>
        <div class="message-meta" style="display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 5px; font-size: 11px;">
          <span class="timestamp" style="color: rgba(0,0,0,0.45);">${time}</span>
          ${isSent ? `<span class="status ${message.seen ? 'seen' : ''}" style="color: ${message.seen ? '#4fc3f7' : '#999'}; transition: all 0.3s ease; font-size: 16px;">✓✓</span>` : ''}
        </div>
      </div>
    `;
  }
  
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

function updateMessageSeenStatus(messageId) {
  const containers = ['chatMessages', 'chatMessagesDoctor'];
  containers.forEach(containerId => {
    const container = document.getElementById(containerId);
    if (!container) return;
    const msgDiv = container.querySelector(`[data-message-id="${messageId}"]`);
    if (msgDiv) {
      const statusSpan = msgDiv.querySelector('.status');
      if (statusSpan && !statusSpan.classList.contains('seen')) {
        statusSpan.classList.add('seen');
        statusSpan.style.color = '#4fc3f7';
        statusSpan.style.transform = 'scale(1.4)';
        setTimeout(() => { statusSpan.style.transform = 'scale(1)'; }, 300);
      }
    }
  });
}

async function loadChatHistory(userId) {
  console.log('📜 Loading chat:', userId);
  currentChatUser = userId;
  const token = localStorage.getItem('token');
  
  try {
    const response = await fetch(`${API_URL}/messages/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const messages = await response.json();
    
    const container = document.getElementById('chatMessages') || document.getElementById('chatMessagesDoctor');
    if (container) {
      container.innerHTML = '';
      if (messages.length === 0) {
        container.innerHTML = '<p class="empty-state" style="text-align: center; color: var(--text-secondary); padding: 20px;">No messages yet. Start the conversation!</p>';
      } else {
        messages.forEach(msg => {
          const isSent = msg.senderId === currentUserId;
          if (document.getElementById('chatMessages')) {
            displayMessage(msg, isSent);
          } else {
            displayMessageDoctor(msg, isSent);
          }
          if (!isSent && !msg.seen && msg._id) {
            markMessageAsSeen(msg._id, msg.senderId);
          }
        });
      }
    }
  } catch (error) {
    console.error('❌ Load chat error:', error);
  }
}

async function markMessageAsSeen(messageId, senderId) {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/message/${messageId}/seen`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) {
      socket.emit('messageSeen', { messageId, seenBy: currentUserId, senderId });
    }
  } catch (error) {
    console.error('❌ Mark seen error:', error);
  }
}

// ============ VOICE MESSAGING ============
document.getElementById('voiceMessageBtn')?.addEventListener('click', toggleVoiceRecording);
document.getElementById('voiceMessageBtnDoctor')?.addEventListener('click', toggleVoiceRecordingDoctor);

async function toggleVoiceRecording() {
  const button = document.getElementById('voiceMessageBtn');
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (event) => { audioChunks.push(event.data); };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        await sendVoiceMessage(audioBlob);
        audioChunks = [];
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      button.textContent = '⏹️';
      button.classList.add('recording');
    } catch (error) {
      console.error('❌ Mic error:', error);
      showNotification('Microphone access denied', 'error');
    }
  } else {
    mediaRecorder.stop();
    button.textContent = '🎤';
    button.classList.remove('recording');
  }
}

async function toggleVoiceRecordingDoctor() {
  const button = document.getElementById('voiceMessageBtnDoctor');
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (event) => { audioChunks.push(event.data); };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        await sendVoiceMessageDoctor(audioBlob);
        audioChunks = [];
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      button.textContent = '⏹️';
      button.classList.add('recording');
    } catch (error) {
      console.error('❌ Mic error:', error);
      showNotification('Microphone access denied', 'error');
    }
  } else {
    mediaRecorder.stop();
    button.textContent = '🎤';
    button.classList.remove('recording');
  }
}

async function sendVoiceMessage(audioBlob) {
  const reader = new FileReader();
  reader.readAsDataURL(audioBlob);
  reader.onloadend = async () => {
    const messageData = {
      senderId: currentUserId,
      receiverId: currentChatUser,
      messageType: 'voice',
      content: reader.result,
      timestamp: new Date(),
      seen: false
    };
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_URL}/message`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData)
      });
      if (response.ok) {
        const result = await response.json();
        messageData._id = result.message._id;
        displayMessage(messageData, true);
        socket.emit('sendMessage', messageData);
      }
    } catch (error) {
      console.error('❌ Voice send error:', error);
    }
  };
}

async function sendVoiceMessageDoctor(audioBlob) {
  const reader = new FileReader();
  reader.readAsDataURL(audioBlob);
  reader.onloadend = async () => {
    const messageData = {
      senderId: currentUserId,
      receiverId: currentChatUser,
      messageType: 'voice',
      content: reader.result,
      timestamp: new Date(),
      seen: false
    };
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_URL}/message`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData)
      });
      if (response.ok) {
        const result = await response.json();
        messageData._id = result.message._id;
        displayMessageDoctor(messageData, true);
        socket.emit('sendMessage', messageData);
      }
    } catch (error) {
      console.error('❌ Voice send error:', error);
    }
  };
}

// ============ CALLING - IMPROVED VIDEO QUALITY ============
document.getElementById('audioCallBtn')?.addEventListener('click', () => initiateCall('audio'));
document.getElementById('videoCallBtn')?.addEventListener('click', () => initiateCall('video'));
document.getElementById('audioCallBtnDoctor')?.addEventListener('click', () => initiateCall('audio'));
document.getElementById('videoCallBtnDoctor')?.addEventListener('click', () => initiateCall('video'));

async function initiateCall(type) {
  if (!currentChatUser) {
    showNotification('Please select a user to call', 'error');
    return;
  }
  if (isCallActive) {
    showNotification('Call already in progress', 'warning');
    return;
  }
  console.log('📞 Initiating', type, 'call');
  currentCallType = type;
  currentCallTo = currentChatUser;
  
  await fetchOtherUserInfo(currentChatUser);

  try {
    localStream = await navigator.mediaDevices.getUserMedia(getMediaConstraints(type));
    console.log('✅ Got local stream');

    const modal = currentUserRole === 'patient' ? 
      document.getElementById('videoCallModal') : 
      document.getElementById('videoCallModalDoctor');
    const localVideo = currentUserRole === 'patient' ? 
      document.getElementById('localVideo') : 
      document.getElementById('localVideoDoctor');
    
    if (modal) {
      modal.style.display = 'flex';
    }
    
    if (localVideo && type === 'video') {
      localVideo.srcObject = localStream;
      localVideo.muted = true;
      await localVideo.play();
      console.log('✅ Local video playing');
    }
    
    // IMPROVED: Hide audio indicator for video calls
    if (type === 'audio') {
      showAudioCallUI('Calling...', false);
    } else {
      // Hide audio indicator for video calls
      const indicator = currentUserRole === 'patient' ?
        document.querySelector('#videoCallModal .audio-only-indicator') :
        document.querySelector('#videoCallModalDoctor .audio-only-indicator');
      if (indicator) indicator.style.display = 'none';
    }

    peerConnection = new RTCPeerConnection(configuration);
    
    // IMPROVED: Add tracks with higher bitrate for better quality
    localStream.getTracks().forEach(track => {
      const sender = peerConnection.addTrack(track, localStream);
      
      if (track.kind === 'video') {
        const parameters = sender.getParameters();
        if (!parameters.encodings) {
          parameters.encodings = [{}];
        }
        // CRITICAL: Increased bitrate for better video quality
        parameters.encodings[0].maxBitrate = 5000000; // 5 Mbps (was 2.5 Mbps)
        parameters.encodings[0].maxFramerate = 60; // 60 FPS (was 30 FPS)
        parameters.encodings[0].scaleResolutionDownBy = 1; // No downscaling
        sender.setParameters(parameters);
        console.log('✅ Video bitrate set to 5 Mbps @ 60 FPS');
      }
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('iceCandidate', {
          to: currentChatUser,
          candidate: event.candidate
        });
      }
    };
    
    peerConnection.ontrack = (event) => {
      console.log('🎥 Remote track received');
      const remoteVideo = currentUserRole === 'patient' ? 
        document.getElementById('remoteVideo') : 
        document.getElementById('remoteVideoDoctor');
      
      if (remoteVideo) {
        remoteVideo.srcObject = event.streams[0];
        
        // IMPROVED: Hide audio indicator when remote video connects
        if (type === 'video') {
          const indicator = currentUserRole === 'patient' ?
            document.querySelector('#videoCallModal .audio-only-indicator') :
            document.querySelector('#videoCallModalDoctor .audio-only-indicator');
          if (indicator) indicator.style.display = 'none';
        }
        
        remoteVideo.play().catch(e => {
          setTimeout(() => remoteVideo.play(), 500);
        });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log('🔗 State:', peerConnection.connectionState);
      
      if (peerConnection.connectionState === 'connected') {
        isCallActive = true;
        showNotification('Call connected!', 'success');
        
        // Hide audio indicator when connected
        if (type === 'audio') {
          setTimeout(() => {
            const indicators = document.querySelectorAll('.audio-only-indicator .status');
            indicators.forEach(el => el.style.display = 'none');
          }, 1000);
        }
      } else if (peerConnection.connectionState === 'failed') {
        showNotification('Connection failed', 'error');
        setTimeout(() => endCall(), 2000);
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log('🧊 ICE state:', peerConnection.iceConnectionState);
    };

    // IMPROVED: Create offer with better settings
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: type === 'video',
      voiceActivityDetection: true,
      iceRestart: false
    });
    
    await peerConnection.setLocalDescription(offer);
    console.log('✅ Offer created');

    socket.emit('callUser', {
      to: currentChatUser,
      from: currentUserId,
      callType: type,
      offer: offer
    });

    showNotification('Calling...', 'info');

  } catch (error) {
    console.error('❌ Call error:', error);
    showNotification('Could not start call. Check permissions.', 'error');
    endCall();
  }
}

async function fetchOtherUserInfo(userId) {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/user/info/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const userInfo = await response.json();
    let photoPath = 'https://via.placeholder.com/150';
    if (userInfo.profilePhoto) {
      let cleanPath = userInfo.profilePhoto.replace(/\\/g, '/');
      if (cleanPath.startsWith('backend/')) cleanPath = cleanPath.substring(8);
      photoPath = `/backend/${cleanPath}`;
    }
    otherUserInfo = { name: userInfo.name, photo: photoPath };
  } catch (error) {
    console.error('❌ Fetch user error:', error);
    otherUserInfo = { name: 'Unknown', photo: 'https://via.placeholder.com/150' };
  }
}

function showAudioCallUI(status, hideStatus) {
  const indicator = currentUserRole === 'patient' ? 
    document.querySelector('#videoCallModal .audio-only-indicator') : 
    document.querySelector('#videoCallModalDoctor .audio-only-indicator');
  
  if (indicator && otherUserInfo) {
    indicator.style.display = 'flex';
    indicator.innerHTML = `
      <img src="${otherUserInfo.photo}" onerror="this.src='https://via.placeholder.com/150'" 
           style="width: 180px; height: 180px; border-radius: 50%; margin-bottom: 20px; object-fit: cover; border: 6px solid #4fc3f7; box-shadow: 0 15px 50px rgba(79, 195, 247, 0.4); animation: audioCallPulse 2s infinite;">
      <div style="font-size: 28px; font-weight: 600; margin-bottom: 15px; color: white; text-shadow: 0 2px 10px rgba(0,0,0,0.3);">${otherUserInfo.name}</div>
      <div class="status" style="font-size: 16px; color: #4ade80; ${hideStatus ? 'display: none;' : ''}">${status}</div>
    `;
    const style = document.createElement('style');
    style.id = 'audioCallStyle';
    if (!document.getElementById('audioCallStyle')) {
      style.textContent = `@keyframes audioCallPulse { 0%, 100% { transform: scale(1); box-shadow: 0 15px 50px rgba(79, 195, 247, 0.4); } 50% { transform: scale(1.05); box-shadow: 0 20px 60px rgba(79, 195, 247, 0.6); } }`;
      document.head.appendChild(style);
    }
  }
}

async function handleIncomingCall(data) {
  if (isCallActive) {
    socket.emit('answerCall', { to: data.from, from: currentUserId, answer: 'rejected' });
    return;
  }
  incomingCallData = data;
  currentCallType = data.callType;
  currentCallTo = data.from;
  await fetchOtherUserInfo(data.from);
  
  const callType = data.callType === 'video' ? '🎥 Video' : '🎤 Audio';
  const modal = document.createElement('div');
  modal.id = 'incomingCallModal';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.95); display: flex; align-items: center; justify-content: center; z-index: 10000; animation: fadeIn 0.3s ease;';
  modal.innerHTML = `
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 50px; border-radius: 25px; text-align: center; max-width: 420px; box-shadow: 0 25px 80px rgba(0,0,0,0.9);">
      <img src="${otherUserInfo.photo}" onerror="this.src='https://via.placeholder.com/180'" 
           style="width: 180px; height: 180px; border-radius: 50%; margin-bottom: 25px; object-fit: cover; border: 6px solid white; animation: incomingCallPulse 1.5s infinite; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
      <h2 style="color: white; margin-bottom: 12px; font-size: 32px; text-shadow: 0 2px 10px rgba(0,0,0,0.3);">${otherUserInfo.name}</h2>
      <p style="color: rgba(255,255,255,0.9); margin-bottom: 35px; font-size: 20px;">${callType} Call</p>
      <div style="display: flex; gap: 25px; justify-content: center;">
        <button id="answerCallBtn" style="background: #28a745; color: white; border: none; padding: 18px; border-radius: 50%; font-size: 28px; cursor: pointer; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 20px rgba(40, 167, 69, 0.5); transition: all 0.3s;">✔</button>
        <button id="declineCallBtn" style="background: #dc3545; color: white; border: none; padding: 18px; border-radius: 50%; font-size: 28px; cursor: pointer; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 20px rgba(220, 53, 69, 0.5); transition: all 0.3s;">✕</button>
      </div>
      <div style="margin-top: 25px; display: flex; gap: 60px; justify-content: center; font-size: 15px; color: rgba(255,255,255,0.8); font-weight: 500;">
        <span>Answer</span>
        <span>Decline</span>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const style = document.createElement('style');
  style.textContent = `@keyframes incomingCallPulse { 0%, 100% { transform: scale(1); box-shadow: 0 10px 40px rgba(0,0,0,0.5); } 50% { transform: scale(1.08); box-shadow: 0 15px 60px rgba(255,255,255,0.3); } } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } #answerCallBtn:hover, #declineCallBtn:hover { transform: scale(1.12); }`;
  document.head.appendChild(style);
  playRingtone();
  document.getElementById('answerCallBtn').onclick = async () => { stopRingtone(); modal.remove(); await answerCall(data); };
  document.getElementById('declineCallBtn').onclick = () => { stopRingtone(); modal.remove(); socket.emit('answerCall', { to: data.from, from: currentUserId, answer: 'rejected' }); showNotification('Call declined', 'info'); };
}

async function answerCall(data) {
  try {
    localStream = await navigator.mediaDevices.getUserMedia(getMediaConstraints(data.callType));
    console.log('✅ Got local stream');

    const modal = currentUserRole === 'patient' ? 
      document.getElementById('videoCallModal') : 
      document.getElementById('videoCallModalDoctor');
    const localVideo = currentUserRole === 'patient' ? 
      document.getElementById('localVideo') : 
      document.getElementById('localVideoDoctor');
    
    if (modal) {
      modal.style.display = 'flex';
    }
    
    if (localVideo && data.callType === 'video') {
      localVideo.srcObject = localStream;
      localVideo.muted = true;
      await localVideo.play();
      console.log('✅ Local video playing');
    }
    
    // IMPROVED: Proper audio indicator handling
    if (data.callType === 'audio') {
      showAudioCallUI('Connecting...', false);
    } else {
      const indicator = currentUserRole === 'patient' ?
        document.querySelector('#videoCallModal .audio-only-indicator') :
        document.querySelector('#videoCallModalDoctor .audio-only-indicator');
      if (indicator) indicator.style.display = 'none';
    }

    peerConnection = new RTCPeerConnection(configuration);
    
    // IMPROVED: Add tracks with higher bitrate
    localStream.getTracks().forEach(track => {
      const sender = peerConnection.addTrack(track, localStream);
      
      if (track.kind === 'video') {
        const parameters = sender.getParameters();
        if (!parameters.encodings) {
          parameters.encodings = [{}];
        }
        parameters.encodings[0].maxBitrate = 5000000; // 5 Mbps
        parameters.encodings[0].maxFramerate = 60; // 60 FPS
        parameters.encodings[0].scaleResolutionDownBy = 1;
        sender.setParameters(parameters);
        console.log('✅ Video bitrate set to 5 Mbps @ 60 FPS');
      }
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('iceCandidate', {
          to: data.from,
          candidate: event.candidate
        });
      }
    };

    peerConnection.ontrack = (event) => {
      const remoteVideo = currentUserRole === 'patient' ? 
        document.getElementById('remoteVideo') : 
        document.getElementById('remoteVideoDoctor');
      
      if (remoteVideo) {
        remoteVideo.srcObject = event.streams[0];
        
        // IMPROVED: Hide audio indicator for video calls
        if (data.callType === 'video') {
          const indicator = currentUserRole === 'patient' ?
            document.querySelector('#videoCallModal .audio-only-indicator') :
            document.querySelector('#videoCallModalDoctor .audio-only-indicator');
          if (indicator) indicator.style.display = 'none';
        }
        
        remoteVideo.play().catch(e => {
          setTimeout(() => remoteVideo.play(), 500);
        });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'connected') {
        isCallActive = true;
        showNotification('Call connected!', 'success');
      } else if (peerConnection.connectionState === 'failed') {
        endCall();
      }
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    console.log('✅ Remote description set');

    if (iceCandidatesQueue.length > 0) {
      console.log('🔥 Processing', iceCandidatesQueue.length, 'queued candidates');
      for (const candidate of iceCandidatesQueue) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
      iceCandidatesQueue = [];
    }

    const answer = await peerConnection.createAnswer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: data.callType === 'video',
      voiceActivityDetection: true
    });
    
    await peerConnection.setLocalDescription(answer);
    console.log('✅ Answer created');

    socket.emit('answerCall', {
      to: data.from,
      from: currentUserId,
      answer: 'accepted',
      answerSDP: answer
    });

    isCallActive = true;

  } catch (error) {
    console.error('❌ Answer error:', error);
    showNotification('Could not answer call', 'error');
    endCall();
  }
}

async function handleCallAnswered(data) {
  if (data.answer === 'rejected') {
    showNotification('Call declined', 'error');
    endCall();
    return;
  }
  if (data.answer === 'accepted' && data.answerSDP) {
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answerSDP));
      if (iceCandidatesQueue.length > 0) {
        for (const candidate of iceCandidatesQueue) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
        iceCandidatesQueue = [];
      }
      isCallActive = true;
      setTimeout(() => {
        document.querySelectorAll('.audio-only-indicator .status').forEach(el => el.style.display = 'none');
      }, 1000);
    } catch (error) {
      console.error('❌ Handle answer error:', error);
      endCall();
    }
  }
}

document.getElementById('endCallBtn')?.addEventListener('click', () => endCall());
document.getElementById('endCallBtnDoctor')?.addEventListener('click', () => endCall());

function endCall(skipNotify = false) {
  console.log('🔴 Ending call');
  stopRingtone();
  const incomingModal = document.getElementById('incomingCallModal');
  if (incomingModal) incomingModal.remove();
  
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  
  iceCandidatesQueue = [];
  
  const modals = ['videoCallModal', 'videoCallModalDoctor'];
  modals.forEach(id => {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
  });
  
  const videos = ['remoteVideo', 'localVideo', 'remoteVideoDoctor', 'localVideoDoctor'];
  videos.forEach(id => {
    const video = document.getElementById(id);
    if (video) {
      video.srcObject = null;
      video.load();
    }
  });
  
  if (!skipNotify && currentCallTo) {
    if (isCallActive) {
      socket.emit('callEnded', { to: currentCallTo, from: currentUserId });
    } else {
      socket.emit('cancelCall', { to: currentCallTo, from: currentUserId });
    }
  }
  
  isCallActive = false;
  currentCallType = null;
  currentCallTo = null;
  otherUserInfo = null;
  console.log('✅ Call ended');
}

document.getElementById('toggleAudioBtn')?.addEventListener('click', toggleAudio);
document.getElementById('toggleVideoBtn')?.addEventListener('click', toggleVideo);
document.getElementById('toggleAudioBtnDoctor')?.addEventListener('click', toggleAudio);
document.getElementById('toggleVideoBtnDoctor')?.addEventListener('click', toggleVideo);

function toggleAudio() {
  if (!localStream) return;
  const audioTrack = localStream.getAudioTracks()[0];
  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled;
    const btn = currentUserRole === 'patient' ? document.getElementById('toggleAudioBtn') : document.getElementById('toggleAudioBtnDoctor');
    if (btn) {
      btn.textContent = audioTrack.enabled ? '🎤 Mute' : '🎤 Unmute';
      btn.style.background = audioTrack.enabled ? 'rgba(255,255,255,0.2)' : '#dc3545';
    }
  }
}

function toggleVideo() {
  if (!localStream) return;
  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.enabled = !videoTrack.enabled;
    const btn = currentUserRole === 'patient' ? document.getElementById('toggleVideoBtn') : document.getElementById('toggleVideoBtnDoctor');
    if (btn) {
      btn.textContent = videoTrack.enabled ? '📹 Video Off' : '📹 Video On';
      btn.style.background = videoTrack.enabled ? 'rgba(255,255,255,0.2)' : '#dc3545';
    }
  }
}

function playRingtone() {
  ringtoneInterval = setInterval(() => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = 800;
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  }, 1500);
}

function stopRingtone() {
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
}

function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = 800;
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (e) {
    console.log('Notification sound failed:', e);
  }
}

if (typeof window !== 'undefined') {
  window.loadChatHistory = loadChatHistory;
  window.reinitializeSocketForCalls = initializeSocket;
  window.endCall = endCall;
  window.currentChatUser = currentChatUser; 
  window.initiateCall = initiateCall;
  window.answerCall = answerCall;
  window.getMediaConstraints = getMediaConstraints;
}