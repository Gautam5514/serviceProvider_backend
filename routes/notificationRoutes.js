const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} = require("../controllers/notificationController");

router.get("/", protect, getMyNotifications);
router.put("/read-all", protect, markAllNotificationsRead);
router.put("/:id/read", protect, markNotificationRead);
router.delete("/:id", protect, deleteNotification);

module.exports = router;
