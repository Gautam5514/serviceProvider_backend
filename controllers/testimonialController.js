const crypto      = require("crypto");
const Testimonial = require("../models/Testimonial");
const AppError    = require("../utils/AppError");
const catchAsync  = require("../utils/catchAsync");

// ─── Seed data ────────────────────────────────────────────────────────────────
// Inserted once if the collection has no seed rows.
const SEED_ROWS = [
  { name: "Priya Sharma",  city: "Mumbai",    rating: 5, avatar: "PS", category: "ac",          service: "AC Repair",          text: "Booked at 10 PM, technician was at my door by 9 AM. Fixed in under an hour. Pricing was exactly as shown — no hidden charges." },
  { name: "Rahul Verma",   city: "Bangalore", rating: 5, avatar: "RV", category: "electrical",  service: "Electrical Work",    text: "Had an electrical fault for weeks. The ServiceMarket technician diagnosed and fixed it in 30 minutes. Clean work, zero mess." },
  { name: "Anjali Mehra",  city: "Delhi",     rating: 4, avatar: "AM", category: "ac",          service: "AC Deep Cleaning",   text: "AC deep cleaning was incredibly thorough. Punctual, courteous, and my unit runs like new. Already re-booked for next season." },
  { name: "Vikram Goel",   city: "Hyderabad", rating: 5, avatar: "VG", category: "fridge",      service: "Fridge Repair",      text: "Our double-door fridge stopped cooling suddenly. The technician replaced the defrost heater quickly. Exceptional knowledge and service." },
  { name: "Sandhya R.",    city: "Chennai",   rating: 4, avatar: "SR", category: "appliance",   service: "Washing Machine",    text: "Very professional washing machine service. Explained the drum issue clearly and fixed it inside an hour. Highly recommended!" },
];

async function seedIfEmpty() {
  const count = await Testimonial.countDocuments({ isSeed: true });
  if (count === 0) {
    await Testimonial.insertMany(
      SEED_ROWS.map(r => ({ ...r, isSeed: true, isApproved: true }))
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashIp(ip = "") {
  return crypto.createHash("sha256").update(ip + "testimonial_salt").digest("hex");
}

function buildAvatar(name = "") {
  return name.trim().split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2) || "U";
}

// ─── GET /api/testimonials ────────────────────────────────────────────────────
// Public — returns approved testimonials and all seed rows.
// Seeded rows always appear; user-submitted rows need admin approval first.
const getPublicTestimonials = catchAsync(async (_req, res) => {
  await seedIfEmpty();

  const testimonials = await Testimonial.find({
    $or: [{ isApproved: true }, { isSeed: true }],
  })
    .select("name city rating avatar category service text createdAt")
    .sort({ isSeed: -1, createdAt: -1 })
    .limit(30)
    .lean();

  res.json({ success: true, testimonials });
});

// ─── POST /api/testimonials ───────────────────────────────────────────────────
// Public — anyone can submit a review. It goes into a moderation queue.
// Rate-limited: one submission per IP per 24 hours.
const submitTestimonial = catchAsync(async (req, res) => {
  const { name, city, rating, category, service, text } = req.body;

  if (!name?.trim())
    throw new AppError("Name is required.", 400);
  if (!text?.trim() || text.trim().length < 20)
    throw new AppError("Review must be at least 20 characters.", 400);
  if (!rating || Number(rating) < 1 || Number(rating) > 5)
    throw new AppError("Rating must be between 1 and 5.", 400);

  // One submission per IP per 24 hours
  const ipHash    = hashIp(req.ip || req.headers["x-forwarded-for"] || "");
  const since     = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentSub = await Testimonial.findOne({
    submitterIp: ipHash,
    createdAt:   { $gte: since },
  }).select("_id").lean();

  if (recentSub)
    throw new AppError("You can submit one review per day. Thank you for your feedback!", 429);

  await Testimonial.create({
    name:        name.trim(),
    city:        city?.trim() || "India",
    rating:      Math.round(Number(rating)),
    category:    category || "general",
    service:     service?.trim() || "",
    text:        text.trim(),
    avatar:      buildAvatar(name),
    submitterIp: ipHash,
    isApproved:  false,
  });

  res.status(201).json({
    success: true,
    message: "Thank you! Your review has been submitted and will appear after a quick approval check.",
  });
});

// ─── Admin: GET /api/testimonials/admin/pending ───────────────────────────────
const getPendingTestimonials = catchAsync(async (_req, res) => {
  const testimonials = await Testimonial.find({ isApproved: false, isSeed: false })
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, testimonials });
});

// ─── Admin: PUT /api/testimonials/:id/approve ────────────────────────────────
const approveTestimonial = catchAsync(async (req, res) => {
  const doc = await Testimonial.findByIdAndUpdate(
    req.params.id,
    { $set: { isApproved: true } },
    { new: true }
  );
  if (!doc) throw new AppError("Testimonial not found.", 404);
  res.json({ success: true, message: "Testimonial approved.", testimonial: doc });
});

// ─── Admin: DELETE /api/testimonials/:id ─────────────────────────────────────
const deleteTestimonial = catchAsync(async (req, res) => {
  const doc = await Testimonial.findByIdAndDelete(req.params.id);
  if (!doc) throw new AppError("Testimonial not found.", 404);
  res.json({ success: true, message: "Testimonial deleted." });
});

module.exports = {
  getPublicTestimonials,
  submitTestimonial,
  getPendingTestimonials,
  approveTestimonial,
  deleteTestimonial,
};
