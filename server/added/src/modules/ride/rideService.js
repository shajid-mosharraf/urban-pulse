const { getClient, query } = require("../../config/db");
const {
  emitToOnlineDrivers,
  emitToDrivers,
  getOnlineDriverIds,
} = require("../../realtime/socketState");

const createNotification = async (client, userId, title, content, type = "System") => {
  try {
    await client.query(
      `INSERT INTO notifications (user_id, title, content, type, is_read, created_at)
       VALUES ($1, $2, $3, $4, false, NOW())`,
      [userId, title, content, type]
    );
  } catch (err) {
    // Keep core ride flow working even if notifications table has not been migrated yet.
    if (String(err?.message || "").toLowerCase().includes("relation \"notifications\" does not exist")) {
      return;
    }
    throw err;
  }
};

const asNumber = (value, field) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw { status: 400, message: `${field} must be a valid number.` };
  }
  return parsed;
};

const randomOtp = () => String(Math.floor(Math.random() * 1000000)).padStart(6, "0");

const normalizePaymentMethod = (value) => {
  const method = String(value || "cash").trim().toLowerCase();
  if (!["cash", "wallet"].includes(method)) {
    throw { status: 400, message: "payment_method must be either cash or wallet." };
  }
  return method;
};

const normalizeServiceType = (value) => {
  const serviceType = String(value || "").trim().toLowerCase();
  if (!serviceType) {
    throw { status: 400, message: "service_type is required." };
  }
  return serviceType;
};

const isMissingTableError = (err, tableName) => {
  const msg = String(err?.message || "").toLowerCase();
  return msg.includes(`relation \"${String(tableName || "").toLowerCase()}\" does not exist`);
};

const fetchRankedCandidateDrivers = async (client, pickupLat, pickupLng, serviceType, limit = 7) => {
  const onlineDriverIds = getOnlineDriverIds();
  const normalizedType = String(serviceType || "").trim().toLowerCase();

  // Defensive validation: reject empty service types
  if (!normalizedType) {
    console.warn(`[CandidateQuery] Empty service type requested - no candidates available`);
    return [];
  }

  // INNER JOIN requires vehicle to exist and be active
  // LOWER() + TRIM() ensures exact matching (exact service type, no empty values)
  // LENGTH check prevents matching empty strings in database
  const ranked = await client.query(
    `SELECT
       d.user_id AS driver_id,
       LOWER(v.type) AS vehicle_type,
       COALESCE(d.rating_avg, 0) AS rating_avg,
       CASE
         WHEN d.user_id = ANY($4::int[]) THEN 0
         ELSE 1
       END AS online_rank,
       (
         6371 * ACOS(
           LEAST(
             1,
             GREATEST(
               -1,
               COS(RADIANS($1)) * COS(RADIANS(d.current_latitude)) *
               COS(RADIANS(d.current_longitude) - RADIANS($2)) +
               SIN(RADIANS($1)) * SIN(RADIANS(d.current_latitude))
             )
           )
         )
       ) AS distance_km
     FROM drivers d
     INNER JOIN vehicles v ON v.vehicle_id = d.current_vehicle_id AND v.vehicle_id IS NOT NULL
     WHERE d.active_status = TRUE
       AND COALESCE(d.is_approved, TRUE) = TRUE
       AND COALESCE(v.active, TRUE) = TRUE
       AND v.type IS NOT NULL
       AND LENGTH(TRIM(v.type)) > 0
       AND LOWER(TRIM(v.type)) = $3
       AND d.current_latitude IS NOT NULL
       AND d.current_longitude IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM rides r
         WHERE r.driver_id = d.user_id
           AND LOWER(r.status) NOT IN ('completed', 'cancelled')
       )
     ORDER BY online_rank ASC, distance_km ASC, COALESCE(d.rating_avg, 0) DESC
     LIMIT $5`,
    [pickupLat, pickupLng, normalizedType, onlineDriverIds, limit]
  );

  // Debug: Log query results to verify correct service type matching
  console.log(
    `[CandidateQuery] Searching for service_type: '${normalizedType}' -> Found ${ranked.rows.length} drivers`
  );
  if (ranked.rows.length > 0) {
    const driverInfo = ranked.rows.map(r => `Driver#${r.driver_id}(Vehicle:${r.vehicle_type})`).join(", ");
    console.log(`  ${driverInfo}`);
  } else {
    console.warn(`  ⚠️  NO DRIVERS FOUND for service type '${normalizedType}' - check vehicle types in database`);
  }

  return ranked.rows.map((r) => ({
    driver_id: Number(r.driver_id),
    distance_km: Number(r.distance_km || 0),
    rating_avg: Number(r.rating_avg || 0),
  }));
};

