const Booking  = require("../models/Booking");
const Provider = require("../models/Provider");
const Service  = require("../models/Service");
const User     = require("../models/User");
const { seedIfEmpty } = require("./serviceController");
const AppError   = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

// ─── Seed cache ────────────────────────────────────────────────────────────────
// Avoids hitting the DB on every single public search just to check if seeded.
let _seeded = false;
async function ensureSeeded() {
  if (_seeded) return;
  await seedIfEmpty();
  _seeded = true;
}

// ─── Regex helper ──────────────────────────────────────────────────────────────
function escapeRegex(v = "") {
  return String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function rx(v) {
  return new RegExp(escapeRegex(v), "i");
}

// ─── Alias map ─────────────────────────────────────────────────────────────────
// Maps what a user might type → the actual DB enum value.
const ALIASES = {
  // booking status
  "on way":           "provider_on_way",
  "on the way":       "provider_on_way",
  "onway":            "provider_on_way",
  "travelling":       "provider_on_way",
  "traveling":        "provider_on_way",
  "in progress":      "in_progress",
  "in-progress":      "in_progress",
  "inprogress":       "in_progress",
  "started":          "in_progress",
  "wip":              "in_progress",
  "done":             "completed",
  "finished":         "completed",
  "finish":           "completed",
  "complete":         "completed",
  "cancel":           "cancelled",
  "canceled":         "cancelled",
  // payment method
  "cash":             "cash_on_delivery",
  "cod":              "cash_on_delivery",
  "cash on delivery": "cash_on_delivery",
  "delivery":         "cash_on_delivery",
};

function resolveAlias(q) {
  return ALIASES[q.toLowerCase().trim()] ?? q;
}

// ─── Date parsing ──────────────────────────────────────────────────────────────
// Supports: "today", "yesterday", "this week", "last week",
//           "this month", "last month", and any parseable date string.
function parseDateRange(value) {
  const v   = value.toLowerCase().trim();
  const now = new Date();

  const d = (offsetDays = 0) => {
    const r = new Date(now);
    r.setDate(r.getDate() + offsetDays);
    return r;
  };
  const startOf = (date) => { const r = new Date(date); r.setHours(0, 0, 0, 0);          return r; };
  const endOf   = (date) => { const r = new Date(date); r.setHours(23, 59, 59, 999);      return r; };

  if (v === "today")
    return { $gte: startOf(d(0)),  $lte: endOf(d(0))  };
  if (v === "yesterday")
    return { $gte: startOf(d(-1)), $lte: endOf(d(-1)) };

  if (v === "this week" || v === "week") {
    const s = new Date(now);
    s.setDate(now.getDate() - now.getDay());
    s.setHours(0, 0, 0, 0);
    return { $gte: s, $lte: endOf(now) };
  }
  if (v === "last week") {
    const s = new Date(now);
    s.setDate(now.getDate() - now.getDay() - 7);
    s.setHours(0, 0, 0, 0);
    const e = new Date(now);
    e.setDate(now.getDate() - now.getDay() - 1);
    e.setHours(23, 59, 59, 999);
    return { $gte: s, $lte: e };
  }
  if (v === "this month" || v === "month") {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    return { $gte: s, $lte: endOf(now) };
  }
  if (v === "last month") {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { $gte: s, $lte: e };
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime()))
    return { $gte: startOf(parsed), $lte: endOf(parsed) };

  return null;
}

// ─── Booking $or clauses ───────────────────────────────────────────────────────
function bookingOrClauses(term, dateRange) {
  return [
    { bookingNumber:       term },
    { serviceName:         term },
    { serviceCategory:     term },
    { status:              term },
    { paymentStatus:       term },
    { paymentMethod:       term },
    { "address.city":      term },
    { "address.text":      term },
    ...(dateRange
      ? [{ scheduledDate: dateRange }, { completedAt: dateRange }, { createdAt: dateRange }]
      : []),
  ];
}

