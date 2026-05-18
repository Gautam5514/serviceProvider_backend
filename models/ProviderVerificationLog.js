const mongoose = require("mongoose");

/*
 * Audit trail for every status change on a provider account.
 * Immutable — logs are never updated or deleted.
 * Used by admin panel to track the full history of a provider's verification.
 */

const ProviderVerificationLogSchema = new mongoose.Schema(
  {
    // REQUIRED
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Provider",
      required: true,
    },
    action: {
      type: String,
      enum: [
        "profile_submitted",
        "services_submitted",
        "kyc_submitted",
        "kyc_verified",
        "kyc_rejected",
        "work_proof_submitted",
        "skill_reviewed",
        "bgv_initiated",
        "bgv_completed",
        "bgv_failed",
        "bank_details_submitted",
        "bank_penny_drop_verified",
        "agreement_accepted",
        "approved",
        "rejected",
        "suspended",
        "reinstated",
        "blocked",
        "job_tier_upgraded",  // basic → home_entry → priority
      ],
      required: true,
    },
    previousStatus: {
      type: String,
      required: true,
    },
    newStatus: {
      type: String,
      required: true,
    },

    // OPTIONAL — null means system-triggered (e.g. auto-upgrade after BGV)
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    remarks: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

ProviderVerificationLogSchema.index({ providerId: 1, createdAt: -1 });

module.exports =
  mongoose.models.ProviderVerificationLog ||
  mongoose.model("ProviderVerificationLog", ProviderVerificationLogSchema);
