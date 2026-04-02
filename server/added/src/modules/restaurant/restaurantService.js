const { getClient, query } = require("../../config/db");

const toNumber = (value) => Number(value || 0);
const DELIVERY_CHARGE_TK = 40;

const normalizeStatus = (value) => String(value || "").toLowerCase().trim();

const getRouteDistanceKm = async (pickupCoords, dropoffCoords) => {
  if (!pickupCoords || !dropoffCoords) {
    return 0;
  }

  const [pickupLat, pickupLng] = pickupCoords;
  const [dropoffLat, dropoffLng] = dropoffCoords;

  if (
    !Number.isFinite(pickupLat) ||
    !Number.isFinite(pickupLng) ||
    !Number.isFinite(dropoffLat) ||
    !Number.isFinite(dropoffLng)
  ) {
    return 0;
  }

  try {
    const routeUrl = `https://router.project-osrm.org/route/v1/driving/${pickupLng},${pickupLat};${dropoffLng},${dropoffLat}?overview=false`;
    const response = await fetch(routeUrl);
    const data = await response.json();

    if (!response.ok || !data?.routes?.length) {
      return 0;
    }

    const distanceMeters = Number(data.routes[0].distance || 0);
    const distanceKm = Number((distanceMeters / 1000).toFixed(2));
    return Number.isFinite(distanceKm) ? distanceKm : 0;
  } catch (err) {
    return 0;
  }
};

const getRestaurantByOwner = async (userId) => {
  const restaurantResult = await query(
    `SELECT
       r.restaurant_id,
       r.name,
       r.rating,
       r.phone,
       r.location_id,
       l.address_name AS restaurant_address,
       l.latitude AS restaurant_latitude,
       l.longitude AS restaurant_longitude
     FROM restaurants r
     LEFT JOIN locations l ON l.location_id = r.location_id
     WHERE r.owner_id = $1
     LIMIT 1`,
    [userId]
  );

  if (restaurantResult.rows.length === 0) {
    throw { status: 404, message: "Restaurant not found for this owner." };
  }

  return restaurantResult.rows[0];
};

