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

router.get(
	"/food/restaurants",
	protect,
	authorize("customer"),
	customerController.getFoodRestaurants
);

router.get(
	"/food/restaurants/:restaurantId/menu",
	protect,
	authorize("customer"),
	customerController.getRestaurantMenu
);

router.post(
	"/:userId/food/orders",
	protect,
	authorize("customer"),
	authorizeSelfOrRoles("admin"),
	customerController.createFoodOrder
);

module.exports = router;