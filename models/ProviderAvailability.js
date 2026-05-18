const mongoose = require("mongoose");

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const ProviderAvailabilitySchema = new mongoose.Schema(
  {
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Provider",
      required: true,
      unique: true,
    },
    workingType: {
      type: String,
      enum: ["full_time", "part_time"],
      required: true,
    },
    availableDays: {
      type: [{ type: String, enum: DAYS }],
      default: [],
    },
    workingHoursFrom: {
      type: String, // "09:00"
      required: true,
    },
    workingHoursTo: {
      type: String, // "18:00"
      required: true,
    },
    acceptsUrgentJobs: {
      type: Boolean,
      default: false,
    },
    travelRadiusKm: {
      type: Number,
      required: true,
      default: 10,
    },
    hasOwnVehicle: {
      type: Boolean,
      default: false,
    },
    vehicleType: {
      type: String,
      enum: ["bike", "scooter", "car", "cycle", "other"],
    },
    preferredLocations: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.ProviderAvailability ||
  mongoose.model("ProviderAvailability", ProviderAvailabilitySchema);
