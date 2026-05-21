const SupportTicket  = require("../models/SupportTicket");
const SupportMessage = require("../models/SupportMessage");
const User           = require("../models/User");
const AppError       = require("../utils/AppError");
const catchAsync     = require("../utils/catchAsync");
const { emitToUser, emitToRole } = require("../socket");

const CATEGORY_LABELS = {
  booking_issue:       "Booking Issue",
  payment_issue:       "Payment Issue",
  provider_complaint:  "Provider Complaint",
  app_bug:             "App Bug / Error",
  general:             "General Enquiry",
};

// ─── POST /api/support ────────────────────────────────────────────────────────
// Customer creates a new ticket + sends the opening message.
const createTicket = catchAsync(async (req, res) => {
  const { category, message } = req.body;

  if (!category || !CATEGORY_LABELS[category])
    throw new AppError("Please select a valid support category.", 400);
  if (!message || message.trim().length < 10)
    throw new AppError("Please describe your issue (minimum 10 characters).", 400);

  const user = await User.findById(req.user._id).select("fullName").lean();

  // Auto-generate subject from first 80 chars of message
  const subject = message.trim().slice(0, 80) + (message.trim().length > 80 ? "…" : "");

  const ticket = await SupportTicket.create({
    customerId:    req.user._id,
    category,
    subject,
    status:        "open",
    unreadByAdmin: 1,
  });

  const msg = await SupportMessage.create({
    ticketId:   ticket._id,
    senderId:   req.user._id,
    senderRole: "customer",
    senderName: user?.fullName || "Customer",
    text:       message.trim(),
  });

  await SupportTicket.findByIdAndUpdate(ticket._id, { lastMessageAt: new Date() });

  // Notify all connected admins in real time
  emitToRole("admin", "support:ticket:created", {
    ticketId:     ticket._id,
    ticketNumber: ticket.ticketNumber,
    category:     CATEGORY_LABELS[category],
    subject:      ticket.subject,
    customerName: user?.fullName || "Customer",
    createdAt:    ticket.createdAt,
  });

  res.status(201).json({ success: true, ticket, message: msg });
});

// ─── GET /api/support ─────────────────────────────────────────────────────────
// Customer lists all their tickets with last message preview.
const getMyTickets = catchAsync(async (req, res) => {
  const tickets = await SupportTicket.find({ customerId: req.user._id })
    .sort({ lastMessageAt: -1 })
    .lean();

  // Get last message preview for each ticket
  const ids = tickets.map(t => t._id);
  const previews = await SupportMessage.aggregate([
    { $match: { ticketId: { $in: ids } } },
    { $sort:  { createdAt: -1 } },
    { $group: {
        _id:        "$ticketId",
        text:       { $first: "$text" },
        senderRole: { $first: "$senderRole" },
        createdAt:  { $first: "$createdAt" },
    }},
  ]);

  const previewMap = Object.fromEntries(previews.map(p => [p._id.toString(), p]));

  res.json({
    success: true,
    tickets: tickets.map(t => ({
      ...t,
      lastMessage: previewMap[t._id.toString()] || null,
      categoryLabel: CATEGORY_LABELS[t.category] || t.category,
    })),
  });
});

// ─── GET /api/support/admin ───────────────────────────────────────────────────
// Admin views all tickets.
const getAdminTickets = catchAsync(async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status && status !== "all") filter.status = status;

  const tickets = await SupportTicket.find(filter)
    .populate("customerId", "fullName email phone")
    .sort({ lastMessageAt: -1 })
    .limit(200)
    .lean();

  // Last message preview
  const ids = tickets.map(t => t._id);
  const previews = await SupportMessage.aggregate([
    { $match: { ticketId: { $in: ids } } },
    { $sort:  { createdAt: -1 } },
    { $group: {
        _id:        "$ticketId",
        text:       { $first: "$text" },
        senderRole: { $first: "$senderRole" },
        createdAt:  { $first: "$createdAt" },
    }},
  ]);

  const previewMap = Object.fromEntries(previews.map(p => [p._id.toString(), p]));

  res.json({
    success: true,
    tickets: tickets.map(t => ({
      ...t,
      lastMessage:   previewMap[t._id.toString()] || null,
      categoryLabel: CATEGORY_LABELS[t.category] || t.category,
    })),
  });
});

