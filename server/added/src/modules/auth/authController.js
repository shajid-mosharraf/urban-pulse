const authService = require("./authService");
const { sendSuccess, sendError } = require("../../utils/responseUtils");


// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Body: { email, password, role }
 */
const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Field validation
    if (!email || !password || !role) {
      return sendError(res, 400, "Email, password, and role are required.");
    }

    // Role whitelist — reject unknown roles early
    const allowedRoles = ["customer", "driver", "restaurant", "admin"];
    if (!allowedRoles.includes(role)) {
      return sendError(res, 400, `Invalid role. Must be one of: ${allowedRoles.join(", ")}.`);
    }

    const { accessToken, refreshToken, user } = await authService.loginUser(
      email,
      password,
      role
    );

    // Send refresh token as HttpOnly cookie (web); mobile reads it from body
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return sendSuccess(res, 200, "Login successful.", { accessToken, user });

  } catch (err) {
    return sendError(res, err.status || 500, err.message || "Login failed.");
  }
};


// ─── Reset Password ───────────────────────────────────────────────────────────

/**
 * POST /api/auth/reset-password
 * Body (forgot flow): { phone, newPassword, confirmPassword }
 * Body (legacy flow): { phone, oldPassword, newPassword }
 */
const resetPassword = async (req, res) => {
  try {
    const { phone, oldPassword, newPassword, confirmPassword } = req.body;

    if (!phone || !newPassword) {
      return sendError(res, 400, "Phone number and new password are required.");
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return sendError(res, 400, "New password and confirm password do not match.");
    }

    if (newPassword.length < 6) {
      return sendError(res, 400, "New password must be at least 6 characters.");
    }

    await authService.resetPassword(phone, newPassword, oldPassword);

    return sendSuccess(res, 200, "Password reset successfully. Please login with your new password.");

  } catch (err) {
    return sendError(res, err.status || 500, err.message || "Password reset failed.");
  }
};


// ─── Refresh Token ────────────────────────────────────────────────────────────

/**
 * POST /api/auth/refresh
 * Cookie: refreshToken  (or body for mobile)
 */
const refreshToken = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!token) {
      return sendError(res, 400, "Refresh token is required.");
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await authService.refreshAccessToken(token);

    // Rotate cookie
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return sendSuccess(res, 200, "Token refreshed successfully.", { accessToken });

  } catch (err) {
    return sendError(res, err.status || 500, err.message || "Token refresh failed.");
  }
};


// ─── Logout ───────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/logout
 * Requires valid access token (protect middleware).
 */
const logout = async (req, res) => {
  try {
    const userId = req.user.user_id; // injected by protect middleware

    await authService.logoutUser(userId);

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
    });

    return sendSuccess(res, 200, "Logged out successfully.");

  } catch (err) {
    return sendError(res, err.status || 500, err.message || "Logout failed.");
  }
};


module.exports = { login, resetPassword, refreshToken, logout };