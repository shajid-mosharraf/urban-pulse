const { getClient, query } = require("../../config/db");

const toNumber = (value) => Number(value || 0);

const DRIVER_PAYOUT_RATIO = 0.97;

const ensureWallet = async (client, userId) => {
  const existing = await client.query(
    `SELECT wallet_id, balance
     FROM wallets
     WHERE user_id = $1
     FOR UPDATE`,
    [userId]
  );

  if (existing.rows.length) {
    return {
      wallet_id: Number(existing.rows[0].wallet_id),
      balance: Number(existing.rows[0].balance || 0),
    };
  }

  const created = await client.query(
    `INSERT INTO wallets (user_id, balance, currency, last_updated)
     VALUES ($1, 0, 'BDT', NOW())
     RETURNING wallet_id, balance`,
    [userId]
  );

  return {
    wallet_id: Number(created.rows[0].wallet_id),
    balance: Number(created.rows[0].balance || 0),
  };
};

const insertWalletTransaction = async (client, walletId, amount, type, description) => {
  await client.query(
    `INSERT INTO wallet_transactions (wallet_id, amount, type, description, timestamp)
     VALUES ($1, $2, $3, $4, NOW())`,
    [walletId, amount, type, description]
  );
};

const settleRidePayment = async (client, rideRow) => {
  const fare = Number(rideRow.final_fare || rideRow.initial_fare || 0);
  const paymentMethod = String(rideRow.payment_method || "cash").toLowerCase();

  if (fare <= 0) {
    throw { status: 400, message: "Ride fare must be greater than zero before completion." };
  }

  const existingPayment = await client.query(
    `SELECT payment_id
     FROM payments
     WHERE ride_id = $1
     LIMIT 1`,
    [rideRow.ride_id]
  );

  if (existingPayment.rows.length) {
    return {
      amount: fare,
      method: paymentMethod,
      driver_payout: paymentMethod === "wallet" ? fare * DRIVER_PAYOUT_RATIO : null,
      alreadyProcessed: true,
    };
  }

  if (paymentMethod === "wallet") {
    const customerWallet = await ensureWallet(client, rideRow.customer_id);
    if (customerWallet.balance < fare) {
      throw {
        status: 409,
        message: "Insufficient wallet balance to complete this ride.",
      };
    }

    const driverWallet = await ensureWallet(client, rideRow.driver_id);
    const driverPayout = Number((fare * DRIVER_PAYOUT_RATIO).toFixed(2));

    await client.query(
      `UPDATE wallets
       SET balance = balance - $2,
           last_updated = NOW()
       WHERE wallet_id = $1`,
      [customerWallet.wallet_id, fare]
    );

    await insertWalletTransaction(
      client,
      customerWallet.wallet_id,
      -fare,
      "debit",
      `Ride payment #${rideRow.ride_id} (wallet)`
    );

    await client.query(
      `UPDATE wallets
       SET balance = balance + $2,
           last_updated = NOW()
       WHERE wallet_id = $1`,
      [driverWallet.wallet_id, driverPayout]
    );

    await insertWalletTransaction(
      client,
      driverWallet.wallet_id,
      driverPayout,
      "credit",
      `Ride earning #${rideRow.ride_id} (97% payout)`
    );
  }

  await client.query(
    `INSERT INTO payments (ride_id, amount, method, status, timestamp)
     VALUES ($1, $2, $3, 'Paid', NOW())`,
    [rideRow.ride_id, fare, paymentMethod]
  );

  return {
    amount: fare,
    method: paymentMethod,
    driver_payout: paymentMethod === "wallet" ? Number((fare * DRIVER_PAYOUT_RATIO).toFixed(2)) : null,
    alreadyProcessed: false,
  };
};

