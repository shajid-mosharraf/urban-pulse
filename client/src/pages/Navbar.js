import React from "react";
import { Link } from "react-router-dom";
import "./pageDesign/navbar.css";

function Navbar() {
  return (
    <nav className="navbar">
      <div className="logo">UrbanPulse</div>

      <div className="nav-links">
        <Link to="/">Home</Link>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/login">Login</Link>
        <Link to="/signup" className="signup-btn">Sign Up</Link>
      </div>
    </nav>
  );
}


export default Navbar;
