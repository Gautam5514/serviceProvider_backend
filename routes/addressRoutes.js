const express = require("express");
const router  = express.Router();
const { protect, customerOnly } = require("../middleware/auth");
const { getAddresses, addAddress, setDefault, deleteAddress } = require("../controllers/addressController");

router.get("/",            protect, customerOnly, getAddresses);
router.post("/",           protect, customerOnly, addAddress);
router.put("/:id/default", protect, customerOnly, setDefault);
router.delete("/:id",      protect, customerOnly, deleteAddress);

module.exports = router;
