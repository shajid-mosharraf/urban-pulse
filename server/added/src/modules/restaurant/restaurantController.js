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

module.exports = { getDashboard };