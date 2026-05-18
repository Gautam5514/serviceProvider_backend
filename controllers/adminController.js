const Provider = require("../models/Provider");
const User = require("../models/User");
const Booking = require("../models/Booking");
const Coupon = require("../models/Coupon");
const ProviderDocument = require("../models/ProviderDocument");
const ProviderWorkProof = require("../models/ProviderWorkProof");
const ProviderBankDetails = require("../models/ProviderBankDetails");
const ProviderAvailability = require("../models/ProviderAvailability");
const ProviderAgreement = require("../models/ProviderAgreement");
const { sendProviderDecisionEmail } = require("../utils/emailService");

// ─── GET /admin/providers/pending ────────────────────────────────────────────
const getPendingProviders = async (_req, res) => {
  try {
    const providers = await Provider.find({ isActive: false }).populate(
      "userId",
      "fullName email phone emailVerified createdAt"
    );
    res.status(200).json({ success: true, providers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

// ─── GET /admin/providers/approved ───────────────────────────────────────────
const getApprovedProviders = async (_req, res) => {
  try {
    const providers = await Provider.find({
      isActive: true,
      onboardingStatus: "approved",
    }).populate("userId", "fullName email phone emailVerified createdAt");
    res.status(200).json({ success: true, providers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

// ─── GET /admin/providers/:id ─────────────────────────────────────────────────
// Returns the provider + every related sub-document for the admin review page.
const getProviderDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const provider = await Provider.findById(id).populate(
      "userId",
      "fullName email phone emailVerified createdAt"
    );

    if (!provider) {
      return res.status(404).json({ success: false, message: "Provider not found" });
    }

    const [documents, workProofs, bankDetails, availability, agreement] =
      await Promise.all([
        ProviderDocument.find({ providerId: provider._id }).sort({ createdAt: 1 }),
        ProviderWorkProof.find({ providerId: provider._id }),
        ProviderBankDetails.findOne({ providerId: provider._id }),
        ProviderAvailability.findOne({ providerId: provider._id }),
        ProviderAgreement.findOne({ providerId: provider._id }),
      ]);

    res.status(200).json({
      success: true,
      provider: {
        ...provider.toObject(),
        documents,
        workProofs,
        bankDetails,
        availability,
        agreement,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

// ─── PUT /admin/providers/:id/verify ─────────────────────────────────────────
const verifyProvider = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    if (!["approved", "rejected", "suspended", "blocked"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const provider = await Provider.findById(id).populate(
      "userId",
      "fullName email"
    );

    if (!provider) {
      return res.status(404).json({ success: false, message: "Provider not found" });
    }

    provider.onboardingStatus = status;
    provider.isActive = status === "approved";
    if (status === "approved") {
      provider.onboardingCompletedAt = new Date();
    }
    await provider.save();

    // Fire-and-forget email — never block the API response on email failure
    sendProviderDecisionEmail(
      provider.userId.email,
      provider.userId.fullName,
      status,
      remarks || null
    ).catch((err) => console.error("Decision email failed:", err.message));

    res.status(200).json({
      success: true,
      message: `Provider ${status} successfully`,
      provider,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

// ─── GET /admin/analytics ─────────────────────────────────────────────────────
const getAnalytics = async (_req, res) => {
  try {
    const now       = new Date();
    const startOfDay= new Date(now); startOfDay.setHours(0,0,0,0);
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth= new Date(now.getFullYear(), now.getMonth(), 1);
    const start30   = new Date(now); start30.setDate(now.getDate() - 29);

    const [
      bookingsToday,
      bookingsWeek,
      bookingsMonth,
      bookingsTotal,
      pendingUnassigned,
      completedTotal,
      revenueMonth,
      revenueTotal,
      customersTotal,
      providersTotal,
      providersApproved,
      providersPending,
      signupsMonth,
      dailyCounts,
      categoryRevenue,
      topProviders,
    ] = await Promise.all([
      Booking.countDocuments({ createdAt: { $gte: startOfDay } }),
      Booking.countDocuments({ createdAt: { $gte: startOfWeek } }),
      Booking.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Booking.countDocuments(),
      Booking.countDocuments({ status: "pending", providerId: null }),
      Booking.countDocuments({ status: "completed" }),
      Booking.aggregate([
        { $match: { status: "completed", completedAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: "$pricing.totalAmount" } } },
      ]),
      Booking.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: null, total: { $sum: "$pricing.totalAmount" } } },
      ]),
      User.countDocuments({ role: "customer" }),
      User.countDocuments({ role: "provider" }),
      Provider.countDocuments({ isActive: true, onboardingStatus: "approved" }),
      Provider.countDocuments({ isActive: false, onboardingStatus: { $nin: ["approved","rejected","suspended","blocked"] } }),
      User.countDocuments({ createdAt: { $gte: startOfMonth } }),
      // Bookings per day last 30 days
      Booking.aggregate([
        { $match: { createdAt: { $gte: start30 } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      // Revenue by category
      Booking.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: "$serviceCategory", revenue: { $sum: "$pricing.totalAmount" }, count: { $sum: 1 } } },
        { $sort: { revenue: -1 } },
      ]),
      // Top 5 providers
      Provider.find({ isActive: true }).sort({ totalJobsCompleted: -1 }).limit(5)
        .populate("userId", "fullName email"),
    ]);

    res.json({
      success: true,
      stats: {
        bookings: { today: bookingsToday, week: bookingsWeek, month: bookingsMonth, total: bookingsTotal, pendingUnassigned, completed: completedTotal },
        revenue:  { month: revenueMonth[0]?.total || 0, total: revenueTotal[0]?.total || 0 },
        users:    { customers: customersTotal, providers: providersTotal, signupsMonth },
        providers:{ approved: providersApproved, pending: providersPending },
      },
      dailyCounts,
      categoryRevenue,
      topProviders,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Coupon management (admin) ────────────────────────────────────────────────
const { createCoupon, getAllCoupons, deleteCoupon } = require("./couponController");
const {
  getAdminServices,
  getAdminServiceCategories,
  createAdminService,
  updateAdminService,
  deleteAdminService,
} = require("./serviceController");

module.exports = {
  getPendingProviders,
  getProviderDetails,
  verifyProvider,
  getApprovedProviders,
  getAnalytics,
  createCoupon,
  getAllCoupons,
  deleteCoupon,
  getAdminServices,
  getAdminServiceCategories,
  createAdminService,
  updateAdminService,
  deleteAdminService,
};
