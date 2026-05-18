const express = require("express");
const router  = express.Router();
const { getServices, getServiceBySlug } = require("../controllers/serviceController");

router.get("/",      getServices);
router.get("/:slug", getServiceBySlug);

module.exports = router;
