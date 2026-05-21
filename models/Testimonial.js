const mongoose = require("mongoose");

const SERVICE_CATEGORIES = ["ac", "cooler", "fan", "tv", "fridge", "electrical", "appliance", "general"];

const TestimonialSchema = new mongoose.Schema(
  {
    name:       { type: String, required: true, trim: true, maxlength: 60 },
    city:       { type: String, required: true, trim: true, maxlength: 40 },
    rating:     { type: Number, required: true, min: 1, max: 5 },
    category:   { type: String, enum: SERVICE_CATEGORIES, default: "general" },
    service:    { type: String, trim: true, maxlength: 80, default: "" },
    text:       { type: String, required: true, trim: true, minlength: 20, maxlength: 600 },
    avatar:     { type: String, trim: true, maxlength: 10 }, // 1–2 initials

    // Moderation
    isApproved:  { type: Boolean, default: false },
    isSeed:      { type: Boolean, default: false }, // seed rows bypass approval check

    // Rate-limiting: one submission per IP per 24 h (hashed before storage)
    submitterIp: { type: String, select: false },
  },
  { timestamps: true }
);

TestimonialSchema.index({ isApproved: 1, isSeed: 1, createdAt: -1 });

module.exports =
  mongoose.models.Testimonial || mongoose.model("Testimonial", TestimonialSchema);
