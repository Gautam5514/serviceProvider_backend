const Booking          = require("../models/Booking");
const Provider         = require("../models/Provider");
const ProviderRating   = require("../models/ProviderRating");
const User             = require("../models/User");
const Coupon           = require("../models/Coupon");
const ProviderAvailability = require("../models/ProviderAvailability");
const {
  sendJobCompletedEmail,
} = require("../utils/emailService");
const { createNotification, notifyMany } = require("../utils/notificationService");

const DAY_MAP = ["sun","mon","tue","wed","thu","fri","sat"];

function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function normalizeText(value = "") {
  return String(value).trim().toLowerCase();
}

const SERVICE_CATEGORY_KEYWORDS = {
  ac: ["ac", "a/c", "air conditioner", "air conditioning", "hvac"],
  cooler: ["cooler", "air cooler"],
  fan: ["fan", "ceiling fan", "table fan", "exhaust"],
  tv: ["tv", "television", "led", "display"],
  fridge: ["fridge", "refrigerator", "freezer"],
  electrical: ["electric", "electrical", "wiring", "switch", "socket", "mcb"],
  appliance: ["appliance", "fridge", "refrigerator", "washing", "geyser", "microwave"],
};

function getProviderServiceCategories(provider) {
  const categories = new Set();

  for (const service of provider?.services || []) {
    if (service.category) categories.add(service.category);

    const searchable = normalizeText([
      service.serviceName,
      service.previousCompany,
    ].filter(Boolean).join(" "));

    for (const [category, keywords] of Object.entries(SERVICE_CATEGORY_KEYWORDS)) {
      if (keywords.some((keyword) => searchable.includes(keyword))) {
        categories.add(category);
      }
    }
  }

  return [...categories];
}

function providerCanServeCategory(provider, category) {
  return getProviderServiceCategories(provider).includes(category);
}

