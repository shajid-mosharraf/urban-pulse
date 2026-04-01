const express = require("express");

const accountController = require("./accountController");
const {
  uploadProfilePicture,
  uploadLicenseDocument,
  handleUploadError,
} = require("../../middlewares/uploadMiddleware");
const {
  protect,
  authorizeSelfOrRoles,
} = require("../../middlewares/authMiddleware");

const router = express.Router();

router.get("/:userId/profile", protect, authorizeSelfOrRoles("admin"), accountController.getProfile);
router.put("/:userId/profile", protect, authorizeSelfOrRoles("admin"), accountController.updateProfile);
router.put("/:userId/password", protect, authorizeSelfOrRoles("admin"), accountController.updatePassword);
router.post(
  "/:userId/profile-picture",
  protect,
  authorizeSelfOrRoles("admin"),
  uploadProfilePicture,
  handleUploadError,
  accountController.updateProfilePicture
);
router.post(
  "/:userId/license-document",
  protect,
  authorizeSelfOrRoles("admin"),
  uploadLicenseDocument,
  handleUploadError,
  accountController.updateDriverLicenseDocument
);

router.get("/:userId/wallet", protect, authorizeSelfOrRoles("admin"), accountController.getWallet);
router.post("/:userId/wallet/recharge", protect, authorizeSelfOrRoles("admin"), accountController.rechargeWallet);

router.get("/:userId/trips", protect, authorizeSelfOrRoles("admin"), accountController.getTrips);
router.get("/:userId/promotions", protect, authorizeSelfOrRoles("admin"), accountController.getPromotions);
router.get("/:userId/notifications", protect, authorizeSelfOrRoles("admin"), accountController.getNotifications);
router.patch("/:userId/notifications/read-all", protect, authorizeSelfOrRoles("admin"), accountController.markAllNotificationsRead);
router.patch("/:userId/notifications/:notificationId/read", protect, authorizeSelfOrRoles("admin"), accountController.markNotificationRead);
router.delete("/:userId/notifications/read", protect, authorizeSelfOrRoles("admin"), accountController.deleteReadNotifications);
router.delete("/:userId/notifications/:notificationId", protect, authorizeSelfOrRoles("admin"), accountController.deleteNotification);
router.get("/:userId/ratings", protect, authorizeSelfOrRoles("admin"), accountController.getRatings);

module.exports = router;
