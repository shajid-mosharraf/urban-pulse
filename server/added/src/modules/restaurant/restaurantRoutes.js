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

module.exports = router;