import React from "react";
import { Link } from "react-router-dom";

function Home() {
  return (
    <div style={{ textAlign: "center", padding: "50px" }}>
      <h1>Welcome to Urban Pulse 🚖</h1>
      <p>The fastest ride-sharing platform in the city.</p>
      <Link to="/login">
        <button style={{ padding: "10px 20px", fontSize: "16px", cursor: "pointer" }}>
          Login / Register
        </button>
      </Link>
    </div>
  );
}

export default Home;