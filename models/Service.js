const mongoose = require("mongoose");

const ServiceSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    slug:     { type: String, required: true, unique: true, trim: true, lowercase: true },
    category: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    description:   { type: String, trim: true },
    basePrice:     { type: Number, required: true, min: 0 },
    priceUnit:     { type: String, enum: ["per_visit", "per_hour"], default: "per_visit" },
    whatIsIncluded:{ type: [String], default: [] },
    estimatedDurationMinutes: { type: Number, default: 60 },
    images:        { type: [String], default: [] },
    isPopular:     { type: Boolean, default: false },
    sortOrder:     { type: Number, default: 0 },
    active:        { type: Boolean, default: true },
  },
  { timestamps: true }
);

ServiceSchema.index({ category: 1, active: 1, sortOrder: 1 });

module.exports =
  mongoose.models.Service || mongoose.model("Service", ServiceSchema);
