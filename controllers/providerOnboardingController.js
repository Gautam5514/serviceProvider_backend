const Provider = require("../models/Provider");
const ProviderDocument = require("../models/ProviderDocument");
const ProviderWorkProof = require("../models/ProviderWorkProof");
const ProviderBankDetails = require("../models/ProviderBankDetails");
const ProviderAvailability = require("../models/ProviderAvailability");
const ProviderAgreement = require("../models/ProviderAgreement");
const ProviderVerificationLog = require("../models/ProviderVerificationLog");
const User = require("../models/User");
const { createNotification } = require("../utils/notificationService");

// ─── Helper: log every status transition ────────────────────────────────────
async function logAction(providerId, action, previousStatus, newStatus, performedBy = null, remarks = null) {
  await ProviderVerificationLog.create({
    providerId,
    action,
    previousStatus,
    newStatus,
    performedBy,
    remarks,
  });
}

function getLocationUpdate(location) {
  if (!location) return {};
  const lat = Number(location.lat);
  const lng = Number(location.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return {};
  return {
    location: { type: "Point", coordinates: [lng, lat] },
    locationSource: ["gps", "ip", "manual", "fallback"].includes(location.source)
      ? location.source
      : "manual",
    locationUpdatedAt: new Date(),
  };
}

// ─── GET /onboarding/status ──────────────────────────────────────────────────
// Returns the provider's current step, status, and per-step completion summary.
const getOnboardingStatus = async (req, res) => {
  try {
    const userId = req.user._id;

    const provider = await Provider.findOne({ userId });

    if (!provider) {
      return res.status(200).json({
        success: true,
        onboardingStarted: false,
        currentStep: 1,
        message: "No profile found. Start from Step 1.",
      });
    }

    // Parallel fetch of all related records
    const [documents, workProofs, bankDetails, availability, agreement] = await Promise.all([
      ProviderDocument.find({ providerId: provider._id }),
      ProviderWorkProof.find({ providerId: provider._id }),
      ProviderBankDetails.findOne({ providerId: provider._id }),
      ProviderAvailability.findOne({ providerId: provider._id }),
      ProviderAgreement.findOne({ providerId: provider._id }),
    ]);

    const docTypes = documents.map((d) => d.docType);
    const mvpDocs = ["aadhaar", "pan", "selfie"];
    const missingMvpDocs = mvpDocs.filter((d) => !docTypes.includes(d));

    const steps = {
      1: {
        label: "Basic Profile",
        complete: !!provider.dateOfBirth && !!provider.city && !!provider.serviceArea,
      },
      2: {
        label: "Services & Skills",
        complete: provider.services.length > 0,
      },
      3: {
        label: "KYC Documents",
        complete: missingMvpDocs.length === 0,
        missingMvpDocs,
        uploadedDocs: docTypes,
      },
      4: {
        label: "Work Proofs",
        complete: workProofs.length > 0,
        count: workProofs.length,
        note: "Recommended, not required to proceed",
      },
      5: {
        label: "Bank Details",
        complete: !!bankDetails,
      },
      6: {
        label: "Availability",
        complete: !!availability,
      },
      7: {
        label: "Legal Agreement",
        complete: !!agreement,
      },
    };

    res.status(200).json({
      success: true,
      onboardingStarted: true,
      currentStep: provider.onboardingStep,
      onboardingStatus: provider.onboardingStatus,
      jobTier: provider.jobTier,
      isActive: provider.isActive,
      steps,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── STEP 1: Basic Profile ────────────────────────────────────────────────────
// Required: dateOfBirth, city, serviceArea, workingRadiusKm
// Optional: gender, emergencyContact, alternatePhone, languages, about
const step1Profile = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      dateOfBirth, city, serviceArea, workingRadiusKm,
      gender, emergencyContact, alternatePhone, languages, about, location,
    } = req.body;

    if (!dateOfBirth || !city || !serviceArea || !workingRadiusKm) {
      return res.status(400).json({
        success: false,
        message: "dateOfBirth, city, serviceArea and workingRadiusKm are required",
      });
    }

    let provider = await Provider.findOne({ userId });
    const previousStatus = provider?.onboardingStatus || "pending_profile";

    if (!provider) {
      provider = new Provider({ userId });
    }

    provider.dateOfBirth = dateOfBirth;
    provider.city = city;
    provider.serviceArea = serviceArea;
    provider.workingRadiusKm = workingRadiusKm;

    if (gender !== undefined) provider.gender = gender;
    if (emergencyContact !== undefined) provider.emergencyContact = emergencyContact;
    if (alternatePhone !== undefined) provider.alternatePhone = alternatePhone;
    if (languages !== undefined) provider.languages = languages;
    if (about !== undefined) provider.about = about;
    Object.assign(provider, getLocationUpdate(location));

    provider.onboardingStep = Math.max(provider.onboardingStep || 1, 2);
    provider.onboardingStatus = "profile_complete";

    await provider.save();
    await logAction(provider._id, "profile_submitted", previousStatus, "profile_complete");

    res.status(200).json({
      success: true,
      message: "Step 1 saved. Move to Step 2: Services & Skills.",
      nextStep: 2,
      provider,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── STEP 2: Services & Skills ────────────────────────────────────────────────
// Required: services[] — at least 1 service
// Each service: category, serviceName, experienceYears, skillLevel, hasOwnTools,
//               canProvideInstallationAndRepair
// Optional per service: previousCompany, canHandleEmergency
const step2Services = async (req, res) => {
  try {
    const userId = req.user._id;
    const { services } = req.body;

    if (!Array.isArray(services) || services.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one service is required",
      });
    }

    const requiredServiceFields = ["category", "serviceName", "experienceYears", "skillLevel"];
    for (const [i, svc] of services.entries()) {
      const missing = requiredServiceFields.filter((f) => svc[f] === undefined || svc[f] === "");
      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Service at index ${i} is missing: ${missing.join(", ")}`,
        });
      }
    }

    const provider = await Provider.findOne({ userId });
    if (!provider) {
      return res.status(400).json({
        success: false,
        message: "Complete Step 1 (Basic Profile) first",
      });
    }

    const previousStatus = provider.onboardingStatus;
    provider.services = services;
    provider.onboardingStep = Math.max(provider.onboardingStep, 3);

    await provider.save();
    await logAction(provider._id, "services_submitted", previousStatus, provider.onboardingStatus);

    res.status(200).json({
      success: true,
      message: "Step 2 saved. Move to Step 3: KYC Documents.",
      nextStep: 3,
      services: provider.services,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── STEP 3: KYC Documents ────────────────────────────────────────────────────
// Required: documents[] must include aadhaar, pan, selfie
// Each: { docType, fileUrl, docNumberMasked?, expiryDate? }
const step3Documents = async (req, res) => {
  try {
    const userId = req.user._id;
    const { documents } = req.body;

    if (!Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({
        success: false,
        message: "documents array is required",
      });
    }

    const provider = await Provider.findOne({ userId });
    if (!provider) {
      return res.status(400).json({ success: false, message: "Complete Step 1 first" });
    }

    // Check MVP docs are present in the submitted list
    const mvpDocs = ["aadhaar", "pan", "selfie"];
    const submittedTypes = documents.map((d) => d.docType);
    const missing = mvpDocs.filter((d) => !submittedTypes.includes(d));

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required documents: ${missing.join(", ")}`,
      });
    }

    // Validate each document has a fileUrl
    for (const doc of documents) {
      if (!doc.docType || !doc.fileUrl) {
        return res.status(400).json({
          success: false,
          message: "Each document needs docType and fileUrl",
        });
      }
    }

    // Upsert each document (allows re-upload)
    const ops = documents.map((doc) =>
      ProviderDocument.findOneAndUpdate(
        { providerId: provider._id, docType: doc.docType },
        {
          fileUrl: doc.fileUrl,
          docNumberMasked: doc.docNumberMasked,
          expiryDate: doc.expiryDate,
          status: "uploaded",
          adminRemarks: null,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    );
    const savedDocs = await Promise.all(ops);

    const previousStatus = provider.onboardingStatus;
    provider.onboardingStep = Math.max(provider.onboardingStep, 4);
    provider.onboardingStatus = "kyc_submitted";

    await provider.save();
    await logAction(provider._id, "kyc_submitted", previousStatus, "kyc_submitted");

    res.status(200).json({
      success: true,
      message: "Step 3 saved. Documents submitted for review. Move to Step 4: Work Proofs.",
      nextStep: 4,
      documents: savedDocs.map((d) => ({ docType: d.docType, status: d.status })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── STEP 4: Work Proofs ─────────────────────────────────────────────────────
// Recommended (not blocking). Can submit empty array to skip.
// Each proof: { proofType, fileUrl?, title?, description?,
//               referenceContactName?, referenceContactPhone? }
const step4WorkProofs = async (req, res) => {
  try {
    const userId = req.user._id;
    const { proofs = [] } = req.body;

    const provider = await Provider.findOne({ userId });
    if (!provider) {
      return res.status(400).json({ success: false, message: "Complete Step 1 first" });
    }

    const savedProofs = [];

    if (proofs.length > 0) {
      for (const proof of proofs) {
        if (!proof.proofType) {
          return res.status(400).json({ success: false, message: "Each proof needs a proofType" });
        }
        // reference_contact doesn't need a file
        if (proof.proofType !== "reference_contact" && !proof.fileUrl) {
          return res.status(400).json({
            success: false,
            message: `fileUrl is required for proofType "${proof.proofType}"`,
          });
        }

        const saved = await ProviderWorkProof.create({
          providerId: provider._id,
          proofType: proof.proofType,
          fileUrl: proof.fileUrl,
          title: proof.title,
          description: proof.description,
          referenceContactName: proof.referenceContactName,
          referenceContactPhone: proof.referenceContactPhone,
        });
        savedProofs.push(saved);
      }

      await logAction(provider._id, "work_proof_submitted", provider.onboardingStatus, provider.onboardingStatus);
    }

    provider.onboardingStep = Math.max(provider.onboardingStep, 5);
    await provider.save();

    res.status(200).json({
      success: true,
      message: proofs.length > 0
        ? `Step 4 saved. ${proofs.length} work proof(s) uploaded. Move to Step 5: Bank Details.`
        : "Step 4 skipped. Move to Step 5: Bank Details.",
      nextStep: 5,
      proofsUploaded: savedProofs.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── STEP 5: Bank Details ─────────────────────────────────────────────────────
// Required: accountHolderName, accountNumber, ifscCode
// Optional: upiId, cancelledChequeUrl
const step5BankDetails = async (req, res) => {
  try {
    const userId = req.user._id;
    const { accountHolderName, accountNumber, ifscCode, upiId, cancelledChequeUrl } = req.body;

    if (!accountHolderName || !accountNumber || !ifscCode) {
      return res.status(400).json({
        success: false,
        message: "accountHolderName, accountNumber and ifscCode are required",
      });
    }

    const provider = await Provider.findOne({ userId });
    if (!provider) {
      return res.status(400).json({ success: false, message: "Complete Step 1 first" });
    }

    const bankDetails = await ProviderBankDetails.findOneAndUpdate(
      { providerId: provider._id },
      {
        accountHolderName,
        accountNumber,
        ifscCode: ifscCode.toUpperCase(),
        upiId,
        cancelledChequeUrl,
        pennyDropVerified: false,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    provider.onboardingStep = Math.max(provider.onboardingStep, 6);
    await provider.save();

    await logAction(provider._id, "bank_details_submitted", provider.onboardingStatus, provider.onboardingStatus);

    res.status(200).json({
      success: true,
      message: "Step 5 saved. Move to Step 6: Availability.",
      nextStep: 6,
      bankDetails: {
        accountHolderName: bankDetails.accountHolderName,
        accountNumberMasked: `****${bankDetails.accountNumber.slice(-4)}`,
        ifscCode: bankDetails.ifscCode,
        upiId: bankDetails.upiId,
        pennyDropVerified: bankDetails.pennyDropVerified,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── STEP 6: Availability ─────────────────────────────────────────────────────
// Required: workingType, availableDays, workingHoursFrom, workingHoursTo, travelRadiusKm
// Optional: acceptsUrgentJobs, hasOwnVehicle, vehicleType, preferredLocations
const step6Availability = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      workingType, availableDays, workingHoursFrom, workingHoursTo, travelRadiusKm,
      acceptsUrgentJobs, hasOwnVehicle, vehicleType, preferredLocations,
    } = req.body;

    if (!workingType || !availableDays?.length || !workingHoursFrom || !workingHoursTo || !travelRadiusKm) {
      return res.status(400).json({
        success: false,
        message: "workingType, availableDays, workingHoursFrom, workingHoursTo and travelRadiusKm are required",
      });
    }

    const provider = await Provider.findOne({ userId });
    if (!provider) {
      return res.status(400).json({ success: false, message: "Complete Step 1 first" });
    }

    await ProviderAvailability.findOneAndUpdate(
      { providerId: provider._id },
      {
        workingType,
        availableDays,
        workingHoursFrom,
        workingHoursTo,
        travelRadiusKm,
        acceptsUrgentJobs: acceptsUrgentJobs ?? false,
        hasOwnVehicle: hasOwnVehicle ?? false,
        vehicleType,
        preferredLocations: preferredLocations ?? [],
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    provider.onboardingStep = Math.max(provider.onboardingStep, 7);
    await provider.save();

    res.status(200).json({
      success: true,
      message: "Step 6 saved. Move to Step 7: Legal Agreement.",
      nextStep: 7,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── STEP 7: Legal Agreement ─────────────────────────────────────────────────
// All 7 consent booleans must be explicitly true to proceed.
// This is the final step — triggers admin review.
const step7Agreement = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      termsAccepted,
      codeOfConductAccepted,
      customerSafetyAccepted,
      noDirectPaymentRuleAccepted,
      commissionPolicyAccepted,
      dataPrivacyConsent,
      bgvConsent,
    } = req.body;

    const allAccepted = [
      termsAccepted,
      codeOfConductAccepted,
      customerSafetyAccepted,
      noDirectPaymentRuleAccepted,
      commissionPolicyAccepted,
      dataPrivacyConsent,
      bgvConsent,
    ].every((v) => v === true);

    if (!allAccepted) {
      return res.status(400).json({
        success: false,
        message: "All agreements must be accepted to complete onboarding",
      });
    }

    const provider = await Provider.findOne({ userId });
    if (!provider) {
      return res.status(400).json({ success: false, message: "Complete Step 1 first" });
    }

    if (provider.onboardingStep < 6) {
      return res.status(400).json({
        success: false,
        message: `Complete all steps before submitting agreement. Currently on Step ${provider.onboardingStep}.`,
      });
    }

    // Upsert agreement with IP for legal record
    await ProviderAgreement.findOneAndUpdate(
      { providerId: provider._id },
      {
        termsAccepted,
        codeOfConductAccepted,
        customerSafetyAccepted,
        noDirectPaymentRuleAccepted,
        commissionPolicyAccepted,
        dataPrivacyConsent,
        bgvConsent,
        acceptedFromIp: req.ip,
        acceptedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    const previousStatus = provider.onboardingStatus;
    provider.onboardingStep = 7;
    provider.onboardingStatus = "background_check_pending";
    provider.onboardingCompletedAt = new Date();

    await provider.save();
    await logAction(
      provider._id,
      "agreement_accepted",
      previousStatus,
      "background_check_pending",
      null,
      "Provider completed all 7 onboarding steps. Pending admin review."
    );

    res.status(200).json({
      success: true,
      message: "Onboarding complete! Your profile is under review. We'll notify you once approved.",
      onboardingStatus: "background_check_pending",
    });

    try {
      const adminUser = await User.findOne({ role: "admin" });
      const providerUser = await User.findById(userId);
      if (adminUser) {
        await createNotification({
          recipientId: adminUser._id,
          recipientRole: "admin",
          type: "new_provider_onboard",
          title: "New Provider Application",
          message: `${providerUser?.fullName || "A new provider"} has submitted their onboarding application and is waiting for review.`,
          data: { providerId: provider._id },
        });
      }
    } catch (err) {
      console.error("Failed to send admin notification:", err);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getOnboardingStatus,
  step1Profile,
  step2Services,
  step3Documents,
  step4WorkProofs,
  step5BankDetails,
  step6Availability,
  step7Agreement,
};
