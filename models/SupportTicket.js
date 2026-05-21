const mongoose = require("mongoose");

const SupportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, unique: true },

    customerId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    category: {
      type: String,
      enum: ["booking_issue", "payment_issue", "provider_complaint", "app_bug", "general"],
      required: true,
    },

    // First line of the customer's description (auto-trimmed to 120 chars)
    subject: { type: String, required: true, trim: true, maxlength: 200 },

    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
    },

    lastMessageAt:    { type: Date, default: Date.now },
    unreadByAdmin:    { type: Number, default: 0 },
    unreadByCustomer: { type: Number, default: 0 },
  },
  { timestamps: true }
);

SupportTicketSchema.pre("save", function (next) {
  if (!this.ticketNumber) {
    const d   = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const rnd = Math.floor(1000 + Math.random() * 9000);
    this.ticketNumber = `TKT${ymd}${rnd}`;
  }
  next();
});

SupportTicketSchema.index({ customerId: 1, createdAt: -1 });
SupportTicketSchema.index({ status: 1, lastMessageAt: -1 });

module.exports =
  mongoose.models.SupportTicket || mongoose.model("SupportTicket", SupportTicketSchema);
