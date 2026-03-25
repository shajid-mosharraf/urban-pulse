const { query } = require("../../config/db");

const toNumber = (value) => Number(value || 0);

const getRestaurantDashboardData = async (userId) => {
  const restaurantResult = await query(
    `SELECT
       r.restaurant_id,
       r.name,
       r.rating,
       r.phone
     FROM restaurants r
     WHERE r.owner_id = $1
     LIMIT 1`,
    [userId]
  );

  if (restaurantResult.rows.length === 0) {
    throw { status: 404, message: "Restaurant not found for this owner." };
  }

  const restaurant = restaurantResult.rows[0];

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
       AND LOWER(fo.status) IN ('placed', 'preparing', 'ready')
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

module.exports = { getRestaurantDashboardData };