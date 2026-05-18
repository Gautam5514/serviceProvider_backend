const Provider = require("../models/Provider");
const ProviderRating = require("../models/ProviderRating");
const ProviderDocument = require("../models/ProviderDocument");
const ProviderAvailability = require("../models/ProviderAvailability");
const ProviderBankDetails = require("../models/ProviderBankDetails");
const ProviderWorkProof = require("../models/ProviderWorkProof");
const ProviderAgreement = require("../models/ProviderAgreement");

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

// Public — list approved active providers (customer-facing search)
const getProviders = async (req, res) => {
  try {
    const { city, service } = req.query;
    const filter = { isActive: true, onboardingStatus: "approved" };
    if (city) filter.city = new RegExp(city, "i");
    if (service) filter["services.category"] = service;

    const providers = await Provider.find(filter)
      .populate("userId", "fullName phone profilePhoto")
      .sort({ rating: -1, totalReviews: -1 });

    res.status(200).json({ success: true, providers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Protected — get own full profile including all onboarding data
const getProviderProfile = async (req, res) => {
  try {
    const provider = await Provider.findOne({ userId: req.user._id }).populate(
      "userId",
      "fullName email phone profilePhoto phoneVerified emailVerified createdAt"
    );

    if (!provider) {
      return res
        .status(404)
        .json({ success: false, message: "Provider profile not found" });
    }

    // Fetch all related onboarding data in parallel
    const [documents, availability, bankDetails, workProofs, agreement] =
      await Promise.all([
        ProviderDocument.find({ providerId: provider._id }),
        ProviderAvailability.findOne({ providerId: provider._id }),
        ProviderBankDetails.findOne({ providerId: provider._id }),
        ProviderWorkProof.find({ providerId: provider._id }),
        ProviderAgreement.findOne({ providerId: provider._id }),
      ]);

    const ratingStats = await ProviderRating.aggregate([
      { $match: { providerId: provider._id, isVisible: true, adminHidden: false } },
      { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);

    const nextRating = ratingStats.length ? Math.round(ratingStats[0].avg * 10) / 10 : 0;
    const nextTotalReviews = ratingStats.length ? ratingStats[0].count : 0;
    if (provider.rating !== nextRating || provider.totalReviews !== nextTotalReviews) {
      provider.rating = nextRating;
      provider.totalReviews = nextTotalReviews;
      await provider.save();
    }

    // Mask sensitive bank data
    const maskedBankDetails = bankDetails
      ? {
          accountHolderName: bankDetails.accountHolderName,
          accountNumberMasked: bankDetails.accountNumber
            ? `****${bankDetails.accountNumber.slice(-4)}`
            : "",
          ifscCode: bankDetails.ifscCode,
          upiId: bankDetails.upiId || "",
          pennyDropVerified: bankDetails.pennyDropVerified,
        }
      : null;

    res.status(200).json({
      success: true,
      provider,
      documents,
      availability,
      bankDetails: maskedBankDetails,
      workProofs,
      agreementSigned: !!agreement,
      agreementSignedAt: agreement?.acceptedAt || null,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Protected — update editable profile fields (Step 1 data)
const updateProviderProfile = async (req, res) => {
  try {
    const {
      city,
      serviceArea,
      about,
      alternatePhone,
      workingRadiusKm,
      gender,
      emergencyContact,
      languages,
      location,
    } = req.body;

    const provider = await Provider.findOne({ userId: req.user._id });
    if (!provider) {
      return res
        .status(404)
        .json({ success: false, message: "Provider profile not found" });
    }

    if (city !== undefined) provider.city = city;
    if (serviceArea !== undefined) provider.serviceArea = serviceArea;
    if (about !== undefined) provider.about = about;
    if (alternatePhone !== undefined) provider.alternatePhone = alternatePhone;
    if (workingRadiusKm !== undefined) provider.workingRadiusKm = workingRadiusKm;
    if (gender !== undefined) provider.gender = gender;
    if (emergencyContact !== undefined) provider.emergencyContact = emergencyContact;
    if (languages !== undefined) provider.languages = languages;
    Object.assign(provider, getLocationUpdate(location));

    await provider.save();

    res.status(200).json({ success: true, message: "Profile updated", provider });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Protected — update services list
const updateProviderServices = async (req, res) => {
  try {
    const { services } = req.body;

    if (!Array.isArray(services) || services.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "At least one service is required" });
    }

    const provider = await Provider.findOne({ userId: req.user._id });
    if (!provider) {
      return res
        .status(404)
        .json({ success: false, message: "Provider profile not found" });
    }

    provider.services = services;
    await provider.save();

    res
      .status(200)
      .json({ success: true, message: "Services updated", services: provider.services });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Protected — update availability settings
const updateProviderAvailability = async (req, res) => {
  try {
    const {
      workingType,
      availableDays,
      workingHoursFrom,
      workingHoursTo,
      travelRadiusKm,
      acceptsUrgentJobs,
      hasOwnVehicle,
      vehicleType,
      preferredLocations,
    } = req.body;

    const provider = await Provider.findOne({ userId: req.user._id });
    if (!provider) {
      return res
        .status(404)
        .json({ success: false, message: "Provider profile not found" });
    }

    const availability = await ProviderAvailability.findOneAndUpdate(
      { providerId: provider._id },
      {
        ...(workingType !== undefined && { workingType }),
        ...(availableDays !== undefined && { availableDays }),
        ...(workingHoursFrom !== undefined && { workingHoursFrom }),
        ...(workingHoursTo !== undefined && { workingHoursTo }),
        ...(travelRadiusKm !== undefined && { travelRadiusKm }),
        ...(acceptsUrgentJobs !== undefined && { acceptsUrgentJobs }),
        ...(hasOwnVehicle !== undefined && { hasOwnVehicle }),
        ...(vehicleType !== undefined && { vehicleType }),
        ...(preferredLocations !== undefined && { preferredLocations }),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ success: true, message: "Availability updated", availability });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getProviders,
  getProviderProfile,
  updateProviderProfile,
  updateProviderServices,
  updateProviderAvailability,
};
