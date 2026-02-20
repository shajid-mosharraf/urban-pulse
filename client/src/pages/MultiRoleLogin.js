import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import "./pageDesign/Auth.css";

// Images
import generalImg from "./images/general.jpg";
import customerImg from "./images/customer.jpeg";
import driverImg from "./images/driver.jpeg";
import restaurantImg from "./images/restaurant.jpg";
import adminImg from "./images/general.jpg"; // add this image

function MultiRoleLogin() {
  const [role, setRole] = useState(null);
  const navigate = useNavigate();


  const [formData, setFormData] = useState({
    email: "",
    phone: "",
    password: ""
  });

  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    
    e.preventDefault();

    if (!role) {
        setMessage("Please select a role first.");
        return;
    }

    if (!formData.email || !formData.phone || !formData.password) {
        setMessage("All fields are required.");
        return;
    }

    // ✅ Simulate successful login
    setMessage("Login successful!");

    // Redirect based on role
    setTimeout(() => {
        if (role === "customer") {
        navigate("/customer");
        } 
        else if (role === "driver") {
        navigate("/driver");
        } 
        else if (role === "restaurant") {
        navigate("/restaurant");
        } 
        else if (role === "admin") {
        navigate("/admin");
        }
    }, 1000);
    

  };

  // 🔥 Image switching logic
  let currentImage = generalImg;

  if (role === "customer") currentImage = customerImg;
  else if (role === "driver") currentImage = driverImg;
  else if (role === "restaurant") currentImage = restaurantImg;
  else if (role === "admin") currentImage = adminImg;

  return (
    <div className="multi-column-container">

      {/* ========== LEFT COLUMN ========== */}
      <div className="left-column">
        <h1>Welcome Back to UrbanPulse</h1>
        <p>Login to continue your journey with us.</p>
      </div>

      {/* ========== MIDDLE COLUMN ========== */}
      <div className="middle-column">

        {/* Role Selection */}
        <h2>Select Role</h2>
        <div className="role-selection">
          <button onClick={() => setRole("customer")}>Customer</button>
          <button onClick={() => setRole("driver")}>Driver</button>
          <button onClick={() => setRole("restaurant")}>Restaurant</button>
          <button onClick={() => setRole("admin")}>Admin</button>
        </div>

        {/* Login Form */}
        <form className="auth-form" onSubmit={handleSubmit}>

          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
          />

          <input
            type="text"
            name="phone"
            placeholder="Phone Number"
            value={formData.phone}
            onChange={handleChange}
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
          />

          <button type="submit">
            Login
          </button>
        </form>

        {/* Message */}
        {message && <p className="signup-message">{message}</p>}

      </div>

      {/* ========== RIGHT COLUMN ========== */}
      <div className="right-column">
        <img
          src={currentImage}
          alt="Role Illustration"
          className="role-image"
        />
      </div>

    </div>
  );
}

export default MultiRoleLogin;
