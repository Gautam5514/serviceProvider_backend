const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipientRole: {
      type: String,
      enum: ["customer", "provider", "admin"],
      required: true,
    },
    type: {
      type: String,
      enum: [
        "booking_created",
        "new_job_available",
        "job_claimed",
        "provider_on_way",
        "job_started",
        "job_completed",
        "invoice_ready",
        "new_provider_onboard",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

NotificationSchema.index({ recipientId: 1, readAt: 1, createdAt: -1 });
NotificationSchema.index({ bookingId: 1, type: 1 });

module.exports =
  mongoose.models.Notification ||
  mongoose.model("Notification", NotificationSchema);
