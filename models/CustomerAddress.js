const mongoose = require("mongoose");

const CustomerAddressSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    label:       { type: String, enum: ["Home", "Work", "Other"], default: "Home" },
    fullAddress: { type: String, required: true, trim: true },
    city:        { type: String, required: true, trim: true },
    pincode:     { type: String, trim: true },
    lat:         { type: Number },
    lng:         { type: Number },
    isDefault:   { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Only one default per user
CustomerAddressSchema.index({ userId: 1 });

module.exports =
  mongoose.models.CustomerAddress ||
  mongoose.model("CustomerAddress", CustomerAddressSchema);
