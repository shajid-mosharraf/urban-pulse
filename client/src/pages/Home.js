import React, { useState } from "react";
import "./pageDesign/Home.css";

import homeimage from "./images/urban-pulse.jfif";

function Home() {
  const [activeService, setActiveService] = useState(null);
  const [isLoggedIn] = useState(false); // simulate login

  const services = [
    {
      id: "ride",
      title: "🚖 Ride",
      shortDesc: "Book fast and affordable rides anywhere in the city.",
      longDesc: "UrbanPulse Ride allows you to book rides instantly with professional drivers. Track your ride in real-time, share your location, and enjoy safe and comfortable journeys."
    },
    {
      id: "courier",
      title: "📦 Courier",
      shortDesc: "Send packages quickly and securely to any location.",
      longDesc: "UrbanPulse Courier helps you deliver packages efficiently. Schedule pickups, track shipments, and get delivery confirmation instantly."
    },
    {
      id: "hospital",
      title: "🏥 Hospital",
      shortDesc: "Request emergency transport and healthcare support.",
      longDesc: "UrbanPulse Hospital service provides fast emergency transport. Request an ambulance or medical assistance immediately to reach healthcare centers safely."
    },
    {
      id: "food",
      title: "🍔 Food Delivery",
      shortDesc: "Order your favorite meals delivered to your doorstep.",
      longDesc: "UrbanPulse Food Delivery connects you with local restaurants. Track your order, enjoy fast delivery, and pay securely online."
    }
  ];

  const handleClick = (serviceId) => {
    // toggle the description for the clicked service
    if (activeService === serviceId) {
      setActiveService(null); // hide description + alert on second click
    } else {
      setActiveService(serviceId); // show description + alert
    }
  };

  return (
    <div className="home-container">
      
      {/* Left Column */}
      <div className="home-left">
        <h1>Welcome to UrbanPulse 🚖</h1>
        <p>The fastest ride-sharing platform in the city.</p>

        {/* LOGIN ALERT BOX ABOVE THE CARDS */}
        {!isLoggedIn && activeService && (
          <div className="login-alert-box">
            ⚠ Please Login / Sign Up to use these services
          </div>
        )}

        <div className="services-container">
          {services.map((service) => (
            <div
              key={service.id}
              className={`service-card ${activeService === service.id ? "active" : ""}`}
              onClick={() => handleClick(service.id)}
            >
              <h2>{service.title}</h2>
              <p>{service.shortDesc}</p>

              {/* Show long description */}
              {activeService === service.id && (
                <div className="service-details">
                  <p>{service.longDesc}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right Column */}
      <div className="home-right">
        <img src={homeimage} alt="UrbanPulse" className="hero-image" />
      </div>

    </div>
  );
}

export default Home;
