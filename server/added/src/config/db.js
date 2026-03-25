const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});

pool.on("connect", () => {
  console.log("✅ Connected to PostgreSQL");
});

pool.on("error", (err) => {
  console.error("❌ PostgreSQL error:", err.message);
});

/**
 * Execute a parameterized query
 * @param {string} text - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<QueryResult>}
 */
const query = (text, params) => pool.query(text, params);

/**
 * Get a client from the pool (for transactions)
 * @returns {Promise<PoolClient>}
 */
const getClient = () => pool.connect();

module.exports = { query, getClient };
