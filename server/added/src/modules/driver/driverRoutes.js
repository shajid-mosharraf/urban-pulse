const express = require("express");

const driverController = require("./driverController");
const {
	protect,
	authorize,
	authorizeSelfOrRoles,
} = require("../../middlewares/authMiddleware");

const router = express.Router();

router.get(
	"/dashboard/:userId",
	protect,
	authorize("driver"),
	authorizeSelfOrRoles("admin"),
	driverController.getDashboard
);

router.post(
	"/:userId/rides/accept",
	protect,
	authorize("driver"),
	authorizeSelfOrRoles("driver"),
	driverController.acceptRide
);

router.post(
	"/:userId/rides/start",
	protect,
	authorize("driver"),
	authorizeSelfOrRoles("driver"),
	driverController.startRide
);

router.post(
	"/:userId/rides/end",
	protect,
	authorize("driver"),
	authorizeSelfOrRoles("driver"),
	driverController.endRide
);

router.post(
	"/:userId/rides/decline",
	protect,
	authorize("driver"),
	authorizeSelfOrRoles("driver", "admin"),
	driverController.declineRide
);

router.patch(
	"/:userId/status",
	protect,
	authorize("driver"),
	authorizeSelfOrRoles("driver"),
	driverController.toggleStatus
);

router.patch(
	"/:userId/location",
	protect,
	authorize("driver"),
	authorizeSelfOrRoles("driver"),
	driverController.updateLocation
);

router.post(
	"/:userId/vehicle/switch",
	protect,
	authorize("driver"),
	authorizeSelfOrRoles("driver"),
	driverController.switchActiveVehicle
);

module.exports = router;