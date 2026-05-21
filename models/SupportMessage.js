const mongoose = require("mongoose");

const SupportMessageSchema = new mongoose.Schema(
  {
    ticketId:   { type: mongoose.Schema.Types.ObjectId, ref: "SupportTicket", required: true },
    senderId:   { type: mongoose.Schema.Types.ObjectId, ref: "User",          required: true },
    senderRole: { type: String, enum: ["customer", "admin"],                  required: true },
    senderName: { type: String, required: true, trim: true },
    text:       { type: String, required: true, trim: true, maxlength: 2000  },
  },
  { timestamps: true }
);

SupportMessageSchema.index({ ticketId: 1, createdAt: 1 });

module.exports =
  mongoose.models.SupportMessage || mongoose.model("SupportMessage", SupportMessageSchema);
