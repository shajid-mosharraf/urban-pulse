const express = require("express");
const app = express();
const cors = require("cors");
const pool = require("./db");

// Middleware
app.use(cors());
app.use(express.json());

// ---------------- ROUTES ----------------

// 1. Get All Users (GET)
app.get("/users", async (req, res) => {
  try {
    const allUsers = await pool.query("SELECT * FROM users");
    res.json(allUsers.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// 2. Get All Rides (GET)
app.get("/rides", async (req, res) => {
  try {
    const allRides = await pool.query(`
      SELECT 
        r.ride_id,
        u_cust.first_name AS passenger,
        u_driver.first_name AS driver,
        r.final_fare,
        r.status
      FROM rides r
      JOIN users u_cust ON r.customer_id = u_cust.user_id
      JOIN users u_driver ON r.driver_id = u_driver.user_id
    `);
    res.json(allRides.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// 3. Create a New User (POST)
app.post("/users", async (req, res) => {
  try {
    const { first_name, last_name, email, phone, password_hash, nid } = req.body;

    const newUser = await pool.query(
      "INSERT INTO users (first_name, last_name, email, phone, password_hash, nid) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [first_name, last_name, email, phone, password_hash, nid]
    );

    console.log("Newly Inserted Row:", newUser.rows[0]);
    res.json(newUser.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});
// ---------------- CREATE CUSTOMER (Must happen after User) ----------------
app.post("/customers", async (req, res) => {
  try {
    const { user_id, rating } = req.body;
    const newCustomer = await pool.query(
      "INSERT INTO customers (user_id, customer_rating) VALUES ($1, $2) RETURNING *",
      [user_id, rating || 5.0]
    );
    res.json(newCustomer.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});
// ---------------- 4. CREATE LOCATIONS (Must happen before Rides) ----------------
app.post("/locations", async (req, res) => {
  try {
    const { address_name, city, latitude, longitude } = req.body;
    const newLoc = await pool.query(
      "INSERT INTO locations (address_name, city, latitude, longitude) VALUES ($1, $2, $3, $4) RETURNING *",
      [address_name, city, latitude, longitude]
    );
    res.json(newLoc.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// ---------------- 5. CREATE DRIVER (Must happen after User) ----------------
app.post("/drivers", async (req, res) => {
  try {
    const { user_id, licence_id, license_expire, rating_avg } = req.body;
    const newDriver = await pool.query(
      "INSERT INTO drivers (user_id, licence_id, license_expire, rating_avg, active_status) VALUES ($1, $2, $3, $4, TRUE) RETURNING *",
      [user_id, licence_id, license_expire, rating_avg]
    );
    res.json(newDriver.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// ---------------- 6. CREATE VEHICLE (Must happen after Driver) ----------------
app.post("/vehicles", async (req, res) => {
  try {
    const { owner_id, licence_no, model, type, color } = req.body;
    const newVehicle = await pool.query(
      "INSERT INTO vehicles (owner_id, licence_no, model, type, color) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [owner_id, licence_no, model, type, color]
    );
    res.json(newVehicle.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// ---------------- 7. CREATE RIDE (Must happen after User, Driver, Locations) ----------------
app.post("/rides", async (req, res) => {
  try {
    const { customer_id, driver_id, pickup_id, dropoff_id, fare, distance } = req.body;
    const newRide = await pool.query(
      "INSERT INTO rides (customer_id, driver_id, pickup_location_id, dropoff_location_id, final_fare, distance_km, status) VALUES ($1, $2, $3, $4, $5, $6, 'Requested') RETURNING *",
      [customer_id, driver_id, pickup_id, dropoff_id, fare, distance]
    );
    res.json(newRide.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// ---------------- 8. CREATE WALLET (Must happen after User) ----------------
app.post("/wallets", async (req, res) => {
  try {
    const { user_id, balance } = req.body;
    const newWallet = await pool.query(
      "INSERT INTO wallets (user_id, balance) VALUES ($1, $2) RETURNING *",
      [user_id, balance]
    );
    res.json(newWallet.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});
// --- NEW ROUTES FOR INSERTION ---

// 1. Create Courier (Must exist after Ride)
app.post("/couriers", async (req, res) => {
  try {
    const { ride_id, weight, type, receiver_name, receiver_phone } = req.body;
    const newCourier = await pool.query(
      "INSERT INTO couriers (ride_id, weight_kg, type, receiver_name, receiver_phone) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [ride_id, weight, type, receiver_name, receiver_phone]
    );
    res.json(newCourier.rows[0]);
  } catch (err) { console.error(err.message); res.status(500).send("Server Error"); }
});

// 2. Create Payment
app.post("/payments", async (req, res) => {
  try {
    const { ride_id, amount, method } = req.body;
    const newPayment = await pool.query(
      "INSERT INTO payments (ride_id, amount, method, status) VALUES ($1, $2, $3, 'Completed') RETURNING *",
      [ride_id, amount, method]
    );
    res.json(newPayment.rows[0]);
  } catch (err) { console.error(err.message); res.status(500).send("Server Error"); }
});

// 3. Create Hospital
app.post("/hospitals", async (req, res) => {
  try {
    const { name, location_id, contact } = req.body;
    const newHospital = await pool.query(
      "INSERT INTO hospitals (name, location_id, contact_no, beds_available) VALUES ($1, $2, $3, TRUE) RETURNING *",
      [name, location_id, contact]
    );
    res.json(newHospital.rows[0]);
  } catch (err) { console.error(err.message); res.status(500).send("Server Error"); }
});

// 4. Create Restaurant
app.post("/restaurants", async (req, res) => {
  try {
    const { name, owner_id, location_id } = req.body;
    const newRest = await pool.query(
      "INSERT INTO restaurants (name, owner_id, location_id) VALUES ($1, $2, $3) RETURNING *",
      [name, owner_id, location_id]
    );
    res.json(newRest.rows[0]);
  } catch (err) { console.error(err.message); res.status(500).send("Server Error"); }
});

// 5. Create Menu Item
app.post("/menu_items", async (req, res) => {
  try {
    const { restaurant_id, name, price } = req.body;
    const newItem = await pool.query(
      "INSERT INTO menu_items (restaurant_id, name, price) VALUES ($1, $2, $3) RETURNING *",
      [restaurant_id, name, price]
    );
    res.json(newItem.rows[0]);
  } catch (err) { console.error(err.message); res.status(500).send("Server Error"); }
});

// 6. Create Food Order
app.post("/food_orders", async (req, res) => {
  try {
    const { customer_id, restaurant_id, total_price } = req.body;
    const newOrder = await pool.query(
      "INSERT INTO food_orders (customer_id, restaurant_id, total_price) VALUES ($1, $2, $3) RETURNING *",
      [customer_id, restaurant_id, total_price]
    );
    res.json(newOrder.rows[0]);
  } catch (err) { console.error(err.message); res.status(500).send("Server Error"); }
});
// Get All Customers
app.get("/customers", async (req, res) => {
  try {
    const allCustomers = await pool.query(`
      SELECT c.user_id, u.first_name, u.email, c.customer_rating 
      FROM customers c
      JOIN users u ON c.user_id = u.user_id
    `);
    res.json(allCustomers.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// ---------------- START SERVER ----------------
const PORT = process.env.SERVER_PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is starting on port ${PORT}`);
});