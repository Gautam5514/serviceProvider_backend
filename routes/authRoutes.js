const express = require("express");
const router  = express.Router();

const { authLimiter, otpLimiter } = require("../middleware/rateLimiter");
const {
  validateSendOTP,
  validateVerifyOTP,
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
} = require("../middleware/validators/authValidators");
const {
  register,
  login,
  sendRegisterOTP,
  verifyRegisterOTP,
  sendProviderOTP,
  verifyProviderOTP,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");

// Registration & login (15 attempts / 15 min)
router.post("/register",            authLimiter, validateRegister,       register);
router.post("/login",               authLimiter, validateLogin,          login);

// OTP flows (5 sends / 15 min — prevents email bombing)
router.post("/send-register-otp",   otpLimiter,  validateSendOTP,        sendRegisterOTP);
router.post("/verify-register-otp", otpLimiter,  validateVerifyOTP,      verifyRegisterOTP);

// Legacy provider OTP (kept for backward compatibility)
router.post("/send-provider-otp",   otpLimiter,  validateSendOTP,        sendProviderOTP);
router.post("/verify-provider-otp", otpLimiter,  validateVerifyOTP,      verifyProviderOTP);

// Password recovery (5 attempts / 15 min)
router.post("/forgot-password",     otpLimiter,  validateForgotPassword, forgotPassword);
router.post("/reset-password",      otpLimiter,  validateResetPassword,  resetPassword);

module.exports = router;