// ─── Result builders ───────────────────────────────────────────────────────────
function serviceResult(svc) {
  return {
    id:    svc._id,
    type:  "service",
    label: svc.name,
    meta:  [
      svc.category,
      `₹${svc.basePrice}`,
      svc.description ? svc.description.slice(0, 50) : null,
    ].filter(Boolean).join(" · "),
    href: `/book/${svc.slug}`,
  };
}

function bookingResult(booking, role = "customer") {
  const providerName = booking.providerId?.userId?.fullName;
  const customerName = booking.customerId?.fullName;
  const party        = role === "provider" ? customerName : providerName;
  // Replace ALL underscores so "provider_on_way" → "provider on way"
  const statusLabel  = (booking.status || "").replace(/_/g, " ");

  return {
    id:    booking._id,
    type:  "booking",
    label: `${booking.bookingNumber || "Booking"} · ${booking.serviceName}`,
    meta:  [statusLabel, booking.paymentStatus, party, booking.address?.city]
             .filter(Boolean).join(" · "),
    href:  role === "provider"
             ? `/dashboard/provider/orders/${booking._id}`
             : `/bookings/${booking._id}`,
  };
}

function userResult(u) {
  return {
    id:    u._id,
    type:  u.role || "user",
    label: u.fullName,
    meta:  [u.role, u.email, u.phone].filter(Boolean).join(" · "),
    href:  "",
  };
}

function providerResult(p) {
  const services = (p.services || [])
    .map(s => s.serviceName)
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");

  return {
    id:    p._id,
    type:  "provider",
    label: p.userId?.fullName || "Provider",
    meta:  [
      (p.onboardingStatus || "").replace(/_/g, " "),
      p.city,
      services,
    ].filter(Boolean).join(" · "),
    href: `/admin/providers/${p._id}`,
  };
}