// ─── GET /api/support/:id ─────────────────────────────────────────────────────
// Load ticket + all messages. Marks as read for the caller.
const getTicket = catchAsync(async (req, res) => {
  const ticket = await SupportTicket.findById(req.params.id)
    .populate("customerId", "fullName email phone")
    .lean();

  if (!ticket) throw new AppError("Support ticket not found.", 404);

  const userId     = req.user._id.toString();
  const isCustomer = ticket.customerId._id.toString() === userId;
  const isAdmin    = req.user.role === "admin";
  if (!isCustomer && !isAdmin) throw new AppError("Access denied.", 403);

  const messages = await SupportMessage.find({ ticketId: ticket._id })
    .sort({ createdAt: 1 })
    .lean();

  // Mark as read
  const unreadReset = isAdmin ? { unreadByAdmin: 0 } : { unreadByCustomer: 0 };
  await SupportTicket.findByIdAndUpdate(ticket._id, unreadReset);

  res.json({
    success: true,
    ticket:  { ...ticket, categoryLabel: CATEGORY_LABELS[ticket.category] || ticket.category },
    messages,
  });
});

// ─── POST /api/support/:id/message ────────────────────────────────────────────
// Send a message in an existing ticket.
const sendMessage = catchAsync(async (req, res) => {
  const { text } = req.body;
  if (!text?.trim() || text.trim().length < 1)
    throw new AppError("Message cannot be empty.", 400);
  if (text.trim().length > 2000)
    throw new AppError("Message is too long (max 2000 characters).", 400);

  const ticket = await SupportTicket.findById(req.params.id)
    .populate("customerId", "_id fullName")
    .lean();

  if (!ticket) throw new AppError("Support ticket not found.", 404);

  const userId     = req.user._id.toString();
  const isCustomer = ticket.customerId._id.toString() === userId;
  const isAdmin    = req.user.role === "admin";

  if (!isCustomer && !isAdmin) throw new AppError("Access denied.", 403);
  if (["resolved", "closed"].includes(ticket.status))
    throw new AppError("This ticket is already closed. Create a new ticket if you need further help.", 400);

  const user       = await User.findById(req.user._id).select("fullName").lean();
  const senderRole = isAdmin ? "admin" : "customer";

  const msg = await SupportMessage.create({
    ticketId:   ticket._id,
    senderId:   req.user._id,
    senderRole,
    senderName: user?.fullName || senderRole,
    text:       text.trim(),
  });

  // Update ticket meta
  const ticketUpdate = { lastMessageAt: new Date() };
  if (isAdmin) {
    ticketUpdate.status           = "in_progress";
    ticketUpdate.unreadByCustomer = (ticket.unreadByCustomer || 0) + 1;
  } else {
    ticketUpdate.unreadByAdmin    = (ticket.unreadByAdmin || 0) + 1;
  }
  await SupportTicket.findByIdAndUpdate(ticket._id, ticketUpdate);

  const payload = {
    ticketId: ticket._id,
    message:  {
      _id:        msg._id,
      senderRole,
      senderName: user?.fullName || senderRole,
      text:       text.trim(),
      createdAt:  msg.createdAt,
    },
  };

  // Real-time: send to the customer and to all admins
  emitToUser(ticket.customerId._id.toString(), "support:message:new", payload);
  emitToRole("admin", "support:message:new", payload);

  res.status(201).json({ success: true, message: msg });
});

// ─── PUT /api/support/:id/status ─────────────────────────────────────────────
// Admin resolves or closes a ticket.
const updateTicketStatus = catchAsync(async (req, res) => {
  const { status } = req.body;
  if (!["resolved", "closed", "open", "in_progress"].includes(status))
    throw new AppError("Invalid status value.", 400);

  const ticket = await SupportTicket.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  ).populate("customerId", "_id fullName");

  if (!ticket) throw new AppError("Ticket not found.", 404);

  // Notify the customer that their ticket status changed
  emitToUser(ticket.customerId._id.toString(), "support:ticket:status", {
    ticketId:     ticket._id,
    ticketNumber: ticket.ticketNumber,
    status,
  });

  res.json({ success: true, ticket });
});

module.exports = {
  createTicket,
  getMyTickets,
  getAdminTickets,
  getTicket,
  sendMessage,
  updateTicketStatus,
};