const getRestaurantDashboardData = async (userId) => {
  const restaurant = await getRestaurantByOwner(userId);

  // NO AUTO-TRANSITION - orders stay in cooking until restaurant marks ready for delivery

  const statsResult = await query(
    `SELECT
       COUNT(CASE WHEN DATE(fo.order_time) = CURRENT_DATE THEN 1 ELSE NULL END) AS orders_today,
       COALESCE(SUM(CASE
         WHEN DATE(fo.order_time) = CURRENT_DATE
         THEN COALESCE(fo.total_price, 0)
         ELSE 0
       END), 0) AS revenue_today,
       COALESCE(AVG(CASE
         WHEN DATE(fo.order_time) = CURRENT_DATE AND r.end_time IS NOT NULL
         THEN EXTRACT(EPOCH FROM (r.end_time - fo.order_time)) / 60
         ELSE NULL
       END), 0) AS avg_prep_time
     FROM food_orders fo
     LEFT JOIN rides r ON r.ride_id = fo.ride_id
     WHERE fo.restaurant_id = $1`,
    [restaurant.restaurant_id]
  );

  const incomingOrdersResult = await query(
    `SELECT
       fo.order_id,
       fo.status,
       fo.total_price,
       fo.order_time,
       u.first_name,
       u.last_name,
       COALESCE(
         STRING_AGG(mi.name || ' x' || od.quantity::text, ', ' ORDER BY mi.name),
         'No items'
       ) AS items
     FROM food_orders fo
     JOIN customers c ON c.user_id = fo.customer_id
     JOIN users u ON u.user_id = c.user_id
     LEFT JOIN order_details od ON od.order_id = fo.order_id
     LEFT JOIN menu_items mi ON mi.item_id = od.item_id
     WHERE fo.restaurant_id = $1
       AND LOWER(fo.status) IN ('placed', 'cooking', 'ready_for_delivery', 'on_the_way')
     GROUP BY fo.order_id, fo.status, fo.total_price, fo.order_time, u.first_name, u.last_name
     ORDER BY fo.order_time DESC
     LIMIT 8`,
    [restaurant.restaurant_id]
  );

  const menuTopResult = await query(
    `SELECT
       mi.item_id,
       mi.name,
       mi.price,
       mi.is_available,
       COALESCE(SUM(od.quantity), 0) AS orders_count
     FROM menu_items mi
     LEFT JOIN order_details od ON od.item_id = mi.item_id
     LEFT JOIN food_orders fo ON fo.order_id = od.order_id
     WHERE mi.restaurant_id = $1
     GROUP BY mi.item_id, mi.name, mi.price, mi.is_available
     ORDER BY orders_count DESC, mi.name
     LIMIT 6`,
    [restaurant.restaurant_id]
  );

  const financeResult = await query(
    `SELECT
       COALESCE(SUM(CASE
         WHEN fo.order_time >= DATE_TRUNC('week', CURRENT_DATE)
         THEN COALESCE(fo.total_price, 0)
         ELSE 0
       END), 0) AS week_revenue,
       COALESCE(SUM(CASE
         WHEN LOWER(p.status) = 'pending'
         THEN COALESCE(p.amount, 0)
         ELSE 0
       END), 0) AS pending_payments
     FROM food_orders fo
     LEFT JOIN payments p ON p.ride_id = fo.ride_id
     WHERE fo.restaurant_id = $1`,
    [restaurant.restaurant_id]
  );

  return {
    restaurant: {
      restaurant_id: restaurant.restaurant_id,
      name: restaurant.name,
      rating: toNumber(restaurant.rating),
      phone: restaurant.phone,
    },
    stats: {
      orders_today: toNumber(statsResult.rows[0]?.orders_today),
      revenue_today: toNumber(statsResult.rows[0]?.revenue_today),
      avg_prep_time: Math.round(toNumber(statsResult.rows[0]?.avg_prep_time)),
    },
    incomingOrders: incomingOrdersResult.rows.map((o) => ({
      order_id: o.order_id,
      status: o.status,
      total_price: toNumber(o.total_price),
      order_time: o.order_time,
      customer_name: `${o.first_name || ""} ${o.last_name || ""}`.trim(),
      items: o.items,
    })),
    topMenuItems: menuTopResult.rows.map((m) => ({
      item_id: m.item_id,
      name: m.name,
      price: toNumber(m.price),
      is_available: m.is_available,
      orders_count: toNumber(m.orders_count),
    })),
    finance: {
      week_revenue: toNumber(financeResult.rows[0]?.week_revenue),
      pending_payments: toNumber(financeResult.rows[0]?.pending_payments),
    },
  };
};

const updateOrderStatus = async (userId, orderId, nextStatusRaw) => {
  const restaurant = await getRestaurantByOwner(userId);
  const nextStatus = normalizeStatus(nextStatusRaw);
  const validStatuses = ["placed", "preparing", "ready", "delivered"];

  if (!validStatuses.includes(nextStatus)) {
    throw {
      status: 400,
      message: `Invalid status. Allowed values: ${validStatuses.join(", ")}.`,
    };
  }

  const orderResult = await query(
    `SELECT fo.order_id, fo.status
     FROM food_orders fo
     WHERE fo.order_id = $1
       AND fo.restaurant_id = $2
     LIMIT 1`,
    [orderId, restaurant.restaurant_id]
  );

  if (orderResult.rows.length === 0) {
    throw { status: 404, message: "Order not found for this restaurant." };
  }

  const currentStatus = normalizeStatus(orderResult.rows[0].status);

  if (currentStatus === nextStatus) {
    return {
      order_id: orderId,
      status: nextStatus,
      unchanged: true,
    };
  }

  const allowedTransitions = {
    placed: ["preparing"],
    preparing: ["ready"],
    ready: ["delivered"],
    delivered: [],
  };

  if (!allowedTransitions[currentStatus]?.includes(nextStatus)) {
    throw {
      status: 400,
      message: `Invalid transition from ${currentStatus} to ${nextStatus}.`,
    };
  }

  const updateResult = await query(
    `UPDATE food_orders
     SET status = $1
     WHERE order_id = $2
       AND restaurant_id = $3
     RETURNING order_id, status`,
    [nextStatus, orderId, restaurant.restaurant_id]
  );

  return {
    order_id: updateResult.rows[0].order_id,
    status: normalizeStatus(updateResult.rows[0].status),
    unchanged: false,
  };
};

