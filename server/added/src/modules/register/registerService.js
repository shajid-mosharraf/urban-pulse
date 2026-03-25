const bcrypt = require("bcrypt");
const { query, getClient } = require("../../config/db");
const { uploadToSupabase } = require("../../middlewares/uploadMiddleware");

const SALT_ROUNDS = 12;

// ─── Valid self-registerable roles (matching frontend values) ─────────────────
const VALID_ROLES = ["customer", "driver", "restaurant"];

/**
 * Register a new user OR add a new role to an existing user.
 *
 * Handles 3 roles: customer | driver | restaurant
 * Each role may insert into role-specific tables.
 *
 * @param {Object} fields   - All parsed body fields from controller
 * @param {Object} files    - { profilePic, licenseDocs } — multer file objects
 * @returns {Object}        - { message, userId, role, isNewUser }
 */
const registerUser = async (fields, files = {}) => {
  const {
    // Common
    firstName, lastName, email, phone, password, nid, wallet,
    // Driver
    licenseId, licenseExpire,
    vehiclePlate, vehicleModel, vehicleType, vehicleColor,
    // Restaurant
    restaurantName, managerName, location,
    // Role
    role,
  } = fields;

  // ── Validate role ───────────────────────────────────────────────────────────
  if (!role || !VALID_ROLES.includes(role.toLowerCase())) {
    throw { status: 400, message: `Invalid role. Allowed: ${VALID_ROLES.join(", ")}` };
  }

  const normalizedRole = role.toLowerCase();

  // ── Validate required common fields ────────────────────────────────────────
  if (!firstName || !lastName || !email || !phone || !password || !nid) {
    throw { status: 400, message: "Missing required fields: firstName, lastName, email, phone, password, nid." };
  }

  // ── Validate role-specific required fields ──────────────────────────────────
  if (normalizedRole === "driver") {
    if (!licenseId || !licenseExpire || !vehiclePlate || !vehicleModel || !vehicleType || !vehicleColor) {
      throw { status: 400, message: "Missing required driver fields." };
    }
  }

  if (normalizedRole === "restaurant") {
    if (!restaurantName || !location) {
      throw { status: 400, message: "Missing required restaurant fields: restaurantName, location." };
    }
  }

  const client = await getClient();

  try {
    await client.query("BEGIN");

    // ── 1. Check if user already exists ────────────────────────────────────
    const existingUserResult = await client.query(
      `SELECT user_id, email
       FROM "users" 
       WHERE email = $1 OR phone = $2 
       LIMIT 1`,
      [email, phone]
    );

    let userId;
    let isNewUser = false;

    if (existingUserResult.rows.length > 0) {
      // ── User exists — check if they already have this role ──────────────
      userId = existingUserResult.rows[0].user_id;

      const existingRoleResult = await client.query(
        `SELECT ur.id 
         FROM "user_role" ur
         JOIN "roles" r ON ur.role_id = r.role_id
         WHERE ur.user_id = $1 AND LOWER(r.role_name) = $2`,
        [userId, normalizedRole]
      );

      if (existingRoleResult.rows.length > 0) {
        throw {
          status: 409,
          message: `User already exists and is already registered as a ${normalizedRole}.`,
        };
      }

      // ── Assign new role + role-specific data ────────────────────────────
      await assignRole(client, userId, normalizedRole);
      await insertRoleSpecificData(client, userId, normalizedRole, fields, files);

      await client.query("COMMIT");

      return {
        message: `User already existed. New role as ${normalizedRole} has been added successfully.`,
        userId,
        role: normalizedRole,
        isNewUser: false,
      };

    } else {
      // ── 2. New user — upload profile picture if provided ─────────────────
      let profilePictureUrl = null;

      if (files.profilePic) {
        const file = files.profilePic[0]; // multer fields returns array
        profilePictureUrl = await uploadToSupabase({
          buffer: file.buffer,
          mimetype: file.mimetype,
          originalName: file.originalname,
          bucket: "avatars",
          folder: "users",
        });
      }

      // ── 3. Hash password ─────────────────────────────────────────────────
      const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

      // ── 4. Insert into User table ─────────────────────────────────────────
      const newUserResult = await client.query(
        `INSERT INTO users 
           (first_name, last_name, email, phone, password_hash, nid, profile_picture, active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
         RETURNING user_id`,
        [firstName, lastName, email, phone, password_hash, nid, profilePictureUrl]
      );

      userId = newUserResult.rows[0].user_id;
      isNewUser = true;

      // ── 5. Create wallet if provided ──────────────────────────────────────
      if (wallet) {
        await client.query(
          `INSERT INTO wallets (user_id, balance, last_updated)
           VALUES ($1, $2, NOW())`,
          [userId, parseFloat(wallet) || 0]
        );
      }

      // ── 6. Assign role ────────────────────────────────────────────────────
      await assignRole(client, userId, normalizedRole);

      // ── 7. Insert role-specific data ──────────────────────────────────────
      await insertRoleSpecificData(client, userId, normalizedRole, fields, files);

      await client.query("COMMIT");

      return {
        message: "Registration Successful",
        userId,
        role: normalizedRole,
        isNewUser: true,
      };
    }

  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

// ─── Helper: Assign role via Roles + User_Role ────────────────────────────────
const assignRole = async (client, userId, normalizedRole) => {
  // Map frontend role strings to DB role_name
  const roleNameMap = {
    customer: "Customer",
    driver: "Driver",
    restaurant: "Restaurant Manager",
  };

  const dbRoleName = roleNameMap[normalizedRole];

  const roleResult = await client.query(
    `SELECT role_id
     FROM roles 
     WHERE role_name = $1`,
    [dbRoleName]
  );

  if (roleResult.rows.length === 0) {
    throw { status: 400, message: `Role "${dbRoleName}" not found in database.` };
  }

  await client.query(
    `INSERT INTO user_role (user_id, role_id, assigned_at) 
    VALUES ($1, $2, NOW())`,
    [userId, roleResult.rows[0].role_id]
  );
};

// ─── Helper: Insert role-specific rows ───────────────────────────────────────
const insertRoleSpecificData = async (client, userId, normalizedRole, fields, files) => {
  const {
    licenseId, licenseExpire,
    vehiclePlate, vehicleModel, vehicleType, vehicleColor,
    restaurantName, location, phone,
  } = fields;

  if (normalizedRole === "customer") {
    // Insert into customers table
    await client.query(
      `INSERT INTO "customers" (user_id) 
      VALUES ($1) 
      ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

  } else if (normalizedRole === "driver") {
    // Upload license document if provided
    let licenseDocUrl = null;
    if (files.licenseDocs) {
      const file = files.licenseDocs[0];
      licenseDocUrl = await uploadToSupabase({
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalName: file.originalname,
        bucket: "documents",
        folder: `drivers/${userId}`,
      });
    }

    // Normalize vehicle type to lowercase for consistency
    const normalizedVehicleType = String(vehicleType || "").trim().toLowerCase();

    // Insert into Driver table
    await client.query(
      `INSERT INTO "drivers" (user_id, licence_id, documents_url, license_expire, active_status, is_approved)
       VALUES ($1, $2, $3, $4, false, false)`,
      [userId, licenseId, licenseDocUrl, licenseExpire]
    );

    // Insert into Vehicle table and set it as the current vehicle
    const vehicleResult = await client.query(
      `INSERT INTO "vehicles" (owner_id, licence_no, model, type, color, active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING vehicle_id`,
      [userId, vehiclePlate, vehicleModel, normalizedVehicleType, vehicleColor]
    );

    // Set the newly created vehicle as the driver's current vehicle
    if (vehicleResult.rows.length > 0) {
      const vehicleId = vehicleResult.rows[0].vehicle_id;
      await client.query(
        `UPDATE drivers 
         SET current_vehicle_id = $1 
         WHERE user_id = $2`,
        [vehicleId, userId]
      );
    }

  } else if (normalizedRole === "restaurant") {
    // Insert into owners/restaurant manager table
    await client.query(
      `INSERT INTO "owners" (user_id, manager_approved) VALUES ($1, false) ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    // Insert into Restaurant table
    await client.query(
      `INSERT INTO "restaurants" (owner_id, name, phone, rating, is_approved)
       VALUES ($1, $2, $3, 0, false)`,
      [userId, restaurantName, phone]
    );
  }
};

module.exports = { registerUser };