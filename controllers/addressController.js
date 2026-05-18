const CustomerAddress = require("../models/CustomerAddress");

const MAX_ADDRESSES = 5;

// GET /api/addresses
const getAddresses = async (req, res) => {
  try {
    const addresses = await CustomerAddress.find({ userId: req.user._id }).sort({ isDefault: -1, createdAt: -1 });
    res.json({ success: true, addresses });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// POST /api/addresses
const addAddress = async (req, res) => {
  try {
    const { label, fullAddress, city, pincode, isDefault, lat, lng } = req.body;
    if (!fullAddress || !city)
      return res.status(400).json({ success: false, message: "Address and city are required." });

    const count = await CustomerAddress.countDocuments({ userId: req.user._id });
    if (count >= MAX_ADDRESSES)
      return res.status(400).json({ success: false, message: `You can save a maximum of ${MAX_ADDRESSES} addresses.` });

    // If setting as default, unset others
    if (isDefault) {
      await CustomerAddress.updateMany({ userId: req.user._id }, { isDefault: false });
    }

    // First address is auto-default
    const shouldBeDefault = isDefault || count === 0;

    const address = await CustomerAddress.create({
      userId: req.user._id,
      label:  label || "Home",
      fullAddress, city, pincode,
      ...(Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && {
        lat: Number(lat),
        lng: Number(lng),
      }),
      isDefault: shouldBeDefault,
    });

    res.status(201).json({ success: true, address });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// PUT /api/addresses/:id/default
const setDefault = async (req, res) => {
  try {
    const addr = await CustomerAddress.findOne({ _id: req.params.id, userId: req.user._id });
    if (!addr) return res.status(404).json({ success: false, message: "Address not found." });
    await CustomerAddress.updateMany({ userId: req.user._id }, { isDefault: false });
    addr.isDefault = true;
    await addr.save();
    res.json({ success: true, address: addr });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// DELETE /api/addresses/:id
const deleteAddress = async (req, res) => {
  try {
    const addr = await CustomerAddress.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!addr) return res.status(404).json({ success: false, message: "Address not found." });
    res.json({ success: true, message: "Address removed." });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { getAddresses, addAddress, setDefault, deleteAddress };
