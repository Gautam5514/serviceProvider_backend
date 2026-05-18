const mongoose = require("mongoose");

/*
 * Helps separate real technicians from random applicants.
 * work_photo and reference_contact are most common for MVP.
 * certificate / experience_letter / job_id_card are optional extras.
 *
 * Required level:
 *   recommended → asked during onboarding Step 4, not blocking
 *   optional    → can be added anytime
 */

const ProviderWorkProofSchema = new mongoose.Schema(
  {
    // REQUIRED
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Provider",
      required: true,
    },
    proofType: {
      type: String,
      enum: [
        "work_photo",         // recommended — photo of past work
        "certificate",        // optional — training/skill cert
        "experience_letter",  // optional — from past employer
        "job_id_card",        // optional — past company ID
        "reference_contact",  // optional — customer/employer reference
      ],
      required: true,
    },

    // REQUIRED for file-based proofs (all except reference_contact)
    fileUrl: {
      type: String,
    },

    // REQUIRED only when proofType = reference_contact
    referenceContactName: {
      type: String,
      trim: true,
    },
    referenceContactPhone: {
      type: String,
      trim: true,
    },

    // OPTIONAL
    title: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 300,
    },

    // Admin-controlled
    status: {
      type: String,
      enum: ["uploaded", "under_review", "verified", "rejected"],
      default: "uploaded",
    },
    adminRemarks: {
      type: String,
      trim: true,
    },
    verifiedAt: {
      type: Date,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

ProviderWorkProofSchema.index({ providerId: 1, proofType: 1 });

module.exports =
  mongoose.models.ProviderWorkProof ||
  mongoose.model("ProviderWorkProof", ProviderWorkProofSchema);
