const ProviderRating = require("../models/ProviderRating");
const Provider       = require("../models/Provider");
const Booking        = require("../models/Booking");
const mongoose       = require("mongoose");

// ─── POST /api/ratings ────────────────────────────────────────────────────────
// Customer submits a rating after job completion.
const submitRating = async (req, res) => {
  try {
    const customerId = req.user._id;
    const { bookingId, rating, review, tags } = req.body;

    if (!bookingId || !rating)
      return res.status(400).json({ success: false, message: "bookingId and rating are required." });
    if (rating < 1 || rating > 5)
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5." });

    const booking = await Booking.findById(bookingId);
    if (!booking)
      return res.status(404).json({ success: false, message: "Booking not found." });
    if (booking.customerId.toString() !== customerId.toString())
      return res.status(403).json({ success: false, message: "You can only rate your own bookings." });
    if (booking.status !== "completed")
      return res.status(400).json({ success: false, message: "You can only rate completed bookings." });
    if (booking.isRated)
      return res.status(409).json({ success: false, message: "You have already rated this booking." });
    const providerId = booking.providerId?._id || booking.providerId;
    if (!providerId)
      return res.status(400).json({ success: false, message: "No provider assigned to this booking." });
    if (!mongoose.Types.ObjectId.isValid(providerId))
      return res.status(400).json({ success: false, message: "Invalid provider on this booking." });

    const ratingDoc = await ProviderRating.create({
      providerId,
      customerId,
      bookingId,
      rating:  Number(rating),
      review:  review?.trim() || "",
      tags:    Array.isArray(tags) ? tags : [],
    });

    // Mark booking as rated
    booking.isRated  = true;
    booking.ratingId = ratingDoc._id;
    await booking.save();

    // Recompute provider's aggregate rating from all reviews
    const stats = await ProviderRating.aggregate([
      { $match: { providerId: new mongoose.Types.ObjectId(providerId), isVisible: true, adminHidden: false } },
      { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);

    if (stats.length > 0) {
      await Provider.findByIdAndUpdate(providerId, {
        rating:       Math.round(stats[0].avg * 10) / 10,
        totalReviews: stats[0].count,
      });
    }

    res.status(201).json({ success: true, message: "Rating submitted. Thank you!", rating: ratingDoc });
  } catch (error) {
    if (error.code === 11000)
      return res.status(409).json({ success: false, message: "You have already rated this booking." });
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/ratings/provider/:providerId ────────────────────────────────────
const getProviderRatings = async (req, res) => {
  try {
    const { providerId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const ratings = await ProviderRating.find({
      providerId,
      isVisible:   true,
      adminHidden: false,
    })
      .populate("customerId", "fullName")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await ProviderRating.countDocuments({ providerId, isVisible: true, adminHidden: false });

    // Star breakdown
    const breakdown = await ProviderRating.aggregate([
      { $match: { providerId: require("mongoose").Types.ObjectId.createFromHexString(providerId), isVisible: true, adminHidden: false } },
      { $group: { _id: "$rating", count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]);

    const starMap = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    breakdown.forEach(b => { starMap[b._id] = b.count; });

    res.json({ success: true, ratings, total, page: Number(page), starBreakdown: starMap });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { submitRating, getProviderRatings };
