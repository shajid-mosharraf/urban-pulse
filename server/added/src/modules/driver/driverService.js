const { getClient, query } = require("../../config/db");
const { getIo } = require("../../realtime/socketState");
const rideService = require("../ride/rideService");

const toNumber = (value) => Number(value || 0);

const normalizeStatus = (value) => String(value || "").toLowerCase();

const backfillLegacyPendingAssignmentsForDriver = async (driverId) => {
  const client = await getClient();

  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO ride_driver_requests (
         ride_id,
         driver_id,
         status,
         priority_rank,
         distance_km,
         rating_snapshot,
         sent_at,
         responded_at
       )
       SELECT
         r.ride_id,
         d.user_id,
         'pending',
         1,
         (
           6371 * ACOS(
             LEAST(
               1,
               GREATEST(
                 -1,
                 COS(RADIANS(pu.latitude)) * COS(RADIANS(d.current_latitude)) *
                 COS(RADIANS(d.current_longitude) - RADIANS(pu.longitude)) +
                 SIN(RADIANS(pu.latitude)) * SIN(RADIANS(d.current_latitude))
               )
             )
           )
         ) AS distance_km,
         COALESCE(d.rating_avg, 0) AS rating_snapshot,
         NOW(),
         NULL
       FROM rides r
       JOIN locations pu ON pu.location_id = r.pickup_location_id
       JOIN drivers d ON d.user_id = $1
       JOIN vehicles v ON v.vehicle_id = d.current_vehicle_id
       WHERE LOWER(r.status) = 'requested'
         AND r.driver_id IS NULL
         AND d.active_status = TRUE
         AND COALESCE(d.is_approved, TRUE) = TRUE
         AND d.current_latitude IS NOT NULL
         AND d.current_longitude IS NOT NULL
         AND COALESCE(v.active, TRUE) = TRUE
         AND r.service_type IS NOT NULL
         AND v.type IS NOT NULL
         AND LENGTH(TRIM(r.service_type)) > 0
         AND LENGTH(TRIM(v.type)) > 0
         AND LOWER(TRIM(v.type)) = LOWER(TRIM(r.service_type))
         AND NOT EXISTS (
           SELECT 1
           FROM rides ar
           WHERE ar.driver_id = d.user_id
             AND LOWER(ar.status) NOT IN ('completed', 'cancelled')
         )
         AND NOT EXISTS (
           SELECT 1
           FROM ride_driver_requests rr
           WHERE rr.ride_id = r.ride_id
             AND rr.driver_id = d.user_id
         )
       ORDER BY r.request_time DESC
       LIMIT 25`,
      [driverId]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");

    const msg = String(err?.message || "").toLowerCase();
    if (
      msg.includes("relation \"ride_driver_requests\" does not exist") ||
      msg.includes("column")
    ) {
      return;
    }

    throw err;
  } finally {
    client.release();
  }
};

const getDriverDashboardData = async (userId) => {
  await backfillLegacyPendingAssignmentsForDriver(userId);

  const userResult = await query(
    `SELECT
       u.user_id,
       u.first_name,
       u.last_name,
       d.active_status,
       d.rating_avg,
       v.model AS vehicle_model,
       v.type AS vehicle_type,
       v.licence_no AS vehicle_plate
     FROM users u
     JOIN drivers d ON d.user_id = u.user_id
     LEFT JOIN vehicles v ON v.vehicle_id = d.current_vehicle_id
     WHERE u.user_id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw { status: 404, message: "Driver not found." };
  }

  const user = userResult.rows[0];

  const earningsResult = await query(
    `SELECT
       COALESCE(SUM(CASE
         WHEN DATE(r.end_time) = CURRENT_DATE AND LOWER(r.status) = 'completed'
         THEN COALESCE(p.amount, r.final_fare, r.initial_fare, 0)
         ELSE 0
       END), 0) AS today_earnings,
       COALESCE(SUM(CASE
         WHEN r.end_time >= DATE_TRUNC('week', CURRENT_DATE) AND LOWER(r.status) = 'completed'
         THEN COALESCE(p.amount, r.final_fare, r.initial_fare, 0)
         ELSE 0
       END), 0) AS week_earnings,
       COALESCE(SUM(CASE
         WHEN DATE_TRUNC('month', r.end_time) = DATE_TRUNC('month', CURRENT_DATE)
              AND LOWER(r.status) = 'completed'
         THEN COALESCE(p.amount, r.final_fare, r.initial_fare, 0)
         ELSE 0
       END), 0) AS month_earnings,
       COUNT(CASE
         WHEN DATE(r.end_time) = CURRENT_DATE AND LOWER(r.status) = 'completed'
         THEN 1
         ELSE NULL
       END) AS trips_today,
       COUNT(CASE
         WHEN LOWER(r.status) = 'completed'
         THEN 1
         ELSE NULL
       END) AS total_completed_rides
     FROM rides r
     LEFT JOIN payments p ON p.ride_id = r.ride_id
     WHERE r.driver_id = $1`,
    [userId]
  );

  let incomingRequestsResult;
  try {
    incomingRequestsResult = await query(
      `SELECT
         r.ride_id,
         r.distance_km,
         r.initial_fare,
         r.service_type,
         r.request_time,
         pu.address_name AS pickup,
         du.address_name AS dropoff,
         rr.priority_rank,
         rr.distance_km AS driver_distance_km,
         rr.rating_snapshot
       FROM ride_driver_requests rr
       JOIN rides r ON r.ride_id = rr.ride_id
       LEFT JOIN locations pu ON pu.location_id = r.pickup_location_id
       LEFT JOIN locations du ON du.location_id = r.dropoff_location_id
       WHERE rr.driver_id = $1
         AND LOWER(rr.status) = 'pending'
         AND LOWER(r.status) = 'requested'
         AND r.driver_id IS NULL
       ORDER BY rr.priority_rank ASC, r.request_time DESC
       LIMIT 8`,
      [userId]
    );
  } catch (err) {
    if (String(err?.message || "").toLowerCase().includes("relation \"ride_driver_requests\" does not exist")) {
      // Avoid sending unfiltered ride requests when the routing table is missing.
      incomingRequestsResult = { rows: [] };
    } else {
      throw err;
    }
  }

  const activeRideResult = await query(
    `SELECT
       r.ride_id,
       r.status,
       r.service_type,
       r.request_time,
       r.start_time,
       rcd.pickup_otp,
      rcd.completion_otp,
       rcd.driver_marked_complete_at,
       pu.address_name AS pickup,
       pu.latitude AS pickup_latitude,
       pu.longitude AS pickup_longitude,
       du.address_name AS dropoff,
       du.latitude AS dropoff_latitude,
       du.longitude AS dropoff_longitude,
       c.user_id AS customer_id,
       cu.first_name AS customer_first_name,
       cu.last_name AS customer_last_name,
      c.customer_rating AS customer_rating_avg,
       COALESCE(r.final_fare, r.initial_fare, p.amount, 0) AS fare
     FROM rides r
     LEFT JOIN payments p ON p.ride_id = r.ride_id
    LEFT JOIN ride_completion_details rcd ON rcd.ride_id = r.ride_id
     LEFT JOIN locations pu ON pu.location_id = r.pickup_location_id
     LEFT JOIN locations du ON du.location_id = r.dropoff_location_id
     LEFT JOIN customers c ON c.user_id = r.customer_id
     LEFT JOIN users cu ON cu.user_id = c.user_id
     WHERE r.driver_id = $1
       AND LOWER(r.status) NOT IN ('completed', 'cancelled')
     ORDER BY r.request_time DESC
     LIMIT 1`,
    [userId]
  );

  let tripLogResult;
  try {
    tripLogResult = await query(
      `SELECT
         r.ride_id,
         r.status,
         COALESCE(r.final_fare, r.initial_fare, p.amount, 0) AS fare,
         r.end_time,
         pu.address_name AS pickup,
        du.address_name AS dropoff,
        cu.first_name AS customer_first_name,
        cu.last_name AS customer_last_name,
        pr.score AS my_rating_to_customer,
        crt.score AS customer_rating_to_driver
       FROM rides r
       LEFT JOIN payments p ON p.ride_id = r.ride_id
       LEFT JOIN locations pu ON pu.location_id = r.pickup_location_id
       LEFT JOIN locations du ON du.location_id = r.dropoff_location_id
       LEFT JOIN customers c ON c.user_id = r.customer_id
       LEFT JOIN users cu ON cu.user_id = c.user_id
       LEFT JOIN ride_party_ratings pr ON pr.ride_id = r.ride_id
        AND pr.rater_id = r.driver_id
        AND pr.receiver_id = r.customer_id
       LEFT JOIN ride_party_ratings crt ON crt.ride_id = r.ride_id
        AND crt.rater_id = r.customer_id
        AND crt.receiver_id = r.driver_id
       WHERE r.driver_id = $1
         AND DATE(COALESCE(r.end_time, r.request_time)) = CURRENT_DATE
       ORDER BY COALESCE(r.end_time, r.request_time) DESC
       LIMIT 8`,
      [userId]
    );
  } catch (err) {
    if (String(err?.message || "").toLowerCase().includes("relation \"ride_party_ratings\" does not exist")) {
      tripLogResult = await query(
        `SELECT
           r.ride_id,
           r.status,
           COALESCE(r.final_fare, r.initial_fare, p.amount, 0) AS fare,
           r.end_time,
           pu.address_name AS pickup,
           du.address_name AS dropoff,
           cu.first_name AS customer_first_name,
           cu.last_name AS customer_last_name,
           NULL::INT AS my_rating_to_customer,
           NULL::INT AS customer_rating_to_driver
         FROM rides r
         LEFT JOIN payments p ON p.ride_id = r.ride_id
         LEFT JOIN locations pu ON pu.location_id = r.pickup_location_id
         LEFT JOIN locations du ON du.location_id = r.dropoff_location_id
         LEFT JOIN customers c ON c.user_id = r.customer_id
         LEFT JOIN users cu ON cu.user_id = c.user_id
         WHERE r.driver_id = $1
           AND DATE(COALESCE(r.end_time, r.request_time)) = CURRENT_DATE
         ORDER BY COALESCE(r.end_time, r.request_time) DESC
         LIMIT 8`,
        [userId]
      );
    } else {
      throw err;
    }
  }

  let lastRidesResult;
  try {
    lastRidesResult = await query(
      `SELECT
         r.ride_id,
         r.status,
         COALESCE(r.final_fare, r.initial_fare, p.amount, 0) AS fare,
         COALESCE(r.end_time, r.request_time) AS event_time,
         pu.address_name AS pickup,
         du.address_name AS dropoff,
         cu.first_name AS customer_first_name,
         cu.last_name AS customer_last_name,
         pr.score AS my_rating_to_customer,
         crt.score AS customer_rating_to_driver
       FROM rides r
       LEFT JOIN payments p ON p.ride_id = r.ride_id
       LEFT JOIN locations pu ON pu.location_id = r.pickup_location_id
       LEFT JOIN locations du ON du.location_id = r.dropoff_location_id
       LEFT JOIN customers c ON c.user_id = r.customer_id
       LEFT JOIN users cu ON cu.user_id = c.user_id
       LEFT JOIN ride_party_ratings pr ON pr.ride_id = r.ride_id
        AND pr.rater_id = r.driver_id
        AND pr.receiver_id = r.customer_id
       LEFT JOIN ride_party_ratings crt ON crt.ride_id = r.ride_id
        AND crt.rater_id = r.customer_id
        AND crt.receiver_id = r.driver_id
       WHERE r.driver_id = $1
       ORDER BY COALESCE(r.end_time, r.request_time) DESC
       LIMIT 3`,
      [userId]
    );
  } catch (err) {
    if (String(err?.message || "").toLowerCase().includes("relation \"ride_party_ratings\" does not exist")) {
      lastRidesResult = await query(
        `SELECT
           r.ride_id,
           r.status,
           COALESCE(r.final_fare, r.initial_fare, p.amount, 0) AS fare,
           COALESCE(r.end_time, r.request_time) AS event_time,
           pu.address_name AS pickup,
           du.address_name AS dropoff,
           cu.first_name AS customer_first_name,
           cu.last_name AS customer_last_name,
           NULL::INT AS my_rating_to_customer,
           NULL::INT AS customer_rating_to_driver
         FROM rides r
         LEFT JOIN payments p ON p.ride_id = r.ride_id
         LEFT JOIN locations pu ON pu.location_id = r.pickup_location_id
         LEFT JOIN locations du ON du.location_id = r.dropoff_location_id
         LEFT JOIN customers c ON c.user_id = r.customer_id
         LEFT JOIN users cu ON cu.user_id = c.user_id
         WHERE r.driver_id = $1
         ORDER BY COALESCE(r.end_time, r.request_time) DESC
         LIMIT 3`,
        [userId]
      );
    } else {
      throw err;
    }
  }

  const weeklyTrendResult = await query(
    `SELECT
       TO_CHAR(day_ref, 'Dy') AS day_label,
       COALESCE(SUM(CASE
         WHEN LOWER(r.status) = 'completed'
         THEN COALESCE(p.amount, r.final_fare, r.initial_fare, 0)
         ELSE 0
       END), 0) AS amount
     FROM (
       SELECT generate_series(CURRENT_DATE - INTERVAL '6 day', CURRENT_DATE, INTERVAL '1 day')::date AS day_ref
     ) d
     LEFT JOIN rides r ON DATE(r.end_time) = d.day_ref AND r.driver_id = $1
     LEFT JOIN payments p ON p.ride_id = r.ride_id
     GROUP BY day_ref
     ORDER BY day_ref`,
    [userId]
  );

  const e = earningsResult.rows[0] || {
    today_earnings: 0,
    week_earnings: 0,
    month_earnings: 0,
    trips_today: 0,
    total_completed_rides: 0,
  };

  return {
    user: {
      user_id: user.user_id,
      full_name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
      active_status: Boolean(user.active_status),
      rating_avg: toNumber(user.rating_avg),
      vehicle_model: user.vehicle_model,
      vehicle_type: user.vehicle_type,
      vehicle_plate: user.vehicle_plate,
    },
    earnings: {
      today: toNumber(e.today_earnings),
      week: toNumber(e.week_earnings),
      month: toNumber(e.month_earnings),
      trips_today: toNumber(e.trips_today),
      total_completed_rides: toNumber(e.total_completed_rides),
    },
    incomingRequests: incomingRequestsResult.rows.map((r) => ({
      ride_id: r.ride_id,
      pickup: r.pickup,
      dropoff: r.dropoff,
      distance_km: toNumber(r.distance_km),
      initial_fare: toNumber(r.initial_fare),
      service_type: r.service_type,
      request_time: r.request_time,
    })),
    activeRide: activeRideResult.rows[0]
      ? {
          ride_id: activeRideResult.rows[0].ride_id,
          status: activeRideResult.rows[0].status,
          service_type: activeRideResult.rows[0].service_type,
          request_time: activeRideResult.rows[0].request_time,
          start_time: activeRideResult.rows[0].start_time,
          pickup_otp: activeRideResult.rows[0].pickup_otp,
          completion_otp: activeRideResult.rows[0].completion_otp,
          driver_marked_complete_at: activeRideResult.rows[0].driver_marked_complete_at,
          pickup: activeRideResult.rows[0].pickup,
          pickup_latitude: toNumber(activeRideResult.rows[0].pickup_latitude),
          pickup_longitude: toNumber(activeRideResult.rows[0].pickup_longitude),
          dropoff: activeRideResult.rows[0].dropoff,
          dropoff_latitude: toNumber(activeRideResult.rows[0].dropoff_latitude),
          dropoff_longitude: toNumber(activeRideResult.rows[0].dropoff_longitude),
          fare: toNumber(activeRideResult.rows[0].fare),
          customer_name: `${activeRideResult.rows[0].customer_first_name || ""} ${activeRideResult.rows[0].customer_last_name || ""}`.trim(),
          customer_rating_avg: toNumber(activeRideResult.rows[0].customer_rating_avg),
        }
      : null,
    tripLogToday: tripLogResult.rows.map((r) => ({
      ride_id: r.ride_id,
      status: r.status,
      fare: toNumber(r.fare),
      end_time: r.end_time,
      pickup: r.pickup,
      dropoff: r.dropoff,
      customer_name: `${r.customer_first_name || ""} ${r.customer_last_name || ""}`.trim(),
      my_rating_to_customer:
        r.my_rating_to_customer !== null && r.my_rating_to_customer !== undefined
          ? toNumber(r.my_rating_to_customer)
          : null,
      customer_rating_to_driver:
        r.customer_rating_to_driver !== null && r.customer_rating_to_driver !== undefined
          ? toNumber(r.customer_rating_to_driver)
          : null,
    })),
    weeklyTrend: weeklyTrendResult.rows.map((d) => ({
      day: d.day_label,
      amount: toNumber(d.amount),
    })),
    lastRides: lastRidesResult.rows.map((r) => ({
      ride_id: r.ride_id,
      status: r.status,
      fare: toNumber(r.fare),
      event_time: r.event_time,
      pickup: r.pickup,
      dropoff: r.dropoff,
      customer_name: `${r.customer_first_name || ""} ${r.customer_last_name || ""}`.trim(),
      my_rating_to_customer:
        r.my_rating_to_customer !== null && r.my_rating_to_customer !== undefined
          ? toNumber(r.my_rating_to_customer)
          : null,
      customer_rating_to_driver:
        r.customer_rating_to_driver !== null && r.customer_rating_to_driver !== undefined
          ? toNumber(r.customer_rating_to_driver)
          : null,
    })),
  };
};

