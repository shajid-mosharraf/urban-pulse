const { getClient, query } = require("../../config/db");

const toNumber = (value) => Number(value || 0);

const isMissingNotificationsTableError = (err) =>
  String(err?.message || "").toLowerCase().includes("relation \"notifications\" does not exist");

const getLegacyNotificationsData = async (userId) => {
  const ridesResult = await query(
    `SELECT
       r.ride_id,
       r.status,
       r.request_time,
       COALESCE(pu.address_name, 'Unknown pickup') AS pickup,
       COALESCE(du.address_name, 'Unknown dropoff') AS dropoff
     FROM rides r
     LEFT JOIN locations pu ON pu.location_id = r.pickup_location_id
     LEFT JOIN locations du ON du.location_id = r.dropoff_location_id
     WHERE r.customer_id = $1
     ORDER BY r.request_time DESC
     LIMIT 10`,
    [userId]
  );

  const paymentsResult = await query(
    `SELECT
       p.payment_id,
       p.amount,
       p.method,
       p.status,
       p.timestamp
     FROM payments p
     JOIN rides r ON r.ride_id = p.ride_id
     WHERE r.customer_id = $1
     ORDER BY p.timestamp DESC
     LIMIT 10`,
    [userId]
  );

  const foodResult = await query(
    `SELECT
       fo.order_id,
       fo.status,
       fo.order_time,
       rs.name AS restaurant_name
     FROM food_orders fo
     JOIN restaurants rs ON rs.restaurant_id = fo.restaurant_id
     WHERE fo.customer_id = $1
     ORDER BY fo.order_time DESC
     LIMIT 10`,
    [userId]
  );

  const notifications = [
    ...ridesResult.rows.map((r) => ({
      id: `ride-${r.ride_id}`,
      type: "Ride Alert",
      title: `Ride ${r.status}`,
      message: `${r.pickup} to ${r.dropoff}`,
      date: r.request_time,
      isRead: false,
    })),
    ...paymentsResult.rows.map((p) => ({
      id: `payment-${p.payment_id}`,
      type: "Payment",
      title: `Payment ${p.status}`,
      message: `${toNumber(p.amount)} BDT via ${p.method || "unknown"}`,
      date: p.timestamp,
      isRead: false,
    })),
    ...foodResult.rows.map((o) => ({
      id: `order-${o.order_id}`,
      type: "Delivery",
      title: `Food order ${o.status}`,
      message: `Order from ${o.restaurant_name}`,
      date: o.order_time,
      isRead: false,
    })),
  ]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 30);

  return { notifications };
};

const getUserProfile = async (userId) => {
  const userResult = await query(
    `SELECT
       u.user_id,
       u.first_name,
       u.last_name,
       u.email,
       u.phone,
       u.profile_picture,
       u.created_at,
       ARRAY_AGG(LOWER(r.role_name)) FILTER (WHERE r.role_name IS NOT NULL) AS roles
     FROM users u
     LEFT JOIN user_role ur ON ur.user_id = u.user_id
     LEFT JOIN roles r ON r.role_id = ur.role_id
     WHERE u.user_id = $1
     GROUP BY u.user_id`,
    [userId]
  );

  if (!userResult.rows.length) {
    throw { status: 404, message: "User profile not found." };
  }

  const user = userResult.rows[0];

  const addressesResult = await query(
    `SELECT
       sa.location_id,
       sa.label,
       l.address_name,
       l.city,
       l.latitude,
       l.longitude
     FROM saved_addresses sa
     JOIN locations l ON l.location_id = sa.location_id
     WHERE sa.customer_id = $1
     ORDER BY sa.label NULLS LAST, sa.location_id DESC`,
    [userId]
  );

  return {
    user: {
      user_id: user.user_id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone,
      profile_picture: user.profile_picture,
      created_at: user.created_at,
      roles: user.roles || [],
    },
    savedAddresses: addressesResult.rows,
  };
};

const updateUserProfile = async (userId, payload) => {
  const { first_name, last_name, email, phone } = payload;

  const result = await query(
    `UPDATE users
     SET
       first_name = COALESCE($2, first_name),
       last_name = COALESCE($3, last_name),
       email = COALESCE($4, email),
       phone = COALESCE($5, phone)
     WHERE user_id = $1
     RETURNING user_id, first_name, last_name, email, phone, profile_picture`,
    [userId, first_name, last_name, email, phone]
  );

  if (!result.rows.length) {
    throw { status: 404, message: "User profile not found." };
  }

  return result.rows[0];
};

