const Booking  = require("../models/Booking");
const Provider = require("../models/Provider");
const User     = require("../models/User");
const catchAsync = require("../utils/catchAsync");

// GET /api/stats/public — real numbers shown on the landing page
const getPublicStats = catchAsync(async (_req, res) => {
  const [bookingsDone, verifiedProviders, customers] = await Promise.all([
    Booking.countDocuments({ status: "completed" }),
    Provider.countDocuments({ isActive: true, onboardingStatus: "approved" }),
    User.countDocuments({ role: "customer" }),
  ]);

  res.json({
    success:          true,
    bookingsDone,
    verifiedProviders,
    customers,
    citiesCovered:    25, // updated manually as expansion happens
  });
});

module.exports = { getPublicStats };
