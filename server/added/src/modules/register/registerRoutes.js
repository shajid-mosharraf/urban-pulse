const express = require("express");
const router = express.Router();

const { register } = require("./registerController");
const { uploadFields, handleUploadError } = require("../../middlewares/uploadMiddleware");

/**
 * Multer fields config:
 *  - profilePic   → single image (all roles, optional)
 *  - licenseDocs  → single pdf/image (driver only, optional)
 *
 * Using uploadFields so both files can come in the same multipart request.
 */
const uploadRegisterFiles = uploadFields([
  { name: "profilePic", maxCount: 1 },
  { name: "licenseDocs", maxCount: 1 },
]);

/**
 * @route   POST /api/register
 * @desc    Register new user or add role to existing user
 * @access  Public
 *
 * Content-Type: multipart/form-data
 *
 * Fields:
 *   firstName, lastName, email, phone, password, nid, wallet, role
 *   [driver]     licenseId, licenseExpire, vehiclePlate, vehicleModel, vehicleType, vehicleColor
 *   [restaurant] restaurantName, managerName, location
 * Files:
 *   profilePic   (optional — image)
 *   licenseDocs  (optional — pdf or image, driver only)
 */
router.post(
  "/",
  uploadRegisterFiles,  // parse multipart/form-data, attach files to req.files
  handleUploadError,    // catch multer errors cleanly
  register              // run business logic
);

module.exports = router;