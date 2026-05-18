const Coupon = require("../models/Coupon");

// POST /api/coupons/validate  — customer checks if a coupon is valid
const validateCoupon = async (req, res) => {
  try {
    const { code, orderAmount, category } = req.body;
    if (!code) return res.status(400).json({ success: false, message: "Coupon code is required." });

    const coupon = await Coupon.findOne({ code: code.toUpperCase().trim(), isActive: true });
    if (!coupon)
      return res.status(404).json({ success: false, message: "Invalid or expired coupon code." });

    if (new Date() > coupon.expiresAt)
      return res.status(400).json({ success: false, message: "This coupon has expired." });

    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses)
      return res.status(400).json({ success: false, message: "This coupon has reached its usage limit." });

    if (coupon.minOrderValue > 0 && orderAmount < coupon.minOrderValue)
      return res.status(400).json({
        success: false,
        message: `Minimum order value of ₹${coupon.minOrderValue} required for this coupon.`,
      });

    if (coupon.applicableCategories.length > 0 && !coupon.applicableCategories.includes(category))
      return res.status(400).json({
        success: false,
        message: `This coupon is only valid for: ${coupon.applicableCategories.join(", ")} services.`,
      });

    const discount = coupon.discountType === "percent"
      ? Math.round((orderAmount * coupon.discountValue) / 100)
      : coupon.discountValue;

    res.json({
      success: true,
      message: "Coupon applied!",
      coupon: { code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue, description: coupon.description },
      discount,
      finalAmount: Math.max(0, orderAmount - discount),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// POST /api/admin/coupons  — admin creates a coupon
const createCoupon = async (req, res) => {
  try {
    const { code, description, discountType, discountValue, minOrderValue, maxUses, expiresAt, applicableCategories } = req.body;
    if (!code || !discountType || !discountValue || !expiresAt)
      return res.status(400).json({ success: false, message: "code, discountType, discountValue and expiresAt are required." });

    const coupon = await Coupon.create({
      code: code.toUpperCase().trim(),
      description, discountType, discountValue,
      minOrderValue: minOrderValue || 0,
      maxUses: maxUses || null,
      expiresAt: new Date(expiresAt),
      applicableCategories: applicableCategories || [],
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, coupon });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ success: false, message: "Coupon code already exists." });
    res.status(500).json({ success: false, message: e.message });
  }
};

// GET /api/admin/coupons
const getAllCoupons = async (_req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json({ success: true, coupons });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// DELETE /api/admin/coupons/:id
const deleteCoupon = async (req, res) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Coupon deleted." });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// PUT /api/admin/coupons/:id/expire  — immediately deactivate a coupon
// Safe to call on already-expired coupons (idempotent).
const expireCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!coupon)
      return res.status(404).json({ success: false, message: "Coupon not found." });

    res.json({ success: true, message: "Coupon deactivated. Customers can no longer use it.", coupon });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { validateCoupon, createCoupon, getAllCoupons, deleteCoupon, expireCoupon };
