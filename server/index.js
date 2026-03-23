const express = require("express");
const http = require("http"); // <-- Added for Socket.io
const { Server } = require("socket.io"); // <-- Added for Socket.io
const cors = require("cors");
const pool = require("./db");

const app = express();

// MIDDLEWARE
app.use(cors());
app.use(express.json());

// =========================================================================
// SOCKET.IO SETUP (For Real-Time Driver Pings)
// =========================================================================
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // Your React frontend URL
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log(`User connected to socket: ${socket.id}`);

  // Driver goes online
  socket.on("driver_online", async (driver_user_id) => {
    socket.join(`driver_${driver_user_id}`);
    console.log(`Driver ${driver_user_id} went online.`);
    try {
      await pool.query("UPDATE drivers SET active_status = true WHERE user_id = $1", [driver_user_id]);
    } catch (err) { console.error("DB Error:", err); }
  });
  //driver offline
  socket.on("driver_offline", async (driver_user_id) => {
    socket.leave(`driver_${driver_user_id}`);
    console.log(`Driver ${driver_user_id} went offline.`);
    try {
      await pool.query("UPDATE drivers SET active_status = false WHERE user_id = $1", [driver_user_id]);
    } catch (err) { console.error("DB Error:", err); }
  });
  socket.on("update_location", async (data) => {
    const { driver_id, lat, lng } = data;
    try {
      await pool.query(
        "UPDATE drivers SET current_latitude = $1, current_longitude = $2 WHERE user_id = $3",
        [lat, lng, driver_id]
      );
      // Optional: console.log(`Driver ${driver_id} moved to ${lat}, ${lng}`);
    } catch (err) {
      console.error("Failed to update location:", err);
    }
  });
  // Customer waits for a specific ride
  socket.on("customer_waiting", (ride_id) => {
    socket.join(`ride_${ride_id}`);
    console.log(`Customer waiting in room: ride_${ride_id}`);
  });

  // Driver accepts, tell the customer
  socket.on("ride_accepted_by_driver", (data) => {
    io.to(`ride_${data.ride_id}`).emit("ride_accepted", data.driverDetails);
    console.log(`Notification sent to customer for ride_${data.ride_id}`);
  });
  // --- NEW CHAT SYSTEM (WITH DATABASE) ---

  // 1. Join the private ride room
  socket.on("join_ride_room", (ride_id) => {
    socket.join(`ride_${ride_id}`);
    console.log(`User joined private chat room: ride_${ride_id}`);
  });

  // 2. Receive message, broadcast it, AND save it to the DB
  socket.on("send_message", async (data) => {
    // data contains: { ride_id, sender_id, sender_role: "user" | "driver", text: "Hello!" }
    
    // A. Instantly forward the message so the UI feels lightning fast
    io.to(`ride_${data.ride_id}`).emit("receive_message", data);

    // B. Save to Database in the background
    try {
      // Check if a conversation row exists for this ride
      let convRes = await pool.query("SELECT conversation_id FROM conversations WHERE ride_id = $1", [data.ride_id]);
      let conversation_id;

      if (convRes.rows.length === 0) {
        // Create it if it doesn't exist
        const newConv = await pool.query(
          "INSERT INTO conversations (ride_id) VALUES ($1) RETURNING conversation_id", 
          [data.ride_id]
        );
        conversation_id = newConv.rows[0].conversation_id;
      } else {
        conversation_id = convRes.rows[0].conversation_id;
      }

      // Insert the actual message
      await pool.query(
        "INSERT INTO messages (conversation_id, sender_id, content) VALUES ($1, $2, $3)",
        [conversation_id, data.sender_id, data.text]
      );
      
    } catch (err) {
      console.error("Chat DB Save Error:", err);
    }
  });


  socket.on("disconnect", () => {
    console.log("User disconnected", socket.id);
  });
});

// Make 'io' accessible inside our Express routes
app.set("io", io);


