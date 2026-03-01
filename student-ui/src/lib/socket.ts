import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let handlersRegistered = false;

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
  const s = getSocket(hubUrl);

  if (!s.connected) {
    s.connect();
  }

  if (!handlersRegistered) {
    handlersRegistered = true;

    s.on('connect', () => {
      console.log('✓ Connected to Notification Hub');
      s.emit('joinRoom', studentId);
    });

    s.on('disconnect', () => {
      console.log('✗ Disconnected from Notification Hub');
    });

    s.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
  } else if (s.connected) {
    // Already connected, just join the room
    s.emit('joinRoom', studentId);
  }

  return s;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    handlersRegistered = false;
  }
};
