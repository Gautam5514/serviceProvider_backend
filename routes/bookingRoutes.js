const express = require("express");
const router  = express.Router();
const { protect, customerOnly, providerOnly, adminOnly } = require("../middleware/auth");
const {
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
  updateProviderLocation,
  getProviderEarnings,
  raiseDispute,
} = require("../controllers/bookingController");

// Customer
router.post("/",                      protect, customerOnly, createBooking);
router.get("/my",                     protect, customerOnly, getMyBookings);
router.put("/:id/cancel",             protect,               cancelBooking);

// Provider — all static routes MUST come before /:id to avoid shadowing
router.get("/provider/jobs",          protect, providerOnly, getProviderJobs);
router.get("/provider/available",     protect, providerOnly, getAvailableJobs);
router.get("/provider/earnings",      protect, providerOnly, getProviderEarnings);
router.put("/:id/pickup",             protect, providerOnly, pickupJob);
router.put("/:id/accept",             protect, providerOnly, acceptJob);
router.put("/:id/reject",             protect, providerOnly, rejectJob);
router.put("/:id/on-way",             protect, providerOnly, markOnWay);
router.put("/:id/location",           protect, providerOnly, updateProviderLocation);
router.put("/:id/start",              protect, providerOnly, startJob);
router.put("/:id/complete",           protect, providerOnly, completeJob);

// Admin
router.get("/admin/all",              protect, adminOnly,    getAllBookings);

// Dispute — customer, provider or admin
router.put("/:id/dispute",            protect,               raiseDispute);

// Shared detail — customer or provider
router.get("/:id",                    protect,               getBookingById);

module.exports = router;
