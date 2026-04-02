const express = require("express");

const restaurantController = require("./restaurantController");
const {
	protect,
	authorize,
	authorizeSelfOrRoles,
} = require("../../middlewares/authMiddleware");

const router = express.Router();

router.get(
	"/dashboard/:userId",
	protect,
	authorize("restaurant"),
	authorizeSelfOrRoles("admin"),
	restaurantController.getDashboard
);

router.patch(
	"/orders/:orderId/status",
	protect,
	authorize("restaurant"),
	restaurantController.patchOrderStatus
);

router.patch(
	"/orders/:orderId/decision",
	protect,
	authorize("restaurant"),
	restaurantController.patchOrderDecision
);

router.patch(
	"/menu/:itemId/availability",
	protect,
	authorize("restaurant"),
	restaurantController.patchMenuItemAvailability
);
router.patch(
	"/orders/:orderId/ready-for-delivery",
	protect,
	authorize("restaurant"),
	restaurantController.patchOrderReadyForDelivery
);


router.get(
	"/menu",
	protect,
	authorize("restaurant"),
	restaurantController.getMenuItems
);

router.post(
	"/menu",
	protect,
	authorize("restaurant"),
	restaurantController.postMenuItem
);

module.exports = router;