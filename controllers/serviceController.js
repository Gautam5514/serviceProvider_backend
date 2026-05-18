const Service = require("../models/Service");

// Seed default services if collection is empty (called on first GET)
const DEFAULT_SERVICES = [
  // AC
  { name: "AC Repair", slug: "ac-repair", category: "ac", basePrice: 499, priceUnit: "per_visit", estimatedDurationMinutes: 75, isPopular: true, sortOrder: 1, whatIsIncluded: ["Full diagnosis", "Basic repair", "Gas pressure check", "Test run"] },
  { name: "AC Installation", slug: "ac-installation", category: "ac", basePrice: 999, priceUnit: "per_visit", estimatedDurationMinutes: 150, isPopular: true, sortOrder: 2, whatIsIncluded: ["Wall mounting", "Copper piping", "Electrical connection", "Test run & demo"] },
  { name: "AC Deep Cleaning", slug: "ac-deep-cleaning", category: "ac", basePrice: 799, priceUnit: "per_visit", estimatedDurationMinutes: 90, sortOrder: 3, whatIsIncluded: ["Filter cleaning", "Coil cleaning", "Drain pipe flush", "Anti-bacterial spray"] },
  { name: "AC Gas Refilling", slug: "ac-gas-refilling", category: "ac", basePrice: 1299, priceUnit: "per_visit", estimatedDurationMinutes: 60, sortOrder: 4, whatIsIncluded: ["Gas level check", "Leak detection", "Refrigerant refill", "Pressure test"] },
  { name: "AC Uninstallation", slug: "ac-uninstallation", category: "ac", basePrice: 399, priceUnit: "per_visit", estimatedDurationMinutes: 60, sortOrder: 5, whatIsIncluded: ["Safe dismounting", "Gas recovery", "Pipe capping"] },
  // Cooler
  { name: "Cooler Repair", slug: "cooler-repair", category: "cooler", basePrice: 349, priceUnit: "per_visit", estimatedDurationMinutes: 60, isPopular: true, sortOrder: 1, whatIsIncluded: ["Motor & pump check", "Pad inspection", "Electrical check", "Basic repair"] },
  { name: "Cooler Full Service", slug: "cooler-service", category: "cooler", basePrice: 499, priceUnit: "per_visit", estimatedDurationMinutes: 90, sortOrder: 2, whatIsIncluded: ["Full cleaning", "Pad replacement", "Water pump overhaul", "Lubrication"] },
  { name: "Cooler Installation", slug: "cooler-installation", category: "cooler", basePrice: 599, priceUnit: "per_visit", estimatedDurationMinutes: 90, sortOrder: 3, whatIsIncluded: ["Placement & mounting", "Water connection", "Electrical setup", "Test run"] },
  // Fan
  { name: "Fan Repair", slug: "fan-repair", category: "fan", basePrice: 199, priceUnit: "per_visit", estimatedDurationMinutes: 45, isPopular: true, sortOrder: 1, whatIsIncluded: ["Diagnosis", "Capacitor check", "Winding inspection", "Basic repair"] },
  { name: "Fan Installation", slug: "fan-installation", category: "fan", basePrice: 299, priceUnit: "per_visit", estimatedDurationMinutes: 45, sortOrder: 2, whatIsIncluded: ["Ceiling/wall mounting", "Electrical connection", "Blade balancing", "Test run"] },
  { name: "Fan Servicing", slug: "fan-servicing", category: "fan", basePrice: 149, priceUnit: "per_visit", estimatedDurationMinutes: 30, sortOrder: 3, whatIsIncluded: ["Full cleaning", "Blade balancing", "Bearing lubrication"] },
  // TV
  { name: "TV Repair", slug: "tv-repair", category: "tv", basePrice: 499, priceUnit: "per_visit", estimatedDurationMinutes: 90, isPopular: true, sortOrder: 1, whatIsIncluded: ["Full diagnosis", "Board inspection", "Basic component repair", "Test"] },
  { name: "TV Wall Mounting", slug: "tv-wall-mounting", category: "tv", basePrice: 599, priceUnit: "per_visit", estimatedDurationMinutes: 60, sortOrder: 2, whatIsIncluded: ["Bracket installation", "Cable management", "Level alignment", "Safety check"] },
  // Fridge
  { name: "Fridge Repair", slug: "fridge-repair", category: "fridge", basePrice: 499, priceUnit: "per_visit", estimatedDurationMinutes: 90, isPopular: true, sortOrder: 1, whatIsIncluded: ["Cooling diagnosis", "Compressor check", "Thermostat inspection", "Basic repair"] },
  { name: "Fridge Gas Refill", slug: "fridge-gas-refill", category: "fridge", basePrice: 1199, priceUnit: "per_visit", estimatedDurationMinutes: 90, sortOrder: 2, whatIsIncluded: ["Leak check", "Gas refill", "Pressure testing", "Cooling test"] },
  // Electrical
  { name: "Electrical Work", slug: "electrical-work", category: "electrical", basePrice: 299, priceUnit: "per_visit", estimatedDurationMinutes: 60, isPopular: true, sortOrder: 1, whatIsIncluded: ["Switch/socket repair", "Wiring check", "MCB/fuse work", "Safety inspection"] },
  { name: "Wiring & Cabling", slug: "wiring-cabling", category: "electrical", basePrice: 499, priceUnit: "per_visit", estimatedDurationMinutes: 90, sortOrder: 2, whatIsIncluded: ["New wiring", "Cable routing", "Junction box", "Testing"] },
  // Appliance
  { name: "Appliance Repair", slug: "appliance-repair", category: "appliance", basePrice: 399, priceUnit: "per_visit", estimatedDurationMinutes: 90, isPopular: true, sortOrder: 1, whatIsIncluded: ["Diagnosis", "Component check", "Basic repair", "Test run"] },
  { name: "Washing Machine Repair", slug: "washing-machine-repair", category: "appliance", basePrice: 499, priceUnit: "per_visit", estimatedDurationMinutes: 90, sortOrder: 2, whatIsIncluded: ["Motor check", "Drum inspection", "Belt & pump check", "Test run"] },
];

