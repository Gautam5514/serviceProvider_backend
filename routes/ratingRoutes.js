const express = require("express");
const router  = express.Router();
const { protect, customerOnly } = require("../middleware/auth");
const { submitRating, getProviderRatings } = require("../controllers/ratingController");

router.post("/",                        protect, customerOnly, submitRating);
router.get("/provider/:providerId",     getProviderRatings);

module.exports = router;
