const express = require("express");
const router  = express.Router();
const { getPublicStats } = require("../controllers/statsController");

router.get("/public", getPublicStats);

module.exports = router;