const acceptRideRequest = async (driverId, rideId) => {
  const accepted = await rideService.acceptRideByDriver({
    ride_id: rideId,
    driver_id: driverId,
  });

  return {
    ride_id: accepted.ride.ride_id,
    status: accepted.ride.status,
    pickup_otp: accepted.otp?.pickup_otp || null,
    driver: {
      name: accepted.driverDetails?.first_name || "Driver",
      phone: accepted.driverDetails?.phone || "",
      vehicle: accepted.driverDetails?.licence_no || "Assigned vehicle",
      rating: accepted.driverDetails?.rating_avg || "5.0",
    },
  };
};

const randomOtp = () => String(Math.floor(Math.random() * 1000000)).padStart(6, "0");

const startActiveRide = async (driverId, rideId, otp) => {
  const normalizedOtp = String(otp || "").trim();

  if (!normalizedOtp) {
    throw {
      status: 400,
      message: "Pickup OTP is required to mark passenger pickup and start the trip.",
    };
  }

  if (!/^\d{6}$/.test(normalizedOtp)) {
    throw {
      status: 400,
      message: "Pickup OTP must be a 6-digit code.",
    };
  }

  const client = await getClient();

  try {
    await client.query("BEGIN");

    const validation = await client.query(
      `SELECT r.ride_id
       FROM rides r
       JOIN ride_completion_details rcd ON rcd.ride_id = r.ride_id
       WHERE r.ride_id = $1
         AND r.driver_id = $2
         AND LOWER(r.status) = 'accepted'
         AND rcd.pickup_otp = $3
       FOR UPDATE OF r`,
      [rideId, driverId, normalizedOtp]
    );

    if (!validation.rows.length) {
      throw {
        status: 409,
        message: "Ride cannot be started. Ensure it is accepted by you and pickup OTP is correct.",
      };
    }

    const rideResult = await client.query(
      `UPDATE rides
       SET status = 'in_progress',
           start_time = COALESCE(start_time, CURRENT_TIMESTAMP)
       WHERE ride_id = $1
       RETURNING ride_id, status, start_time, customer_id`,
      [rideId]
    );

    // Generate completion OTP
    const completionOtp = randomOtp();

    const otpUpdateResult = await client.query(
      `INSERT INTO ride_completion_details (ride_id, otp_verified_at, completion_otp, updated_at)
       VALUES ($1, CURRENT_TIMESTAMP, $2, NOW())
       ON CONFLICT (ride_id)
       DO UPDATE SET otp_verified_at = CURRENT_TIMESTAMP, completion_otp = $2, updated_at = NOW()
       RETURNING completion_otp`,
      [rideId, completionOtp]
    );

    const savedCompletionOtp = otpUpdateResult.rows[0]?.completion_otp || completionOtp;

    await client.query(
      `UPDATE food_orders
       SET status = 'on_the_way'
       WHERE ride_id = $1
         AND LOWER(status) = 'ready_for_delivery'`,
      [rideId]
    );

    // Send completion OTP to customer via chat
    try {
      const customerId = Number(rideResult.rows[0]?.customer_id || 0);
      
      // Create/get conversation
      await client.query(
        `INSERT INTO conversations (ride_id)
         SELECT $1
         WHERE NOT EXISTS (
           SELECT 1 FROM conversations WHERE ride_id = $1
         )`,
        [rideId]
      );

      // Get restaurant owner
      const restaurantInfo = await client.query(
        `SELECT r.owner_id
         FROM food_orders fo
         JOIN restaurants r ON r.restaurant_id = fo.restaurant_id
         WHERE fo.ride_id = $1
         ORDER BY fo.order_time DESC
         LIMIT 1`,
        [rideId]
      );

      const restaurantOwnerId = Number(restaurantInfo.rows[0]?.owner_id || 0);
      
      if (restaurantOwnerId > 0 && customerId > 0) {
        const conversationRow = await client.query(
          `SELECT conversation_id
           FROM conversations
           WHERE ride_id = $1
           ORDER BY conversation_id DESC
           LIMIT 1`,
          [rideId]
        );

        const conversationId = Number(conversationRow.rows[0]?.conversation_id || 0);
        const completionOtpMessage = `Delivery Completion OTP: ${savedCompletionOtp}`;

        if (conversationId > 0) {
          await client.query(
            `INSERT INTO messages (conversation_id, sender_id, content, timestamp)
             VALUES ($1, $2, $3, NOW())`,
            [conversationId, restaurantOwnerId, completionOtpMessage]
          );
        }
      }

      const io = getIo();
      if (io) {
        io.to(`ride_${rideId}`).emit("delivery_completion_otp_ready", {
          ride_id: rideId,
          completion_otp: savedCompletionOtp,
          status: "in_progress",
        });
      }
    } catch (chatErr) {
      // Continue even if chat fails - main operation succeeded
      const msg = String(chatErr?.message || "").toLowerCase();
      if (
        !msg.includes("relation \"conversations\" does not exist") &&
        !msg.includes("relation \"messages\" does not exist")
      ) {
        throw chatErr;
      }
    }

    await client.query("COMMIT");
    return rideResult.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const endActiveRide = async (driverId, rideId) => {
  const client = await getClient();

  try {
    await client.query("BEGIN");

    const rideResult = await client.query(
      `SELECT
         ride_id,
         status,
         driver_id
       FROM rides
       WHERE ride_id = $1
       FOR UPDATE`,
      [rideId]
    );

    if (rideResult.rows.length === 0) {
      throw { status: 404, message: "Ride not found." };
    }

    const ride = rideResult.rows[0];

    if (Number(ride.driver_id) !== Number(driverId)) {
      throw { status: 403, message: "You can only end your own active ride." };
    }

    const status = normalizeStatus(ride.status);
    if (status !== "in_progress") {
      throw {
        status: 409,
        message: "Ride must be in progress before marking trip completion.",
      };
    }

    // Get existing completion OTP (sent to customer when ride became on_the_way)
    const completionDetailsResult = await client.query(
      `SELECT completion_otp FROM ride_completion_details WHERE ride_id = $1`,
      [rideId]
    );
    
    let completionOtp = completionDetailsResult.rows[0]?.completion_otp;
    if (!completionOtp) {
      completionOtp = randomOtp();
    }

    const rideStatusResult = await client.query(
      `UPDATE rides
       SET status = 'driver_completed'
       WHERE ride_id = $1
         AND LOWER(status) = 'in_progress'
       RETURNING ride_id, status`,
      [rideId]
    );

    if (rideStatusResult.rows.length === 0) {
      throw {
        status: 409,
        message: "Ride already marked for customer confirmation.",
      };
    }

    const detailsResult = await client.query(
      `INSERT INTO ride_completion_details (
         ride_id,
         driver_marked_complete_at,
         completion_otp,
         completion_mode,
         updated_at
       )
       VALUES ($1, CURRENT_TIMESTAMP, $2, 'waiting_customer_otp', NOW())
       ON CONFLICT (ride_id)
       DO UPDATE
       SET driver_marked_complete_at = CURRENT_TIMESTAMP,
           completion_mode = 'waiting_customer_otp',
           updated_at = NOW()
       RETURNING driver_marked_complete_at, completion_otp, completion_mode`,
      [rideId, completionOtp]
    );

    await client.query("COMMIT");

    return {
      ...rideStatusResult.rows[0],
      driver_marked_complete_at: detailsResult.rows[0]?.driver_marked_complete_at || null,
      completion_otp: completionOtp,
      completion_mode: detailsResult.rows[0]?.completion_mode || "waiting_customer_otp",
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const declineRideRequest = async (driverId, rideId) => {
  const client = await getClient();

  try {
    await client.query("BEGIN");

    const rideCheck = await client.query(
      `SELECT ride_id, status, driver_id FROM rides WHERE ride_id = $1 FOR UPDATE`,
      [rideId]
    );

    if (rideCheck.rows.length === 0) {
      throw { status: 404, message: "Ride not found." };
    }

    const ride = rideCheck.rows[0];
    if (String(ride.status || "").toLowerCase() !== "requested" || ride.driver_id !== null) {
      throw { status: 409, message: "Ride cannot be declined in its current state." };
    }

    try {
      await client.query(
        `UPDATE ride_driver_requests
         SET status = 'declined',
             responded_at = NOW()
         WHERE ride_id = $1
           AND driver_id = $2
           AND LOWER(status) = 'pending'`,
        [rideId, driverId]
      );
    } catch (err) {
      if (!String(err?.message || "").toLowerCase().includes("relation \"ride_driver_requests\" does not exist")) {
        throw err;
      }
    }

    await client.query("COMMIT");
    return { ride_id: rideId, status: "declined" };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const toggleDriverStatus = async (driverId, isOnline) => {
  const client = await getClient();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE drivers SET active_status = $1 WHERE user_id = $2 RETURNING user_id, active_status`,
      [isOnline, driverId]
    );

    if (result.rows.length === 0) {
      throw { status: 404, message: "Driver not found." };
    }

    await client.query("COMMIT");

    return {
      user_id: result.rows[0].user_id,
      active_status: Boolean(result.rows[0].active_status),
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const updateGPSLocation = async (driverId, latitude, longitude) => {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw { status: 400, message: "Invalid latitude/longitude coordinates." };
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw { status: 400, message: "Coordinates out of valid range." };
  }

  const client = await getClient();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE drivers
       SET current_latitude = $1, current_longitude = $2
       WHERE user_id = $3
       RETURNING user_id, current_latitude, current_longitude`,
      [lat, lng, driverId]
    );

    if (result.rows.length === 0) {
      throw { status: 404, message: "Driver not found." };
    }

    const activeRides = await client.query(
      `SELECT ride_id
       FROM rides
       WHERE driver_id = $1
         AND LOWER(status) NOT IN ('completed', 'cancelled')`,
      [driverId]
    );

    await client.query("COMMIT");

    return {
      user_id: result.rows[0].user_id,
      latitude: toNumber(result.rows[0].current_latitude),
      longitude: toNumber(result.rows[0].current_longitude),
      active_ride_ids: activeRides.rows.map((row) => Number(row.ride_id)),
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const switchActiveVehicle = async (driverId, vehicleId) => {
  const client = await getClient();

  try {
    await client.query("BEGIN");

    // Verify the driver exists
    const driverCheck = await client.query(
      `SELECT user_id FROM drivers WHERE user_id = $1`,
      [driverId]
    );

    if (driverCheck.rows.length === 0) {
      throw { status: 404, message: "Driver not found." };
    }

    // Verify the vehicle exists and belongs to this driver
    const vehicleCheck = await client.query(
      `SELECT vehicle_id, type, model, licence_no, color
       FROM vehicles
       WHERE vehicle_id = $1 AND owner_id = $2 AND active = TRUE`,
      [vehicleId, driverId]
    );

    if (vehicleCheck.rows.length === 0) {
      throw { status: 404, message: "Vehicle not found or is not owned by this driver." };
    }

    const vehicle = vehicleCheck.rows[0];

    // Update the driver's current_vehicle_id
    const updateResult = await client.query(
      `UPDATE drivers
       SET current_vehicle_id = $1
       WHERE user_id = $2
       RETURNING user_id, current_vehicle_id`,
      [vehicleId, driverId]
    );

    await client.query("COMMIT");

    return {
      user_id: updateResult.rows[0].user_id,
      current_vehicle_id: updateResult.rows[0].current_vehicle_id,
      vehicle_type: vehicle.type,
      vehicle_model: vehicle.model,
      vehicle_plate: vehicle.licence_no,
      message: `Active vehicle switched to ${vehicle.model} (${vehicle.type})`,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  getDriverDashboardData,
  acceptRideRequest,
  declineRideRequest,
  toggleDriverStatus,
  updateGPSLocation,
  startActiveRide,
  endActiveRide,
  switchActiveVehicle,
};