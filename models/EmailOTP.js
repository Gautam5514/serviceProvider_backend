const mongoose = require("mongoose");

const EmailOTPSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    otpHash: { type: String, required: true },
    purpose: {
      type: String,
      enum: ["provider_email_verify", "register_email_verify", "forgot_password"],
      required: true,
    },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Auto-delete documents 1 hour after creation
EmailOTPSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

module.exports =
  mongoose.models.EmailOTP || mongoose.model("EmailOTP", EmailOTPSchema);
