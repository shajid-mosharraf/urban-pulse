const { registerUser } = require("./registerService");
const { sendSuccess, sendError } = require("../../utils/responseUtils");

/**
 * POST /api/register
 *
 * Accepts multipart/form-data (because frontend sends files + fields together).
 * Files handled by multer in the route before this controller runs.
 *
 * Body fields:  firstName, lastName, email, phone, password, nid, wallet, role
 * Driver extra: licenseId, licenseExpire, vehiclePlate, vehicleModel, vehicleType, vehicleColor
 * Restaurant:   restaurantName, managerName, location
 * Files:        profilePic (image), licenseDocs (pdf/image) — both optional
 */
const register = async (req, res) => {
  try {
    // req.body   → text fields (parsed by multer)
    // req.files  → { profilePic: [...], licenseDocs: [...] }
    const result = await registerUser(req.body, req.files || {});

    const statusCode = result.isNewUser ? 201 : 200;
    return sendSuccess(res, statusCode, result.message, {
      userId: result.userId,
      role: result.role,
    });

  } catch (err) {
    return sendError(res, err.status || 500, err.message || "Registration failed.");
  }
};

module.exports = { register };