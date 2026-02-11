import React from "react";
import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav style={{ background: "#333", padding: "15px", color: "white", display: "flex", justifyContent: "space-between" }}>
      <h3>Urban Pulse</h3>
      <div>
        <Link to="/" style={{ color: "white", margin: "0 15px", textDecoration: "none" }}>Home</Link>
        <Link to="/dashboard" style={{ color: "white", margin: "0 15px", textDecoration: "none" }}>Dashboard</Link>
        <Link to="/login" style={{ color: "yellow", margin: "0 15px", textDecoration: "none" }}>Login</Link>
      </div>
    </nav>
  );
}

export default Navbar;