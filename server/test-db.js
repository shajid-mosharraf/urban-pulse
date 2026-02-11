const Pool = require("pg").Pool;
require("dotenv").config(); // Load the .env file

console.log("--- Checking Config ---");
console.log("User:", process.env.DB_USER);
console.log("Password:", process.env.DB_PASSWORD ? "****" : "MISSING/UNDEFINED");
console.log("Host:", process.env.DB_HOST);
console.log("Database:", process.env.DB_NAME);
console.log("-----------------------");

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error(" CONNECTION FAILED:", err.message);
  } else {
    console.log(" SUCCESS! Connected to Database.");
    console.log("Time from DB:", res.rows[0].now);
  }
  pool.end();
});