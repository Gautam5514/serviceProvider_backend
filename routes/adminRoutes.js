const express = require("express");
const router  = express.Router();
const { protect, adminOnly } = require("../middleware/auth");
const {
  getPendingProviders,
  getProviderDetails,
  verifyProvider,
  getApprovedProviders,
  getAnalytics,
  createCoupon,
  getAllCoupons,
  deleteCoupon,
  getAdminServices,
  getAdminServiceCategories,
  createAdminService,
  updateAdminService,
  deleteAdminService,
} = require("../controllers/adminController");
const { expireCoupon } = require("../controllers/couponController");

// All admin routes require protect + adminOnly
router.use(protect, adminOnly);

router.get("/providers/pending",    getPendingProviders);
router.get("/providers/approved",   getApprovedProviders);
router.get("/providers/:id",        getProviderDetails);
router.put("/providers/:id/verify", verifyProvider);

router.get("/analytics",            getAnalytics);

router.get("/services",             getAdminServices);
router.get("/services/categories",  getAdminServiceCategories);
router.post("/services",            createAdminService);
router.put("/services/:id",         updateAdminService);
router.delete("/services/:id",      deleteAdminService);

router.get("/coupons",              getAllCoupons);
router.post("/coupons",             createCoupon);
router.put("/coupons/:id/expire",   expireCoupon);
router.delete("/coupons/:id",       deleteCoupon);

module.exports = router;
