const bcrypt = require("bcrypt");
const { query } = require("../../config/db");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require("../../utils/tokenUtils");

const SALT_ROUNDS = 12;

const normalizeRoleName = (roleName) => {
  const role = String(roleName || "").toLowerCase().trim();
  if (role === "restaurant manager") {
    return "restaurant";
  }
  return role;
};


// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * Login a user with email + password + role.
 * Validates role exists on the account, checks driver approval if applicable.
 * Returns access token + refresh token.
 *
 * @param {string} email
 * @param {string} password
 * @param {string} role  - role sent from frontend ("customer"|"driver"|"restaurant"|"admin")
 * @returns {Object} { accessToken, refreshToken, user }
 */
const loginUser = async (email, password, role) => {
  const normalizedRole = String(role || "").toLowerCase().trim();

  // 1. Fetch user + all their roles
  const result = await query(
    `SELECT
       u.user_id, u.first_name, u.last_name,
       u.email, u.phone, u.profile_picture,
       u.password_hash, u.active,
       ARRAY_AGG(LOWER(r.role_name)) AS roles
     FROM users u
     LEFT JOIN user_role ur ON u.user_id = ur.user_id
     LEFT JOIN roles      r  ON ur.role_id = r.role_id
     WHERE u.email = $1
     GROUP BY u.user_id`,
    [email]
  );

  // 2. Account existence check
  if (result.rows.length === 0) {
    throw { status: 401, message: "No account found with this email." };
  }

  const user = result.rows[0];

  // 3. Account active check
  if (!user.active) {
    throw {
      status: 403,
      message: "Your account has been deactivated. Please contact support.",
    };
  }

  // 4. Password check
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw { status: 401, message: "Incorrect password. Please try again." };
  }

  // 5. Role existence check — does this user actually have the selected role?
  const userRoles = user.roles.filter(Boolean).map(normalizeRoleName);
  if (!userRoles.includes(normalizedRole)) {
    throw {
      status: 403,
      message: `You do not have a ${normalizedRole} account. Please select the correct role or register.`,
    };
  }

  // 6. Driver approval check
  if (normalizedRole === "driver") {
    const driverResult = await query(
      `SELECT is_approved FROM drivers WHERE user_id = $1`,
      [user.user_id]
    );

    if (driverResult.rows.length === 0) {
      throw {
        status: 403,
        message: "Driver profile not found. Please complete your registration.",
      };
    }

    if (!driverResult.rows[0].is_approved) {
      throw {
        status: 403,
        message:
          "Your driver account is pending admin approval. You will be notified once approved.",
      };
    }
  }

  // 7. Restaurant approval check
  if (normalizedRole === "restaurant") {
    const restaurantResult = await query(
      `SELECT
         COALESCE(o.manager_approved, false) AS manager_approved,
         COALESCE(r.is_approved, false) AS restaurant_approved
       FROM owners o
       LEFT JOIN restaurants r ON r.owner_id = o.user_id
       WHERE o.user_id = $1
       LIMIT 1`,
      [user.user_id]
    );

    if (restaurantResult.rows.length === 0) {
      throw {
        status: 403,
        message: "Restaurant manager profile not found. Please complete your registration.",
      };
    }

    const approval = restaurantResult.rows[0];
    if (!approval.manager_approved || !approval.restaurant_approved) {
      throw {
        status: 403,
        message: "Your restaurant account is pending admin approval.",
      };
    }
  }

  // 8. Generate tokens
  const tokenPayload = {
    user_id: user.user_id,
    email: user.email,
    roles: userRoles,
  };

  const accessToken  = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken({ user_id: user.user_id });

  // 9. Persist refresh token
  await query(
    `UPDATE users
     SET refresh_token = $1, updated_at = NOW()
     WHERE user_id = $2`,
    [refreshToken, user.user_id]
  );

  return {
    accessToken,
    refreshToken,
    user: {
      user_id:         user.user_id,
      first_name:      user.first_name,
      last_name:       user.last_name,
      email:           user.email,
      phone:           user.phone,
      profile_picture: user.profile_picture,
      roles:           userRoles,
      activeRole:      normalizedRole,
    },
  };
};


