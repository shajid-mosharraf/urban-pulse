import React, { useState, useEffect } from "react";

import "./pageDesign/Auth.css";

// Images
import generalImg from "./images/general.jpg";
import customerImg from "./images/customer.jpeg";
import driverImg from "./images/driver.jpeg";
import restaurantImg from "./images/restaurant.jpg";

function MultiRoleSignUp() {
  const [role, setRole] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
    nid: "",
    wallet: "",
    profilePic: null,
    // Driver
    licenseId: "",
    vehicleType: "",
    licenseDocs: null,
    // Restaurant
    restaurantName: "",
    managerName: "",
    location: ""
  });

  const [profilePreview, setProfilePreview] = useState(null);

  // Reset profilePic & preview whenever role changes
  useEffect(() => {
    setFormData((prev) => ({ ...prev, profilePic: null }));
    setProfilePreview(null);
  }, [role]);

  // Handle input change
  const handleChange = (e) => {
    const { name, value, files } = e.target;

    if (name === "profilePic") {
      setFormData({ ...formData, profilePic: files[0] });
      setProfilePreview(URL.createObjectURL(files[0]));
    } else if (name === "licenseDocs") {
      setFormData({ ...formData, licenseDocs: files[0] });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }
    alert(`Account created as ${role}!`);
  };

  // Determine image
  let currentImage = generalImg;
  if (role === "customer") currentImage = customerImg;
  else if (role === "driver") currentImage = driverImg;
  else if (role === "restaurant") currentImage = restaurantImg;

  return (
    <div className="multi-column-container">

      {/* Left Column */}
      <div className="left-column">
        <h1>Welcome to the growing community of UrbanPulse</h1>
        <p>Join thousands of users, drivers, and restaurants revolutionizing city transportation and food delivery.</p>
      </div>

      {/* Middle Column */}
      <div className="middle-column">

        {/* Role selection */}
        {!role && (
          <>
            <h2>Select Your Role</h2>
            <div className="role-selection">
              <button onClick={() => setRole("customer")}>Customer</button>
              <button onClick={() => setRole("driver")}>Driver</button>
              <button onClick={() => setRole("restaurant")}>Restaurant</button>
            </div>
          </>
        )}

        {/* Form */}
        {role && (
          <>
            <h2>{role.charAt(0).toUpperCase() + role.slice(1)} Sign Up</h2>
            <form className="auth-form" onSubmit={handleSubmit}>
              
              {/* Profile Picture */}
              <label>Profile Picture:</label>
              <input type="file" name="profilePic" accept="image/*" onChange={handleChange} />
              {profilePreview && <img src={profilePreview} alt="Profile Preview" className="profile-preview" />}

              {/* General fields */}
              <input type="text" name="firstName" placeholder="First Name" value={formData.firstName} onChange={handleChange} required />
              <input type="text" name="lastName" placeholder="Last Name" value={formData.lastName} onChange={handleChange} required />
              <input type="text" name="phone" placeholder="Phone Number" value={formData.phone} onChange={handleChange} required />
              <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} required />
              <input type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} required />
              <input type="password" name="confirmPassword" placeholder="Confirm Password" value={formData.confirmPassword} onChange={handleChange} required />
              <input type="text" name="nid" placeholder="NID" value={formData.nid} onChange={handleChange} required />
              <input type="text" name="wallet" placeholder="Wallet" value={formData.wallet} onChange={handleChange} required />

              {/* Role-specific fields */}
              {role === "driver" && (
                <div className="role-specific">
                  <input type="text" name="licenseId" placeholder="License ID" value={formData.licenseId} onChange={handleChange} />
                  <input type="text" name="vehicleType" placeholder="Vehicle Type" value={formData.vehicleType} onChange={handleChange} />
                  <label>Upload License Document:</label>
                  <input type="file" name="licenseDocs" accept=".pdf,.jpg,.png" onChange={handleChange} />
                </div>
              )}

              {role === "restaurant" && (
                <div className="role-specific">
                  <input type="text" name="restaurantName" placeholder="Restaurant Name" value={formData.restaurantName} onChange={handleChange} />
                  <input type="text" name="managerName" placeholder="Manager Name" value={formData.managerName} onChange={handleChange} />
                  <input type="text" name="location" placeholder="Restaurant Location" value={formData.location} onChange={handleChange} />
                </div>
              )}

              <button type="submit">Sign Up as {role.charAt(0).toUpperCase() + role.slice(1)}</button>
            </form>

            <p className="go-back" onClick={() => setRole(null)}>← Go back to role selection</p>
          </>
        )}

      </div>

      {/* Right Column */}
      <div className="right-column">
        <img src={currentImage} alt="Role illustration" className="role-image" />
      </div>
    </div>
  );
}

export default MultiRoleSignUp;
