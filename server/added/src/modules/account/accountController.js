const { sendError, sendSuccess } = require("../../utils/responseUtils");
const accountService = require("./accountService");

const parseUserId = (value) => {
  const userId = Number(value);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw { status: 400, message: "A valid userId is required." };
  }
  return userId;
};

const getProfile = async (req, res) => {
  try {
    const userId = parseUserId(req.params.userId);
    const data = await accountService.getUserProfile(userId);
    return sendSuccess(res, 200, "Profile fetched successfully.", data);
  } catch (err) {
    return sendError(res, err.status || 500, err.message || "Failed to fetch profile.");
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = parseUserId(req.params.userId);
    const data = await accountService.updateUserProfile(userId, req.body || {});
    return sendSuccess(res, 200, "Profile updated successfully.", data);
  } catch (err) {
    return sendError(res, err.status || 500, err.message || "Failed to update profile.");
  }
};

const updatePassword = async (req, res) => {
  try {
    const userId = parseUserId(req.params.userId);
    const data = await accountService.updateUserPassword(userId, req.body || {});
    return sendSuccess(res, 200, "Password updated successfully.", data);
  } catch (err) {
    return sendError(res, err.status || 500, err.message || "Failed to update password.");
  }
};

const updateProfilePicture = async (req, res) => {
  try {
    const userId = parseUserId(req.params.userId);
    const data = await accountService.updateUserProfilePicture(userId, req.file);
    return sendSuccess(res, 200, "Profile picture updated successfully.", data);
  } catch (err) {
    return sendError(res, err.status || 500, err.message || "Failed to update profile picture.");
  }
};

const updateDriverLicenseDocument = async (req, res) => {
  try {
    const userId = parseUserId(req.params.userId);
    const data = await accountService.updateDriverLicenseDocument(userId, req.file);
    return sendSuccess(res, 200, "Driver license document updated successfully.", data);
  } catch (err) {
    return sendError(res, err.status || 500, err.message || "Failed to update driver license document.");
  }
};

const getWallet = async (req, res) => {
  try {
    const userId = parseUserId(req.params.userId);
    const data = await accountService.getWalletData(userId);
    return sendSuccess(res, 200, "Wallet fetched successfully.", data);
  } catch (err) {
    return sendError(res, err.status || 500, err.message || "Failed to fetch wallet.");
  }
};

const rechargeWallet = async (req, res) => {
  try {
    const userId = parseUserId(req.params.userId);
    const amount = Number(req.body?.amount);
    const method = req.body?.method;
    const promoCode = req.body?.promoCode;

    if (!Number.isFinite(amount) || amount <= 0) {
      return sendError(res, 400, "A valid amount is required.");
    }

    const data = await accountService.rechargeWallet(userId, amount, method, promoCode);
    return sendSuccess(res, 200, "Wallet recharged successfully.", data);
  } catch (err) {
    return sendError(res, err.status || 500, err.message || "Failed to recharge wallet.");
  }
};

const getTrips = async (req, res) => {
  try {
    const userId = parseUserId(req.params.userId);
    const data = await accountService.getTripsHistory(userId);
    return sendSuccess(res, 200, "Trips fetched successfully.", data);
  } catch (err) {
    return sendError(res, err.status || 500, err.message || "Failed to fetch trips.");
  }
};

const getPromotions = async (req, res) => {
  try {
    const userId = parseUserId(req.params.userId);
    const data = await accountService.getPromotionsData(userId);
    return sendSuccess(res, 200, "Promotions fetched successfully.", data);
  } catch (err) {
    return sendError(res, err.status || 500, err.message || "Failed to fetch promotions.");
  }
};

const getNotifications = async (req, res) => {
  try {
    const userId = parseUserId(req.params.userId);
    const data = await accountService.getNotificationsData(userId);
    return sendSuccess(res, 200, "Notifications fetched successfully.", data);
  } catch (err) {
    return sendError(res, err.status || 500, err.message || "Failed to fetch notifications.");
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const userId = parseUserId(req.params.userId);
    const notificationId = Number(req.params.notificationId);

    if (!Number.isInteger(notificationId) || notificationId <= 0) {
      return sendError(res, 400, "A valid notificationId is required.");
    }

    const data = await accountService.markNotificationAsRead(userId, notificationId);
    return sendSuccess(res, 200, "Notification marked as read.", data);
  } catch (err) {
    return sendError(res, err.status || 500, err.message || "Failed to mark notification as read.");
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    const userId = parseUserId(req.params.userId);
    const data = await accountService.markAllNotificationsAsRead(userId);
    return sendSuccess(res, 200, "All notifications marked as read.", data);
  } catch (err) {
    return sendError(res, err.status || 500, err.message || "Failed to mark all notifications as read.");
  }
};

const deleteNotification = async (req, res) => {
  try {
    const userId = parseUserId(req.params.userId);
    const notificationId = Number(req.params.notificationId);

    if (!Number.isInteger(notificationId) || notificationId <= 0) {
      return sendError(res, 400, "A valid notificationId is required.");
    }

    const data = await accountService.deleteNotification(userId, notificationId);
    return sendSuccess(res, 200, "Notification deleted.", data);
  } catch (err) {
    return sendError(res, err.status || 500, err.message || "Failed to delete notification.");
  }
};

const deleteReadNotifications = async (req, res) => {
  try {
    const userId = parseUserId(req.params.userId);
    const data = await accountService.deleteReadNotifications(userId);
    return sendSuccess(res, 200, "Read notifications deleted.", data);
  } catch (err) {
    return sendError(res, err.status || 500, err.message || "Failed to delete read notifications.");
  }
};

const getRatings = async (req, res) => {
  try {
    const userId = parseUserId(req.params.userId);
    const data = await accountService.getRatingsData(userId);
    return sendSuccess(res, 200, "Ratings fetched successfully.", data);
  } catch (err) {
    return sendError(res, err.status || 500, err.message || "Failed to fetch ratings.");
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updatePassword,
  updateProfilePicture,
  updateDriverLicenseDocument,
  getWallet,
  rechargeWallet,
  getTrips,
  getPromotions,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteReadNotifications,
  getRatings,
};