const getCustomerDashboardData = async (userId) => {
  const userResult = await query(
    `SELECT
       u.user_id,
       u.first_name,
       u.last_name,
       c.customer_rating
     FROM users u
     LEFT JOIN customers c ON c.user_id = u.user_id
     WHERE u.user_id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw { status: 404, message: "Customer not found." };
  }

  const user = userResult.rows[0];

  const walletResult = await query(
    `SELECT
       COALESCE(SUM(CASE
         WHEN DATE_TRUNC('month', r.request_time) = DATE_TRUNC('month', CURRENT_DATE)
              AND LOWER(r.status) = 'completed'
         THEN COALESCE(p.amount, r.final_fare, r.initial_fare, 0)
         ELSE 0
       END), 0) AS month_spent,
       COUNT(CASE
         WHEN DATE_TRUNC('month', r.request_time) = DATE_TRUNC('month', CURRENT_DATE)
              AND LOWER(r.status) = 'completed'
         THEN 1
         ELSE NULL
       END) AS rides_this_month,
       COALESCE(SUM(CASE
         WHEN LOWER(r.status) = 'completed'
         THEN COALESCE(p.amount, r.final_fare, r.initial_fare, 0)
         ELSE 0
       END), 0) AS lifetime_spent
     FROM rides r
     LEFT JOIN payments p ON p.ride_id = r.ride_id
     WHERE r.customer_id = $1`,
    [userId]
  );

  const walletBalanceResult = await query(
    `SELECT balance
     FROM wallets
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );

  let activeRideResult;
  try {
    activeRideResult = await query(
      `SELECT
         r.ride_id,
         r.status,
         r.service_type,
         COALESCE(r.final_fare, r.initial_fare, p.amount, 0) AS fare,
         rcd.pickup_otp,
         rcd.ride_otp,
         rcd.completion_otp,
         COALESCE(rcd.payment_method, 'cash') AS payment_method,
         rcd.driver_marked_complete_at,
         r.request_time,
         pu.address_name AS pickup,
         du.address_name AS dropoff,
         d.user_id AS driver_id,
         dr.first_name AS driver_first_name,
         dr.last_name AS driver_last_name,
        d.rating_avg AS driver_rating_avg,
         v.model AS vehicle_model,
         v.licence_no AS vehicle_plate
       FROM rides r
       LEFT JOIN payments p ON p.ride_id = r.ride_id
      LEFT JOIN ride_completion_details rcd ON rcd.ride_id = r.ride_id
       LEFT JOIN locations pu ON pu.location_id = r.pickup_location_id
       LEFT JOIN locations du ON du.location_id = r.dropoff_location_id
       LEFT JOIN drivers d ON d.user_id = r.driver_id
       LEFT JOIN users dr ON dr.user_id = d.user_id
       LEFT JOIN vehicles v ON v.vehicle_id = d.current_vehicle_id
       WHERE r.customer_id = $1
         AND LOWER(r.status) NOT IN ('completed', 'cancelled')
       ORDER BY r.request_time DESC
       LIMIT 1`,
      [userId]
    );
  } catch (err) {
    //eta baad db update korchi
    const msg = String(err?.message || "").toLowerCase();
    if (msg.includes("relation \"ride_completion_details\" does not exist")) {
      activeRideResult = await query(
        `SELECT
           r.ride_id,
           r.status,
           r.service_type,
           COALESCE(r.final_fare, r.initial_fare, p.amount, 0) AS fare,
           NULL::VARCHAR AS pickup_otp,
           NULL::VARCHAR AS ride_otp,
           NULL::VARCHAR AS completion_otp,
           'cash'::VARCHAR AS payment_method,
           NULL::TIMESTAMP AS driver_marked_complete_at,
           r.request_time,
           pu.address_name AS pickup,
           du.address_name AS dropoff,
           d.user_id AS driver_id,
           dr.first_name AS driver_first_name,
           dr.last_name AS driver_last_name,
           d.rating_avg AS driver_rating_avg,
           v.model AS vehicle_model,
           v.licence_no AS vehicle_plate
         FROM rides r
         LEFT JOIN payments p ON p.ride_id = r.ride_id
         LEFT JOIN locations pu ON pu.location_id = r.pickup_location_id
         LEFT JOIN locations du ON du.location_id = r.dropoff_location_id
         LEFT JOIN drivers d ON d.user_id = r.driver_id
         LEFT JOIN users dr ON dr.user_id = d.user_id
         LEFT JOIN vehicles v ON v.vehicle_id = d.current_vehicle_id
         WHERE r.customer_id = $1
           AND LOWER(r.status) NOT IN ('completed', 'cancelled')
         ORDER BY r.request_time DESC
         LIMIT 1`,
        [userId]
      );
    } else {
      throw err;
    }
  }

  const txResult = await query(
    `SELECT
       p.payment_id,
       p.amount,
       p.status,
       p.method,
       p.timestamp,
       pu.address_name AS pickup,
       du.address_name AS dropoff
     FROM payments p
     JOIN rides r ON r.ride_id = p.ride_id
     LEFT JOIN locations pu ON pu.location_id = r.pickup_location_id
     LEFT JOIN locations du ON du.location_id = r.dropoff_location_id
     WHERE r.customer_id = $1
     ORDER BY p.timestamp DESC
     LIMIT 5`,
    [userId]
  );

  let recentRidesResult;
  try {
    recentRidesResult = await query(
      `SELECT
         r.ride_id,
         r.status,
         r.distance_km,
         COALESCE(r.final_fare, r.initial_fare, p.amount, 0) AS fare,
         r.request_time,
         pu.address_name AS pickup,
         du.address_name AS dropoff,
         dr.first_name AS driver_first_name,
         dr.last_name AS driver_last_name,
         rt.score AS rating,
         pr.score AS my_rating_to_driver,
         drt.score AS driver_rating_to_customer
       FROM rides r
       LEFT JOIN payments p ON p.ride_id = r.ride_id
       LEFT JOIN ratings rt ON rt.ride_id = r.ride_id
       LEFT JOIN ride_party_ratings pr ON pr.ride_id = r.ride_id
        AND pr.rater_id = r.customer_id
        AND pr.receiver_id = r.driver_id
       LEFT JOIN ride_party_ratings drt ON drt.ride_id = r.ride_id
        AND drt.rater_id = r.driver_id
        AND drt.receiver_id = r.customer_id
       LEFT JOIN locations pu ON pu.location_id = r.pickup_location_id
       LEFT JOIN locations du ON du.location_id = r.dropoff_location_id
       LEFT JOIN drivers d ON d.user_id = r.driver_id
       LEFT JOIN users dr ON dr.user_id = d.user_id
       WHERE r.customer_id = $1
       ORDER BY r.request_time DESC
       LIMIT 5`,
      [userId]
    );
  } catch (err) {
    //lagbe na delete kore dibooo ,, db update korchi
    if (String(err?.message || "").toLowerCase().includes("relation \"ride_party_ratings\" does not exist")) {
      recentRidesResult = await query(
        `SELECT
           r.ride_id,
           r.status,
           r.distance_km,
           COALESCE(r.final_fare, r.initial_fare, p.amount, 0) AS fare,
           r.request_time,
           pu.address_name AS pickup,
           du.address_name AS dropoff,
           dr.first_name AS driver_first_name,
           dr.last_name AS driver_last_name,
           rt.score AS rating,
           NULL::INT AS my_rating_to_driver,
           NULL::INT AS driver_rating_to_customer
         FROM rides r
         LEFT JOIN payments p ON p.ride_id = r.ride_id
         LEFT JOIN ratings rt ON rt.ride_id = r.ride_id
         LEFT JOIN locations pu ON pu.location_id = r.pickup_location_id
         LEFT JOIN locations du ON du.location_id = r.dropoff_location_id
         LEFT JOIN drivers d ON d.user_id = r.driver_id
         LEFT JOIN users dr ON dr.user_id = d.user_id
         WHERE r.customer_id = $1
         ORDER BY r.request_time DESC
         LIMIT 5`,
        [userId]
      );
    } else {
      throw err;
    }
  }

  const recentFoodDeliveriesResult = await query(
    `SELECT
       fo.order_id,
       fo.status,
       fo.total_price,
       fo.order_time,
       fo.ride_id,
       r.name AS restaurant_name,
       dr.first_name AS driver_first_name,
       dr.last_name AS driver_last_name
     FROM food_orders fo
     JOIN restaurants r ON r.restaurant_id = fo.restaurant_id
     LEFT JOIN rides rd ON rd.ride_id = fo.ride_id
     LEFT JOIN drivers d ON d.user_id = rd.driver_id
     LEFT JOIN users dr ON dr.user_id = d.user_id
     WHERE fo.customer_id = $1
     ORDER BY fo.order_time DESC
     LIMIT 3`,
    [userId]
  );

  const recentParcelDeliveriesResult = await query(
    `SELECT
       c.courier_id,
       c.status,
       r.request_time,
       pu.address_name AS pickup,
       du.address_name AS dropoff,
       COALESCE(r.final_fare, r.initial_fare, 0) AS fare
     FROM couriers c
     JOIN rides r ON r.ride_id = c.ride_id
     LEFT JOIN locations pu ON pu.location_id = r.pickup_location_id
     LEFT JOIN locations du ON du.location_id = r.dropoff_location_id
     WHERE c.sender_id = $1
     ORDER BY r.request_time DESC
     LIMIT 3`,
    [userId]
  );

  const savedPlacesResult = await query(
    `SELECT COUNT(*) AS saved_count
     FROM saved_addresses
     WHERE customer_id = $1`,
    [userId]
  );

  const promotionsResult = await query(
    `SELECT promo_id, code, discount_amount, expiration_date
     FROM promotions
     WHERE expiration_date IS NULL OR expiration_date >= CURRENT_DATE
     ORDER BY expiration_date NULLS LAST, promo_id DESC
     LIMIT 5`
  );

  const wallet = walletResult.rows[0] || {
    month_spent: 0,
    rides_this_month: 0,
    lifetime_spent: 0,
  };

  const currentWalletBalance = toNumber(walletBalanceResult.rows[0]?.balance);

  const activeRide = activeRideResult.rows[0] || null;

  return {
    user: {
      user_id: user.user_id,
      first_name: user.first_name,
      last_name: user.last_name,
      full_name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
      customer_rating: toNumber(user.customer_rating),
    },
    wallet: {
      balance: currentWalletBalance,
      month_spent: toNumber(wallet.month_spent),
      rides_this_month: toNumber(wallet.rides_this_month),
      lifetime_spent: toNumber(wallet.lifetime_spent),
    },
    activeRide: activeRide
      ? {
          ride_id: activeRide.ride_id,
          status: activeRide.status,
          service_type: activeRide.service_type,
          fare: toNumber(activeRide.fare),
          pickup_otp: activeRide.pickup_otp,
          ride_otp: activeRide.ride_otp,
          completion_otp: activeRide.completion_otp,
          payment_method: activeRide.payment_method,
          driver_marked_complete_at: activeRide.driver_marked_complete_at,
          request_time: activeRide.request_time,
          pickup: activeRide.pickup,
          dropoff: activeRide.dropoff,
          driver_name: `${activeRide.driver_first_name || ""} ${activeRide.driver_last_name || ""}`.trim(),
          driver_rating_avg: toNumber(activeRide.driver_rating_avg),
          vehicle_model: activeRide.vehicle_model,
          vehicle_plate: activeRide.vehicle_plate,
        }
      : null,
    recentTransactions: txResult.rows.map((tx) => ({
      payment_id: tx.payment_id,
      amount: toNumber(tx.amount),
      status: tx.status,
      method: tx.method,
      timestamp: tx.timestamp,
      pickup: tx.pickup,
      dropoff: tx.dropoff,
    })),
    recentRides: recentRidesResult.rows.map((ride) => ({
      ride_id: ride.ride_id,
      status: ride.status,
      distance_km: toNumber(ride.distance_km),
      fare: toNumber(ride.fare),
      request_time: ride.request_time,
      pickup: ride.pickup,
      dropoff: ride.dropoff,
      driver_name: `${ride.driver_first_name || ""} ${ride.driver_last_name || ""}`.trim(),
      rating: ride.rating !== null && ride.rating !== undefined ? toNumber(ride.rating) : null,
      my_rating_to_driver:
        ride.my_rating_to_driver !== null && ride.my_rating_to_driver !== undefined
          ? toNumber(ride.my_rating_to_driver)
          : null,
      driver_rating_to_customer:
        ride.driver_rating_to_customer !== null && ride.driver_rating_to_customer !== undefined
          ? toNumber(ride.driver_rating_to_customer)
          : null,
    })),
    recentFoodDeliveries: recentFoodDeliveriesResult.rows.map((order) => ({
      order_id: order.order_id,
      status: order.status,
      total_price: toNumber(order.total_price),
      order_time: order.order_time,
      restaurant_name: order.restaurant_name,
      ride_id: order.ride_id,
      driver_name: `${order.driver_first_name || ""} ${order.driver_last_name || ""}`.trim(),
    })),
    recentParcelDeliveries: recentParcelDeliveriesResult.rows.map((parcel) => ({
      courier_id: parcel.courier_id,
      status: parcel.status,
      request_time: parcel.request_time,
      pickup: parcel.pickup,
      dropoff: parcel.dropoff,
      fare: toNumber(parcel.fare),
    })),
    latestFoodOrders: recentFoodDeliveriesResult.rows.map((order) => ({
      order_id: order.order_id,
      status: order.status,
      total_price: toNumber(order.total_price),
      order_time: order.order_time,
      restaurant_name: order.restaurant_name,
      ride_id: order.ride_id,
      driver_name: `${order.driver_first_name || ""} ${order.driver_last_name || ""}`.trim(),
    })),
    latestParcelDeliveries: recentParcelDeliveriesResult.rows.map((parcel) => ({
      courier_id: parcel.courier_id,
      status: parcel.status,
      request_time: parcel.request_time,
      pickup: parcel.pickup,
      dropoff: parcel.dropoff,
      fare: toNumber(parcel.fare),
    })),
    savedPlaces: toNumber(savedPlacesResult.rows[0]?.saved_count),
    promotions: promotionsResult.rows.map((promo) => ({
      promo_id: promo.promo_id,
      promo_code: promo.code,
      discount_amount: toNumber(promo.discount_amount),
      valid_until: promo.expiration_date,
    })),
  };
};

