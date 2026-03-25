const express = require("express");

const customerController = require("./customerController");
const {
	protect,
	authorize,
	authorizeSelfOrRoles,
} = require("../../middlewares/authMiddleware");

const router = express.Router();

/**
 * @route   GET /api/customer/dashboard/:userId
 * @desc    Get dashboard data for customer
 * @access  Private (customer only, self scope)
 */
router.get(
	"/dashboard/:userId",
	protect,
	authorize("customer"),
	authorizeSelfOrRoles("admin"),
	customerController.getDashboard
);

router.post(
	"/:userId/rides/:rideId/confirm",
	protect,
	authorize("customer"),
	authorizeSelfOrRoles("admin"),
	customerController.confirmRideCompletion
);

module.exports = router;