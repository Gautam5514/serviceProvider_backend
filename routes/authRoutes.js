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
const { protect } = require("../middleware/auth");
const {
  register,
  login,
  checkEmail,
  getMe,
  getWsToken,
  logout,
  sendRegisterOTP,
  verifyRegisterOTP,
  sendProviderOTP,
  verifyProviderOTP,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");

// Email availability (on blur in register form — rate-limited to prevent harvesting)
router.get ("/check-email",          authLimiter,                             checkEmail);

// Session management (cookie-based)
router.get ("/me",                  protect,                             getMe);
router.get ("/ws-token",            protect,                             getWsToken);
router.post("/logout",              protect,                             logout);

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
