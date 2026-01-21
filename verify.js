// Test 1: Check if socket is connected
console.log('Socket connected?', socket?.connected);

// Test 2: Check currentChatUser
console.log('currentChatUser:', window.currentChatUser);

// Test 3: Try manual message send
socket.emit('sendMessage', {
  senderId: 'TEST',
  receiverId: window.currentChatUser,
  content: 'Test message',
  messageType: 'text'
});