const getWalletData = async (userId) => {
  const walletResult = await query(
    `SELECT wallet_id, balance, currency, last_updated
     FROM wallets
     WHERE user_id = $1`,
    [userId]
  );

  const txResult = await query(
    `SELECT transaction_id, amount, type, description, timestamp
     FROM wallet_transactions wt
     JOIN wallets w ON w.wallet_id = wt.wallet_id
     WHERE w.user_id = $1
     ORDER BY wt.timestamp DESC
     LIMIT 20`,
    [userId]
  );

  const statsResult = await query(
    `SELECT
       COALESCE(SUM(CASE WHEN LOWER(wt.type) IN ('debit', 'expense') THEN ABS(wt.amount) ELSE 0 END), 0) AS total_spent,
       COALESCE(SUM(CASE WHEN LOWER(wt.type) IN ('credit', 'recharge', 'bonus') THEN wt.amount ELSE 0 END), 0) AS total_recharged
     FROM wallet_transactions wt
     JOIN wallets w ON w.wallet_id = wt.wallet_id
     WHERE w.user_id = $1`,
    [userId]
  );

  return {
    wallet: walletResult.rows[0]
      ? {
          wallet_id: walletResult.rows[0].wallet_id,
          balance: toNumber(walletResult.rows[0].balance),
          currency: walletResult.rows[0].currency,
          last_updated: walletResult.rows[0].last_updated,
        }
      : {
          wallet_id: null,
          balance: 0,
          currency: "BDT",
          last_updated: null,
        },
    stats: {
      total_spent: toNumber(statsResult.rows[0]?.total_spent),
      total_recharged: toNumber(statsResult.rows[0]?.total_recharged),
    },
    transactions: txResult.rows.map((tx) => ({
      transaction_id: tx.transaction_id,
      amount: toNumber(tx.amount),
      type: tx.type,
      description: tx.description,
      timestamp: tx.timestamp,
    })),
  };
};

