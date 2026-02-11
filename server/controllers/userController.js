const pool = require("../db"); // Import the database connection

// =========================================
// 1. INSERT A TUPLE (Create a New User)
// =========================================
const createUser = async (req, res) => {
  try {
    // 1. Get data from the frontend (body)
    const { first_name, last_name, email, phone, password_hash } = req.body;

    // 2. Write the SQL Query
    // $1, $2, etc. are placeholders for security (prevents SQL Injection)
    // "RETURNING *" means "give me back the row I just inserted"
    const query = `
      INSERT INTO users (first_name, last_name, email, phone, password_hash) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING *
    `;
    
    // 3. Execute the query with the actual values
    const newTuple = await pool.query(query, [
      first_name, 
      last_name, 
      email, 
      phone, 
      password_hash
    ]);

    // 4. Send the response back to the user
    res.json(newTuple.rows[0]);

  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
};

// =========================================
// 2. SELECT ALL (Get All Users)
// =========================================
const getAllUsers = async (req, res) => {
  try {
    // 1. Write the SQL Query
    const query = "SELECT * FROM users";

    // 2. Execute the query
    const allTuples = await pool.query(query);

    // 3. Send the list of rows back
    res.json(allTuples.rows);

  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
};

// Export these functions so routes can use them
module.exports = { createUser, getAllUsers };