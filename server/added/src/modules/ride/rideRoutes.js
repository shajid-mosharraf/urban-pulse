const express = require("express");
const rideController = require("./rideController");
const { protect, authorize } = require("../../middlewares/authMiddleware");

const router = express.Router();

// Frontend Ride page uses this to create a ride request.
router.post("/request", protect, authorize("customer"), rideController.requestRide);

// Driver dashboard uses this to claim the ride.
router.post("/accept", protect, authorize("driver"), rideController.acceptRide);

// Customer can cancel only before pickup (requested/accepted).
router.post("/:rideId/cancel", protect, authorize("customer"), rideController.cancelRide);

// Both customer and driver can rate each other after completion.
router.post("/:rideId/rate", protect, authorize("customer", "driver"), rideController.rateRide);

module.exports = router;