const rechargeWallet = async (userId, amount, method, promoCode) => {
  const client = await getClient();

  try {
    await client.query("BEGIN");

    let walletId;

    const walletCheck = await client.query(
      `SELECT wallet_id FROM wallets WHERE user_id = $1`,
      [userId]
    );

    if (!walletCheck.rows.length) {
      const insertWallet = await client.query(
        `INSERT INTO wallets (user_id, balance, currency, last_updated)
         VALUES ($1, 0, 'BDT', NOW())
         RETURNING wallet_id`,
        [userId]
      );
      walletId = insertWallet.rows[0].wallet_id;
    } else {
      walletId = walletCheck.rows[0].wallet_id;
    }

    let bonus = 0;
    if (promoCode) {
      const promoResult = await client.query(
        `SELECT discount_amount
         FROM promotions
         WHERE LOWER(code) = LOWER($1)
           AND (expiration_date IS NULL OR expiration_date >= CURRENT_DATE)
         LIMIT 1`,
        [promoCode]
      );
      if (promoResult.rows.length) {
        bonus = toNumber(promoResult.rows[0].discount_amount);
      }
    }

    const finalCredit = toNumber(amount) + bonus;

    await client.query(
      `UPDATE wallets
       SET balance = balance + $2,
           last_updated = NOW()
       WHERE user_id = $1`,
      [userId, finalCredit]
    );

    await client.query(
      `INSERT INTO wallet_transactions (wallet_id, amount, type, description, timestamp)
       VALUES ($1, $2, 'credit', $3, NOW())`,
      [
        walletId,
        finalCredit,
        `Wallet recharge via ${method || "manual"}${promoCode ? ` (promo: ${promoCode})` : ""}`,
      ]
    );

    const updatedWallet = await client.query(
      `SELECT wallet_id, balance, currency, last_updated
       FROM wallets
       WHERE user_id = $1`,
      [userId]
    );

    await client.query("COMMIT");

    return {
      wallet: {
        wallet_id: updatedWallet.rows[0].wallet_id,
        balance: toNumber(updatedWallet.rows[0].balance),
        currency: updatedWallet.rows[0].currency,
        last_updated: updatedWallet.rows[0].last_updated,
      },
      credited_amount: finalCredit,
      bonus_applied: bonus,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const getTripsHistory = async (userId) => {
  const rideResult = await query(
    `SELECT
       r.ride_id AS id,
       'Ride' AS type,
       r.status,
       r.request_time AS event_time,
       pu.address_name AS pickup,
       du.address_name AS dropoff,
       r.distance_km,
       COALESCE(r.final_fare, r.initial_fare, 0) AS amount,
       p.method AS payment_method
     FROM rides r
     LEFT JOIN locations pu ON pu.location_id = r.pickup_location_id
     LEFT JOIN locations du ON du.location_id = r.dropoff_location_id
     LEFT JOIN payments p ON p.ride_id = r.ride_id
     WHERE r.customer_id = $1
     ORDER BY r.request_time DESC
     LIMIT 30`,
    [userId]
  );

  const orderResult = await query(
    `SELECT
       fo.order_id AS id,
       'Food Order' AS type,
       fo.status,
       fo.order_time AS event_time,
       r.name AS restaurant_name,
       fo.total_price AS amount,
       p.method AS payment_method,
       STRING_AGG(mi.name || ' x' || od.quantity, ', ' ORDER BY mi.name) AS items
     FROM food_orders fo
     JOIN restaurants r ON r.restaurant_id = fo.restaurant_id
     LEFT JOIN order_details od ON od.order_id = fo.order_id
     LEFT JOIN menu_items mi ON mi.item_id = od.item_id
     LEFT JOIN payments p ON p.ride_id = fo.ride_id
     WHERE fo.customer_id = $1
     GROUP BY fo.order_id, r.name, p.method
     ORDER BY fo.order_time DESC
     LIMIT 30`,
    [userId]
  );

  const courierResult = await query(
    `SELECT
       c.courier_id AS id,
       'Parcel Delivery' AS type,
       c.status,
       r.request_time AS event_time,
       pu.address_name AS pickup,
       du.address_name AS dropoff,
       c.weight_kg,
       COALESCE(r.final_fare, r.initial_fare, 0) AS amount,
       p.method AS payment_method
     FROM couriers c
     JOIN rides r ON r.ride_id = c.ride_id
     LEFT JOIN locations pu ON pu.location_id = r.pickup_location_id
     LEFT JOIN locations du ON du.location_id = r.dropoff_location_id
     LEFT JOIN payments p ON p.ride_id = r.ride_id
     WHERE c.sender_id = $1
     ORDER BY r.request_time DESC
     LIMIT 30`,
    [userId]
  );

  const unified = [
    ...rideResult.rows,
    ...orderResult.rows,
    ...courierResult.rows,
  ]
    .sort((a, b) => new Date(b.event_time) - new Date(a.event_time))
    .slice(0, 60)
    .map((row) => ({
      ...row,
      amount: toNumber(row.amount),
      distance_km: row.distance_km !== undefined && row.distance_km !== null ? toNumber(row.distance_km) : null,
      weight_kg: row.weight_kg !== undefined && row.weight_kg !== null ? toNumber(row.weight_kg) : null,
    }));

  return { trips: unified };
};

const getPromotionsData = async (userId) => {
  const promosResult = await query(
    `SELECT promo_id, code, discount_amount, description, expiration_date
     FROM promotions
     WHERE expiration_date IS NULL OR expiration_date >= CURRENT_DATE
     ORDER BY expiration_date NULLS LAST, promo_id DESC`,
    []
  );

  const statsResult = await query(
    `SELECT
       COUNT(*) FILTER (WHERE p.promo_id IS NOT NULL) AS promos_used,
       COALESCE(SUM(pr.discount_amount), 0) AS total_saved
     FROM payments p
     JOIN rides r ON r.ride_id = p.ride_id
     LEFT JOIN promotions pr ON pr.promo_id = p.promo_id
     WHERE r.customer_id = $1`,
    [userId]
  );

  return {
    promotions: promosResult.rows.map((promo) => ({
      promo_id: promo.promo_id,
      code: promo.code,
      discount_amount: toNumber(promo.discount_amount),
      description: promo.description,
      expiration_date: promo.expiration_date,
    })),
    stats: {
      promos_used: toNumber(statsResult.rows[0]?.promos_used),
      total_saved: toNumber(statsResult.rows[0]?.total_saved),
    },
  };
};

const getNotificationsData = async (userId) => {
  let notificationsResult;

  try {
    notificationsResult = await query(
      `SELECT
         notification_id,
         title,
         content,
         type,
         is_read,
         created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 60`,
      [userId]
    );
  } catch (err) {
    if (isMissingNotificationsTableError(err)) {
      return getLegacyNotificationsData(userId);
    }
    throw err;
  }

  const notifications = notificationsResult.rows.map((n) => ({
    id: n.notification_id,
    type: n.type || "System",
    title: n.title || "Notification",
    message: n.content || "",
    date: n.created_at,
    isRead: Boolean(n.is_read),
  }));

  return { notifications };
};

const markNotificationAsRead = async (userId, notificationId) => {
  let result;

  try {
    result = await query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE notification_id = $1 AND user_id = $2
       RETURNING notification_id`,
      [notificationId, userId]
    );
  } catch (err) {
    if (isMissingNotificationsTableError(err)) {
      throw { status: 400, message: "Notification persistence is not enabled yet. Run the migration first." };
    }
    throw err;
  }

  if (!result.rows.length) {
    throw { status: 404, message: "Notification not found." };
  }

  return { notification_id: result.rows[0].notification_id, is_read: true };
};

const markAllNotificationsAsRead = async (userId) => {
  try {
    await query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );
  } catch (err) {
    if (isMissingNotificationsTableError(err)) {
      throw { status: 400, message: "Notification persistence is not enabled yet. Run the migration first." };
    }
    throw err;
  }

  return { success: true };
};

const deleteNotification = async (userId, notificationId) => {
  let result;

  try {
    result = await query(
      `DELETE FROM notifications
       WHERE notification_id = $1 AND user_id = $2
       RETURNING notification_id`,
      [notificationId, userId]
    );
  } catch (err) {
    if (isMissingNotificationsTableError(err)) {
      throw { status: 400, message: "Notification persistence is not enabled yet. Run the migration first." };
    }
    throw err;
  }

  if (!result.rows.length) {
    throw { status: 404, message: "Notification not found." };
  }

  return { deleted_id: result.rows[0].notification_id };
};

const deleteReadNotifications = async (userId) => {
  let result;

  try {
    result = await query(
      `DELETE FROM notifications
       WHERE user_id = $1 AND is_read = TRUE
       RETURNING notification_id`,
      [userId]
    );
  } catch (err) {
    if (isMissingNotificationsTableError(err)) {
      throw { status: 400, message: "Notification persistence is not enabled yet. Run the migration first." };
    }
    throw err;
  }

  return { deleted_count: result.rowCount, deleted_ids: result.rows.map((r) => r.notification_id) };
};

const getRatingsData = async (userId) => {
  const summaryResult = await query(
    `SELECT
       COALESCE(AVG(score), 0) AS avg_rating,
       COUNT(*) AS total_ratings,
       COUNT(*) FILTER (WHERE score = 5) AS star_5,
       COUNT(*) FILTER (WHERE score = 4) AS star_4,
       COUNT(*) FILTER (WHERE score = 3) AS star_3,
       COUNT(*) FILTER (WHERE score = 2) AS star_2,
       COUNT(*) FILTER (WHERE score = 1) AS star_1
     FROM ratings
     WHERE receiver_id = $1`,
    [userId]
  );

  const reviewsResult = await query(
    `SELECT
       rt.rating_id,
       rt.score,
       rt.comment,
       rt.timestamp,
       su.first_name AS sender_first_name,
       su.last_name AS sender_last_name,
       ru.first_name AS receiver_first_name,
       ru.last_name AS receiver_last_name,
       r.ride_id,
       pu.address_name AS pickup,
       du.address_name AS dropoff
     FROM ratings rt
     LEFT JOIN users su ON su.user_id = rt.sender_id
     LEFT JOIN users ru ON ru.user_id = rt.receiver_id
     LEFT JOIN rides r ON r.ride_id = rt.ride_id
     LEFT JOIN locations pu ON pu.location_id = r.pickup_location_id
     LEFT JOIN locations du ON du.location_id = r.dropoff_location_id
     WHERE rt.receiver_id = $1 OR rt.sender_id = $1
     ORDER BY rt.timestamp DESC
     LIMIT 50`,
    [userId]
  );

  const summary = summaryResult.rows[0] || {};
  const total = toNumber(summary.total_ratings);

  const distribution = [5, 4, 3, 2, 1].map((stars) => {
    const count = toNumber(summary[`star_${stars}`]);
    return {
      stars,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  });

  return {
    summary: {
      averageRating: Number(toNumber(summary.avg_rating).toFixed(2)),
      totalRatings: total,
      distribution,
    },
    reviews: reviewsResult.rows.map((review) => ({
      id: review.rating_id,
      rating: toNumber(review.score),
      comment: review.comment,
      date: review.timestamp,
      trip: review.pickup && review.dropoff ? `${review.pickup} -> ${review.dropoff}` : null,
      sender_name: `${review.sender_first_name || ""} ${review.sender_last_name || ""}`.trim(),
      receiver_name: `${review.receiver_first_name || ""} ${review.receiver_last_name || ""}`.trim(),
      yourReview: false,
    })),
  };
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  getWalletData,
  rechargeWallet,
  getTripsHistory,
  getPromotionsData,
  getNotificationsData,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteReadNotifications,
  getRatingsData,
};
