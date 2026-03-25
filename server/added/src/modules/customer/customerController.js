const { sendError, sendSuccess } = require("../../utils/responseUtils");
const customerService = require("./customerService");
const { getIo } = require("../../realtime/socketState");

const getDashboard = async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return sendError(res, 400, "A valid customer userId is required.");
    }

    const data = await customerService.getCustomerDashboardData(userId);
    return sendSuccess(res, 200, "Customer dashboard fetched successfully.", data);
  } catch (err) {
    return sendError(
      res,
      err.status || 500,
      err.message || "Failed to fetch customer dashboard."
    );
  }
};

const confirmRideCompletion = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const rideId = Number(req.params.rideId);
    const otp = req.body?.otp;

    if (!Number.isInteger(userId) || userId <= 0) {
      return sendError(res, 400, "A valid customer userId is required.");
    }

    if (!Number.isInteger(rideId) || rideId <= 0) {
      return sendError(res, 400, "A valid rideId is required.");
    }

    const data = await customerService.confirmRideCompletion(userId, rideId, otp);

    const io = getIo();
    if (io) {
      io.to(`ride_${rideId}`).emit("ride_completed", {
        ride_id: rideId,
        status: data.status,
        end_time: data.end_time,
      });
    }

    return sendSuccess(res, 200, "Ride completion confirmed.", data);
  } catch (err) {
    return sendError(
      res,
      err.status || 500,
      err.message || "Failed to confirm ride completion."
    );
  }
};

module.exports = { getDashboard, confirmRideCompletion };