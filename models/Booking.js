const mongoose = require("mongoose");

const STATUSES = [
  "pending",          // created, waiting for provider acceptance
  "accepted",         // provider accepted
  "provider_on_way",  // provider marked "on the way"
  "in_progress",      // OTP verified by provider, work started
  "completed",        // job done
  "cancelled",        // cancelled by customer/provider/admin
  "disputed",         // complaint raised
];

const BookingSchema = new mongoose.Schema(
  {
    bookingNumber: {
      type: String,
      unique: true,
    },

    // ── Parties ──────────────────────────────────────────────────────────────
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Provider",
      default: null,
    },

    // ── Service details ───────────────────────────────────────────────────────
    serviceCategory: {
      type: String,
      enum: ["ac", "cooler", "fan", "tv", "fridge", "electrical", "appliance"],
      required: true,
    },
    serviceName: { type: String, required: true, trim: true },
    serviceSlug: { type: String, trim: true },

    // ── Scheduling ────────────────────────────────────────────────────────────
    scheduledDate:     { type: Date,   required: true },
    scheduledTimeSlot: { type: String, required: true }, // "09:00"

    // ── Address ───────────────────────────────────────────────────────────────
    address: {
      text:    { type: String, required: true },
      city:    { type: String },
      pincode: { type: String },
      lat:     { type: Number },
      lng:     { type: Number },
    },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: STATUSES,
      default: "pending",
    },

    // ── Pricing ───────────────────────────────────────────────────────────────
    pricing: {
      basePrice:   { type: Number, required: true },
      platformFee: { type: Number, default: 0 },
      tax:         { type: Number, default: 0 },
      discount:    { type: Number, default: 0 },
      totalAmount: { type: Number, required: true },
    },

    // ── Payment ───────────────────────────────────────────────────────────────
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "refunded"],
      default: "unpaid",
    },
    paymentMethod: {
      type: String,
      enum: ["cash_on_delivery", "online"],
      default: "cash_on_delivery",
    },

    // ── Completion OTP ────────────────────────────────────────────────────────
    // Customer shows this to provider at doorstep to verify & start the job
    completionOtp:         { type: String },
    completionOtpVerified: { type: Boolean, default: false },

    // ── Cancellation ──────────────────────────────────────────────────────────
    cancelledBy:  { type: String, enum: ["customer", "provider", "admin"] },
    cancelReason: { type: String, trim: true },
    cancelledAt:  { type: Date },

    // ── Completion ────────────────────────────────────────────────────────────
    completedAt: { type: Date },

    // ── Rating ────────────────────────────────────────────────────────────────
    ratingId: { type: mongoose.Schema.Types.ObjectId, ref: "ProviderRating" },
    isRated:  { type: Boolean, default: false },

    // ── Provider live location (broadcast via Socket.io when on the way) ─────────
    providerCurrentLocation: {
      lat:       { type: Number },
      lng:       { type: Number },
      updatedAt: { type: Date },
    },

    // ── Notes ─────────────────────────────────────────────────────────────────
    customerNote: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

// Auto-generate booking number before save
BookingSchema.pre("save", function (next) {
  if (!this.bookingNumber) {
    const d   = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const rnd = Math.floor(1000 + Math.random() * 9000);
    this.bookingNumber = `BK${ymd}${rnd}`;
  }
  next();
});

BookingSchema.index({ customerId: 1, createdAt: -1 });
BookingSchema.index({ providerId: 1, status: 1 });
BookingSchema.index({ status: 1 });
BookingSchema.index({ "address.lat": 1, "address.lng": 1 });

module.exports =
  mongoose.models.Booking || mongoose.model("Booking", BookingSchema);