const assertDriverHasNoActiveRide = async (client, driverId) => {
  const activeRide = await client.query(
    `SELECT ride_id
     FROM rides
     WHERE driver_id = $1
       AND LOWER(status) NOT IN ('completed', 'cancelled')
     LIMIT 1`,
    [driverId]
  );

  if (activeRide.rows.length) {
    throw {
      status: 409,
      message: "You already have an active ride. Complete it before accepting a new request.",
    };
  }
};

const createRideRequest = async (payload) => {
  const {
    customer_id,
    pickup_name,
    pickup_lat,
    pickup_lng,
    dropoff_name,
    dropoff_lat,
    dropoff_lng,
    service_type,
    distance_km,
    initial_fare,
    payment_method,
  } = payload;

  const customerId = asNumber(customer_id, "customer_id");
  const pickupLat = asNumber(pickup_lat, "pickup_lat");
  const pickupLng = asNumber(pickup_lng, "pickup_lng");
  const dropoffLat = asNumber(dropoff_lat, "dropoff_lat");
  const dropoffLng = asNumber(dropoff_lng, "dropoff_lng");
  const distance = asNumber(distance_km, "distance_km");
  const initialFare = asNumber(initial_fare, "initial_fare");
  const paymentMethod = normalizePaymentMethod(payment_method);
  const normalizedServiceType = normalizeServiceType(service_type);

  if (!pickup_name || !dropoff_name) {
    throw {
      status: 400,
      message: "pickup_name, dropoff_name and service_type are required.",
    };
  }

  // Validate that drivers exist with this vehicle type
  const allowedTypes = ["bike", "cng", "car", "micro"];
  if (!allowedTypes.includes(normalizedServiceType)) {
    throw {
      status: 400,
      message: `Invalid service_type: '${normalizedServiceType}'. Allowed types: ${allowedTypes.join(", ")}`,
    };
  }

  const client = await getClient();

  try {
    await client.query("BEGIN");

    // Lock customer row to serialize ride creation attempts for the same customer.
    const customerCheck = await client.query(
      "SELECT user_id FROM customers WHERE user_id = $1 FOR UPDATE",
      [customerId]
    );

    if (customerCheck.rows.length === 0) {
      throw { status: 404, message: "Customer not found." };
    }

    const activeRideCheck = await client.query(
      `SELECT ride_id
       FROM rides
       WHERE customer_id = $1
         AND LOWER(status) NOT IN ('completed', 'cancelled')
       ORDER BY request_time DESC
       LIMIT 1`,
      [customerId]
    );

    if (activeRideCheck.rows.length > 0) {
      throw {
        status: 409,
        message: "You already have an active ride. Please complete or cancel it before booking another ride.",
      };
    }

    const pickupLocation = await client.query(
      `INSERT INTO locations (address_name, city, latitude, longitude)
       VALUES ($1, $2, $3, $4)
       RETURNING location_id`,
      [pickup_name, "Dhaka", pickupLat, pickupLng]
    );

    const dropoffLocation = await client.query(
      `INSERT INTO locations (address_name, city, latitude, longitude)
       VALUES ($1, $2, $3, $4)
       RETURNING location_id`,
      [dropoff_name, "Dhaka", dropoffLat, dropoffLng]
    );

    const rideResult = await client.query(
      `INSERT INTO rides (
         customer_id,
         pickup_location_id,
         dropoff_location_id,
         service_type,
         status,
         distance_km,
         initial_fare
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ride_id, customer_id, driver_id, status, distance_km, initial_fare, request_time`,
      [
        customerId,
        pickupLocation.rows[0].location_id,
        dropoffLocation.rows[0].location_id,
        normalizedServiceType,
        "Requested",
        distance,
        initialFare,
      ]
    );

    const ride = {
      ...rideResult.rows[0],
      payment_method: paymentMethod,
    };

    await client.query(
      `INSERT INTO ride_completion_details (ride_id, payment_method, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (ride_id)
       DO UPDATE SET payment_method = EXCLUDED.payment_method, updated_at = NOW()`,
      [ride.ride_id, paymentMethod]
    );

    await createNotification(
      client,
      customerId,
      "Ride requested",
      `Your ${normalizedServiceType} ride request from ${pickup_name} to ${dropoff_name} has been created.`,
      "Ride Alert"
    );

    let rankedCandidates = [];
    try {
      rankedCandidates = await fetchRankedCandidateDrivers(client, pickupLat, pickupLng, normalizedServiceType, 7);

      if (rankedCandidates.length) {
        for (let i = 0; i < rankedCandidates.length; i += 1) {
          const candidate = rankedCandidates[i];
          await client.query(
            `INSERT INTO ride_driver_requests (
               ride_id,
               driver_id,
               status,
               priority_rank,
               distance_km,
               rating_snapshot,
               sent_at
             )
             VALUES ($1, $2, 'pending', $3, $4, $5, NOW())
             ON CONFLICT (ride_id, driver_id)
             DO UPDATE
             SET status = 'pending',
                 priority_rank = EXCLUDED.priority_rank,
                 distance_km = EXCLUDED.distance_km,
                 rating_snapshot = EXCLUDED.rating_snapshot,
                 sent_at = NOW(),
                 responded_at = NULL`,
            [ride.ride_id, candidate.driver_id, i + 1, candidate.distance_km, candidate.rating_avg]
          );
        }
      }
    } catch (candidateErr) {
      if (!isMissingTableError(candidateErr, "ride_driver_requests")) {
        throw candidateErr;
      }
    }

    await client.query("COMMIT");

    const rideBroadcastPayload = {
      ride_id: ride.ride_id,
      customer_id: ride.customer_id,
      pickup_address: pickup_name,
      dropoff_address: dropoff_name,
      distance,
      fare: initialFare,
      service_type: normalizedServiceType,
      request_time: ride.request_time,
    };

    const shortlistedDriverIds = rankedCandidates.map((c) => c.driver_id);

    if (shortlistedDriverIds.length > 0) {
      console.log(
        `[Ride Request] Ride ${ride.ride_id} (${normalizedServiceType}) sent to ${shortlistedDriverIds.length} drivers: [${shortlistedDriverIds.join(", ")}]`
      );
    } else {
      console.warn(`[Ride Request] Ride ${ride.ride_id} (${normalizedServiceType}) - NO MATCHING DRIVERS FOUND!`);
    }

    const nearbyDriversCount = shortlistedDriverIds.length
      ? emitToDrivers(shortlistedDriverIds, "new_ride_request", rideBroadcastPayload)
      : 0;

    return {
      ride,
      shortlistedDrivers: rankedCandidates,
      nearbyDriversCount,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const acceptRideByDriver = async ({ ride_id, driver_id }) => {
  const rideId = asNumber(ride_id, "ride_id");
  const driverId = asNumber(driver_id, "driver_id");

  const client = await getClient();

  let acceptedRide;
  let restaurantChatMessage = null;

  try {
    await client.query("BEGIN");

    // Lock driver row to prevent concurrent accepts by the same driver.
    const driverCheck = await client.query(
      `SELECT d.user_id, COALESCE(v.type, '') AS vehicle_type
       FROM drivers d
       LEFT JOIN vehicles v ON v.vehicle_id = d.current_vehicle_id
       WHERE d.user_id = $1
         AND COALESCE(d.is_approved, TRUE) = TRUE
       FOR UPDATE OF d`,
      [driverId]
    );

    if (driverCheck.rows.length === 0) {
      throw { status: 404, message: "Driver not found or not approved." };
    }

    await assertDriverHasNoActiveRide(client, driverId);

    const rideLock = await client.query(
      `SELECT ride_id, customer_id, driver_id, status, service_type
       FROM rides
       WHERE ride_id = $1
       FOR UPDATE`,
      [rideId]
    );

    if (!rideLock.rows.length) {
      throw { status: 404, message: "Ride not found." };
    }

    const lockedRide = rideLock.rows[0];
    const driverVehicleType = String(driverCheck.rows[0]?.vehicle_type || "").trim().toLowerCase();
    const rideServiceType = String(lockedRide.service_type || "").trim().toLowerCase();

    // Vehicle type validation with detailed logging for debugging
    if (driverVehicleType !== rideServiceType) {
      console.warn(
        `[Vehicle Mismatch] Driver ${driverId} vehicle '${driverVehicleType}' does not match ride ${rideId} requirement '${rideServiceType}'`
      );
      throw {
        status: 409,
        message: `Vehicle type mismatch. This ride requires ${lockedRide.service_type}. Your vehicle is ${driverCheck.rows[0]?.vehicle_type || 'not assigned'}.`,
      };
    }

    if (lockedRide.driver_id !== null || String(lockedRide.status || "").toLowerCase() !== "requested") {
      throw {
        status: 409,
        message: "Ride is no longer available. It may already be accepted.",
      };
    }

    let hasPendingAssignment = true;
    try {
      const assignmentRow = await client.query(
        `SELECT status
         FROM ride_driver_requests
         WHERE ride_id = $1
           AND driver_id = $2
         FOR UPDATE`,
        [rideId, driverId]
      );

      if (!assignmentRow.rows.length) {
        throw {
          status: 403,
          message: "This ride was not assigned to you.",
        };
      }

      if (String(assignmentRow.rows[0].status || "").toLowerCase() !== "pending") {
        throw {
          status: 409,
          message: "This ride request has already been responded to.",
        };
      }
    } catch (assignmentErr) {
      if (!isMissingTableError(assignmentErr, "ride_driver_requests")) {
        throw assignmentErr;
      }
      hasPendingAssignment = false;
    }

    let pickupOtp = randomOtp();
    try {
      const existingOtpResult = await client.query(
        `SELECT pickup_otp
         FROM ride_completion_details
         WHERE ride_id = $1
         FOR UPDATE`,
        [rideId]
      );

      const existingOtp = String(existingOtpResult.rows[0]?.pickup_otp || "").trim();
      if (existingOtp) {
        pickupOtp = existingOtp;
      }
    } catch (otpErr) {
      if (!isMissingTableError(otpErr, "ride_completion_details")) {
        throw otpErr;
      }
    }

    const updateResult = await client.query(
      `UPDATE rides
       SET driver_id = $1,
           status = 'Accepted'
       WHERE ride_id = $2
         AND driver_id IS NULL
         AND LOWER(status) = 'requested'
       RETURNING ride_id, customer_id, driver_id, status`,
      [driverId, rideId]
    );

    if (!updateResult.rows.length) {
      throw {
        status: 409,
        message: "Ride is no longer available. It may already be accepted.",
      };
    }

    const detailsResult = await client.query(
      `INSERT INTO ride_completion_details (
         ride_id,
         pickup_otp,
         completion_otp,
         ride_otp,
         updated_at
       )
       VALUES ($1, $2, NULL, NULL, NOW())
       ON CONFLICT (ride_id)
       DO UPDATE
       SET pickup_otp = EXCLUDED.pickup_otp,
           completion_otp = NULL,
           ride_otp = NULL,
           updated_at = NOW()
       RETURNING pickup_otp`,
      [rideId, pickupOtp]
    );

    acceptedRide = {
      ...updateResult.rows[0],
      pickup_otp: detailsResult.rows[0]?.pickup_otp || null,
    };

    if (hasPendingAssignment) {
      await client.query(
        `UPDATE ride_driver_requests
         SET status = CASE WHEN driver_id = $2 THEN 'accepted' ELSE 'rejected' END,
             responded_at = NOW()
         WHERE ride_id = $1
           AND status = 'pending'`,
        [rideId, driverId]
      );
    }

    try {
      await client.query(
        `INSERT INTO conversations (ride_id)
         SELECT $1
         WHERE NOT EXISTS (
           SELECT 1 FROM conversations WHERE ride_id = $1
         )`,
        [rideId]
      );
    } catch (conversationErr) {
      if (!isMissingTableError(conversationErr, "conversations")) {
        throw conversationErr;
      }
    }

    try {
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
      if (restaurantOwnerId > 0) {
        const conversationRow = await client.query(
          `SELECT conversation_id
           FROM conversations
           WHERE ride_id = $1
           ORDER BY conversation_id DESC
           LIMIT 1`,
          [rideId]
        );

        const conversationId = Number(conversationRow.rows[0]?.conversation_id || 0);
        const chatText = `Pickup OTP: ${pickupOtp}`;

        if (conversationId > 0) {
          await client.query(
            `INSERT INTO messages (conversation_id, sender_id, content, timestamp)
             VALUES ($1, $2, $3, NOW())`,
            [conversationId, restaurantOwnerId, chatText]
          );
        }

        restaurantChatMessage = {
          sender_id: restaurantOwnerId,
          sender_role: "restaurant",
          text: chatText,
        };
      }
    } catch (chatErr) {
      const missingConversation = isMissingTableError(chatErr, "conversations");
      const missingMessages = isMissingTableError(chatErr, "messages");
      if (!missingConversation && !missingMessages) {
        throw chatErr;
      }
    }

    await createNotification(
      client,
      acceptedRide.customer_id,
      "Driver assigned",
      "Your ride has been accepted by a driver.",
      "Ride Alert"
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const driverDetailsResult = await query(
    `SELECT
       u.first_name,
       u.phone,
       d.rating_avg,
       COALESCE(v.licence_no, d.licence_id) AS vehicle_no
     FROM drivers d
     JOIN users u ON u.user_id = d.user_id
     LEFT JOIN vehicles v ON v.vehicle_id = d.current_vehicle_id
     WHERE d.user_id = $1`,
    [driverId]
  );

  const driverDetailsRow = driverDetailsResult.rows[0] || {};

  return {
    ride: acceptedRide,
    driverDetails: {
      first_name: driverDetailsRow.first_name || "Driver",
      phone: driverDetailsRow.phone || "",
      licence_no: driverDetailsRow.vehicle_no || "Vehicle not assigned",
      rating_avg: driverDetailsRow.rating_avg || "5.0",
    },
    otp: {
      pickup_otp: acceptedRide.pickup_otp,
    },
    restaurant_chat_message: restaurantChatMessage,
  };
};

const rateRideParticipant = async ({ ride_id, rater_id, roles, score, comment }) => {
  const rideId = asNumber(ride_id, "ride_id");
  const raterId = asNumber(rater_id, "rater_id");
  const normalizedScore = asNumber(score, "score");
  const normalizedComment = String(comment || "").trim() || null;

  if (!Number.isInteger(normalizedScore) || normalizedScore < 1 || normalizedScore > 5) {
    throw { status: 400, message: "score must be an integer between 1 and 5." };
  }

  const normalizedRoles = Array.isArray(roles)
    ? roles.map((r) => String(r || "").toLowerCase())
    : [];

  const isDriverRater = normalizedRoles.includes("driver");
  const isCustomerRater = normalizedRoles.includes("customer");

  if (!isDriverRater && !isCustomerRater) {
    throw { status: 403, message: "Only drivers and customers can submit ride ratings." };
  }

  const client = await getClient();

  try {
    await client.query("BEGIN");

    const rideResult = await client.query(
      `SELECT ride_id, customer_id, driver_id, status
       FROM rides
       WHERE ride_id = $1
       FOR UPDATE`,
      [rideId]
    );

    if (!rideResult.rows.length) {
      throw { status: 404, message: "Ride not found." };
    }

    const ride = rideResult.rows[0];

    if (String(ride.status || "").toLowerCase() !== "completed") {
      throw { status: 409, message: "You can rate only after ride completion." };
    }

    let receiverId;
    let raterRole;
    let receiverRole;

    if (Number(ride.customer_id) === raterId && isCustomerRater) {
      receiverId = Number(ride.driver_id);
      raterRole = "customer";
      receiverRole = "driver";
    } else if (Number(ride.driver_id) === raterId && isDriverRater) {
      receiverId = Number(ride.customer_id);
      raterRole = "driver";
      receiverRole = "customer";
    } else {
      throw { status: 403, message: "You can rate only your counterpart in this ride." };
    }

    if (!Number.isInteger(receiverId) || receiverId <= 0) {
      throw { status: 409, message: "Counterpart user not found for this ride." };
    }

    const upsertResult = await client.query(
      `INSERT INTO ride_party_ratings (
         ride_id,
         rater_id,
         receiver_id,
         rater_role,
         receiver_role,
         score,
         comment,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (ride_id, rater_id)
       DO UPDATE
       SET score = EXCLUDED.score,
           comment = EXCLUDED.comment,
           updated_at = NOW()
       RETURNING rating_id, ride_id, rater_id, receiver_id, rater_role, receiver_role, score, comment, updated_at`,
      [rideId, raterId, receiverId, raterRole, receiverRole, normalizedScore, normalizedComment]
    );

    if (receiverRole === "driver") {
      await client.query(
        `UPDATE drivers d
         SET rating_avg = COALESCE(src.avg_score, d.rating_avg)
         FROM (
           SELECT receiver_id, ROUND(AVG(score)::numeric, 2) AS avg_score
           FROM ride_party_ratings
           WHERE receiver_role = 'driver'
             AND receiver_id = $1
           GROUP BY receiver_id
         ) src
         WHERE d.user_id = src.receiver_id`,
        [receiverId]
      );
    } else {
      try {
        await client.query(
          `UPDATE customers c
           SET customer_rating = COALESCE(src.avg_score, c.customer_rating)
           FROM (
             SELECT receiver_id, ROUND(AVG(score)::numeric, 2) AS avg_score
             FROM ride_party_ratings
             WHERE receiver_role = 'customer'
               AND receiver_id = $1
             GROUP BY receiver_id
           ) src
           WHERE c.user_id = src.receiver_id`,
          [receiverId]
        );
      } catch (err) {
        if (!String(err?.message || "").toLowerCase().includes("column \"customer_rating\" does not exist")) {
          throw err;
        }
      }
    }

    await createNotification(
      client,
      receiverId,
      "New ride rating",
      `You received a ${normalizedScore}-star rating for ride #${rideId}.`,
      "System"
    );

    await client.query("COMMIT");

    return upsertResult.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const cancelRideByCustomer = async ({ ride_id, customer_id }) => {
  const rideId = asNumber(ride_id, "ride_id");
  const customerId = asNumber(customer_id, "customer_id");

  const client = await getClient();

  try {
    await client.query("BEGIN");

    const rideLock = await client.query(
      `SELECT ride_id, customer_id, driver_id, status
       FROM rides
       WHERE ride_id = $1
       FOR UPDATE`,
      [rideId]
    );

    if (!rideLock.rows.length) {
      throw { status: 404, message: "Ride not found." };
    }

    const ride = rideLock.rows[0];

    if (Number(ride.customer_id) !== Number(customerId)) {
      throw { status: 403, message: "You can only cancel your own ride." };
    }

    const status = String(ride.status || "").toLowerCase();
    if (!["requested", "accepted"].includes(status)) {
      throw {
        status: 409,
        message: "Ride can only be cancelled before pickup.",
      };
    }

    const updateResult = await client.query(
      `UPDATE rides
       SET status = 'Cancelled',
           end_time = COALESCE(end_time, CURRENT_TIMESTAMP)
       WHERE ride_id = $1
       RETURNING ride_id, status, customer_id, driver_id`,
      [rideId]
    );

    try {
      await client.query(
        `UPDATE ride_driver_requests
         SET status = 'cancelled',
             responded_at = NOW()
         WHERE ride_id = $1
           AND LOWER(status) = 'pending'`,
        [rideId]
      );
    } catch (err) {
      if (!isMissingTableError(err, "ride_driver_requests")) {
        throw err;
      }
    }

    await createNotification(
      client,
      customerId,
      "Ride cancelled",
      `Ride #${rideId} has been cancelled successfully.`,
      "Ride Alert"
    );

    if (updateResult.rows[0]?.driver_id) {
      await createNotification(
        client,
        updateResult.rows[0].driver_id,
        "Ride cancelled",
        `Customer cancelled ride #${rideId} before pickup.`,
        "Ride Alert"
      );
    }

    await client.query("COMMIT");

    return {
      ride_id: updateResult.rows[0].ride_id,
      status: updateResult.rows[0].status,
      customer_id: updateResult.rows[0].customer_id,
      driver_id: updateResult.rows[0].driver_id,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  createRideRequest,
  acceptRideByDriver,
  cancelRideByCustomer,
  rateRideParticipant,
};
