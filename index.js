const express = require("express");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const path = require("path");
const http = require("http");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");

dotenv.config();

// ─── Environment validation — fail fast before any code runs ─────────────────
const REQUIRED_ENV = ["MONGODB_URI", "JWT_SECRET", "SMTP_HOST", "SMTP_USER", "SMTP_PASS"];
const missingVars = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingVars.length > 0) {
  console.error(`\n[FATAL] Missing required environment variables: ${missingVars.join(", ")}`);
  console.error("Copy .env.example to .env and fill in all values.\n");
  process.exit(1);
}
if (
  process.env.JWT_SECRET.length < 32 ||
  process.env.JWT_SECRET === "your_super_secret_key" ||
  process.env.JWT_SECRET.startsWith("REPLACE_")
) {
  console.error("\n[FATAL] JWT_SECRET is too weak or is still the placeholder value.");
  console.error(
    'Generate one with: node -e "require(\'crypto\').randomBytes(64).toString(\'hex\')"'
  );
  console.error("Then set JWT_SECRET in your .env file.\n");
  process.exit(1);
}

const connectDB = require("./config/db");
const { initSocket } = require("./socket");
const { generalLimiter } = require("./middleware/rateLimiter");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const server = http.createServer(app);

// ─── Trust proxy (required for correct IP behind load balancers) ──────────────
if (process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}

// ─── Security headers via Helmet ──────────────────────────────────────────────
app.use(
  helmet({
    // Allow uploaded images/PDFs to be fetched by the frontend
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // Content-Security-Policy — tighten in production after testing
    contentSecurityPolicy:
      process.env.NODE_ENV === "production"
        ? undefined   // helmet default CSP in production
        : false,      // disabled in dev to avoid blocking HMR/devtools
  })
);

// ─── CORS — read allowed origins from .env (supports multiple origins) ────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : ["http://localhost:3000", "http://127.0.0.1:3000"];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ─── General rate limiter (applied before body parsing to save CPU on floods) ─
app.use("/api/", generalLimiter);

// ─── Body parsing with hard size limits (blocks oversized JSON/form attacks) ──
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

// ─── NoSQL injection sanitization ────────────────────────────────────────────
// Strips keys starting with $ or containing . from req.body, req.params, req.query
app.use(mongoSanitize());

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({ success: true, message: "Service Marketplace API is running." });
});

// ─── API routes ───────────────────────────────────────────────────────────────
app.use("/api/auth",          require("./routes/authRoutes"));
app.use("/api/providers",     require("./routes/providerRoutes"));
app.use("/api/admin",         require("./routes/adminRoutes"));
app.use("/api/upload",        require("./routes/uploadRoutes"));
app.use("/api/services",      require("./routes/serviceRoutes"));
app.use("/api/bookings",      require("./routes/bookingRoutes"));
app.use("/api/ratings",       require("./routes/ratingRoutes"));
app.use("/api/addresses",     require("./routes/addressRoutes"));
app.use("/api/coupons",       require("./routes/couponRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/search",        require("./routes/searchRoutes"));

// ─── Static files (uploaded images / PDFs) ───────────────────────────────────
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ─── 404 — unmatched routes ───────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

// ─── Global error handler (MUST be last middleware, needs all 4 args) ─────────
app.use(errorHandler);

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();
    initSocket(server, allowedOrigins);
    server.listen(PORT, () => {
      console.log(
        `[Server] Running on port ${PORT} — ${process.env.NODE_ENV || "development"} mode`
      );
      console.log(`[CORS] Allowed origins: ${allowedOrigins.join(", ")}`);
    });
  } catch (error) {
    console.error("[FATAL] Failed to start server:", error.message);
    process.exit(1);
  }
}

// ─── Process-level safety nets ────────────────────────────────────────────────
process.on("unhandledRejection", (err) => {
  console.error("[FATAL] Unhandled promise rejection:", err);
  server.close(() => process.exit(1));
});

process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught exception:", err);
  process.exit(1);
});

startServer();
