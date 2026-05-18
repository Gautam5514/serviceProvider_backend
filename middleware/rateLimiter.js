const rateLimit = require("express-rate-limit");

// Consistent error response format
const limitHandler = (req, res) => {
  const retryAfter = Math.ceil(res.getHeader("Retry-After") || 900);
  res.status(429).json({
    success: false,
    message: "Too many requests. Please wait and try again.",
    retryAfterSeconds: retryAfter,
  });
};

const baseOptions = {
  standardHeaders: true,  // Send RateLimit-* headers (RFC 6585)
  legacyHeaders: false,   // Disable deprecated X-RateLimit-* headers
  handler: limitHandler,
};

// ─── General API limiter ──────────────────────────────────────────────────────
// 200 requests per 15 min per IP — covers all /api/* endpoints
const generalLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: "Too many requests from this IP.",
});

// ─── Auth limiter ─────────────────────────────────────────────────────────────
// 15 attempts per 15 min — login, register
const authLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 15,
  skipSuccessfulRequests: false,
});

// ─── OTP / password-reset limiter ────────────────────────────────────────────
// 5 sends per 15 min — prevents OTP spam and email bombing
const otpLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 5,
});

// ─── Upload limiter ───────────────────────────────────────────────────────────
// 30 uploads per hour — prevents storage abuse
const uploadLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 60 * 1000,
  max: 30,
});

// ─── Admin limiter ────────────────────────────────────────────────────────────
// 300 per 15 min — admins do more requests, still protected
const adminLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 300,
});

module.exports = { generalLimiter, authLimiter, otpLimiter, uploadLimiter, adminLimiter };