// ─── Reset Password ───────────────────────────────────────────────────────────

/**
 * Reset a user's password using phone validation from DB.
 * Supports two flows:
 * 1) Forgot flow: phone + newPassword
 * 2) Legacy flow: phone + oldPassword + newPassword
 *
 * @param {string} phone
 * @param {string} newPassword
 * @param {string|undefined} oldPassword
 */
const resetPassword = async (phone, newPassword, oldPassword) => {

  // 1. Find user by phone
  const result = await query(
    `SELECT user_id, password_hash, active FROM users WHERE phone = $1`,
    [phone]
  );

  if (result.rows.length === 0) {
    throw { status: 404, message: "No account found with this phone number." };
  }

  const user = result.rows[0];

  // 2. Account active check
  if (!user.active) {
    throw {
      status: 403,
      message: "Your account is deactivated. Please contact support.",
    };
  }

  // 3. Optional legacy verification when old password is provided
  if (oldPassword) {
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isOldPasswordValid) {
      throw { status: 401, message: "Old password is incorrect." };
    }
  }

  // 4. Prevent reuse — new password must differ from old
  const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
  if (isSamePassword) {
    throw {
      status: 400,
      message: "New password must be different from your current password.",
    };
  }

  // 5. Enforce minimum length
  if (newPassword.length < 6) {
    throw { status: 400, message: "New password must be at least 6 characters." };
  }

  // 6. Hash + save
  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await query(
    `UPDATE users
     SET password_hash = $1, updated_at = NOW()
     WHERE user_id = $2`,
    [newHash, user.user_id]
  );
};


// ─── Refresh Token ────────────────────────────────────────────────────────────

/**
 * Issue a new access token using a valid refresh token.
 * @param {string} refreshToken
 * @returns {Object} { accessToken, refreshToken }
 */
const refreshAccessToken = async (refreshToken) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    throw { status: 401, message: "Invalid or expired refresh token. Please login again." };
  }

  const result = await query(
    `SELECT
       u.user_id, u.email, u.active, u.refresh_token,
      ARRAY_AGG(r.role_name) AS roles
     FROM users u
     LEFT JOIN user_role ur ON u.user_id = ur.user_id
     LEFT JOIN roles     r  ON ur.role_id = r.role_id
     WHERE u.user_id = $1
     GROUP BY u.user_id, u.refresh_token`,
    [decoded.user_id]
  );

  if (result.rows.length === 0) {
    throw { status: 401, message: "User not found." };
  }

  const user = result.rows[0];

  if (!user.active) {
    throw { status: 403, message: "Account is deactivated." };
  }

  if (user.refresh_token !== refreshToken) {
    // Possible token reuse — invalidate everything
    await query(
      `UPDATE users SET refresh_token = NULL WHERE user_id = $1`,
      [user.user_id]
    );
    throw { status: 401, message: "Refresh token reuse detected. Please login again." };
  }

  const tokenPayload = {
    user_id: user.user_id,
    email:   user.email,
    roles:   user.roles.filter(Boolean).map(normalizeRoleName),
  };

  const newAccessToken  = generateAccessToken(tokenPayload);
  const newRefreshToken = generateRefreshToken({ user_id: user.user_id });

  await query(
    `UPDATE users
     SET refresh_token = $1, updated_at = NOW()
     WHERE user_id = $2`,
    [newRefreshToken, user.user_id]
  );

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};


// ─── Logout ───────────────────────────────────────────────────────────────────

/**
 * Logout by nullifying the refresh token in DB.
 * @param {string} userId
 */
const logoutUser = async (userId) => {
  await query(
    `UPDATE users
     SET refresh_token = NULL, updated_at = NOW()
     WHERE user_id = $1`,
    [userId]
  );
};


module.exports = {
  loginUser,
  resetPassword,
  refreshAccessToken,
  logoutUser,
};