import React from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";

// Components
import Navbar from "./Navbar";
import SimpleNavbar from "./SimpleNavbar";
import Home from "./Home";
import MultiRoleLogin from "./MultiRoleLogin";
import MultiRoleSignUp from "./MultiRoleSignUp";
import CustomerPage from "./CustomerPage";
import Ride from "./Ride.js";
import FoodServicePage from "./FoodService.js";
import ParcelDeliveryPage from "./ParcelDelivery.js";
// NEW: Import the Driver Dashboard
import DriverDashboard from "./DriverDashboard.js"; 

function Layout() {
  const location = useLocation();

  // Controls which navbar shows up
  const fullNavbarRoutes = ["/", "/signup", "/login"];
  const showFullNavbar = fullNavbarRoutes.includes(location.pathname);

  return (
    <>
      {showFullNavbar ? <Navbar /> : <SimpleNavbar />}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signup" element={<MultiRoleSignUp />} />
        <Route path="/login" element={<MultiRoleLogin />} />
        
        {/* Customer Routes */}
        <Route path="/customer" element={<CustomerPage />} />
        <Route path="/ride" element={<Ride />} />
        <Route path="/food-service" element={<FoodServicePage />} />
        <Route path="/parcel-service" element={<ParcelDeliveryPage />} />
        
        {/* NEW: Driver Route */}
        <Route path="/driver" element={<DriverDashboard />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router>
      <Layout />
    </Router>
  );
}

export default App;