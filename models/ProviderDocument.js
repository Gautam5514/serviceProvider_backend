const mongoose = require("mongoose");

/*
 * MVP REQUIRED (must upload before admin review):
 *   aadhaar, pan, selfie
 *
 * RECOMMENDED (needed for home_entry tier):
 *   address_proof, police_certificate
 *
 * OPTIONAL (advanced verification):
 *   skill_certificate, work_photo, experience_letter, job_id_card, cancelled_cheque
 */

const DOC_CONFIG = {
  aadhaar:            { requiredLevel: "mvp",         label: "Aadhaar Card" },
  pan:                { requiredLevel: "mvp",         label: "PAN Card" },
  selfie:             { requiredLevel: "mvp",         label: "Live Selfie" },
  address_proof:      { requiredLevel: "recommended", label: "Address Proof" },
  police_certificate: { requiredLevel: "recommended", label: "Police Verification Certificate" },
  skill_certificate:  { requiredLevel: "optional",    label: "Skill / Training Certificate" },
  work_photo:         { requiredLevel: "optional",    label: "Previous Work Photo" },
  experience_letter:  { requiredLevel: "optional",    label: "Experience Letter" },
  job_id_card:        { requiredLevel: "optional",    label: "Previous Job ID Card" },
  cancelled_cheque:   { requiredLevel: "optional",    label: "Cancelled Cheque / Passbook" },
};

const DOC_TYPES = Object.keys(DOC_CONFIG);

const ProviderDocumentSchema = new mongoose.Schema(
  {
    // REQUIRED
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Provider",
      required: true,
    },
    docType: {
      type: String,
      enum: DOC_TYPES,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },

    // Auto-set from DOC_CONFIG on save
    requiredLevel: {
      type: String,
      enum: ["mvp", "recommended", "optional"],
    },

    // Admin-controlled
    status: {
      type: String,
      enum: ["uploaded", "under_review", "verified", "rejected", "expired"],
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

    // Store masked number only — never store full Aadhaar/PAN
    docNumberMasked: {
      type: String,
      trim: true,
    },
    expiryDate: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Auto-set requiredLevel from DOC_CONFIG
ProviderDocumentSchema.pre("save", function (next) {
  if (this.docType && DOC_CONFIG[this.docType]) {
    this.requiredLevel = DOC_CONFIG[this.docType].requiredLevel;
  }
  next();
});

// One document per type per provider
ProviderDocumentSchema.index({ providerId: 1, docType: 1 }, { unique: true });

const ProviderDocument =
  mongoose.models.ProviderDocument ||
  mongoose.model("ProviderDocument", ProviderDocumentSchema);

module.exports = ProviderDocument;
module.exports.DOC_CONFIG = DOC_CONFIG;