async function seedIfEmpty() {
  const count = await Service.countDocuments();
  if (count === 0) {
    await Service.insertMany(DEFAULT_SERVICES);
  }
}

function makeSlug(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeCategory(value = "") {
  return makeSlug(value);
}

// GET /api/services?category=ac
const getServices = async (req, res) => {
  try {
    await seedIfEmpty();
    const filter = { active: true };
    if (req.query.category) filter.category = req.query.category;
    const services = await Service.find(filter).sort({ isPopular: -1, sortOrder: 1 });
    res.json({ success: true, services });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/services/:slug
const getServiceBySlug = async (req, res) => {
  try {
    await seedIfEmpty();
    const service = await Service.findOne({ slug: req.params.slug, active: true });
    if (!service) return res.status(404).json({ success: false, message: "Service not found" });
    res.json({ success: true, service });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAdminServices = async (req, res) => {
  try {
    await seedIfEmpty();
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    const services = await Service.find(filter).sort({ category: 1, sortOrder: 1, createdAt: -1 });
    res.json({ success: true, services });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAdminServiceCategories = async (_req, res) => {
  try {
    await seedIfEmpty();
    const categories = await Service.distinct("category");
    res.json({ success: true, categories: categories.filter(Boolean).sort() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createAdminService = async (req, res) => {
  try {
    const {
      name,
      category,
      basePrice,
      priceUnit = "per_visit",
      estimatedDurationMinutes = 60,
      whatIsIncluded = [],
      description = "",
      isPopular = false,
      active = true,
      sortOrder = 0,
    } = req.body;

    const normalizedCategory = normalizeCategory(category);
    if (!name || !normalizedCategory || basePrice === undefined) {
      return res.status(400).json({ success: false, message: "Name, category, and base price are required." });
    }

    const baseSlug = makeSlug(req.body.slug || name);
    let slug = baseSlug;
    let suffix = 2;
    while (await Service.exists({ slug })) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const service = await Service.create({
      name,
      slug,
      category: normalizedCategory,
      description,
      basePrice: Number(basePrice),
      priceUnit,
      estimatedDurationMinutes: Number(estimatedDurationMinutes) || 60,
      whatIsIncluded: Array.isArray(whatIsIncluded)
        ? whatIsIncluded.filter(Boolean)
        : String(whatIsIncluded).split("\n").map((item) => item.trim()).filter(Boolean),
      isPopular: Boolean(isPopular),
      active: Boolean(active),
      sortOrder: Number(sortOrder) || 0,
    });

    res.status(201).json({ success: true, service });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateAdminService = async (req, res) => {
  try {
    const allowed = [
      "name",
      "category",
      "description",
      "basePrice",
      "priceUnit",
      "estimatedDurationMinutes",
      "whatIsIncluded",
      "isPopular",
      "active",
      "sortOrder",
    ];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    if (update.basePrice !== undefined) update.basePrice = Number(update.basePrice);
    if (update.estimatedDurationMinutes !== undefined) update.estimatedDurationMinutes = Number(update.estimatedDurationMinutes);
    if (update.sortOrder !== undefined) update.sortOrder = Number(update.sortOrder);
    if (update.whatIsIncluded !== undefined && !Array.isArray(update.whatIsIncluded)) {
      update.whatIsIncluded = String(update.whatIsIncluded).split("\n").map((item) => item.trim()).filter(Boolean);
    }
    if (update.category !== undefined) update.category = normalizeCategory(update.category);

    const service = await Service.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!service) return res.status(404).json({ success: false, message: "Service not found." });
    res.json({ success: true, service });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteAdminService = async (req, res) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: "Service not found." });
    res.json({ success: true, message: "Service deleted." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getServices,
  getServiceBySlug,
  seedIfEmpty,
  getAdminServices,
  getAdminServiceCategories,
  createAdminService,
  updateAdminService,
  deleteAdminService,
};
