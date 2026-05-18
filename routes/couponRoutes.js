const express = require("express");
const router  = express.Router();
const { protect, customerOnly } = require("../middleware/auth");
const { validateCoupon } = require("../controllers/couponController");

router.post("/validate", protect, customerOnly, validateCoupon);

module.exports = router;
