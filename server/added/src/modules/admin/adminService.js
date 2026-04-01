const { query } = require("../../config/db");

const toNumber = (value) => Number(value || 0);

const getAdminDashboardData = async (userId) => {
  const adminExists = await query(
    `SELECT user_id FROM admins WHERE user_id = $1 LIMIT 1`,
    [userId]
  );

  if (adminExists.rows.length === 0) {
    throw { status: 404, message: "Admin not found." };
  }

  const platformStatsResult = await query(
    `SELECT
       (SELECT COUNT(*) FROM users) AS total_users,
       (SELECT COUNT(*) FROM rides WHERE LOWER(status) NOT IN ('completed', 'cancelled')) AS active_rides,
       (SELECT COUNT(*) FROM food_orders WHERE DATE(order_time) = CURRENT_DATE) AS orders_today,
       (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE DATE(timestamp) = CURRENT_DATE) AS revenue_today,
       (SELECT COUNT(*)
        FROM drivers
        WHERE active_status = TRUE
          AND current_latitude IS NOT NULL
          AND current_longitude IS NOT NULL) AS online_drivers,
       (SELECT COUNT(*) FROM restaurants) AS open_restaurants`
  );

  const pendingVerificationsResult = await query(
    `SELECT
       d.user_id,
       u.first_name,
       u.last_name,
       d.licence_id,
       d.documents_url,
       u.created_at
     FROM drivers d
     JOIN users u ON u.user_id = d.user_id
     WHERE d.is_approved = FALSE
       AND u.active = TRUE
     ORDER BY u.created_at DESC
     LIMIT 8`
  );

  const recentUsersResult = await query(
    `SELECT
       u.user_id,
       u.first_name,
       u.last_name,
       u.created_at,
       u.active,
       COALESCE(
         STRING_AGG(r.role_name, ', ' ORDER BY r.role_name),
         'Unassigned'
       ) AS roles
     FROM users u
     LEFT JOIN user_role ur ON ur.user_id = u.user_id
     LEFT JOIN roles r ON r.role_id = ur.role_id
     GROUP BY u.user_id, u.first_name, u.last_name, u.created_at, u.active
     ORDER BY u.created_at DESC
     LIMIT 8`
  );

  const activePromosResult = await query(
    `SELECT
       p.promo_id,
       p.code,
       p.discount_amount,
       p.expiration_date,
       u.first_name,
       u.last_name
     FROM promotions p
     LEFT JOIN users u ON u.user_id = p.created_by
     WHERE p.expiration_date IS NULL OR p.expiration_date >= CURRENT_DATE
     ORDER BY p.expiration_date NULLS LAST, p.promo_id DESC
     LIMIT 8`
  );

  const paymentsOverviewResult = await query(
    `SELECT
       COALESCE(method, 'unknown') AS method,
       COALESCE(SUM(amount), 0) AS amount
     FROM payments
     WHERE DATE(timestamp) = CURRENT_DATE
     GROUP BY method
     ORDER BY amount DESC`
  );

  const pendingRestaurantVerificationsResult = await query(
    `SELECT
       o.user_id,
       u.first_name,
       u.last_name,
       u.email,
       u.created_at
     FROM owners o
     JOIN users u ON u.user_id = o.user_id
     WHERE o.manager_approved = FALSE
       AND u.active = TRUE
     ORDER BY u.created_at DESC
     LIMIT 8`
  );

  const stats = platformStatsResult.rows[0] || {};

  return {
    stats: {
      total_users: toNumber(stats.total_users),
      active_rides: toNumber(stats.active_rides),
      orders_today: toNumber(stats.orders_today),
      revenue_today: toNumber(stats.revenue_today),
      online_drivers: toNumber(stats.online_drivers),
      open_restaurants: toNumber(stats.open_restaurants),
    },
    pendingVerifications: pendingVerificationsResult.rows.map((d) => ({
      user_id: d.user_id,
      name: `${d.first_name || ""} ${d.last_name || ""}`.trim(),
      licence_id: d.licence_id,
      documents_url: d.documents_url,
      created_at: d.created_at,
    })),
    recentUsers: recentUsersResult.rows.map((u) => ({
      user_id: u.user_id,
      name: `${u.first_name || ""} ${u.last_name || ""}`.trim(),
      roles: u.roles,
      created_at: u.created_at,
      active: u.active,
    })),
    activePromotions: activePromosResult.rows.map((p) => ({
      promo_id: p.promo_id,
      code: p.code,
      discount_amount: toNumber(p.discount_amount),
      expiration_date: p.expiration_date,
      created_by: `${p.first_name || ""} ${p.last_name || ""}`.trim(),
    })),
    paymentsOverview: paymentsOverviewResult.rows.map((p) => ({
      method: p.method,
      amount: toNumber(p.amount),
    })),
    pendingRestaurantVerifications: pendingRestaurantVerificationsResult.rows.map((r) => ({
      user_id: r.user_id,
      name: `${r.first_name || ""} ${r.last_name || ""}`.trim(),
      manager_name: `${r.first_name || ""} ${r.last_name || ""}`.trim(),
      email: r.email,
      created_at: r.created_at,
    })),
  };
};