function getProviderCoords(provider) {
  const coords = provider?.location?.coordinates;
  if (!Array.isArray(coords) || coords.length !== 2) return null;
  const [lng, lat] = coords.map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function getBookingCoords(booking) {
  const lat = Number(booking?.address?.lat);
  const lng = Number(booking?.address?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function distanceKm(a, b) {
  const toRad = (v) => (v * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function providerRadiusKm(provider, availability) {
  return Number(availability?.travelRadiusKm || provider?.workingRadiusKm || 10);
}

function textLocationMatches(provider, availability, booking) {
  const city = normalizeText(provider.city);
  const serviceArea = normalizeText(provider.serviceArea);
  const preferred = (availability?.preferredLocations || []).map(normalizeText);
  const bookingCity = normalizeText(booking.address?.city);
  const bookingText = normalizeText(booking.address?.text);

  if (city && bookingCity && (bookingCity.includes(city) || city.includes(bookingCity))) return true;
  if (serviceArea && bookingText.includes(serviceArea)) return true;
  return preferred.some((loc) => loc && (bookingText.includes(loc) || bookingCity.includes(loc)));
}

function jobMatchesProviderLocation(provider, availability, booking) {
  const textMatches = textLocationMatches(provider, availability, booking);
  const p = getProviderCoords(provider);
  const b = getBookingCoords(booking);
  if (p && b) {
    const km = distanceKm(p, b);
    return {
      matches: km <= providerRadiusKm(provider, availability) || textMatches,
      distanceKm: km,
    };
  }
  return { matches: textMatches, distanceKm: null };
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

// Find the best available provider for a booking
async function autoAssignProvider(serviceCategory, scheduledDate, address = {}, scheduledTimeSlot = null) {
  const dayOfWeek = DAY_MAP[new Date(scheduledDate).getDay()];

  const providers = await Provider.find({
    isActive: true,
    onboardingStatus: "approved",
  }).sort({ rating: -1, totalJobsCompleted: -1 });

  const bookingLike = { address, scheduledTimeSlot };
  const matches = [];

  for (const p of providers) {
    if (!providerCanServeCategory(p, serviceCategory)) continue;

    const av = await ProviderAvailability.findOne({ providerId: p._id });
    if (av && av.availableDays.includes(dayOfWeek)) {
      const locationMatch = jobMatchesProviderLocation(p, av, bookingLike);
      if (!locationMatch.matches) continue;

      // Make sure provider doesn't already have a booking at the same slot
      const conflict = await Booking.findOne({
        providerId: p._id,
        scheduledDate: new Date(scheduledDate),
        ...(bookingLike.scheduledTimeSlot && { scheduledTimeSlot: bookingLike.scheduledTimeSlot }),
        status: { $in: ["pending", "accepted", "provider_on_way", "in_progress"] },
      });
      if (!conflict) matches.push({ provider: p, distanceKm: locationMatch.distanceKm });
    }
  }

  matches.sort((a, b) => {
    if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
    if (a.distanceKm !== null) return -1;
    if (b.distanceKm !== null) return 1;
    return (b.provider.rating || 0) - (a.provider.rating || 0);
  });

  return matches[0]?.provider || null;
}

async function getMatchingProvidersForBooking(booking) {
  const dayOfWeek = DAY_MAP[new Date(booking.scheduledDate).getDay()];
  const providers = await Provider.find({
    isActive: true,
    onboardingStatus: "approved",
  }).select("userId services city serviceArea location workingRadiusKm");

  const matches = [];
  for (const provider of providers) {
    if (!providerCanServeCategory(provider, booking.serviceCategory)) continue;

    const availability = await ProviderAvailability.findOne({ providerId: provider._id });
    if (!availability?.availableDays?.includes(dayOfWeek)) continue;

    const locationMatch = jobMatchesProviderLocation(provider, availability, booking);
    if (!locationMatch.matches) continue;

    matches.push({ provider, distanceKm: locationMatch.distanceKm });
  }

  return matches.sort((a, b) => {
    if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
    if (a.distanceKm !== null) return -1;
    if (b.distanceKm !== null) return 1;
    return 0;
  });
}

// ─── POST /api/bookings ───────────────────────────────────────────────────────
const createBooking = async (req, res) => {
  try {
    const customerId = req.user._id;
    const {
      serviceCategory, serviceName, serviceSlug,
      scheduledDate, scheduledTimeSlot,
      address, pricing, customerNote, paymentMethod,
    } = req.body;

    if (!serviceCategory || !serviceName || !scheduledDate || !scheduledTimeSlot || !address?.text || !pricing?.basePrice) {
      return res.status(400).json({ success: false, message: "Missing required booking fields" });
    }

    const basePrice   = Number(pricing.basePrice);
    const platformFee = Math.round(basePrice * 0.1);       // 10% platform fee
    const tax         = Math.round((basePrice + platformFee) * 0.18); // 18% GST
    const totalAmount = basePrice + platformFee + tax;

    // New bookings enter the broadcast pool. Every matching provider can see it;
    // the first provider to claim it becomes the assigned technician.
    const provider = null;

    // Apply coupon discount if provided
    let discount = 0;
    let couponCode = null;
    if (req.body.couponCode) {
      const coupon = await Coupon.findOne({ code: req.body.couponCode.toUpperCase().trim(), isActive: true });
      if (coupon && new Date() < coupon.expiresAt && (coupon.maxUses === null || coupon.usedCount < coupon.maxUses)) {
        discount = coupon.discountType === "percent"
          ? Math.round((basePrice * coupon.discountValue) / 100)
          : coupon.discountValue;
        couponCode = coupon.code;
        await Coupon.findByIdAndUpdate(coupon._id, { $inc: { usedCount: 1 } });
      }
    }

    const finalTotal = Math.max(0, totalAmount - discount);

    const booking = await Booking.create({
      customerId,
      providerId:      provider?._id || null,
      serviceCategory, serviceName, serviceSlug: serviceSlug || "",
      scheduledDate:   new Date(scheduledDate),
      scheduledTimeSlot,
      address,
      pricing:         { basePrice, platformFee, tax, discount, totalAmount: finalTotal },
      paymentStatus:   "unpaid",
      paymentMethod:   paymentMethod || "cash_on_delivery",
      completionOtp:   generateOTP(),
      customerNote:    customerNote || "",
      status:          "pending",
    });

    createNotification({
      recipientId: customerId,
      recipientRole: "customer",
      type: "booking_created",
      title: "Booking created",
      message: "Your request is live. Nearby verified providers are being notified now.",
      bookingId: booking._id,
    }).catch(console.error);

    getMatchingProvidersForBooking(booking)
      .then((matches) => notifyMany(matches.map(({ provider, distanceKm }) => ({
        recipientId: provider.userId,
        recipientRole: "provider",
        type: "new_job_available",
        title: "New job near you",
        message: `${booking.serviceName} is available in ${booking.address?.city || "your service area"}. Confirm first to claim it.`,
        bookingId: booking._id,
        data: {
          distanceKm: distanceKm === null ? null : Number(distanceKm.toFixed(1)),
          serviceCategory: booking.serviceCategory,
        },
      }))))
      .catch(console.error);

    res.status(201).json({
      success: true,
      message: "Booking created. We are notifying nearby providers.",
      booking,
      providerAssigned: false,
      couponApplied: couponCode,
      discount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/bookings/my ─────────────────────────────────────────────────────
const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ customerId: req.user._id })
      .populate("providerId", "city serviceArea services")
      .populate({ path: "providerId", populate: { path: "userId", select: "fullName phone" } })
      .sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/bookings/:id ────────────────────────────────────────────────────
const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate({ path: "providerId", populate: { path: "userId", select: "fullName phone" } })
      .populate("customerId", "fullName phone");

    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    const userId     = req.user._id.toString();
    const isCustomer = booking.customerId?._id?.toString() === userId || booking.customerId?.toString() === userId;
    const isProvider = booking.providerId?.userId?._id?.toString() === userId;
    const isAdmin    = req.user.role === "admin";

    if (!isCustomer && !isProvider && !isAdmin) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Hide OTP from provider (customer sees it, provider enters it to verify)
    const data = booking.toObject();
    if (isProvider && !isCustomer) delete data.completionOtp;

    res.json({ success: true, booking: data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PUT /api/bookings/:id/cancel ─────────────────────────────────────────────
const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    const userId     = req.user._id.toString();
    const isCustomer = booking.customerId?.toString() === userId;
    const isAdmin    = req.user.role === "admin";

    if (!isCustomer && !isAdmin) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    if (["completed","cancelled"].includes(booking.status)) {
      return res.status(400).json({ success: false, message: `Cannot cancel a ${booking.status} booking` });
    }

    booking.status      = "cancelled";
    booking.cancelledBy = isAdmin ? "admin" : "customer";
    booking.cancelReason= req.body.reason || "";
    booking.cancelledAt = new Date();
    await booking.save();

    res.json({ success: true, message: "Booking cancelled", booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/bookings/provider/jobs ─────────────────────────────────────────
const getProviderJobs = async (req, res) => {
  try {
    const provider = await Provider.findOne({ userId: req.user._id });
    if (!provider) return res.status(404).json({ success: false, message: "Provider profile not found" });

    const { status } = req.query;
    const filter = { providerId: provider._id };
    if (status) filter.status = status;

    const jobs = await Booking.find(filter)
      .populate("customerId", "fullName phone")
      .populate("ratingId", "rating review tags createdAt")
      .sort({ scheduledDate: 1, createdAt: -1 })
      .lean();

    const ratings = await ProviderRating.find({
      providerId: provider._id,
      bookingId: { $in: jobs.map((job) => job._id) },
      isVisible: true,
      adminHidden: false,
    }).select("bookingId rating review tags createdAt").lean();

    const ratingByBooking = new Map(ratings.map((rating) => [rating.bookingId.toString(), rating]));
    const jobsWithRatings = jobs.map((job) => {
      const ratingDoc = job.ratingId || ratingByBooking.get(job._id.toString()) || null;
      return {
        ...job,
        ratingId: ratingDoc,
        rating: ratingDoc?.rating || null,
        review: ratingDoc?.review || "",
        ratingTags: ratingDoc?.tags || [],
      };
    });

    res.json({ success: true, jobs: jobsWithRatings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PUT /api/bookings/:id/accept ─────────────────────────────────────────────
const acceptJob = async (req, res) => {
  try {
    const provider = await Provider.findOne({ userId: req.user._id });
    if (!provider) return res.status(404).json({ success: false, message: "Provider profile not found" });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    if (booking.providerId?.toString() !== provider._id.toString()) {
      return res.status(403).json({ success: false, message: "This job is not assigned to you" });
    }
    if (booking.status !== "pending") {
      return res.status(400).json({ success: false, message: `Cannot accept a booking with status: ${booking.status}` });
    }

    booking.status = "accepted";
    await booking.save();

    const [customer, providerUser] = await Promise.all([
      User.findById(booking.customerId).select("fullName"),
      User.findById(provider.userId).select("fullName"),
    ]);
    createNotification({
      recipientId: booking.customerId,
      recipientRole: "customer",
      type: "job_claimed",
      title: "Your provider is ready",
      message: `${providerUser?.fullName || "Your technician"} confirmed your booking and will prepare for the visit.`,
      bookingId: booking._id,
    }).catch(console.error);

    res.json({ success: true, message: "Job accepted", booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PUT /api/bookings/:id/reject ─────────────────────────────────────────────
const rejectJob = async (req, res) => {
  try {
    const provider = await Provider.findOne({ userId: req.user._id });
    if (!provider) return res.status(404).json({ success: false, message: "Provider profile not found" });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    if (booking.providerId?.toString() !== provider._id.toString()) {
      return res.status(403).json({ success: false, message: "This job is not assigned to you" });
    }
    if (!["pending","accepted"].includes(booking.status)) {
      return res.status(400).json({ success: false, message: "Cannot reject this booking" });
    }

    // Unassign provider and try to find another
    booking.providerId  = null;
    booking.status      = "pending";
    booking.cancelledBy = undefined;
    await booking.save();

    res.json({ success: true, message: "Job released back to nearby providers", booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PUT /api/bookings/:id/on-way ─────────────────────────────────────────────
const markOnWay = async (req, res) => {
  try {
    const provider = await Provider.findOne({ userId: req.user._id });
    const booking  = await Booking.findById(req.params.id);
    if (!booking || booking.providerId?.toString() !== provider?._id?.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    if (booking.status !== "accepted") {
      return res.status(400).json({ success: false, message: "Accept the job first" });
    }
    booking.status = "provider_on_way";
    await booking.save();
    createNotification({
      recipientId: booking.customerId,
      recipientRole: "customer",
      type: "provider_on_way",
      title: "Provider on the way",
      message: "Your technician has started heading to your location.",
      bookingId: booking._id,
    }).catch(console.error);
    res.json({ success: true, message: "Customer notified you are on the way", booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PUT /api/bookings/:id/start ──────────────────────────────────────────────
// Provider arrives, customer gives OTP → provider enters it to start job
const startJob = async (req, res) => {
  try {
    const provider = await Provider.findOne({ userId: req.user._id });
    const booking  = await Booking.findById(req.params.id);
    if (!booking || booking.providerId?.toString() !== provider?._id?.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    if (!["accepted","provider_on_way"].includes(booking.status)) {
      return res.status(400).json({ success: false, message: "Invalid status to start job" });
    }

    const { otp } = req.body;
    if (!otp) return res.status(400).json({ success: false, message: "OTP is required" });
    if (otp !== booking.completionOtp) {
      return res.status(400).json({ success: false, message: "Incorrect OTP. Please ask the customer to check their booking." });
    }

    booking.status = "in_progress";
    booking.completionOtpVerified = true;
    await booking.save();
    createNotification({
      recipientId: booking.customerId,
      recipientRole: "customer",
      type: "job_started",
      title: "Work started",
      message: "Your OTP was verified and the service is now in progress.",
      bookingId: booking._id,
    }).catch(console.error);
    res.json({ success: true, message: "OTP verified. Job started!", booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PUT /api/bookings/:id/complete ──────────────────────────────────────────
const completeJob = async (req, res) => {
  try {
    const provider = await Provider.findOne({ userId: req.user._id });
    const booking  = await Booking.findById(req.params.id);
    if (!booking || booking.providerId?.toString() !== provider?._id?.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    if (booking.status !== "in_progress") {
      return res.status(400).json({ success: false, message: "Start the job first by verifying the OTP" });
    }

    booking.status      = "completed";
    booking.completedAt = new Date();
    // For cash on delivery, mark as paid on completion
    if (booking.paymentMethod === "cash_on_delivery") {
      booking.paymentStatus = "paid";
    }
    await booking.save();

    // Update provider stats
    await Provider.findByIdAndUpdate(provider._id, { $inc: { totalJobsCompleted: 1 } });

    createNotification({
      recipientId: booking.customerId,
      recipientRole: "customer",
      type: "invoice_ready",
      title: "Invoice ready",
      message: "Your service is complete. The invoice is ready for your records.",
      bookingId: booking._id,
    }).catch(console.error);

    createNotification({
      recipientId: provider.userId,
      recipientRole: "provider",
      type: "job_completed",
      title: "Job completed",
      message: `${booking.serviceName} has been marked complete.`,
      bookingId: booking._id,
    }).catch(console.error);

    // Completion is the one lifecycle email we keep: it acts as a receipt/invoice record.
    const [customer, providerUser] = await Promise.all([
      User.findById(booking.customerId).select("fullName email"),
      User.findById(provider.userId).select("fullName phone"),
    ]);
    if (customer?.email) {
      sendJobCompletedEmail(customer.email, customer.fullName, booking, {
        providerName: providerUser?.fullName,
        providerPhone: providerUser?.phone,
      }).catch(console.error);
    }

    res.json({ success: true, message: "Job completed successfully!", booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/bookings (admin) ────────────────────────────────────────────────
const getAllBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const bookings = await Booking.find(filter)
      .populate("customerId", "fullName phone email")
      .populate({ path: "providerId", populate: { path: "userId", select: "fullName phone" } })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Booking.countDocuments(filter);
    res.json({ success: true, bookings, total, page: Number(page) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/bookings/provider/available ─────────────────────────────────────
// Returns unassigned bookings in the provider's city + matching their service
// categories. Provider can "pick up" any of these.
const getAvailableJobs = async (req, res) => {
  try {
    const provider = await Provider.findOne({ userId: req.user._id });
    if (!provider)
      return res.status(404).json({ success: false, message: "Provider profile not found" });
    if (!provider.isActive || provider.onboardingStatus !== "approved")
      return res.json({ success: true, jobs: [], message: "Your profile must be approved to see available jobs." });

    const myCategories = getProviderServiceCategories(provider);
    if (myCategories.length === 0)
      return res.json({ success: true, jobs: [], message: "Add services to your profile to see matching jobs." });

    const availability = await ProviderAvailability.findOne({ providerId: provider._id });

    const jobs = await Booking.find({
      providerId: null,
      status:    "pending",
      serviceCategory: { $in: myCategories },
      scheduledDate: { $gte: startOfToday() }, // include today's bookings stored at midnight
    })
      .populate("customerId", "fullName")
      .sort({ scheduledDate: 1, createdAt: 1 })
      .limit(80);

    const matchedJobs = jobs
      .map((job) => {
        const match = jobMatchesProviderLocation(provider, availability, job);
        return { job, match };
      })
      .filter(({ match }) => match.matches)
      .sort((a, b) => {
        if (a.match.distanceKm !== null && b.match.distanceKm !== null) {
          return a.match.distanceKm - b.match.distanceKm;
        }
        if (a.match.distanceKm !== null) return -1;
        if (b.match.distanceKm !== null) return 1;
        return new Date(a.job.scheduledDate) - new Date(b.job.scheduledDate);
      })
      .slice(0, 20)
      .map(({ job, match }) => ({
        ...job.toObject(),
        matchDistanceKm: match.distanceKm === null ? null : Number(match.distanceKm.toFixed(1)),
      }));

    const message = matchedJobs.length === 0 && jobs.length > 0
      ? "Open jobs exist for your services, but none matched your city, service area, or working radius. Update your current location or increase your radius."
      : "";

    res.json({ success: true, jobs: matchedJobs, message, matchedCategories: myCategories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PUT /api/bookings/:id/pickup ─────────────────────────────────────────────
// Provider claims an unassigned booking from the job pool.
const pickupJob = async (req, res) => {
  try {
    const provider = await Provider.findOne({ userId: req.user._id });
    if (!provider)
      return res.status(404).json({ success: false, message: "Provider profile not found" });
    if (!provider.isActive || provider.onboardingStatus !== "approved")
      return res.status(403).json({ success: false, message: "Your profile must be approved to accept jobs." });

    const booking = await Booking.findById(req.params.id);
    if (!booking)
      return res.status(404).json({ success: false, message: "Booking not found." });
    if (booking.status !== "pending")
      return res.status(400).json({ success: false, message: "This booking is no longer available." });
    if (booking.providerId)
      return res.status(409).json({ success: false, message: "This job was just claimed by another provider. Please check other available jobs." });

    if (!providerCanServeCategory(provider, booking.serviceCategory)) {
      return res.status(403).json({
        success: false,
        message: "This job does not match your approved service categories.",
      });
    }

    const availability = await ProviderAvailability.findOne({ providerId: provider._id });
    const locationMatch = jobMatchesProviderLocation(provider, availability, booking);
    if (!locationMatch.matches) {
      return res.status(403).json({
        success: false,
        message: "This job is outside your service location or working radius.",
      });
    }

    booking.providerId = provider._id;
    booking.status     = "accepted"; // picked up = immediately accepted
    await booking.save();

    const [customer, providerUser] = await Promise.all([
      User.findById(booking.customerId).select("fullName"),
      User.findById(provider.userId).select("fullName"),
    ]);
    createNotification({
      recipientId: booking.customerId,
      recipientRole: "customer",
      type: "job_claimed",
      title: "Your provider is ready",
      message: `${providerUser?.fullName || "Your technician"} confirmed your booking and will prepare for the visit.`,
      bookingId: booking._id,
    }).catch(console.error);

    createNotification({
      recipientId: provider.userId,
      recipientRole: "provider",
      type: "job_claimed",
      title: "Job confirmed",
      message: `${booking.serviceName} is now assigned to you.`,
      bookingId: booking._id,
    }).catch(console.error);

    res.json({ success: true, message: "Job picked up! It has been added to your active jobs.", booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking,
  getProviderJobs,
  getAvailableJobs,
  pickupJob,
  acceptJob,
  rejectJob,
  markOnWay,
  startJob,
  completeJob,
  getAllBookings,
};
