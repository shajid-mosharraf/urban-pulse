const { sendError, sendSuccess } = require("../../utils/responseUtils");
const adminService = require("./adminService");

const getDashboard = async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return sendError(res, 400, "A valid admin userId is required.");
    }

    const data = await adminService.getAdminDashboardData(userId);
    return sendSuccess(res, 200, "Admin dashboard fetched successfully.", data);
  } catch (err) {
    return sendError(
      res,
      err.status || 500,
      err.message || "Failed to fetch admin dashboard."
    );
  }
};

const getDriverDetails = async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return sendError(res, 400, "A valid driver userId is required.");
    }

    const data = await adminService.getDriverVerificationDetails(userId);
    return sendSuccess(res, 200, "Driver details fetched successfully.", data);
  } catch (err) {
    return sendError(
      res,
      err.status || 500,
      err.message || "Failed to fetch driver details."
    );
  }
};

const verifyDriver = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const approved = req.body?.approved;

    if (!Number.isInteger(userId) || userId <= 0) {
      return sendError(res, 400, "A valid driver userId is required.");
    }

    if (typeof approved !== "boolean") {
      return sendError(res, 400, "The 'approved' flag must be boolean.");
    }

    const data = await adminService.verifyDriver(userId, approved);
    return sendSuccess(
      res,
      200,
      approved ? "Driver approved successfully." : "Driver rejected successfully.",
      data
    );
  } catch (err) {
    return sendError(
      res,
      err.status || 500,
      err.message || "Failed to update driver verification status."
    );
  }
};

const verifyRestaurant = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const approved = req.body?.approved;

    if (!Number.isInteger(userId) || userId <= 0) {
      return sendError(res, 400, "A valid restaurant owner userId is required.");
    }

    if (typeof approved !== "boolean") {
      return sendError(res, 400, "The 'approved' flag must be boolean.");
    }

    const data = await adminService.verifyRestaurant(userId, approved);
    return sendSuccess(
      res,
      200,
      approved ? "Restaurant approved successfully." : "Restaurant rejected successfully.",
      data
    );
  } catch (err) {
    return sendError(
      res,
      err.status || 500,
      err.message || "Failed to update restaurant verification status."
    );
  }
};

const forceCompleteRide = async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);

    if (!Number.isInteger(rideId) || rideId <= 0) {
      return sendError(res, 400, "A valid rideId is required.");
    }

    const data = await adminService.forceCompleteRide(rideId);
    return sendSuccess(res, 200, "Ride force-completed successfully.", data);
  } catch (err) {
    return sendError(
      res,
      err.status || 500,
      err.message || "Failed to force-complete ride."
    );
  }
};

module.exports = {
  getDashboard,
  getDriverDetails,
  verifyDriver,
  verifyRestaurant,
  forceCompleteRide,
};