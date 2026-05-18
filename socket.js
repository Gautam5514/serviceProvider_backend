const jwt = require("jsonwebtoken");
const User = require("./models/User");

let ioInstance = null;

function userRoom(userId) {
  return `user:${userId}`;
}

function initSocket(server, allowedOrigins) {
  const { Server } = require("socket.io");

  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Missing auth token"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("_id role fullName");
      if (!user) return next(new Error("User not found"));

      socket.user = user;
      socket.join(userRoom(user._id));
      socket.join(`role:${user.role}`);
      next();
    } catch {
      next(new Error("Invalid auth token"));
    }
  });

  io.on("connection", (socket) => {
    socket.emit("socket:ready", {
      userId: socket.user._id,
      role: socket.user.role,
    });
  });

  ioInstance = io;
  return io;
}

function emitToUser(userId, event, payload) {
  if (!ioInstance || !userId) return;
  ioInstance.to(userRoom(userId)).emit(event, payload);
}

function emitToUsers(userIds, event, payloadByUserId) {
  if (!ioInstance || !Array.isArray(userIds)) return;
  userIds.forEach((userId) => {
    const payload = typeof payloadByUserId === "function"
      ? payloadByUserId(String(userId))
      : payloadByUserId;
    emitToUser(userId, event, payload);
  });
}

module.exports = {
  initSocket,
  emitToUser,
  emitToUsers,
};