const decideOrder = async (userId, orderId, decisionRaw) => {
  const restaurant = await getRestaurantByOwner(userId);
  const decision = normalizeStatus(decisionRaw);

  if (!["accept", "reject"].includes(decision)) {
    throw { status: 400, message: "Decision must be either accept or reject." };
  }

  const orderResult = await query(
    `SELECT order_id, status
     FROM food_orders
     WHERE order_id = $1
       AND restaurant_id = $2
     LIMIT 1`,
    [orderId, restaurant.restaurant_id]
  );

  if (!orderResult.rows.length) {
    throw { status: 404, message: "Order not found for this restaurant." };
  }

  const currentStatus = normalizeStatus(orderResult.rows[0].status);
  if (currentStatus !== "placed") {
    throw { status: 409, message: "Only newly placed orders can be accepted or rejected." };
  }

  if (decision === "accept") {
    const acceptedResult = await query(
      `UPDATE food_orders
       SET status = 'cooking',
           order_time = NOW()
       WHERE order_id = $1
         AND restaurant_id = $2
       RETURNING order_id, status, order_time`,
      [orderId, restaurant.restaurant_id]
    );

    return {
      order_id: Number(acceptedResult.rows[0].order_id),
      status: acceptedResult.rows[0].status,
      order_time: acceptedResult.rows[0].order_time,
      transition_note: "Order accepted. Will move to on_the_way after 10 seconds.",
    };
  }

  const rejectedResult = await query(
    `UPDATE food_orders
     SET status = 'rejected'
     WHERE order_id = $1
       AND restaurant_id = $2
     RETURNING order_id, status`,
    [orderId, restaurant.restaurant_id]
  );

  return {
    order_id: Number(rejectedResult.rows[0].order_id),
    status: rejectedResult.rows[0].status,
    transition_note: "Order rejected by restaurant.",
  };
};

const updateMenuItemAvailability = async (userId, itemId, isAvailable) => {
  const restaurant = await getRestaurantByOwner(userId);

  const updateResult = await query(
    `UPDATE menu_items
     SET is_available = $1
     WHERE item_id = $2
       AND restaurant_id = $3
     RETURNING item_id, is_available`,
    [Boolean(isAvailable), itemId, restaurant.restaurant_id]
  );

  if (updateResult.rows.length === 0) {
    throw { status: 404, message: "Menu item not found for this restaurant." };
  }

  return updateResult.rows[0];
};

const createMenuItem = async (userId, payload) => {
  const restaurant = await getRestaurantByOwner(userId);
  const name = String(payload?.name || "").trim();
  const description = String(payload?.description || "").trim();
  const price = Number(payload?.price);
  const isAvailable = payload?.is_available !== false;

  if (!name) {
    throw { status: 400, message: "Menu item name is required." };
  }

  if (!Number.isFinite(price) || price <= 0) {
    throw { status: 400, message: "Menu item price must be greater than zero." };
  }

  const inserted = await query(
    `INSERT INTO menu_items (restaurant_id, name, price, is_available, description)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING item_id, name, price, is_available, description`,
    [restaurant.restaurant_id, name, price, Boolean(isAvailable), description || null]
  );

  return {
    item_id: Number(inserted.rows[0].item_id),
    name: inserted.rows[0].name,
    price: toNumber(inserted.rows[0].price),
    is_available: Boolean(inserted.rows[0].is_available),
    description: inserted.rows[0].description || "",
  };
};