const confirmRideCompletion = async (customerId, rideId, otp) => {
  const normalizedOtp = String(otp || "").trim();

  if (!/^\d{6}$/.test(normalizedOtp)) {
    throw { status: 400, message: "A valid 6-digit completion OTP is required." };
  }

  const client = await getClient();

  try {
    await client.query("BEGIN");

    const rideResult = await client.query(
      `SELECT
         r.ride_id,
         r.customer_id,
         r.driver_id,
         r.status,
         rcd.completion_otp,
         rcd.ride_otp,
         COALESCE(rcd.payment_method, 'cash') AS payment_method,
         r.initial_fare,
         r.final_fare,
         rcd.payout_processed_at
       FROM rides r
       LEFT JOIN ride_completion_details rcd ON rcd.ride_id = r.ride_id
       WHERE r.ride_id = $1
       FOR UPDATE OF r`,
      [rideId]
    );

    if (!rideResult.rows.length) {
      throw { status: 404, message: "Ride not found." };
    }

    const ride = rideResult.rows[0];

    if (Number(ride.customer_id) !== Number(customerId)) {
      throw { status: 403, message: "You can only confirm your own ride." };
    }

    if (String(ride.status || "").toLowerCase() !== "driver_completed") {
      throw {
        status: 409,
        message: "Ride is not ready for customer confirmation yet.",
      };
    }

    const expectedOtp = String(ride.completion_otp || ride.ride_otp || "");
    if (!expectedOtp || normalizedOtp !== expectedOtp) {
      throw { status: 400, message: "Invalid completion OTP." };
    }

    const settlement = await settleRidePayment(client, ride);

    const rideStatusResult = await client.query(
      `UPDATE rides
       SET status = 'completed',
           end_time = COALESCE(end_time, CURRENT_TIMESTAMP)
       WHERE ride_id = $1
       RETURNING ride_id, status, end_time`,
      [rideId]
    );

    const detailsResult = await client.query(
      `INSERT INTO ride_completion_details (
         ride_id,
         otp_verified_at,
         customer_confirmed_at,
         completion_mode,
         payout_processed_at,
         updated_at
       )
       VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'customer_confirmed_otp', CURRENT_TIMESTAMP, NOW())
       ON CONFLICT (ride_id)
       DO UPDATE
       SET otp_verified_at = CURRENT_TIMESTAMP,
           customer_confirmed_at = CURRENT_TIMESTAMP,
           completion_mode = 'customer_confirmed_otp',
           payout_processed_at = COALESCE(ride_completion_details.payout_processed_at, CURRENT_TIMESTAMP),
           updated_at = NOW()
       RETURNING completion_mode`,
      [rideId]
    );

    await client.query("COMMIT");

    return {
      ...rideStatusResult.rows[0],
      completion_mode: detailsResult.rows[0]?.completion_mode || "customer_confirmed_otp",
      settlement,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { getCustomerDashboardData, confirmRideCompletion };