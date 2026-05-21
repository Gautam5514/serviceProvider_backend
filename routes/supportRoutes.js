const express = require("express");
const router  = express.Router();
const { protect, customerOnly, adminOnly } = require("../middleware/auth");
const {
  createTicket,
  getMyTickets,
  getAdminTickets,
  getTicket,
  sendMessage,
  updateTicketStatus,
} = require("../controllers/supportController");

// Static admin routes MUST come before /:id to prevent "admin" being matched as an ID
router.get ("/admin",         protect, adminOnly,   getAdminTickets);
router.put ("/:id/status",    protect, adminOnly,   updateTicketStatus);

// Customer routes
router.post("/",              protect, customerOnly, createTicket);
router.get ("/",              protect, customerOnly, getMyTickets);

// Shared (customer who owns it OR admin)
router.get ("/:id",           protect,               getTicket);
router.post("/:id/message",   protect,               sendMessage);

module.exports = router;