const listAllMenuItems = async (userId) => {
  const restaurant = await getRestaurantByOwner(userId);

  const result = await query(
    `SELECT
       mi.item_id,
       mi.name,
       mi.description,
       mi.price,
       mi.is_available,
       COALESCE(SUM(od.quantity), 0) AS orders_count
     FROM menu_items mi
     LEFT JOIN order_details od ON od.item_id = mi.item_id
     LEFT JOIN food_orders fo ON fo.order_id = od.order_id
     WHERE mi.restaurant_id = $1
     GROUP BY mi.item_id, mi.name, mi.description, mi.price, mi.is_available
     ORDER BY mi.name ASC`,
    [restaurant.restaurant_id]
  );

  return result.rows.map((row) => ({
    item_id: Number(row.item_id),
    name: row.name,
    description: row.description || "",
    price: toNumber(row.price),
    is_available: Boolean(row.is_available),
    orders_count: toNumber(row.orders_count),
  }));
};

const markReadyForDelivery = async (userId, orderId) => {
  const restaurant = await getRestaurantByOwner(userId);
  const client = await getClient();

  try {
    await client.query("BEGIN");

    const orderResult = await client.query(
      `SELECT fo.order_id, fo.status, fo.customer_id, fo.ride_id, fo.total_price, fo.payment_method
       FROM food_orders fo
       WHERE fo.order_id = $1
         AND fo.restaurant_id = $2
       FOR UPDATE`,
      [orderId, restaurant.restaurant_id]
    );

    if (!orderResult.rows.length) {
      throw { status: 404, message: "Order not found for this restaurant." };
    }

    const order = orderResult.rows[0];
    const currentStatus = normalizeStatus(order.status);

    if (currentStatus !== "cooking" && currentStatus !== "ready_for_delivery") {
      throw { status: 409, message: "Only cooking orders can be prepared for delivery." };
    }

    const vehiclePreference = ["bike", "cng", "car", "micro"];
    const availableDriversResult = await client.query(
      `SELECT DISTINCT LOWER(TRIM(v.type)) AS vehicle_type
       FROM drivers d
       JOIN vehicles v ON v.vehicle_id = d.current_vehicle_id
       WHERE d.active_status = true
         AND d.is_approved = true
         AND COALESCE(v.active, true) = true
         AND v.type IS NOT NULL
         AND LENGTH(TRIM(v.type)) > 0`
    );

    const availableVehicleTypes = availableDriversResult.rows
      .map((row) => String(row.vehicle_type || "").trim().toLowerCase())
      .filter(Boolean);

    const deliveryServiceType =
      vehiclePreference.find((type) => availableVehicleTypes.includes(type)) ||
      availableVehicleTypes[0] ||
      "bike";

    if (!restaurant.location_id) {
      throw { status: 409, message: "Restaurant location is missing. Please update restaurant profile location." };
    }

    const customerDropoffResult = await client.query(
      `SELECT sa.location_id,
              l.address_name,
              l.latitude,
              l.longitude
       FROM saved_addresses sa
       JOIN locations l ON l.location_id = sa.location_id
       WHERE sa.customer_id = $1
       ORDER BY sa.location_id DESC
       LIMIT 1`,
      [order.customer_id]
    );

    if (!customerDropoffResult.rows.length) {
      throw { status: 409, message: "Customer delivery location is missing. Customer must place order with GPS location." };
    }

    const pickupLocationId = Number(restaurant.location_id);
    const dropoffLocationId = Number(customerDropoffResult.rows[0].location_id);
    const pickupCoords = [toNumber(restaurant.restaurant_latitude), toNumber(restaurant.restaurant_longitude)];
    const dropoffCoords = [
      toNumber(customerDropoffResult.rows[0].latitude),
      toNumber(customerDropoffResult.rows[0].longitude),
    ];
    const routeDistanceKm = await getRouteDistanceKm(pickupCoords, dropoffCoords);
    const orderFoodPrice = toNumber(order.total_price);
    const initialFare = orderFoodPrice + DELIVERY_CHARGE_TK;

    let rideId = order.ride_id ? Number(order.ride_id) : null;

    if (!rideId) {
      const existingRideResult = await client.query(
        `SELECT ride_id
         FROM rides
         WHERE customer_id = $1
           AND LOWER(status) NOT IN ('completed', 'cancelled')
         ORDER BY request_time DESC
         LIMIT 1
         FOR UPDATE`,
        [order.customer_id]
      );

      if (existingRideResult.rows.length) {
        rideId = Number(existingRideResult.rows[0].ride_id);
      } else {
        const rideResult = await client.query(
          `INSERT INTO rides (
             customer_id,
             pickup_location_id,
             dropoff_location_id,
             service_type,
             status,
             request_time,
             distance_km,
             initial_fare
           )
           VALUES ($1, $2, $3, $4, 'Requested', NOW(), $5, $6)
           RETURNING ride_id`,
          [
            order.customer_id,
            pickupLocationId,
            dropoffLocationId,
            deliveryServiceType,
            routeDistanceKm,
            initialFare,
          ]
        );
        rideId = Number(rideResult.rows[0].ride_id);
      }
    }

    await client.query(
      `UPDATE rides
       SET pickup_location_id = $1,
           dropoff_location_id = $2,
           service_type = $3,
           distance_km = $4,
           initial_fare = $5
       WHERE ride_id = $6`,
      [pickupLocationId, dropoffLocationId, deliveryServiceType, routeDistanceKm, initialFare, rideId]
    );

    await client.query(
      `INSERT INTO ride_completion_details (ride_id, payment_method, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (ride_id)
       DO UPDATE SET payment_method = EXCLUDED.payment_method, updated_at = NOW()`,
      [rideId, String(order.payment_method || "cash").toLowerCase().trim()]
    );

    await client.query(
      `UPDATE food_orders
       SET status = 'ready_for_delivery',
           ride_id = COALESCE(ride_id, $1)
       WHERE order_id = $2`,
      [rideId, orderId]
    );

    const driversResult = await client.query(
      `SELECT d.user_id
       FROM drivers d
       JOIN vehicles v ON v.vehicle_id = d.current_vehicle_id
       WHERE d.active_status = true
         AND d.is_approved = true
         AND COALESCE(v.active, true) = true
         AND v.type IS NOT NULL
         AND LOWER(TRIM(v.type)) = $1
       LIMIT 10`,
      [deliveryServiceType]
    );

    for (const driver of driversResult.rows) {
      await client.query(
        `INSERT INTO ride_driver_requests (ride_id, driver_id, status, sent_at)
         VALUES ($1, $2, 'pending', NOW())
         ON CONFLICT (ride_id, driver_id)
         DO UPDATE SET status = 'pending', sent_at = NOW(), responded_at = NULL`,
        [rideId, driver.user_id]
      );
    }

    await client.query("COMMIT");

    return {
      order_id: Number(orderId),
      status: "ready_for_delivery",
      ride_id: Number(rideId),
      drivers_notified: driversResult.rows.length,
      service_type: deliveryServiceType,
      message: `Order marked ready for delivery. ${driversResult.rows.length} drivers notified.`,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  getRestaurantDashboardData,
  updateOrderStatus,
  decideOrder,
  updateMenuItemAvailability,
  createMenuItem,
  listAllMenuItems,
  markReadyForDelivery,
};