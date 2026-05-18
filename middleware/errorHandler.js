const AppError = require("../utils/AppError");

// ─── Error type handlers ──────────────────────────────────────────────────────

// Mongoose bad ObjectId (e.g. /bookings/not-a-valid-id)
const handleCastError = (err) =>
  new AppError(`Invalid ${err.path}: "${err.value}". Please provide a valid ID.`, 400);

// MongoDB duplicate key (e.g. duplicate email/phone)
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue || {})[0] || "field";
  const value = err.keyValue?.[field];
  return new AppError(
    `The ${field} "${value}" is already in use. Please use a different value.`,
    409
  );
};

// Mongoose schema validation failed
const handleValidationError = (err) => {
  const messages = Object.values(err.errors).map((e) => e.message);
  return new AppError(messages[0], 400);
};

// JWT signature invalid
const handleJWTError = () =>
  new AppError("Invalid token. Please log in again.", 401);

// JWT expired
const handleTokenExpiredError = () =>
  new AppError("Your session has expired. Please log in again.", 401);

// Multer file-size exceeded
const handleMulterError = (err) => {
  if (err.code === "LIMIT_FILE_SIZE")
    return new AppError("File size cannot exceed 2 MB.", 400);
  return new AppError(err.message || "File upload error.", 400);
};

// ─── Response helpers ─────────────────────────────────────────────────────────

const sendDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    status: err.status,
    message: err.message,
    stack: err.stack,
    error: err,
  });
};

const sendProd = (err, res) => {
  if (err.isOperational) {
    // Trusted, user-facing error — safe to expose the message
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  } else {
    // Programming bug or unknown error — never leak internals
    console.error("[UNHANDLED ERROR]", err);
    res.status(500).json({
      success: false,
      message: "Something went wrong on our end. Please try again later.",
    });
  }
};

// ─── Global error handler (must be 4-arg middleware, last in index.js) ────────
module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (process.env.NODE_ENV === "development") {
    sendDev(err, res);
    return;
  }

  // Clone so mutations don't affect the original
  let error = Object.assign(Object.create(Object.getPrototypeOf(err)), err);
  error.message = err.message;

  if (error.name === "CastError") error = handleCastError(error);
  if (error.code === 11000) error = handleDuplicateKeyError(error);
  if (error.name === "ValidationError") error = handleValidationError(error);
  if (error.name === "JsonWebTokenError") error = handleJWTError();
  if (error.name === "TokenExpiredError") error = handleTokenExpiredError();
  if (error.name === "MulterError") error = handleMulterError(error);

  sendProd(error, res);
};
