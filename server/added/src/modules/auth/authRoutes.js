const express = require("express");
const router = express.Router();

const authController = require("./authController");
const { protect } = require("../../middlewares/authMiddleware");

/**
 * @route   POST /api/auth/login
 * @desc    Login with email + password + role
 * @access  Public
 * @body    { email, password, role }
 */
router.post("/login", authController.login);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password using phone (supports forgot and legacy flows)
 * @access  Public
 * @body    { phone, newPassword, confirmPassword? , oldPassword? }
 */
router.post("/reset-password", authController.resetPassword);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Alias of reset-password for frontend naming consistency
 * @access  Public
 */
router.post("/forgot-password", authController.resetPassword);

/**
 * @route   POST /api/auth/refresh
 * @desc    Get new access token using refresh token (from cookie or body)
 * @access  Public
 * @cookie  refreshToken
 * @body    { refreshToken } (optional — for mobile clients)
 */
router.post("/refresh", authController.refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout — clears refresh token from DB and cookie
 * @access  Private (requires valid access token)
 */
router.post("/logout", protect, authController.logout);


module.exports = router;