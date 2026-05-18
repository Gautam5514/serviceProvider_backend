const mongoose = require("mongoose");

const CouponSchema = new mongoose.Schema(
  {
    code:         { type: String, required: true, unique: true, uppercase: true, trim: true },
    description:  { type: String, trim: true },
    discountType: { type: String, enum: ["percent", "flat"], required: true },
    discountValue:{ type: Number, required: true, min: 1 },
    minOrderValue:{ type: Number, default: 0 },
    maxUses:      { type: Number, default: null }, // null = unlimited
    usedCount:    { type: Number, default: 0 },
    expiresAt:    { type: Date, required: true },
    applicableCategories: {
      type: [String],
      enum: ["ac", "cooler", "fan", "tv", "electrical", "appliance"],
      default: [],            // empty = valid for all categories
    },
    isActive:     { type: Boolean, default: true },
    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

CouponSchema.index({ code: 1 });

module.exports = mongoose.models.Coupon || mongoose.model("Coupon", CouponSchema);
