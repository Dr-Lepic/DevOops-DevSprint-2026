import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (hubUrl: string): Socket => {
  if (!socket) {
    socket = io(hubUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
};

export const connectSocket = (hubUrl: string, studentId: string) => {
  const socket = getSocket(hubUrl);
  
  if (!socket.connected) {
    socket.connect();
    
    socket.on('connect', () => {
      console.log('✓ Connected to Notification Hub');
      socket.emit('joinRoom', studentId);
    });

    socket.on('disconnect', () => {
      console.log('✗ Disconnected from Notification Hub');
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
  } else {
    // Already connected, just join the room
    socket.emit('joinRoom', studentId);
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket && socket.connected) {
    socket.disconnect();
    socket = null;
  }
};
