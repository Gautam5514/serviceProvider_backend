const mongoose = require("mongoose");

/*
 * One record per payout event (job payment, bonus, deduction, refund).
 * netAmount = amount - platformFee.
 * Never updated after status = completed — create a new adjustment record instead.
 */

const ProviderPayoutSchema = new mongoose.Schema(
  {
    // REQUIRED
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Provider",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    platformFee: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    netAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    payoutType: {
      type: String,
      enum: [
        "job_payment",  // standard payout after job completion
        "bonus",        // platform incentive
        "adjustment",   // correction / manual credit
        "penalty",      // deduction for complaint/policy violation
        "refund",       // money returned to provider
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed", "on_hold"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["bank_transfer", "upi"],
      required: true,
    },

    // OPTIONAL
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
    transactionRef: {
      type: String,
      trim: true, // payment gateway / NEFT reference
    },
    remarks: {
      type: String,
      trim: true,
    },
    processedAt: {
      type: Date,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // admin who triggered the payout
    },
  },
  { timestamps: true }
);

ProviderPayoutSchema.index({ providerId: 1, createdAt: -1 });
ProviderPayoutSchema.index({ status: 1 });

module.exports =
  mongoose.models.ProviderPayout ||
  mongoose.model("ProviderPayout", ProviderPayoutSchema);
