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

  const [loginData, setLoginData] = useState({
    email: "",
    password: ""
  });

  const [forgotData, setForgotData] = useState({
    phone: "",
    newPassword: "",
    confirmPassword: ""
  });

  const [isForgotMode, setIsForgotMode] = useState(false);
  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState("");

  const handleLoginChange = (e) => {
    setLoginData({
      ...loginData,
      [e.target.name]: e.target.value
    });
  };

  const handleForgotChange = (e) => {
    setForgotData({
      ...forgotData,
      [e.target.name]: e.target.value
    });
  };

  const isValidPhone = (phone) => {
    const cleaned = String(phone || "").replace(/[^0-9]/g, "");
    return cleaned.length >= 10 && cleaned.length <= 15;
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    if (!role) {
        setMessage("Please select a role first.");
        return;
    }

    if (!loginData.email || !loginData.password) {
        setMessage("Email and password are required.");
        return;
    }

    try {
        setLoading(true);
        const response = await axios.post("http://localhost:5000/api/auth/login", {
            email: loginData.email,
            password: loginData.password,
            role: role 
        }, {
          withCredentials: true
        });

        const user = response.data?.data?.user;
        const accessToken = response.data?.data?.accessToken;
        
        console.log("Login Success:", response.data);
        setMessage(response.data?.message || "Login successful!");

        if (!user) {
          setMessage("Login succeeded but user data is missing.");
          return;
        }

        const userData = {
            user_id: user.user_id,
            first_name: user.first_name,
            role: user.activeRole || role,
            roles: user.roles || []
        };
        localStorage.setItem("user", JSON.stringify(userData));
        if (accessToken) {
          localStorage.setItem("accessToken", accessToken);
        }

        setTimeout(() => {
          navigate("/dashboard");
        }, 1000);

    } catch (err) {
        console.error(err);
        if (err.response) {
            setMessage(err.response.data?.message || "Login failed.");
        } else {
            setMessage("Server Error. Is the backend running?");
        }
    } finally {
        setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();

    const { phone, newPassword, confirmPassword } = forgotData;

    if (!phone || !newPassword || !confirmPassword) {
      setMessage("All fields are required.");
      return;
    }

    if (!isValidPhone(phone)) {
      setMessage("Please enter a valid phone number.");
      return;
    }

    if (newPassword.length < 6) {
      setMessage("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("New password and confirm password do not match.");
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post("http://localhost:5000/api/auth/forgot-password", {
        phone,
        newPassword,
        confirmPassword
      });

      setMessage(response.data?.message || "Password updated successfully. Please login.");
      setIsForgotMode(false);
      setForgotData({ phone: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      console.error(err);
      if (err.response) {
        setMessage(err.response.data?.message || "Unable to reset password.");
      } else {
        setMessage("Server Error. Is the backend running?");
      }
    } finally {
      setLoading(false);
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

        {!isForgotMode ? (
          <>
            <form className="auth-form" onSubmit={handleLoginSubmit}>
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={loginData.email}
                onChange={handleLoginChange}
              />

              <input
                type="password"
                name="password"
                placeholder="Password"
                value={loginData.password}
                onChange={handleLoginChange}
              />

              <button type="submit" disabled={loading}>
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>

            <button
              type="button"
              className="text-link-btn"
              onClick={() => {
                setMessage("");
                setIsForgotMode(true);
              }}
            >
              Forgot Password?
            </button>
          </>
        ) : (
          <>
            <form className="auth-form" onSubmit={handleForgotSubmit}>
              <input
                type="text"
                name="phone"
                placeholder="Phone Number"
                value={forgotData.phone}
                onChange={handleForgotChange}
              />

              <input
                type="password"
                name="newPassword"
                placeholder="Set New Password"
                value={forgotData.newPassword}
                onChange={handleForgotChange}
              />

              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirm New Password"
                value={forgotData.confirmPassword}
                onChange={handleForgotChange}
              />

              <button type="submit" disabled={loading}>
                {loading ? "Updating..." : "Update Password"}
              </button>
            </form>

            <button
              type="button"
              className="text-link-btn"
              onClick={() => {
                setMessage("");
                setIsForgotMode(false);
              }}
            >
              Back to Login
            </button>
          </>
        )}

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