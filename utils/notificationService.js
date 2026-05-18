const Notification = require("../models/Notification");
const { emitToUser } = require("../socket");

async function createNotification({
  recipientId,
  recipientRole,
  type,
  title,
  message,
  bookingId,
  data = {},
}) {
  if (!recipientId || !recipientRole || !type || !title || !message) return null;

  const notification = await Notification.create({
    recipientId,
    recipientRole,
    type,
    title,
    message,
    bookingId,
    data,
  });

  emitToUser(recipientId, "notification:new", notification);
  return notification;
}

async function notifyMany(notifications) {
  const valid = notifications.filter(Boolean).filter((n) =>
    n.recipientId && n.recipientRole && n.type && n.title && n.message
  );
  if (valid.length === 0) return [];
  const inserted = await Notification.insertMany(valid, { ordered: false });
  inserted.forEach((notification) => {
    emitToUser(notification.recipientId, "notification:new", notification);
  });
  return inserted;
}

module.exports = {
  createNotification,
  notifyMany,
};
