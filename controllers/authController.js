const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const User     = require("../models/User");
const EmailOTP = require("../models/EmailOTP");
const { sendOTPEmail } = require("../utils/emailService");
const AppError   = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

// ─── Private helpers ──────────────────────────────────────────────────────────

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function signToken(payload, expiresIn) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

// Sends OTP email and returns a short-lived verification token.
// Throws AppError on duplicate email, resend-too-soon, etc.
async function _sendOTP(email, purpose) {
  const emailLower = email.toLowerCase().trim();

  const existing = await User.findOne({ email: emailLower });
  if (existing) throw new AppError("Email is already registered. Please sign in.", 409);

  const recent = await EmailOTP.findOne({
    email: emailLower,
    purpose,
    createdAt: { $gte: new Date(Date.now() - 60_000) },
  });
  if (recent)
    throw new AppError("Please wait 60 seconds before requesting another code.", 429);

  const otp     = generateOTP();
  const otpHash = await bcrypt.hash(otp, 10);

  await EmailOTP.create({
    email:     emailLower,
    otpHash,
    purpose,
    expiresAt: new Date(Date.now() + 10 * 60_000),
  });

  await sendOTPEmail(emailLower, otp, purpose);

  return signToken({ email: emailLower, purpose }, "10m");
}

// Verifies OTP against the stored hash. Returns an email-verified token.
// Throws AppError on expired session, wrong code, exhausted attempts.
async function _verifyOTP(verificationToken, otp, expectedPurpose) {
  let decoded;
  try {
    decoded = jwt.verify(verificationToken, process.env.JWT_SECRET);
  } catch {
    throw new AppError("Session expired. Please request a new code.", 400);
  }

  if (decoded.purpose !== expectedPurpose)
    throw new AppError("Invalid verification token.", 400);

  const record = await EmailOTP.findOne({
    email:     decoded.email,
    purpose:   expectedPurpose,
    usedAt:    null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!record)
    throw new AppError("Code expired or already used. Request a new one.", 400);

  if (record.attempts >= 5)
    throw new AppError("Too many wrong attempts. Request a new code.", 429);

  const isMatch = await bcrypt.compare(otp, record.otpHash);
  if (!isMatch) {
    record.attempts += 1;
    await record.save();
    const left = 5 - record.attempts;
    throw new AppError(
      `Incorrect code. ${left} attempt${left !== 1 ? "s" : ""} remaining.`,
      400
    );
  }

  record.usedAt = new Date();
  await record.save();

  return signToken({ email: decoded.email, purpose: "email_verified" }, "15m");
}

// ─── POST /auth/send-register-otp ────────────────────────────────────────────
const sendRegisterOTP = catchAsync(async (req, res) => {
  const verificationToken = await _sendOTP(req.body.email, "register_email_verify");
  res.json({
    success: true,
    message: "Verification code sent to your email.",
    verificationToken,
  });
});

// ─── POST /auth/verify-register-otp ──────────────────────────────────────────
const verifyRegisterOTP = catchAsync(async (req, res) => {
  const emailVerificationToken = await _verifyOTP(
    req.body.verificationToken,
    req.body.otp,
    "register_email_verify"
  );
  res.json({ success: true, message: "Email verified.", emailVerificationToken });
});

// ─── POST /auth/send-provider-otp  (legacy) ──────────────────────────────────
const sendProviderOTP = catchAsync(async (req, res) => {
  const verificationToken = await _sendOTP(req.body.email, "provider_email_verify");
  res.json({
    success: true,
    message: "Verification code sent to your email.",
    verificationToken,
  });
});

// ─── POST /auth/verify-provider-otp  (legacy) ────────────────────────────────
const verifyProviderOTP = catchAsync(async (req, res) => {
  const emailVerificationToken = await _verifyOTP(
    req.body.verificationToken,
    req.body.otp,
    "provider_email_verify"
  );
  res.json({ success: true, message: "Email verified.", emailVerificationToken });
});

// ─── POST /auth/register ──────────────────────────────────────────────────────
const register = catchAsync(async (req, res) => {
  const { fullName, email, phone, password, role, emailVerificationToken } = req.body;

  // Verify the email-verified token issued after OTP confirmation
  let decoded;
  try {
    decoded = jwt.verify(emailVerificationToken, process.env.JWT_SECRET);
  } catch {
    throw new AppError(
      "Verification session expired. Please verify your email again.",
      400
    );
  }

  const emailLower = email.toLowerCase().trim();
  if (decoded.purpose !== "email_verified" || decoded.email !== emailLower)
    throw new AppError("Email verification mismatch. Please verify again.", 400);

  // Run both duplicate checks in parallel
  const [existingEmail, existingPhone] = await Promise.all([
    User.findOne({ email: emailLower }),
    User.findOne({ phone: phone.trim() }),
  ]);

  if (existingEmail)
    throw new AppError("This email is already registered. Please sign in.", 409);
  if (existingPhone)
    throw new AppError("This phone number is already registered.", 409);

  // bcrypt cost factor 12 — good balance of security vs. speed for registration
  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await User.create({
    fullName:      fullName.trim(),
    email:         emailLower,
    phone:         phone.trim(),
    password:      hashedPassword,
    role:          role || "customer",
    emailVerified: true,
  });

  res.status(201).json({
    success: true,
    message: "Account created successfully.",
    user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role },
  });
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────
const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  // Deliberate vague message — don't confirm whether email exists
  if (!user) throw new AppError("Incorrect email or password.", 401);

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new AppError("Incorrect email or password.", 401);

  const token = signToken({ id: user._id, email: user.email, role: user.role }, "7d");

  res.status(200).json({
    success: true,
    message: "Login successful.",
    token,
    user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role },
  });
});

