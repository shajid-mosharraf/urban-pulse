import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import "./pageDesign/Auth.css";

// Images (Ensure these paths are correct in your project)
import generalImg from "./images/general.jpg";
import customerImg from "./images/customer.jpeg";
import driverImg from "./images/driver.jpeg";
import restaurantImg from "./images/restaurant.jpg";

function MultiRoleSignUp() {
  const [role, setRole] = useState(null);
  const navigate = useNavigate();

  // 1. FORM STATE
  const [formData, setFormData] = useState({
    // Common Fields
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
    nid: "",
    wallet: "",
    profilePic: null,

    // Driver Specifics
    licenseId: "",
    licenseExpire: "", // <--- NEW: Fixes your database error
    licenseDocs: null,

    // Vehicle Specifics
    vehiclePlate: "",
    vehicleModel: "",
    vehicleType: "",
    vehicleColor: "",

    // Restaurant Specifics
    restaurantName: "",
    managerName: "",
    location: ""
  });

  const [profilePreview, setProfilePreview] = useState(null);

  // Reset role-specific data when switching roles
  useEffect(() => {
    setFormData((prev) => ({ 
      ...prev, 
      profilePic: null, 
      licenseDocs: null 
    }));
    setProfilePreview(null);
  }, [role]);

  // 2. HANDLE INPUT CHANGES
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

  // 3. HANDLE SUBMIT
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic Validation
    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    try {
      const payload = new FormData();

      payload.append("firstName", formData.firstName || "");
      payload.append("lastName", formData.lastName || "");
      payload.append("phone", formData.phone || "");
      payload.append("email", formData.email || "");
      payload.append("password", formData.password || "");
      payload.append("nid", formData.nid || "");
      payload.append("wallet", formData.wallet || "0");
      payload.append("role", role || "");

      if (formData.profilePic) {
        payload.append("profilePic", formData.profilePic);
      }

      if (role === "driver") {
        payload.append("licenseId", formData.licenseId || "");
        payload.append("licenseExpire", formData.licenseExpire || "");
        payload.append("vehiclePlate", formData.vehiclePlate || "");
        payload.append("vehicleModel", formData.vehicleModel || "");
        payload.append("vehicleType", formData.vehicleType || "");
        payload.append("vehicleColor", formData.vehicleColor || "");

        if (formData.licenseDocs) {
          payload.append("licenseDocs", formData.licenseDocs);
        }
      }

      if (role === "restaurant") {
        payload.append("restaurantName", formData.restaurantName || "");
        payload.append("managerName", formData.managerName || "");
        payload.append("location", formData.location || "");
      }

      const response = await axios.post("http://localhost:5000/api/register", payload, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      console.log("Success:", response.data);
      alert(`Account created successfully! Please login.`);
      navigate("/login"); 

    } catch (err) {
      console.error(err);
      if (err.response) {
        alert("Error: " + (err.response.data?.message || "Registration failed"));
      } else {
        alert("Server Error. Check console logs.");
      }
    }
  };

  // Determine Side Image based on Role
  let currentImage = generalImg;
  if (role === "customer") currentImage = customerImg;
  else if (role === "driver") currentImage = driverImg;
  else if (role === "restaurant") currentImage = restaurantImg;

  return (
    <div className="multi-column-container">

      {/* Left Column */}
      <div className="left-column">
        <h1>Welcome to UrbanPulse</h1>
        <p>Join thousands of users, drivers, and restaurants revolutionizing city transportation.</p>
      </div>

      {/* Middle Column */}
      <div className="middle-column">

        {/* Role Selection Screen */}
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

        {/* Signup Form Screen */}
        {role && (
          <>
            <h2>{role.charAt(0).toUpperCase() + role.slice(1)} Sign Up</h2>
            <form className="auth-form" onSubmit={handleSubmit}>
              
              {/* Profile Picture */}
              <div style={{textAlign: 'center', marginBottom: '15px'}}>
                <label>Profile Picture</label> <br/>
                <input type="file" name="profilePic" accept="image/*" onChange={handleChange} />
                {profilePreview && (
                  <img src={profilePreview} alt="Preview" className="profile-preview" style={{width: '80px', height: '80px', borderRadius: '50%', marginTop: '5px'}}/>
                )}
              </div>

              {/* Common Fields */}
              <input type="text" name="firstName" placeholder="First Name" value={formData.firstName} onChange={handleChange} required />
              <input type="text" name="lastName" placeholder="Last Name" value={formData.lastName} onChange={handleChange} required />
              <input type="text" name="phone" placeholder="Phone Number" value={formData.phone} onChange={handleChange} required />
              <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} required />
              <input type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} required />
              <input type="password" name="confirmPassword" placeholder="Confirm Password" value={formData.confirmPassword} onChange={handleChange} required />
              <input type="text" name="nid" placeholder="NID Number" value={formData.nid} onChange={handleChange} required />
              <input type="text" name="wallet" placeholder="Initial Wallet Balance (BDT)" value={formData.wallet} onChange={handleChange} required />

              {/* --- DRIVER SPECIFIC FIELDS --- */}
              {role === "driver" && (
                <div className="role-specific" style={{backgroundColor: '#f9f9f9', padding: '10px', borderRadius: '5px', marginTop: '10px'}}>
                  <h4>Driver Details</h4>
                  
                  <input type="text" name="licenseId" placeholder="Driving License ID" value={formData.licenseId} onChange={handleChange} required />
                  
                  <label style={{display: 'block', marginTop: '5px', fontSize: '0.9em'}}>License Expiration Date:</label>
                  <input type="date" name="licenseExpire" value={formData.licenseExpire} onChange={handleChange} required style={{width: '95%', padding: '8px'}} />
                  
                  <label style={{display: 'block', marginTop: '10px', fontSize: '0.9em'}}>Upload License Document:</label>
                  <input type="file" name="licenseDocs" accept=".pdf,.jpg,.png" onChange={handleChange} style={{marginBottom: '10px'}}/>
                  
                  <h4>Vehicle Details</h4>
                  <input type="text" name="vehiclePlate" placeholder="Vehicle License Plate (e.g. DHA-METRO-KA-1234)" value={formData.vehiclePlate} onChange={handleChange} required />
                  <input type="text" name="vehicleModel" placeholder="Vehicle Model (e.g. Toyota Corolla)" value={formData.vehicleModel} onChange={handleChange} required />
                  <input type="text" name="vehicleColor" placeholder="Vehicle Color" value={formData.vehicleColor} onChange={handleChange} required />
                  
                  <select name="vehicleType" value={formData.vehicleType} onChange={handleChange} required style={{width: "100%", padding: "10px", margin: "10px 0"}}>
                    <option value="">Select Vehicle Type</option>
                    <option value="Car">Car</option>
                    <option value="Bike">Bike</option>
                    <option value="CNG">CNG</option>
                  </select>
                </div>
              )}

              {/* --- RESTAURANT SPECIFIC FIELDS --- */}
              {role === "restaurant" && (
                <div className="role-specific" style={{backgroundColor: '#f9f9f9', padding: '10px', borderRadius: '5px', marginTop: '10px'}}>
                  <h4>Restaurant Details</h4>
                  <input type="text" name="restaurantName" placeholder="Restaurant Name" value={formData.restaurantName} onChange={handleChange} required />
                  <input type="text" name="managerName" placeholder="Manager Name" value={formData.managerName} onChange={handleChange} required />
                  <input type="text" name="location" placeholder="Restaurant Location" value={formData.location} onChange={handleChange} required />
                </div>
              )}

              <button type="submit" style={{marginTop: '20px'}}>Sign Up as {role.charAt(0).toUpperCase() + role.slice(1)}</button>
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