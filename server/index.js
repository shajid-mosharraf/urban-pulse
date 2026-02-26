const express = require("express");
const app = express();
const cors = require("cors");
const pool = require("./db"); // Make sure your db.js file is set up!

// MIDDLEWARE
app.use(cors());
app.use(express.json()); // Allows us to access req.body

// =========================================================================
// 1. LOGIN ROUTE
// =========================================================================
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // A. Check if user exists
    const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (user.rows.length === 0) {
      return res.status(401).json("User not found");
    }

    // B. Check Password (Simple check for now)
    if (user.rows[0].password_hash !== password) {
      return res.status(401).json("Incorrect password");
    }

    // C. Get the Role
    const userId = user.rows[0].user_id;
    const roleResult = await pool.query("SELECT role_name FROM roles WHERE user_id = $1", [userId]);
    
    const userRole = roleResult.rows.length > 0 ? roleResult.rows[0].role_name : "customer";

    // D. Send back User Info + Role
    res.json({ 
      user_id: userId,
      first_name: user.rows[0].first_name,
      role: userRole 
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// =========================================================================
// 2. REGISTER ROUTE (UPDATED)
// =========================================================================
app.post("/register", async (req, res) => {
  try {
    // 1. Destructure ALL data (Added licenseExpire)
    const { 
      firstName, lastName, email, phone, password, role, 
      nid, wallet, 
      licenseId, licenseExpire, // <--- ADDED THIS
      vehiclePlate, vehicleModel, vehicleType, vehicleColor, 
      restaurantName, location 
    } = req.body;

    // 2. Check if user already exists
    const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userCheck.rows.length > 0) {
      return res.status(401).json("User already exists!");
    }

    // ---------------------------------------------------------
    // STEP 3: INSERT INTO 'users'
    // ---------------------------------------------------------
    const newUser = await pool.query(
      `INSERT INTO users (first_name, last_name, email, phone, password_hash, nid) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING user_id`,
      [firstName, lastName, email, phone, password, nid]
    );

    const newUserId = newUser.rows[0].user_id;
    console.log(`User created with ID: ${newUserId}`);

    // ---------------------------------------------------------
    // STEP 4: INSERT INTO 'roles'
    // ---------------------------------------------------------
    await pool.query(
      `INSERT INTO roles (user_id, role_name) VALUES ($1, $2)`,
      [newUserId, role]
    );

    // ---------------------------------------------------------
    // STEP 5: INSERT INTO Specific Profile Tables
    // ---------------------------------------------------------
    
    if (role === "driver") {
      // A. Create Driver Profile (UPDATED with license_expire)
      await pool.query(
        `INSERT INTO drivers (user_id, licence_id, license_expire, active_status) 
         VALUES ($1, $2, $3, $4)`,
        [newUserId, licenseId, licenseExpire, false]
      );

      // B. Create Their First Vehicle
      await pool.query(
        `INSERT INTO vehicles (owner_id, licence_no, model, type, color, active) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newUserId, vehiclePlate, vehicleModel, vehicleType, vehicleColor, true]
      );
    } 
    
    else if (role === "customer") {
      await pool.query(
        `INSERT INTO customers (user_id) VALUES ($1)`,
        [newUserId]
      );
    }
    
    else if (role === "restaurant") {
      await pool.query(`INSERT INTO owners (user_id) VALUES ($1)`, [newUserId]);
      
      await pool.query(
        `INSERT INTO restaurants (owner_id, name, phone) VALUES ($1, $2, $3)`,
        [newUserId, restaurantName, phone]
      );
    }

    // 6. Send Success Message
    res.json({ message: "Registration Successful", userId: newUserId, role: role });

  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error: " + err.message);
  }
});

// START SERVER
app.listen(5000, () => {
  console.log("Server is running on port 5000");
});