// ─── POST /auth/forgot-password ───────────────────────────────────────────────
const forgotPassword = catchAsync(async (req, res) => {
  const emailLower = req.body.email.toLowerCase().trim();
  const user       = await User.findOne({ email: emailLower });

  // Always return the same response to prevent email enumeration attacks
  if (!user) {
    return res.json({
      success: true,
      message: "If an account with that email exists, a reset code has been sent.",
    });
  }

  const recent = await EmailOTP.findOne({
    email:     emailLower,
    purpose:   "forgot_password",
    createdAt: { $gte: new Date(Date.now() - 60_000) },
  });
  if (recent)
    throw new AppError("Please wait 60 seconds before requesting another code.", 429);

  const otp     = generateOTP();
  const otpHash = await bcrypt.hash(otp, 10);
  await EmailOTP.create({
    email:     emailLower,
    otpHash,
    purpose:   "forgot_password",
    expiresAt: new Date(Date.now() + 10 * 60_000),
  });
  await sendOTPEmail(emailLower, otp, "forgot_password");

  const verificationToken = signToken({ email: emailLower, purpose: "forgot_password" }, "10m");
  res.json({
    success: true,
    message: "If an account with that email exists, a reset code has been sent.",
    verificationToken,
  });
});

// ─── POST /auth/reset-password ────────────────────────────────────────────────
const resetPassword = catchAsync(async (req, res) => {
  const { verificationToken, otp, newPassword } = req.body;

  let decoded;
  try {
    decoded = jwt.verify(verificationToken, process.env.JWT_SECRET);
  } catch {
    throw new AppError("Session expired. Please request a new code.", 400);
  }

  if (decoded.purpose !== "forgot_password")
    throw new AppError("Invalid token.", 400);

  const record = await EmailOTP.findOne({
    email:     decoded.email,
    purpose:   "forgot_password",
    usedAt:    null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!record)
    throw new AppError("Code expired or already used. Request a new one.", 400);

  if (record.attempts >= 5)
    throw new AppError("Too many wrong attempts. Request a new code.", 429);

  const isMatch = await bcrypt.compare(otp, record.otpHash);
  if (!isMatch) {
    record.attempts += 1;
    await record.save();
    const left = 5 - record.attempts;
    throw new AppError(
      `Incorrect code. ${left} attempt${left !== 1 ? "s" : ""} remaining.`,
      400
    );
  }

  record.usedAt = new Date();
  await record.save();

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await User.updateOne({ email: decoded.email }, { password: hashedPassword });

  res.json({ success: true, message: "Password reset successfully." });
});

module.exports = {
  register,
  login,
  sendRegisterOTP,
  verifyRegisterOTP,
  sendProviderOTP,
  verifyProviderOTP,
  forgotPassword,
  resetPassword,
};