// ─── Deduplication ─────────────────────────────────────────────────────────────
// Prevents the same document appearing twice when multiple OR clauses match.
function dedup(results) {
  const seen = new Set();
  return results.filter(r => {
    const key = `${r.type}:${r.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Service search (shared by public + customer) ──────────────────────────────
async function searchServices(query, limit) {
  await ensureSeeded();
  const term = rx(query);
  const docs = await Service.find({
    active: true,
    $or: [
      { name:            term },
      { slug:            term },
      { category:        term },
      { description:     term },
      { whatIsIncluded:  term },
    ],
  })
    .sort({ isPopular: -1, sortOrder: 1 })
    .limit(limit)
    .lean();

  return docs.map(serviceResult);
}

// ─── Default suggestions ───────────────────────────────────────────────────────
const SUGGESTIONS = [
  "AC repair", "Fridge repair", "Fan installation",
  "TV mounting", "Cooler service", "Electrical work",
];

// ─── GET /api/search/public ────────────────────────────────────────────────────
const publicSearch = catchAsync(async (req, res) => {
  const raw = String(req.query.q || "").trim().slice(0, 150);

  if (raw.length < 2) {
    return res.json({ success: true, results: [], suggestions: SUGGESTIONS });
  }

  const resolved = resolveAlias(raw);
  let results    = await searchServices(resolved, 8);

  // If alias changed the query and produced no results, also try the original.
  if (results.length === 0 && resolved !== raw) {
    results = await searchServices(raw, 8);
  }

  res.json({
    success:     true,
    results:     dedup(results),
    suggestions: results.length === 0 ? SUGGESTIONS : [],
  });
});

// ─── GET /api/search (authenticated) ──────────────────────────────────────────
const smartSearch = catchAsync(async (req, res) => {
  const raw   = String(req.query.q || "").trim().slice(0, 150);
  const limit = Math.min(Number(req.query.limit) || 8, 15);
  const role  = req.user.role;

  if (raw.length < 2) {
    return res.json({ success: true, role, results: [] });
  }

  const resolved  = resolveAlias(raw);
  const term      = rx(resolved);
  const dateRange = parseDateRange(resolved);

  // ── CUSTOMER ──────────────────────────────────────────────────────────────
  if (role === "customer") {
    const [services, bookings] = await Promise.all([
      searchServices(resolved, limit),
      Booking.find({
        customerId: req.user._id,
        $or: bookingOrClauses(term, dateRange),
      })
        .populate({ path: "providerId", populate: { path: "userId", select: "fullName" } })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
    ]);

    return res.json({
      success: true,
      role,
      results: dedup([
        ...services,
        ...bookings.map(b => bookingResult(b, "customer")),
      ]).slice(0, limit + 4),
    });
  }

  // ── PROVIDER ──────────────────────────────────────────────────────────────
  if (role === "provider") {
    const provider = await Provider.findOne({ userId: req.user._id }).lean();
    if (!provider) return res.json({ success: true, role, results: [] });

    const [jobs] = await Promise.all([
      Booking.find({
        providerId: provider._id,
        $or: bookingOrClauses(term, dateRange),
      })
        .populate("customerId", "fullName phone")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
    ]);

    const profileMatches = (provider.services || [])
      .filter(s =>
        term.test(s.serviceName || "") ||
        term.test(s.category    || "") ||
        term.test(s.skillLevel  || "")
      )
      .slice(0, 3)
      .map((s, i) => ({
        id:    `${provider._id}-${i}`,
        type:  "provider_service",
        label: s.serviceName,
        meta:  [s.category, s.skillLevel, `${s.experienceYears || 0} yrs exp`].join(" · "),
        href:  "/dashboard/provider/profile",
      }));

    return res.json({
      success: true,
      role,
      results: dedup([
        ...jobs.map(b => bookingResult(b, "provider")),
        ...profileMatches,
      ]).slice(0, limit + 3),
    });
  }

  // ── ADMIN ─────────────────────────────────────────────────────────────────
  if (role === "admin") {
    // Find provider user accounts matching the query so we can cross-search
    // providers by their user's name/email (userId is in User, not Provider).
    const matchedProviderUsers = await User.find({
      role: "provider",
      $or: [{ fullName: term }, { email: term }, { phone: term }],
    })
      .select("_id")
      .limit(20)
      .lean();

    const matchedProviderUserIds = matchedProviderUsers.map(u => u._id);

    const [users, providers, bookings] = await Promise.all([
      // Users (all roles)
      User.find({
        $or: [
          { fullName: term },
          { email:    term },
          { phone:    term },
          { role:     term },
          ...(dateRange ? [{ createdAt: dateRange }] : []),
        ],
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),

      // Providers — including by user name cross-reference
      Provider.find({
        $or: [
          { city:                    term },
          { serviceArea:             term },
          { onboardingStatus:        term },
          { jobTier:                 term },
          { "services.category":     term },
          { "services.serviceName":  term },
          ...(matchedProviderUserIds.length > 0
            ? [{ userId: { $in: matchedProviderUserIds } }]
            : []),
          ...(dateRange
            ? [
                { createdAt:             dateRange },
                { updatedAt:             dateRange },
                { onboardingCompletedAt: dateRange },
              ]
            : []),
        ],
      })
        .populate("userId", "fullName email phone")
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean(),

      // All bookings (admin can see everything)
      Booking.find({ $or: bookingOrClauses(term, dateRange) })
        .populate("customerId", "fullName phone email")
        .populate({ path: "providerId", populate: { path: "userId", select: "fullName phone email" } })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
    ]);

    return res.json({
      success: true,
      role,
      results: dedup([
        ...users.map(userResult),
        ...providers.map(providerResult),
        ...bookings.map(b => ({
          ...bookingResult(b, "admin"),
          href: `/bookings/${b._id}`,   // admin can access booking detail via shared endpoint
        })),
      ]).slice(0, limit * 2),
    });
  }

  res.json({ success: true, role, results: [] });
});

module.exports = { publicSearch, smartSearch };
