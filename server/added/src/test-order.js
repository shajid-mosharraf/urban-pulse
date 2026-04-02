require('dotenv').config();
const {getClient} = require('./config/db');

(async () => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    
    // Create a test customer if not exists
    const custResult = await client.query(
      "INSERT INTO users (first_name, last_name, email, phone, password_hash, nid, active) VALUES ($1, $2, $3, $4, $5, $6, true) ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING user_id",
      ['Test', 'Customer', 'testcustomer@test.com', '01712345670', 'hash', '123456789']
    );
    const customerId = custResult.rows[0].user_id;
    
    // Add customer role
    await client.query('INSERT INTO customers (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [customerId]);
    
    // Create a test location for delivery
    const locResult = await client.query(
      "INSERT INTO locations (address_name, city, latitude, longitude) VALUES ($1, $2, $3, $4) RETURNING location_id",
      ['Test Delivery Address', 'Dhaka', 23.8103, 90.4125]
    );
    const locationId = locResult.rows[0].location_id;
    
    // Create test order for restaurant 3
    const orderResult = await client.query(
      "INSERT INTO food_orders (customer_id, restaurant_id, status, total_price, order_time) VALUES ($1, $2, $3, $4, NOW()) RETURNING order_id",
      [customerId, 3, 'placed', 500]
    );
    const orderId = orderResult.rows[0].order_id;
    
    await client.query('COMMIT');
    console.log('✅ Test order created:', { orderId, customerId, locationId });
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
})();
