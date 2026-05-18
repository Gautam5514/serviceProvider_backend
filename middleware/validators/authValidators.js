const { body, validationResult } = require("express-validator");

// ─── Shared helper: run validationResult and short-circuit on first error ─────
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    return res.status(400).json({
      success: false,
      message: first.msg,
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// ─── Reusable field rules ─────────────────────────────────────────────────────
const emailField = body("email")
  .trim()
  .notEmpty().withMessage("Email address is required.")
  .isEmail().withMessage("Please enter a valid email address.")
  .customSanitizer((v) => v.toLowerCase());

const passwordField = (fieldName = "password", label = "Password") =>
  body(fieldName)
    .notEmpty().withMessage(`${label} is required.`)
    .isLength({ min: 8 }).withMessage(`${label} must be at least 8 characters.`)
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(`${label} must contain at least one uppercase letter, one lowercase letter, and one number.`);

const otpField = body("otp")
  .notEmpty().withMessage("Verification code is required.")
  .isLength({ min: 6, max: 6 }).withMessage("Verification code must be exactly 6 digits.")
  .isNumeric().withMessage("Verification code must contain only numbers.");

const verificationTokenField = body("verificationToken")
  .notEmpty().withMessage("Verification token is required.");

// ─── POST /auth/send-register-otp ─────────────────────────────────────────────
const validateSendOTP = [emailField, handleValidation];

// ─── POST /auth/verify-register-otp ──────────────────────────────────────────
const validateVerifyOTP = [verificationTokenField, otpField, handleValidation];

// ─── POST /auth/register ──────────────────────────────────────────────────────
const validateRegister = [
  body("fullName")
    .trim()
    .notEmpty().withMessage("Full name is required.")
    .isLength({ min: 2, max: 60 }).withMessage("Name must be between 2 and 60 characters.")
    .matches(/^[a-zA-Z\s.'-]+$/).withMessage("Name contains invalid characters."),
  emailField,
  body("phone")
    .notEmpty().withMessage("Phone number is required.")
    .matches(/^\d{10}$/).withMessage("Phone number must be exactly 10 digits."),
  passwordField("password", "Password"),
  body("role")
    .optional()
    .isIn(["customer", "provider"]).withMessage("Role must be customer or provider."),
  verificationTokenField,
  handleValidation,
];

// ─── POST /auth/login ─────────────────────────────────────────────────────────
const validateLogin = [
  emailField,
  body("password").notEmpty().withMessage("Password is required."),
  handleValidation,
];

// ─── POST /auth/forgot-password ───────────────────────────────────────────────
const validateForgotPassword = [emailField, handleValidation];

// ─── POST /auth/reset-password ────────────────────────────────────────────────
const validateResetPassword = [
  verificationTokenField,
  otpField,
  passwordField("newPassword", "New password"),
  handleValidation,
];

module.exports = {
  validateSendOTP,
  validateVerifyOTP,
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
};
