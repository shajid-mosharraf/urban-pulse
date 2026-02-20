import React from "react";
import { useNavigate } from "react-router-dom";
import "./pageDesign/CustomerPage.css";

const CustomerPage = () => {
  const navigate = useNavigate();

  return (
  <div className="customer-wrapper">

    <div className="customer-container">
        

      {/* LEFT SIDE */}
      <div className="sidebar">
        <h2>Customer Panel</h2>

        <button onClick={() => navigate("/statistics")}>
          📊 Statistics
        </button>

        <button onClick={() => navigate("/ongoing")}>
          🚚 Ongoing Requests
        </button>

        <button onClick={() => navigate("/wallet")}>
          💰 Wallet
        </button>

        <button onClick={() => navigate("/profile")}>
          👤 Profile
        </button>

        <button className="logout-btn" onClick={() => navigate("/")}>
          🔓 Logout
        </button>
      </div>


      {/* RIGHT SIDE */}
      <div className="services-section">
         <div 
          className="service-card"
          onClick={() => navigate("/ride")}
        >
          <img src="/images/general.jpg" alt="Ride Service" />
          <h3>Ride Booking</h3>
        </div>

        <div 
          className="service-card"
          onClick={() => navigate("/food-service")}
        >
          <img src="/images/restaurant.jpg" alt="Food Service" />
          <h3>Food Delivery</h3>
        </div>

        <div 
          className="service-card"
          onClick={() => navigate("/parcel-service")}
        >
          <img src="/images/general.jpg" alt="Parcel Service" />
          <h3>Parcel Delivery</h3>
        </div>

        <div 
          className="service-card"
          onClick={() => navigate("/Ambulance-service")}
        >
          <img src="/images/driver.jpeg" alt="Ambulance Service" />
          <h3>Ambulance Service</h3>
        </div>

      </div>
    </div>
  </div>
);

    
};

export default CustomerPage;
