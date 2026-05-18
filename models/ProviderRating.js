const mongoose = require("mongoose");

/*
 * One rating per customer per booking.
 * Provider's aggregate rating + totalReviews on Provider model
 * are updated after each new rating is saved.
 */

const ProviderRatingSchema = new mongoose.Schema(
  {
    // REQUIRED
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Provider",
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    // OPTIONAL
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking", // wire up when Booking model exists
    },
    review: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    // Quick tags customer can pick (helps surface quality signals)
    tags: {
      type: [String],
      enum: ["professional", "punctual", "skilled", "clean_work", "friendly", "value_for_money"],
      default: [],
    },

    // Moderation
    isVisible: {
      type: Boolean,
      default: true,
    },
    adminHidden: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// One rating per customer per booking
ProviderRatingSchema.index({ providerId: 1, customerId: 1, bookingId: 1 }, { unique: true, sparse: true });
ProviderRatingSchema.index({ providerId: 1, createdAt: -1 });

module.exports =
  mongoose.models.ProviderRating ||
  mongoose.model("ProviderRating", ProviderRatingSchema);