// 1. LOGIN ROUTE (FIXED FOR MULTI-ROLE)
app.post("/login", async (req, res) => {
  try {
    // We now grab 'role' from the frontend as well!
    const { email, password, role } = req.body;

    // A. Check if user exists AND has the specific role they requested
    const loginQuery = `
      SELECT u.user_id, u.first_name, u.password_hash, r.role_name 
      FROM users u
      JOIN roles r ON u.user_id = r.user_id
      WHERE u.email = $1 AND r.role_name = $2;
    `;

    const result = await pool.query(loginQuery, [email, role]);

    if (result.rows.length === 0) {
      return res.status(401).json("User not found or incorrect role selected.");
    }

    const user = result.rows[0];

    // B. Check Password
    if (user.password_hash !== password) {
      return res.status(401).json("Incorrect password");
    }

    // C. Send back User Info
    res.json({
      user_id: user.user_id,
      first_name: user.first_name,
      role: user.role_name // This perfectly matches what the user clicked!
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// =========================================================================
// 2. REGISTER ROUTE (YOUR ORIGINAL CODE - UNCHANGED)
// =========================================================================
app.post("/register", async (req, res) => {
  try {
    const {
      firstName, lastName, email, phone, password, role,
      nid, wallet, licenseId, licenseExpire,
      vehiclePlate, vehicleModel, vehicleType, vehicleColor,
      restaurantName, location
    } = req.body;

    const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userCheck.rows.length > 0) {
      return res.status(401).json("User already exists!");
    }

    const newUser = await pool.query(
      `INSERT INTO users (first_name, last_name, email, phone, password_hash, nid) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING user_id`,
      [firstName, lastName, email, phone, password, nid]
    );

    const newUserId = newUser.rows[0].user_id;

    await pool.query(
      `INSERT INTO roles (user_id, role_name) VALUES ($1, $2)`,
      [newUserId, role]
    );

    if (role === "driver") {
      // 1. FIRST: Create the vehicle and ask PostgreSQL to return the new vehicle_id
      await pool.query(
        `INSERT INTO drivers (user_id, licence_id, license_expire, active_status) 
         VALUES ($1, $2, $3, $4)`,
        [newUserId, licenseId, licenseExpire, false]
      );

      // STEP 2: Create the vehicle SECOND (This now works because the driver exists in the DB!)
      const newVehicle = await pool.query(
        `INSERT INTO vehicles (owner_id, licence_no, model, type, color, active) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING vehicle_id`,
        [newUserId, vehiclePlate, vehicleModel, vehicleType, vehicleColor, true]
      );

      const newVehicleId = newVehicle.rows[0].vehicle_id;

      // STEP 3: Go back and update the driver with their new vehicle ID
      await pool.query(
        `UPDATE drivers SET current_vehicle_id = $1 WHERE user_id = $2`,
        [newVehicleId, newUserId]
      );
    }
    else if (role === "customer") {
      await pool.query(`INSERT INTO customers (user_id) VALUES ($1)`, [newUserId]);
    }
    else if (role === "restaurant") {
      await pool.query(`INSERT INTO owners (user_id) VALUES ($1)`, [newUserId]);
      await pool.query(
        `INSERT INTO restaurants (owner_id, name, phone) VALUES ($1, $2, $3)`,
        [newUserId, restaurantName, phone]
      );
    }

    res.json({ message: "Registration Successful", userId: newUserId, role: role });

  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error: " + err.message);
  }
});

// =========================================================================
// 3. RIDE ROUTES (NEW!)
// =========================================================================

// A. Request a Ride (Database Transaction + Find Drivers)
// A. Request a Ride (Database Transaction + Find Drivers)
app.post("/api/rides/request", async (req, res) => {
  const {
    customer_id, pickup_name, pickup_lat, pickup_lng,
    dropoff_name, dropoff_lat, dropoff_lng, service_type, distance_km, initial_fare
  } = req.body;

  try {
    // Start Transaction using your existing pool/client directly
    await pool.query('BEGIN');

    // Insert Locations
    const pickupRes = await pool.query(`INSERT INTO locations (address_name, city, latitude, longitude) VALUES ($1, 'Dhaka', $2, $3) RETURNING location_id;`, [pickup_name, pickup_lat, pickup_lng]);
    const dropoffRes = await pool.query(`INSERT INTO locations (address_name, city, latitude, longitude) VALUES ($1, 'Dhaka', $2, $3) RETURNING location_id;`, [dropoff_name, dropoff_lat, dropoff_lng]);

    // Insert Ride
    const rideRes = await pool.query(`
      INSERT INTO rides (customer_id, pickup_location_id, dropoff_location_id, service_type, status, distance_km, initial_fare) 
      VALUES ($1, $2, $3, $4, 'waiting', $5, $6) RETURNING *;
    `, [customer_id, pickupRes.rows[0].location_id, dropoffRes.rows[0].location_id, service_type, distance_km, initial_fare]);

    // Save to database
    await pool.query('COMMIT');

    // Find nearby drivers
    // Find nearby drivers (Using your exact database column names!)
    const driverResult = await pool.query(`
      SELECT d.user_id, u.first_name, u.phone, d.current_latitude, d.current_longitude
      FROM drivers d 
      JOIN users u ON d.user_id = u.user_id 
      JOIN vehicles v ON d.user_id = v.owner_id
      WHERE d.active_status = true AND LOWER(v.type) = LOWER($3)
      AND (6371 * acos(cos(radians($1)) * cos(radians(d.current_latitude)) * cos(radians(d.current_longitude) - radians($2)) + sin(radians($1)) * sin(radians(d.current_latitude)))) <= 9999;
    `, [pickup_lat, pickup_lng, service_type]);

    const availableDrivers = driverResult.rows;

    // Ping drivers via Socket.io
    const io = req.app.get("io");
    availableDrivers.forEach((driver) => {
      io.to(`driver_${driver.user_id}`).emit("new_ride_request", {
        ride_id: rideRes.rows[0].ride_id,
        pickup_address: pickup_name,
        dropoff_address: dropoff_name,
        distance: distance_km,
        fare: initial_fare
      });
    });

    res.json({ message: "Requested successfully", ride: rideRes.rows[0], nearbyDriversCount: availableDrivers.length });

  } catch (error) {
    // If anything fails, roll it back
    await pool.query('ROLLBACK');
    console.error("Transaction Error:", error);
    res.status(500).json({ error: "Failed to process ride request" });
  }
});

// B. Driver Accepts Ride
app.post("/api/rides/accept", async (req, res) => {
  const { ride_id, driver_id } = req.body;
  try {
    const result = await pool.query(`
      UPDATE rides SET status = 'accepted', driver_id = $1 
      WHERE ride_id = $2 AND status = 'waiting' RETURNING *;
    `, [driver_id, ride_id]);

    if (result.rows.length === 0) return res.status(400).json({ error: "Ride taken or cancelled." });
    const driverInfo = await pool.query(`
      SELECT u.first_name, u.phone, v.licence_no, d.rating_avg
      FROM users u
      JOIN drivers d ON u.user_id = d.user_id
      JOIN vehicles v ON d.current_vehicle_id = v.vehicle_id
      WHERE u.user_id = $1;
    `, [driver_id]);
    res.json({ message: "Ride accepted", ride: result.rows[0],driverDetails: driverInfo.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// START SERVER (Using 'server.listen' instead of 'app.listen' for WebSockets)
server.listen(5000, () => {
  console.log("Server & Socket.io running on port 5000");
});