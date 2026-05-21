const express = require("express");
const router  = express.Router();
const { protect, adminOnly } = require("../middleware/auth");
const {
  getPublicTestimonials,
  submitTestimonial,
  getPendingTestimonials,
  approveTestimonial,
  deleteTestimonial,
} = require("../controllers/testimonialController");

// Public
router.get("/",  getPublicTestimonials);
router.post("/", submitTestimonial);

// Admin moderation queue
router.get("/:id/pending", protect, adminOnly, getPendingTestimonials);
router.put("/:id/approve", protect, adminOnly, approveTestimonial);
router.delete("/:id",      protect, adminOnly, deleteTestimonial);

module.exports = router;
