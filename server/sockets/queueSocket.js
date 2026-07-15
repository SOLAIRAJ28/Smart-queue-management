import { userSockets } from './userSockets.js';

export const initQueueSockets = (io) => {
  io.on('connection', (socket) => {
    console.log(`Socket client connected: ${socket.id}`);

    // Register active user session
    socket.on('register_user', (userId) => {
      if (userId) {
        const userIdStr = userId.toString();
        if (!userSockets.has(userIdStr)) {
          userSockets.set(userIdStr, new Set());
        }
        userSockets.get(userIdStr).add(socket.id);
        socket.userId = userIdStr;
        console.log(`[Socket Registry] User registered: ${userIdStr} on socket ${socket.id}`);
      }
    });

    // Join branch lobby channel (for display boards, tellers, kiosks)
    socket.on('join_branch', (branchId) => {
      if (branchId) {
        socket.join(branchId.toString());
        console.log(`Socket ${socket.id} joined branch room: ${branchId}`);
      }
    });

    // Leave branch lobby channel
    socket.on('leave_branch', (branchId) => {
      if (branchId) {
        socket.leave(branchId.toString());
        console.log(`Socket ${socket.id} left branch room: ${branchId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket client disconnected: ${socket.id}`);
      if (socket.userId && userSockets.has(socket.userId)) {
        const sockets = userSockets.get(socket.userId);
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(socket.userId);
        }
        console.log(`[Socket Registry] User unregistered: ${socket.userId}`);
      }
    });
  });
};
