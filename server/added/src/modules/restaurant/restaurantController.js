const { sendError, sendSuccess } = require("../../utils/responseUtils");
const restaurantService = require("./restaurantService");

const getDashboard = async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return sendError(res, 400, "A valid restaurant owner userId is required.");
    }

    const data = await restaurantService.getRestaurantDashboardData(userId);
    return sendSuccess(res, 200, "Restaurant dashboard fetched successfully.", data);
  } catch (err) {
    return sendError(
      res,
      err.status || 500,
      err.message || "Failed to fetch restaurant dashboard."
    );
  }
};

const patchOrderStatus = async (req, res) => {
  try {
    const userId = Number(req.user?.user_id);
    const orderId = Number(req.params.orderId);
    const { status } = req.body || {};

    if (!Number.isInteger(userId) || userId <= 0) {
      return sendError(res, 401, "Unauthorized user context.");
    }

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return sendError(res, 400, "A valid orderId is required.");
    }

    const data = await restaurantService.updateOrderStatus(userId, orderId, status);
    return sendSuccess(res, 200, "Order status updated successfully.", data);
  } catch (err) {
    return sendError(
      res,
      err.status || 500,
      err.message || "Failed to update order status."
    );
  }
};

const patchOrderDecision = async (req, res) => {
  try {
    const userId = Number(req.user?.user_id);
    const orderId = Number(req.params.orderId);
    const { decision } = req.body || {};

    if (!Number.isInteger(userId) || userId <= 0) {
      return sendError(res, 401, "Unauthorized user context.");
    }

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return sendError(res, 400, "A valid orderId is required.");
    }

    const data = await restaurantService.decideOrder(userId, orderId, decision);
    return sendSuccess(res, 200, "Order decision saved successfully.", data);
  } catch (err) {
    return sendError(
      res,
      err.status || 500,
      err.message || "Failed to save order decision."
    );
  }
};

const patchMenuItemAvailability = async (req, res) => {
  try {
    const userId = Number(req.user?.user_id);
    const itemId = Number(req.params.itemId);
    const { is_available: isAvailable } = req.body || {};

    if (!Number.isInteger(userId) || userId <= 0) {
      return sendError(res, 401, "Unauthorized user context.");
    }

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return sendError(res, 400, "A valid itemId is required.");
    }

    if (typeof isAvailable !== "boolean") {
      return sendError(res, 400, "is_available must be a boolean.");
    }

    const data = await restaurantService.updateMenuItemAvailability(
      userId,
      itemId,
      isAvailable
    );
    return sendSuccess(res, 200, "Menu item availability updated.", data);
  } catch (err) {
    return sendError(
      res,
      err.status || 500,
      err.message || "Failed to update item availability."
    );
  }
};

const postMenuItem = async (req, res) => {
  try {
    const userId = Number(req.user?.user_id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return sendError(res, 401, "Unauthorized user context.");
    }

    const data = await restaurantService.createMenuItem(userId, req.body || {});
    return sendSuccess(res, 201, "Menu item created successfully.", data);
  } catch (err) {
    return sendError(
      res,
      err.status || 500,
      err.message || "Failed to create menu item."
    );
  }
};

const getMenuItems = async (req, res) => {
  try {
    const userId = Number(req.user?.user_id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return sendError(res, 401, "Unauthorized user context.");
    }

    const data = await restaurantService.listAllMenuItems(userId);
    return sendSuccess(res, 200, "Menu items fetched successfully.", data);
  } catch (err) {
    return sendError(
      res,
      err.status || 500,
      err.message || "Failed to fetch menu items."
    );
  }
};

const patchOrderReadyForDelivery = async (req, res) => {
  try {
    const userId = Number(req.user?.user_id);
    const orderId = Number(req.params.orderId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return sendError(res, 401, "Unauthorized user context.");
    }

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return sendError(res, 400, "A valid orderId is required.");
    }

    const data = await restaurantService.markReadyForDelivery(userId, orderId);
    return sendSuccess(res, 200, "Order marked ready for delivery.", data);
  } catch (err) {
    return sendError(
      res,
      err.status || 500,
      err.message || "Failed to mark order ready for delivery."
    );
  }
};

module.exports = {
  getDashboard,
  patchOrderStatus,
  patchOrderDecision,
  patchMenuItemAvailability,
  postMenuItem,
  getMenuItems,
  patchOrderReadyForDelivery,
};