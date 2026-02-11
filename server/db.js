// config/db.js
const { Pool } = require('pg');
require('dotenv').config();
console.log("Database User:", process.env.DB_USER);
console.log("Database Password Type:", typeof process.env.DB_PASSWORD);
// Create a new pool instance using environment variables
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

// Event listener for successful connection
pool.on('connect', () => {
  console.log('Connected to the PostgreSQL database successfully!');
});

// Handle unexpected errors on idle clients
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};