const getDriverVerificationDetails = async (driverUserId) => {
  const result = await query(
    `SELECT
       u.user_id,
       u.first_name,
       u.last_name,
       u.email,
       u.phone,
       u.nid,
       u.profile_picture,
       u.active,
       u.created_at,
       d.licence_id,
       d.license_expire,
       d.documents_url,
       d.rating_avg,
      d.is_approved,
       v.licence_no,
       v.model,
       v.type,
       v.color,
       v.active AS vehicle_active
     FROM drivers d
     JOIN users u ON u.user_id = d.user_id
     LEFT JOIN vehicles v ON v.owner_id = d.user_id
     WHERE d.user_id = $1
     ORDER BY v.vehicle_id DESC
     LIMIT 1`,
    [driverUserId]
  );

  if (result.rows.length === 0) {
    throw { status: 404, message: "Driver not found." };
  }

  const d = result.rows[0];
  return {
    user_id: d.user_id,
    profile: {
      full_name: `${d.first_name || ""} ${d.last_name || ""}`.trim(),
      email: d.email,
      phone: d.phone,
      nid: d.nid,
      created_at: d.created_at,
      active: d.active,
      profile_picture_url: d.profile_picture,
    },
    license: {
      licence_id: d.licence_id,
      license_expire: d.license_expire,
      verification_status: d.is_approved ? "approved" : "pending",
      license_document_url: d.documents_url,
      rating_avg: toNumber(d.rating_avg),
    },
    vehicle: {
      licence_no: d.licence_no,
      model: d.model,
      type: d.type,
      color: d.color,
      active: d.vehicle_active,
    },
    links: {
      profile_picture: d.profile_picture,
      license_document: d.documents_url,
    },
  };
};

const verifyDriver = async (driverUserId, approved) => {
  const exists = await query(
    `SELECT d.user_id
     FROM drivers d
     JOIN users u ON u.user_id = d.user_id
     WHERE d.user_id = $1
     LIMIT 1`,
    [driverUserId]
  );

  if (exists.rows.length === 0) {
    throw { status: 404, message: "Driver not found." };
  }

  await query(
    `UPDATE drivers
     SET is_approved = $2
     WHERE user_id = $1`,
    [driverUserId, approved]
  );

  return {
    user_id: driverUserId,
    status: approved ? "approved" : "rejected",
  };
};

const verifyRestaurant = async (ownerUserId, approved) => {
  const exists = await query(
    `SELECT owner_id
     FROM restaurants
     WHERE owner_id = $1
     LIMIT 1`,
    [ownerUserId]
  );

  if (exists.rows.length === 0) {
    throw { status: 404, message: "Restaurant not found." };
  }

  await query(
    `UPDATE owners
     SET manager_approved = $2
     WHERE user_id = $1`,
    [ownerUserId, approved]
  );

  await query(
    `UPDATE restaurants
     SET is_approved = $2
     WHERE owner_id = $1`,
    [ownerUserId, approved]
  );

  return {
    user_id: ownerUserId,
    status: approved ? "approved" : "rejected",
  };
};

const forceCompleteRide = async (rideId) => {
  const rideResult = await query(
    `SELECT ride_id, status
     FROM rides
     WHERE ride_id = $1
     LIMIT 1`,
    [rideId]
  );

  if (rideResult.rows.length === 0) {
    throw { status: 404, message: "Ride not found." };
  }

  const status = String(rideResult.rows[0].status || "").toLowerCase();
  if (status === "completed" || status === "cancelled") {
    throw { status: 409, message: "Ride is already closed." };
  }

  const updateResult = await query(
    `UPDATE rides
     SET status = 'completed',
         end_time = COALESCE(end_time, CURRENT_TIMESTAMP),
         completion_mode = 'admin_override'
     WHERE ride_id = $1
     RETURNING ride_id, status, end_time`,
    [rideId]
  );

  return {
    ...updateResult.rows[0],
    completion_mode: "admin_override",
  };
};

module.exports = {
  getAdminDashboardData,
  getDriverVerificationDetails,
  verifyDriver,
  verifyRestaurant,
  forceCompleteRide,
};