const { verifyAccessToken } = require("../utils/tokenUtils");
const { sendError } = require("../utils/responseUtils");

/**
 * Protect any route — verifies Bearer access token
 * Attaches decoded user payload to req.user
 */
const protect = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendError(res, 401, "Access denied. No token provided.");
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded; // { user_id, email, roles, iat, exp }
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return sendError(res, 401, "Access token expired. Please refresh your token.");
    }
    return sendError(res, 401, "Invalid access token.");
  }
};

/**
 * Role-based access control middleware
 * Usage: authorize("Admin"), authorize("Driver", "Customer")
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.roles) {
      return sendError(res, 403, "Forbidden. No roles found.");
    }

    const userRoles = (req.user.roles || []).map((role) => String(role).toLowerCase());
    const requiredRoles = roles.map((role) => String(role).toLowerCase());
    const hasRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      return sendError(
        res,
        403,
        `Forbidden. Required role(s): ${requiredRoles.join(", ")}. Your role(s): ${userRoles.join(", ")}.`
      );
    }

    next();
  };
};

/**
 * Allows the request if the path userId belongs to the logged in user,
 * or if the logged in user has one of the override roles.
 */
const authorizeSelfOrRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.user_id) {
      return sendError(res, 401, "Unauthorized. Missing user context.");
    }

    const paramUserId = Number(req.params.userId);
    if (!Number.isInteger(paramUserId) || paramUserId <= 0) {
      return sendError(res, 400, "A valid userId is required.");
    }

    if (Number(req.user.user_id) === paramUserId) {
      return next();
    }

    const userRoles = (req.user.roles || []).map((role) => String(role).toLowerCase());
    const requiredRoles = roles.map((role) => String(role).toLowerCase());
    const hasRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      return sendError(res, 403, "Forbidden. You can only access your own data.");
    }

    next();
  };
};

module.exports = { protect, authorize, authorizeSelfOrRoles };
