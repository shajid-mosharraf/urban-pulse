const { sendError, sendSuccess } = require("../../utils/responseUtils");
const driverService = require("./driverService");
const { getIo } = require("../../realtime/socketState");

const getDashboard = async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return sendError(res, 400, "A valid driver userId is required.");
    }

    const data = await driverService.getDriverDashboardData(userId);
    return sendSuccess(res, 200, "Driver dashboard fetched successfully.", data);
  } catch (err) {
    return sendError(
      res,
      err.status || 500,
      err.message || "Failed to fetch driver dashboard."
    );
  }
};

const acceptRide = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const rideId = Number(req.body?.ride_id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return sendError(res, 400, "Valid user ID required.");
    }

    if (!Number.isInteger(rideId) || rideId <= 0) {
      return sendError(res, 400, "Valid ride ID required.");
    }

    const data = await driverService.acceptRideRequest(userId, rideId);

    const io = getIo();
    if (io) {
      io.to(`ride_${rideId}`).emit("ride_accepted", {
        name: data.driver?.name || "Driver",
        phone: data.driver?.phone || "",
        vehicle: data.driver?.vehicle || "Assigned vehicle",
        rating: data.driver?.rating || "5.0",
        pickup_otp: data.pickup_otp,
      });
    }

    return sendSuccess(res, 200, "Ride accepted successfully.", data);
  } catch (err) {
    return sendError(
      res,
      err.status || 500,
      err.message || "Failed to accept ride."
    );
  }
};

const declineRide = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const rideId = Number(req.body?.ride_id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return sendError(res, 400, "Valid user ID required.");
    }

    if (!Number.isInteger(rideId) || rideId <= 0) {
      return sendError(res, 400, "Valid ride ID required.");
    }

    const data = await driverService.declineRideRequest(userId, rideId);
    return sendSuccess(res, 200, "Ride declined successfully.", data);
  } catch (err) {
    return sendError(
      res,
      err.status || 500,
      err.message || "Failed to decline ride."
    );
  }
};

const toggleStatus = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const isOnline = req.body?.is_online;

    if (!Number.isInteger(userId) || userId <= 0) {
      return sendError(res, 400, "Valid user ID required.");
    }

    if (typeof isOnline !== "boolean") {
      return sendError(res, 400, "is_online must be boolean.");
    }

    const data = await driverService.toggleDriverStatus(userId, isOnline);
    return sendSuccess(res, 200, "Driver status updated.", data);
  } catch (err) {
    return sendError(
      res,
      err.status || 500,
      err.message || "Failed to update status."
    );
  }
};

const updateLocation = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const latitude = req.body?.latitude;
    const longitude = req.body?.longitude;

    if (!Number.isInteger(userId) || userId <= 0) {
      return sendError(res, 400, "Valid user ID required.");
    }

    const data = await driverService.updateGPSLocation(userId, latitude, longitude);

    const io = getIo();
    if (io && Array.isArray(data.active_ride_ids)) {
      data.active_ride_ids.forEach((rideId) => {
        io.to(`ride_${rideId}`).emit("driver_location_update", {
          ride_id: rideId,
          driver_id: userId,
          latitude: data.latitude,
          longitude: data.longitude,
          timestamp: new Date().toISOString(),
        });
      });
    }

    return sendSuccess(res, 200, "Location updated.", data);
  } catch (err) {
    return sendError(
      res,
      err.status || 500,
      err.message || "Failed to update location."
    );
  }
};

const startRide = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const rideId = Number(req.body?.ride_id);
    const pickupOtp = String(req.body?.pickup_otp || "").trim();

    if (!Number.isInteger(userId) || userId <= 0) {
      return sendError(res, 400, "Valid user ID required.");
    }

    if (!Number.isInteger(rideId) || rideId <= 0) {
      return sendError(res, 400, "Valid ride ID required.");
    }

    const data = await driverService.startActiveRide(userId, rideId, pickupOtp);

    const io = getIo();
    if (io) {
      io.to(`ride_${rideId}`).emit("ride_picked_up", {
        ride_id: rideId,
        status: data.status,
        start_time: data.start_time,
      });
    }

    return sendSuccess(res, 200, "Ride started.", data);
  } catch (err) {
    return sendError(
      res,
      err.status || 500,
      err.message || "Failed to start ride."
    );
  }
};

const endRide = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const rideId = Number(req.body?.ride_id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return sendError(res, 400, "Valid user ID required.");
    }

    if (!Number.isInteger(rideId) || rideId <= 0) {
      return sendError(res, 400, "Valid ride ID required.");
    }

    const data = await driverService.endActiveRide(userId, rideId);

    const io = getIo();
    if (io) {
      io.to(`ride_${rideId}`).emit("ride_driver_completed", {
        ride_id: rideId,
        status: data.status,
        completion_otp: data.completion_otp,
      });
    }

    return sendSuccess(res, 200, "Ride end processed.", data);
  } catch (err) {
    return sendError(
      res,
      err.status || 500,
      err.message || "Failed to end ride."
    );
  }
};

module.exports = {
  getDashboard,
  acceptRide,
  declineRide,
  toggleStatus,
  updateLocation,
  startRide,
  endRide,
};