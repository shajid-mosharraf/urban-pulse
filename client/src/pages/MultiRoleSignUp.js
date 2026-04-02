import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { OpenStreetMapProvider } from "leaflet-geosearch";

import "./pageDesign/Auth.css";

// Images (Ensure these paths are correct in your project)
import generalImg from "./images/general.jpg";
import customerImg from "./images/customer.jpeg";
import driverImg from "./images/driver.jpeg";
import restaurantImg from "./images/restaurant.jpg";

function MultiRoleSignUp() {
  const [role, setRole] = useState(null);
  const navigate = useNavigate();
  const locationSearchTimerRef = useRef(null);

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
  const [restaurantLocationCoords, setRestaurantLocationCoords] = useState(null);
  const [restaurantLocationSuggestions, setRestaurantLocationSuggestions] = useState([]);

  const [profilePreview, setProfilePreview] = useState(null);

  const geoProvider = useMemo(
    () =>
      new OpenStreetMapProvider({
        params: {
          countrycodes: "bd",
          limit: 5,
        },
      }),
    []
  );

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

  const handleRestaurantLocationInput = (value) => {
    setFormData((prev) => ({ ...prev, location: value }));
    setRestaurantLocationCoords(null);

    if (locationSearchTimerRef.current) {
      clearTimeout(locationSearchTimerRef.current);
    }

    if (!value || value.trim().length < 2) {
      setRestaurantLocationSuggestions([]);
      return;
    }

    locationSearchTimerRef.current = setTimeout(async () => {
      try {
        const results = await geoProvider.search({ query: `${value}, Bangladesh` });
        setRestaurantLocationSuggestions(results || []);
      } catch (error) {
        setRestaurantLocationSuggestions([]);
      }
    }, 350);
  };

  const selectRestaurantLocationSuggestion = (result) => {
    setFormData((prev) => ({ ...prev, location: result.label }));
    setRestaurantLocationCoords({
      latitude: Number(result.y),
      longitude: Number(result.x),
    });
    setRestaurantLocationSuggestions([]);
  };

  const useCurrentGpsForRestaurantLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = Number(position.coords.latitude);
        const lng = Number(position.coords.longitude);

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
          );
          const data = await response.json();
          const label = data?.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

          setFormData((prev) => ({ ...prev, location: label }));
          setRestaurantLocationCoords({ latitude: lat, longitude: lng });
          setRestaurantLocationSuggestions([]);
        } catch (error) {
          setFormData((prev) => ({ ...prev, location: `${lat.toFixed(6)}, ${lng.toFixed(6)}` }));
          setRestaurantLocationCoords({ latitude: lat, longitude: lng });
          setRestaurantLocationSuggestions([]);
        }
      },
      () => {
        alert("Unable to fetch GPS location. Please allow location access.");
      }
    );
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
        if (!restaurantLocationCoords) {
          alert("Please pick restaurant location from suggestions or use current GPS location.");
          return;
        }

        payload.append("restaurantName", formData.restaurantName || "");
        payload.append("managerName", formData.managerName || "");
        payload.append("location", formData.location || "");
        payload.append("restaurant_latitude", String(restaurantLocationCoords.latitude));
        payload.append("restaurant_longitude", String(restaurantLocationCoords.longitude));
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
                  <input
                    type="text"
                    name="location"
                    placeholder="Search restaurant location"
                    value={formData.location}
                    onChange={(e) => handleRestaurantLocationInput(e.target.value)}
                    required
                  />
                  <button type="button" onClick={useCurrentGpsForRestaurantLocation} style={{ marginTop: '8px' }}>
                    Use Current GPS Location
                  </button>
                  {restaurantLocationSuggestions.length > 0 && (
                    <div style={{ marginTop: '8px', border: '1px solid #ddd', borderRadius: '6px', maxHeight: '150px', overflowY: 'auto', backgroundColor: 'white' }}>
                      {restaurantLocationSuggestions.map((item, index) => (
                        <div
                          key={`${item.x}-${item.y}-${index}`}
                          onClick={() => selectRestaurantLocationSuggestion(item)}
                          style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid #eee', fontSize: '0.9em' }}
                        >
                          {item.label}
                        </div>
                      ))}
                    </div>
                  )}
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