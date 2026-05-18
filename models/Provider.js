const mongoose = require("mongoose");

/*
 * ONBOARDING STEPS (provider fills step by step):
 *   1 → Basic Profile        (Provider fields)
 *   2 → Services & Skills    (Provider.services[])
 *   3 → KYC Documents        (ProviderDocument)
 *   4 → Work Proofs          (ProviderWorkProof)
 *   5 → Bank Details         (ProviderBankDetails)
 *   6 → Availability         (ProviderAvailability)
 *   7 → Legal Agreement      (ProviderAgreement)
 *   → Admin Review           (ProviderVerificationLog tracks every change)
 *   → Approved               (isActive = true)
 *
 * JOB TIER (unlocked progressively):
 *   basic      → KYC verified, can receive outdoor/low-risk jobs
 *   home_entry → Police/BGV verified, can enter customer's home
 *   priority   → Rating ≥ 4.5 + 20+ reviews, gets priority in matching
 */

const ONBOARDING_STATUSES = [
  "pending_profile",       // just registered, profile incomplete
  "profile_complete",      // Step 1–2 done
  "kyc_submitted",         // documents uploaded, waiting admin review
  "kyc_verified",          // admin verified KYC
  "skill_review_pending",  // skill/work proof under review
  "background_check_pending",
  "approved",
  "rejected",
  "suspended",
  "blocked",
];

const JOB_TIERS = ["basic", "home_entry", "priority"];

const SERVICE_CATEGORIES = ["ac", "cooler", "fan", "tv", "fridge", "electrical", "appliance"];

// --- Embedded: one entry per service the provider offers ---
const providerServiceSchema = new mongoose.Schema(
  {
    // REQUIRED
    category: {
      type: String,
      enum: SERVICE_CATEGORIES,
      required: true,
    },
    serviceName: {
      type: String,
      required: true,
      trim: true,
    },
    experienceYears: {
      type: Number,
      required: true,
      min: 0,
    },
    skillLevel: {
      type: String,
      enum: ["beginner", "intermediate", "expert"],
      required: true,
    },
    hasOwnTools: {
      type: Boolean,
      required: true,
      default: false,
    },
    canProvideInstallationAndRepair: {
      type: Boolean,
      required: true,
      default: false,
    },

    // OPTIONAL
    previousCompany: {
      type: String,
      trim: true,
    },
    canHandleEmergency: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const ProviderSchema = new mongoose.Schema(
  {
    // ─────────────────────────────────────────────
    // STEP 1: Basic Profile
    // ─────────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    // REQUIRED
    dateOfBirth: {
      type: Date,
      required: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    serviceArea: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
        default: undefined,
        validate: {
          validator(value) {
            if (!value) return true;
            return value.length === 2 && value.every((n) => Number.isFinite(n));
          },
          message: "Location coordinates must be [lng, lat]",
        },
      },
    },
    locationSource: {
      type: String,
      enum: ["gps", "ip", "manual", "fallback"],
    },
    locationUpdatedAt: {
      type: Date,
    },
    workingRadiusKm: {
      type: Number,
      required: true,
      default: 10,
    },

    // OPTIONAL
    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },
    emergencyContact: {
      type: String,
      trim: true,
    },
    alternatePhone: {
      type: String,
      trim: true,
    },
    languages: {
      type: [String],
      default: [],
    },
    about: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    // ─────────────────────────────────────────────
    // STEP 2: Services & Skills (embedded)
    // ─────────────────────────────────────────────
    services: {
      type: [providerServiceSchema],
      default: [],
    },

    // ─────────────────────────────────────────────
    // Verification & Status (admin-controlled)
    // ─────────────────────────────────────────────
    onboardingStatus: {
      type: String,
      enum: ONBOARDING_STATUSES,
      default: "pending_profile",
    },
    onboardingStep: {
      type: Number,
      default: 1,
      min: 1,
      max: 7,
    },
    jobTier: {
      type: String,
      enum: JOB_TIERS,
      default: "basic",
    },
    isActive: {
      type: Boolean,
      default: false, // true only after admin approves
    },
    onboardingCompletedAt: {
      type: Date,
    },

    // ─────────────────────────────────────────────
    // Aggregated stats (updated after each job)
    // ─────────────────────────────────────────────
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    totalJobsCompleted: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

ProviderSchema.index({ location: "2dsphere" });

module.exports =
  mongoose.models.Provider || mongoose.model("Provider", ProviderSchema);
