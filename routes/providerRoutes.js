const express = require("express");
const router = express.Router();

const { protect, providerOnly } = require("../middleware/auth");
const {
  getProviders,
  getProviderProfile,
  updateProviderProfile,
  updateProviderServices,
  updateProviderAvailability,
} = require("../controllers/providerController");
const {
  getOnboardingStatus,
  step1Profile,
  step2Services,
  step3Documents,
  step4WorkProofs,
  step5BankDetails,
  step6Availability,
  step7Agreement,
} = require("../controllers/providerOnboardingController");

// ─── Public ──────────────────────────────────────────────────────────────────
// List approved, active providers (used by customer-facing search)
router.get("/", getProviders);

// ─── Authenticated provider ──────────────────────────────────────────────────
router.get("/me", protect, providerOnly, getProviderProfile);
router.put("/me", protect, providerOnly, updateProviderProfile);
router.put("/me/services", protect, providerOnly, updateProviderServices);
router.put("/me/availability", protect, providerOnly, updateProviderAvailability);

// ─── Onboarding (step-by-step) ───────────────────────────────────────────────
// GET  — shows which steps are done and what's still missing
// POST — each step saves its own model and advances onboardingStep
router.get("/onboarding/status",   protect, providerOnly, getOnboardingStatus);
router.post("/onboarding/step/1",  protect, providerOnly, step1Profile);
router.post("/onboarding/step/2",  protect, providerOnly, step2Services);
router.post("/onboarding/step/3",  protect, providerOnly, step3Documents);
router.post("/onboarding/step/4",  protect, providerOnly, step4WorkProofs);
router.post("/onboarding/step/5",  protect, providerOnly, step5BankDetails);
router.post("/onboarding/step/6",  protect, providerOnly, step6Availability);
router.post("/onboarding/step/7",  protect, providerOnly, step7Agreement);

module.exports = router;
