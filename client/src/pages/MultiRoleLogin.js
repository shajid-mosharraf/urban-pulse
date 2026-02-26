import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios"; // <--- Imported Axios

import "./pageDesign/Auth.css";

// Images
import generalImg from "./images/general.jpg";
import customerImg from "./images/customer.jpeg";
import driverImg from "./images/driver.jpeg";
import restaurantImg from "./images/restaurant.jpg";
import adminImg from "./images/general.jpg"; 

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Validation (Kept your original logic)
    if (!role) {
        setMessage("Please select a role first.");
        return;
    }

    if (!formData.email || !formData.phone || !formData.password) {
        setMessage("All fields are required.");
        return;
    }

    try {
        // 2. CONNECT TO BACKEND
        // We send all fields (email, password, phone, role) to the server
        const response = await axios.post("http://localhost:5000/login", {
            email: formData.email,
            password: formData.password,
            // Sending these too, even if backend only checks email/pass currently
            phone: formData.phone, 
            role: role 
        });

        // 3. Success Handling
        const { user_id, first_name, role: dbRole } = response.data;
        
        console.log("Login Success:", response.data);
        setMessage("Login successful!");

        // Save to Local Storage
        localStorage.setItem("user_id", user_id);
        localStorage.setItem("first_name", first_name);
        localStorage.setItem("role", dbRole); // Save the REAL role from DB

        // 4. Redirect Logic (Using the Backend's confirmed role)
        setTimeout(() => {
            if (dbRole === "customer") {
                navigate("/customer");
            } 
            else if (dbRole === "driver") {
                navigate("/driver");
            } 
            else if (dbRole === "restaurant") {
                navigate("/restaurant");
            } 
            else if (dbRole === "admin") {
                navigate("/admin");
            }
            else {
                // Fallback if role doesn't match specific pages
                navigate("/home");
            }
        }, 1000);

    } catch (err) {
        console.error(err);
        if (err.response) {
            setMessage(err.response.data); // Show backend error (e.g., "User not found")
        } else {
            setMessage("Server Error. Is the backend running?");
        }
    }
  };

  // 🔥 Image switching logic (Kept exactly as is)
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
          <button onClick={() => setRole("customer")} className={role === "customer" ? "active" : ""}>Customer</button>
          <button onClick={() => setRole("driver")} className={role === "driver" ? "active" : ""}>Driver</button>
          <button onClick={() => setRole("restaurant")} className={role === "restaurant" ? "active" : ""}>Restaurant</button>
          <button onClick={() => setRole("admin")} className={role === "admin" ? "active" : ""}>Admin</button>
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
        {message && <p className="signup-message" style={{color: message.includes("successful") ? "green" : "red"}}>{message}</p>}

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