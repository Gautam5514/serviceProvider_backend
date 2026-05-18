const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { publicSearch, smartSearch } = require("../controllers/searchController");

router.get("/public", publicSearch);
router.get("/", protect, smartSearch);

module.exports = router;
