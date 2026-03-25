const { sendSuccess, sendError } = require("../../utils/responseUtils");
const { getIo } = require("../../realtime/socketState");
const rideService = require("./rideService");

const requestRide = async (req, res) => {
  try {
    const authenticatedCustomerId = Number(req.user?.user_id);
    const data = await rideService.createRideRequest({
      ...(req.body || {}),
      customer_id: authenticatedCustomerId,
    });

    return sendSuccess(res, 201, "Ride request created successfully.", data);
  } catch (err) {
    return sendError(
      res,
      err.status || 500,
      err.message || "Failed to create ride request."
    );
  }
};

const acceptRide = async (req, res) => {
  try {
    const authenticatedDriverId = Number(req.user?.user_id);
    const payload = {
      ...(req.body || {}),
      driver_id: authenticatedDriverId,
    };

    const data = await rideService.acceptRideByDriver(payload);

    const io = getIo();
    if (io) {
      io.to(`ride_${data.ride.ride_id}`).emit("ride_accepted", {
        name: data.driverDetails.first_name,
        phone: data.driverDetails.phone,
        vehicle: data.driverDetails.licence_no,
        rating: data.driverDetails.rating_avg,
        pickup_otp: data.otp?.pickup_otp || null,
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

const cancelRide = async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const customerId = Number(req.user?.user_id);

    if (!Number.isInteger(rideId) || rideId <= 0) {
      return sendError(res, 400, "A valid rideId is required.");
    }

    const data = await rideService.cancelRideByCustomer({
      ride_id: rideId,
      customer_id: customerId,
    });

    const io = getIo();
    if (io) {
      io.to(`ride_${rideId}`).emit("ride_cancelled", {
        ride_id: rideId,
        status: data.status,
        cancelled_by: "customer",
      });
    }

    return sendSuccess(res, 200, "Ride cancelled successfully.", data);
  } catch (err) {
    return sendError(
      res,
      err.status || 500,
      err.message || "Failed to cancel ride."
    );
  }
};

const rateRide = async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    if (!Number.isInteger(rideId) || rideId <= 0) {
      return sendError(res, 400, "A valid rideId is required.");
    }

    const data = await rideService.rateRideParticipant({
      ride_id: rideId,
      rater_id: req.user?.user_id,
      roles: req.user?.roles || [],
      score: req.body?.score,
      comment: req.body?.comment,
    });

    return sendSuccess(res, 200, "Ride rating submitted successfully.", data);
  } catch (err) {
    return sendError(
      res,
      err.status || 500,
      err.message || "Failed to submit ride rating."
    );
  }
};

module.exports = {
  requestRide,
  acceptRide,
  cancelRide,
  rateRide,
};
