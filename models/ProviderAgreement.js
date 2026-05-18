const mongoose = require("mongoose");

/*
 * Every boolean here must be explicitly true before onboarding is complete.
 * acceptedFromIp + acceptedAt are stored for legal record in case of disputes.
 */

const ProviderAgreementSchema = new mongoose.Schema(
  {
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Provider",
      required: true,
      unique: true,
    },

    // ─── All REQUIRED — provider must check all boxes ───────────────────────
    termsAccepted: {
      type: Boolean,
      required: true,
    },
    codeOfConductAccepted: {
      type: Boolean,
      required: true,
    },
    customerSafetyAccepted: {
      type: Boolean,
      required: true,
    },
    // "No direct payment from customer, no customer contact stealing"
    noDirectPaymentRuleAccepted: {
      type: Boolean,
      required: true,
    },
    commissionPolicyAccepted: {
      type: Boolean,
      required: true,
    },
    dataPrivacyConsent: {
      type: Boolean,
      required: true,
    },
    // Consent for Aadhaar/PAN/background check
    bgvConsent: {
      type: Boolean,
      required: true,
    },

    // ─── Legal audit trail ───────────────────────────────────────────────────
    acceptedFromIp: {
      type: String,
      trim: true,
    },
    acceptedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.ProviderAgreement ||
  mongoose.model("ProviderAgreement", ProviderAgreementSchema);
