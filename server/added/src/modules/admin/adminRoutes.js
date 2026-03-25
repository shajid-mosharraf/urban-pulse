const express = require("express");

const adminController = require("./adminController");
const {
	protect,
	authorize,
	authorizeSelfOrRoles,
} = require("../../middlewares/authMiddleware");

const router = express.Router();

router.get(
	"/dashboard/:userId",
	protect,
	authorize("admin"),
	authorizeSelfOrRoles("admin"),
	adminController.getDashboard
);

router.get(
	"/drivers/:userId/details",
	protect,
	authorize("admin"),
	authorizeSelfOrRoles("admin"),
	adminController.getDriverDetails
);

router.patch(
	"/drivers/:userId/verify",
	protect,
	authorize("admin"),
	authorizeSelfOrRoles("admin"),
	adminController.verifyDriver
);

router.patch(
	"/restaurants/:userId/verify",
	protect,
	authorize("admin"),
	authorizeSelfOrRoles("admin"),
	adminController.verifyRestaurant
);

router.patch(
	"/rides/:rideId/force-complete",
	protect,
	authorize("admin"),
	adminController.forceCompleteRide
);

module.exports = router;