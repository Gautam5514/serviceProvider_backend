const mongoose = require("mongoose");

const ProviderBankDetailsSchema = new mongoose.Schema(
  {
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Provider",
      required: true,
      unique: true,
    },

    // ─── REQUIRED ────────────────────────────────────────────────────────────
    accountHolderName: {
      type: String,
      required: true,
      trim: true,
    },
    accountNumber: {
      type: String,
      required: true,
      trim: true,
    },
    ifscCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    // ─── RECOMMENDED ─────────────────────────────────────────────────────────
    cancelledChequeUrl: {
      type: String, // file URL — for manual verification
    },

    // ─── OPTIONAL ────────────────────────────────────────────────────────────
    upiId: {
      type: String,
      trim: true,
    },

    // ─── Penny-drop verification (run by admin / payment gateway) ────────────
    pennyDropVerified: {
      type: Boolean,
      default: false,
    },
    pennyDropVerifiedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.ProviderBankDetails ||
  mongoose.model("ProviderBankDetails", ProviderBankDetailsSchema);
