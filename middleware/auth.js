const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  try {
    const token =
      req.cookies?.token ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null);

    if (!token) {
      return res.status(401).json({ success: false, message: "Not authorized, no token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

const providerOnly = (req, res, next) => {
  if (req.user?.role !== "provider") {
    return res.status(403).json({ success: false, message: "Provider access only" });
  }
  next();
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin access only" });
  }
  next();
};

const customerOnly = (req, res, next) => {
  if (req.user?.role !== "customer") {
    return res.status(403).json({ success: false, message: "Customer access only" });
  }
  next();
};

module.exports = { protect, providerOnly, adminOnly, customerOnly };
