require("dotenv").config();
const http = require("http");
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { Server } = require("socket.io");
const { query } = require("./config/db");

const authRoutes     = require("./modules/auth/authRoutes");
const registerRoutes = require("./modules/register/registerRoutes");
const customerRoutes = require("./modules/customer/customerRoutes");
const driverRoutes = require("./modules/driver/driverRoutes");
const restaurantRoutes = require("./modules/restaurant/restaurantRoutes");
const adminRoutes = require("./modules/admin/adminRoutes");
const accountRoutes = require("./modules/account/accountRoutes");
const rideRoutes = require("./modules/ride/rideRoutes");
const { sendError }  = require("./utils/responseUtils");
const {
  setIo,
  markDriverOnline,
  markDriverOfflineById,
  markDriverOfflineBySocket,
} = require("./realtime/socketState");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

setIo(io);

// ─── Core Middlewares ─────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true, // allow cookies cross-origin
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Routes ───────────────────────────────────────────────────────────────────

// Registration (multipart/form-data — files + fields)
app.use("/api/register", registerRoutes);

// Auth: login, logout, refresh token, profile picture update
app.use("/api/auth", authRoutes);

// Customer dashboard data
app.use("/api/customer", customerRoutes);

// Driver dashboard data
app.use("/api/driver", driverRoutes);

// Restaurant dashboard data
app.use("/api/restaurant", restaurantRoutes);

// Admin dashboard data
app.use("/api/admin", adminRoutes);

// Shared account pages (wallet, trips, promotions, notifications, profile, ratings)
app.use("/api/account", accountRoutes);

// Ride booking and accept flows used by customer and driver UIs
app.use("/api/rides", rideRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  sendError(res, 404, `Route ${req.method} ${req.originalUrl} not found.`);
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  sendError(res, 500, "An unexpected error occurred.");
});

// ─── Socket.IO Events ────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  socket.on("driver_online", async (driverId) => {
    const normalizedDriverId = Number(driverId);
    if (!Number.isInteger(normalizedDriverId) || normalizedDriverId <= 0) {
      return;
    }

    markDriverOnline(normalizedDriverId, socket.id);

    try {
      await query(
        `UPDATE drivers
         SET active_status = true
         WHERE user_id = $1`,
        [normalizedDriverId]
      );
    } catch (err) {
      console.error("Failed to set driver online:", err.message);
    }
  });

  socket.on("driver_offline", async (driverId) => {
    const normalizedDriverId = Number(driverId);
    if (!Number.isInteger(normalizedDriverId) || normalizedDriverId <= 0) {
      return;
    }

    markDriverOfflineById(normalizedDriverId);

    try {
      await query(
        `UPDATE drivers
         SET active_status = false
         WHERE user_id = $1`,
        [normalizedDriverId]
      );
    } catch (err) {
      console.error("Failed to set driver offline:", err.message);
    }
  });

  socket.on("update_location", async ({ driver_id, lat, lng } = {}) => {
    const driverId = Number(driver_id);
    const latitude = Number(lat);
    const longitude = Number(lng);

    if (!Number.isFinite(driverId) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    try {
      await query(
        `UPDATE drivers
         SET current_latitude = $1,
             current_longitude = $2,
             active_status = true
         WHERE user_id = $3`,
        [latitude, longitude, driverId]
      );
      markDriverOnline(driverId, socket.id);
    } catch (err) {
      console.error("Failed to update driver location:", err.message);
    }
  });

  socket.on("join_ride_room", (rideId) => {
    const normalizedRideId = Number(rideId);
    if (!Number.isInteger(normalizedRideId) || normalizedRideId <= 0) {
      return;
    }

    socket.join(`ride_${normalizedRideId}`);
  });

  socket.on("customer_waiting", (rideId) => {
    const normalizedRideId = Number(rideId);
    if (!Number.isInteger(normalizedRideId) || normalizedRideId <= 0) {
      return;
    }

    socket.join(`ride_${normalizedRideId}`);
  });

  socket.on("ride_accepted_by_driver", ({ ride_id, driverDetails } = {}) => {
    const rideId = Number(ride_id);
    if (!Number.isInteger(rideId) || rideId <= 0) {
      return;
    }

    io.to(`ride_${rideId}`).emit("ride_accepted", driverDetails || {});
  });

  socket.on("send_message", (payload = {}) => {
    const rideId = Number(payload.ride_id);
    if (!Number.isInteger(rideId) || rideId <= 0 || !payload.text) {
      return;
    }

    io.to(`ride_${rideId}`).emit("receive_message", {
      ride_id: rideId,
      sender_id: payload.sender_id,
      sender_role: payload.sender_role,
      text: payload.text,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("disconnect", async () => {
    const driverId = markDriverOfflineBySocket(socket.id);

    if (!driverId) {
      return;
    }

    try {
      await query(
        `UPDATE drivers
         SET active_status = false
         WHERE user_id = $1`,
        [driverId]
      );
    } catch (err) {
      console.error("Failed to set driver offline on disconnect:", err.message);
    }
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 UrbanPulse server running on port ${PORT}`);
});

module.exports = app;