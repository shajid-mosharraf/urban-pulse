const { getClient, query } = require("../../config/db");
const { getIo } = require("../../realtime/socketState");

const toNumber = (value) => Number(value || 0);

const DRIVER_PAYOUT_RATIO = 0.97;

const randomOtp = () => String(Math.floor(Math.random() * 1000000)).padStart(6, "0");

const toOptionalNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
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
  console.log("[Backend] DEBUG: Entered settleRidePayment");
  const fare = Number(rideRow.final_fare || rideRow.initial_fare || 0);
  const paymentMethod = String(rideRow.payment_method || "cash").toLowerCase();

  console.log("[Backend] Settlement calculation:", {
    fare,
    final_fare: rideRow.final_fare,
    initial_fare: rideRow.initial_fare,
    paymentMethod,
  });

  if (fare <= 0 && paymentMethod !== "cash") {
    console.error("[Backend] ERROR: Fare is zero or negative, ride cannot be completed");
    throw { status: 400, message: "Ride fare must be greater than zero before completion." };
  }

  if (fare <= 0 && paymentMethod === "cash") {
    console.log("[Backend] Cash payment with no pre-calculated fare - allowing completion");
  }

  const existingPayment = await client.query(
    `SELECT payment_id
     FROM payments
     WHERE ride_id = $1
     LIMIT 1`,
    [rideRow.ride_id]
  );

  if (existingPayment.rows.length > 0) {
    return {
      amount: fare,
      method: paymentMethod,
      driver_payout: paymentMethod === "wallet" ? Number((fare * DRIVER_PAYOUT_RATIO).toFixed(2)) : null,
      alreadyProcessed: true,
    };
  }

  const driverWallet = await ensureWallet(client, rideRow.driver_id);
  const driverPayout = Number((fare * DRIVER_PAYOUT_RATIO).toFixed(2));

  if (paymentMethod === "wallet") {
    const customerWallet = await ensureWallet(client, rideRow.customer_id);

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
  } else {
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
      `Ride earning #${rideRow.ride_id} (cash payout)`
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
    driver_payout: driverPayout,
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
         CASE
           WHEN c.courier_id IS NOT NULL THEN 'parcel'
           WHEN fo.order_id IS NOT NULL THEN 'delivery'
           ELSE 'normal'
         END AS ride_kind,
         COALESCE(r.final_fare, r.initial_fare, p.amount, 0) AS fare,
         rcd.pickup_otp,
         rcd.ride_otp,
         rcd.completion_otp,
         COALESCE(rcd.payment_method, 'cash') AS payment_method,
         rcd.driver_marked_complete_at,
         r.request_time,
         pu.address_name AS pickup,
        pu.latitude AS pickup_latitude,
        pu.longitude AS pickup_longitude,
         du.address_name AS dropoff,
        du.latitude AS dropoff_latitude,
        du.longitude AS dropoff_longitude,
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
       LEFT JOIN food_orders fo ON fo.ride_id = r.ride_id
       LEFT JOIN couriers c ON c.ride_id = r.ride_id
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
           CASE
             WHEN c.courier_id IS NOT NULL THEN 'parcel'
             WHEN fo.order_id IS NOT NULL THEN 'delivery'
             ELSE 'normal'
           END AS ride_kind,
           COALESCE(r.final_fare, r.initial_fare, p.amount, 0) AS fare,
           NULL::VARCHAR AS pickup_otp,
           NULL::VARCHAR AS ride_otp,
           NULL::VARCHAR AS completion_otp,
           'cash'::VARCHAR AS payment_method,
           NULL::TIMESTAMP AS driver_marked_complete_at,
           r.request_time,
           pu.address_name AS pickup,
           pu.latitude AS pickup_latitude,
           pu.longitude AS pickup_longitude,
           du.address_name AS dropoff,
           du.latitude AS dropoff_latitude,
           du.longitude AS dropoff_longitude,
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
         LEFT JOIN food_orders fo ON fo.ride_id = r.ride_id
         LEFT JOIN couriers c ON c.ride_id = r.ride_id
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
       LEFT JOIN food_orders fo ON fo.ride_id = r.ride_id
       LEFT JOIN couriers c ON c.ride_id = r.ride_id
       WHERE r.customer_id = $1
         AND fo.order_id IS NULL
         AND c.courier_id IS NULL
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
         LEFT JOIN food_orders fo ON fo.ride_id = r.ride_id
         LEFT JOIN couriers c ON c.ride_id = r.ride_id
         WHERE r.customer_id = $1
           AND fo.order_id IS NULL
           AND c.courier_id IS NULL
         ORDER BY r.request_time DESC
         LIMIT 5`,
        [userId]
      );
    } else {
      throw err;
    }
  }

  await query(
    `UPDATE food_orders
     SET status = 'on_the_way'
     WHERE customer_id = $1
       AND LOWER(status) = 'cooking'
       AND order_time <= (NOW() - INTERVAL '10 second')`,
    [userId]
  );

  const recentFoodDeliveriesResult = await query(
    `SELECT
       fo.order_id,
       fo.status,
       fo.total_price,
       fo.order_time,
       fo.ride_id,
       COALESCE(rd.final_fare, rd.initial_fare, fo.total_price, 0) AS fare,
       pu.address_name AS pickup,
       du.address_name AS dropoff,
       r.name AS restaurant_name,
       dr.first_name AS driver_first_name,
       dr.last_name AS driver_last_name
     FROM food_orders fo
     JOIN restaurants r ON r.restaurant_id = fo.restaurant_id
     LEFT JOIN rides rd ON rd.ride_id = fo.ride_id
     LEFT JOIN locations pu ON pu.location_id = rd.pickup_location_id
     LEFT JOIN locations du ON du.location_id = rd.dropoff_location_id
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

  if (
    activeRide &&
    String(activeRide.status || "").toLowerCase() === "driver_completed" &&
    !activeRide.completion_otp
  ) {
    const client = await getClient();

    try {
      await client.query("BEGIN");

      const otp = randomOtp();
      const otpResult = await client.query(
        `INSERT INTO ride_completion_details (ride_id, completion_otp, completion_mode, updated_at)
         VALUES ($1, $2, 'waiting_customer_otp', NOW())
         ON CONFLICT (ride_id)
         DO UPDATE SET completion_otp = $2,
                       completion_mode = 'waiting_customer_otp',
                       updated_at = NOW()
         RETURNING completion_otp`,
        [activeRide.ride_id, otp]
      );

      activeRide.completion_otp = otpResult.rows[0]?.completion_otp || otp;

      const io = getIo();
      if (io) {
        io.to(`ride_${activeRide.ride_id}`).emit("delivery_completion_otp_ready", {
          ride_id: activeRide.ride_id,
          completion_otp: activeRide.completion_otp,
          status: activeRide.status,
        });
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

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
          ride_kind: activeRide.ride_kind || "normal",
          fare: toNumber(activeRide.fare),
          pickup_otp: activeRide.pickup_otp,
          ride_otp: activeRide.ride_otp,
          completion_otp: activeRide.completion_otp,
          payment_method: activeRide.payment_method,
          driver_marked_complete_at: activeRide.driver_marked_complete_at,
          request_time: activeRide.request_time,
          pickup: activeRide.pickup,
          pickup_latitude: activeRide.pickup_latitude,
          pickup_longitude: activeRide.pickup_longitude,
          dropoff: activeRide.dropoff,
          dropoff_latitude: activeRide.dropoff_latitude,
          dropoff_longitude: activeRide.dropoff_longitude,
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
      ride_kind: ride.ride_kind || "normal",
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
      fare: toNumber(order.fare),
      pickup: order.pickup,
      dropoff: order.dropoff,
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
      fare: toNumber(order.fare),
      pickup: order.pickup,
      dropoff: order.dropoff,
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

  console.log("[Backend] Confirm ride completion:", { customerId, rideId, otp, normalizedOtp });

  if (!/^\d{6}$/.test(normalizedOtp)) {
    console.warn("[Backend] Invalid OTP format:", normalizedOtp);
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

    console.log("[Backend] Ride query result:", { rowCount: rideResult.rows.length, ride: rideResult.rows[0] });

    if (!rideResult.rows.length) {
      console.warn("[Backend] Ride not found");
      throw { status: 404, message: "Ride not found." };
    }

    const ride = rideResult.rows[0];

    if (Number(ride.customer_id) !== Number(customerId)) {
      console.warn("[Backend] Customer mismatch:", { rideCustomer: ride.customer_id, requestCustomer: customerId });
      throw { status: 403, message: "You can only confirm your own ride." };
    }

    // Accept both "in_progress" (customer confirming with OTP sent at on_the_way)
    // and "driver_completed" (customer confirming after driver arrives)
    const rideStatus = String(ride.status || "").toLowerCase();
    console.log("[Backend] Ride status check:", { status: ride.status, normalized: rideStatus });
    
    if (!["in_progress", "driver_completed"].includes(rideStatus)) {
      console.warn("[Backend] Invalid ride status:", rideStatus);
      throw {
        status: 409,
        message: "Ride is not ready for customer confirmation yet.",
      };
    }

    const expectedOtp = String(ride.completion_otp || ride.ride_otp || "");
    console.log("[Backend] OTP check:", { expected: expectedOtp, provided: normalizedOtp, match: normalizedOtp === expectedOtp });
    
    if (!expectedOtp || normalizedOtp !== expectedOtp) {
      console.warn("[Backend] OTP mismatch:", { expected: expectedOtp, provided: normalizedOtp });
      throw { status: 400, message: "Invalid completion OTP." };
    }

    console.log("[Backend] BEFORE settleRidePayment call with ride:", { rideId: ride.ride_id, fare: ride.initial_fare || ride.final_fare });
    console.log("[Backend] OTP verified, settling payment...");
    console.log("[Backend] DEBUG: About to call settleRidePayment");
    const settlement = await settleRidePayment(client, ride);
    console.log("[Backend] DEBUG: settleRidePayment returned");
    console.log("[Backend] Payment settled:", settlement);

    console.log("[Backend] Updating ride status to completed...");
    const rideStatusResult = await client.query(
      `UPDATE rides
       SET status = 'completed',
           end_time = COALESCE(end_time, CURRENT_TIMESTAMP)
       WHERE ride_id = $1
       RETURNING ride_id, status, end_time`,
      [rideId]
    );
    console.log("[Backend] Ride status updated:", rideStatusResult.rows[0]);

    console.log("[Backend] Updating ride completion details...");
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
    console.log("[Backend] Ride completion details updated:", detailsResult.rows[0]);

    console.log("[Backend] Committing transaction...");
    await client.query("COMMIT");
    console.log("[Backend] Transaction committed successfully");

    return {
      ...rideStatusResult.rows[0],
      completion_mode: detailsResult.rows[0]?.completion_mode || "customer_confirmed_otp",
      settlement,
    };
  } catch (err) {
    console.error("[Backend] ERROR - Exception in confirmRideCompletion:", {
      message: err?.message,
      status: err?.status,
      error: err
    });
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const listFoodRestaurants = async () => {
  const result = await query(
    `SELECT
       r.restaurant_id,
       r.name,
       r.rating,
       r.phone,
       l.address_name,
       l.city
     FROM restaurants r
     LEFT JOIN locations l ON l.location_id = r.location_id
     WHERE COALESCE(r.is_approved, false) = true
     ORDER BY r.name ASC`
  );

  return result.rows.map((row) => ({
    restaurant_id: Number(row.restaurant_id),
    name: row.name,
    rating: toNumber(row.rating),
    phone: row.phone,
    address: row.address_name || null,
    city: row.city || null,
  }));
};

const listRestaurantMenu = async (restaurantId) => {
  const restaurantResult = await query(
    `SELECT restaurant_id, name
     FROM restaurants
     WHERE restaurant_id = $1
       AND COALESCE(is_approved, false) = true
     LIMIT 1`,
    [restaurantId]
  );

  if (!restaurantResult.rows.length) {
    throw { status: 404, message: "Restaurant not found." };
  }

  const itemsResult = await query(
    `SELECT
       item_id,
       name,
       price,
       is_available,
       description
     FROM menu_items
     WHERE restaurant_id = $1
     ORDER BY name ASC`,
    [restaurantId]
  );

  return {
    restaurant: {
      restaurant_id: Number(restaurantResult.rows[0].restaurant_id),
      name: restaurantResult.rows[0].name,
    },
    items: itemsResult.rows.map((row) => ({
      item_id: Number(row.item_id),
      name: row.name,
      price: toNumber(row.price),
      is_available: Boolean(row.is_available),
      description: row.description || "",
    })),
  };
};

const placeFoodOrder = async (customerId, restaurantId, items, deliveryLocation = null) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw { status: 400, message: "At least one item is required to place an order." };
  }

  const normalizedItems = items.map((item) => ({
    item_id: Number(item?.item_id),
    quantity: Number(item?.quantity),
  }));

  const invalidItem = normalizedItems.find(
    (item) => !Number.isInteger(item.item_id) || item.item_id <= 0 || !Number.isInteger(item.quantity) || item.quantity <= 0
  );

  if (invalidItem) {
    throw { status: 400, message: "Each order item must include a valid item_id and positive quantity." };
  }

  const client = await getClient();

  try {
    await client.query("BEGIN");

    const restaurantResult = await client.query(
      `SELECT restaurant_id, name
       FROM restaurants
       WHERE restaurant_id = $1
         AND COALESCE(is_approved, false) = true
       LIMIT 1`,
      [restaurantId]
    );

    if (!restaurantResult.rows.length) {
      throw { status: 404, message: "Restaurant not found." };
    }

    const deliveryAddressName = String(deliveryLocation?.address_name || "").trim();
    const deliveryLat = toOptionalNumber(deliveryLocation?.latitude);
    const deliveryLng = toOptionalNumber(deliveryLocation?.longitude);
    const paymentMethod = String(deliveryLocation?.payment_method || "cash").toLowerCase().trim();

    if (!deliveryAddressName || deliveryLat === null || deliveryLng === null) {
      throw {
        status: 400,
        message: "Delivery address and GPS coordinates are required.",
      };
    }

    if (!["cash", "wallet"].includes(paymentMethod)) {
      throw { status: 400, message: "payment_method must be either cash or wallet." };
    }

    const locationResult = await client.query(
      `INSERT INTO locations (address_name, city, latitude, longitude)
       VALUES ($1, $2, $3, $4)
       RETURNING location_id`,
      [deliveryAddressName, "Dhaka", deliveryLat, deliveryLng]
    );

    const deliveryLocationId = Number(locationResult.rows[0].location_id);
    await client.query(
      `INSERT INTO saved_addresses (customer_id, location_id, label)
       VALUES ($1, $2, 'Current delivery')
       ON CONFLICT (customer_id, location_id) DO NOTHING`,
      [customerId, deliveryLocationId]
    );

    const itemIds = [...new Set(normalizedItems.map((item) => item.item_id))];
    const menuResult = await client.query(
      `SELECT item_id, restaurant_id, name, price, is_available
       FROM menu_items
       WHERE item_id = ANY($1::int[])`,
      [itemIds]
    );

    if (menuResult.rows.length !== itemIds.length) {
      throw { status: 400, message: "One or more menu items are invalid." };
    }

    const menuMap = new Map(menuResult.rows.map((row) => [Number(row.item_id), row]));

    for (const item of normalizedItems) {
      const menuItem = menuMap.get(item.item_id);
      if (!menuItem || Number(menuItem.restaurant_id) !== Number(restaurantId)) {
        throw { status: 400, message: "All selected items must belong to the same restaurant." };
      }

      if (!menuItem.is_available) {
        throw { status: 409, message: `${menuItem.name} is currently unavailable.` };
      }
    }

    const totalPrice = normalizedItems.reduce((sum, item) => {
      const menuItem = menuMap.get(item.item_id);
      return sum + toNumber(menuItem.price) * item.quantity;
    }, 0);

    const orderResult = await client.query(
      `INSERT INTO food_orders (customer_id, restaurant_id, status, total_price, payment_method, order_time)
       VALUES ($1, $2, 'placed', $3, $4, NOW())
       RETURNING order_id, status, total_price, payment_method, order_time`,
      [customerId, restaurantId, totalPrice, paymentMethod]
    );

    const order = orderResult.rows[0];

    for (const item of normalizedItems) {
      const menuItem = menuMap.get(item.item_id);
      await client.query(
        `INSERT INTO order_details (order_id, item_id, quantity, price_at_order)
         VALUES ($1, $2, $3, $4)`,
        [order.order_id, item.item_id, item.quantity, menuItem.price]
      );
    }

    await client.query("COMMIT");

    return {
      order_id: Number(order.order_id),
      status: order.status,
      total_price: toNumber(order.total_price),
      payment_method: order.payment_method || paymentMethod,
      order_time: order.order_time,
      restaurant: {
        restaurant_id: Number(restaurantResult.rows[0].restaurant_id),
        name: restaurantResult.rows[0].name,
      },
      items: normalizedItems.map((item) => {
        const menuItem = menuMap.get(item.item_id);
        return {
          item_id: item.item_id,
          name: menuItem.name,
          quantity: item.quantity,
          unit_price: toNumber(menuItem.price),
        };
      }),
      delivery_location_id: deliveryLocationId,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  getCustomerDashboardData,
  confirmRideCompletion,
  listFoodRestaurants,
  listRestaurantMenu,
  placeFoodOrder,
};