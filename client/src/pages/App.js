import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";

// Components
import Navbar from "./Navbar";
import SimpleNavbar from "./SimpleNavbar";
import Home from "./Home";
import MultiRoleLogin from "./MultiRoleLogin";
import MultiRoleSignUp from "./MultiRoleSignUp";
import Ride from "./Ride.js";
import FoodServicePage from "./FoodService.js";
import ParcelDeliveryPage from "./ParcelDelivery.js";
import CustomerDashboard from "./dashboards/CustomerDashboard";
import DriverDashboard from "./dashboards/DriverDashboard";
import RestaurantDashboard from "./dashboards/RestaurantDashboard";
import AdminDashboard from "./dashboards/AdminDashboard";
import RoleDashboardRedirect from "./RoleDashboardRedirect";

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
        <Route path="/home" element={<Home />} />
        <Route path="/signup" element={<MultiRoleSignUp />} />
        <Route path="/login" element={<MultiRoleLogin />} />
        <Route path="/dashboard" element={<RoleDashboardRedirect />} />
        
        {/* Customer Routes */}
        {/* CustomerPage is deprecated; using dashboards folder instead. */}
        <Route path="/dashboard/customer" element={<CustomerDashboard />} />
        <Route path="/dashboard/customer/statistics" element={<CustomerDashboard />} />
        <Route path="/dashboard/customer/ongoing" element={<CustomerDashboard />} />
        <Route path="/dashboard/customer/wallet" element={<CustomerDashboard />} />
        <Route path="/dashboard/customer/profile" element={<CustomerDashboard />} />
        <Route path="/dashboard/customer/promos" element={<CustomerDashboard />} />
        <Route path="/dashboard/customer/ratings" element={<CustomerDashboard />} />
        <Route path="/dashboard/customer/ambulance" element={<CustomerDashboard />} />
        <Route path="/ride" element={<Ride />} />
        <Route path="/food-service" element={<FoodServicePage />} />
        <Route path="/parcel-service" element={<ParcelDeliveryPage />} />
        <Route path="/ambulance-service" element={<CustomerDashboard />} />
        
        {/* Driver Route */}
        <Route path="/dashboard/driver" element={<DriverDashboard />} />

        {/* Restaurant/Admin Routes */}
        <Route path="/dashboard/restaurant" element={<RestaurantDashboard />} />
        <Route path="/dashboard/admin" element={<AdminDashboard />} />

        {/* Legacy Routes */}
        <Route path="/customer" element={<Navigate to="/dashboard/customer" replace />} />
        <Route path="/statistics" element={<Navigate to="/dashboard/customer/statistics" replace />} />
        <Route path="/ongoing" element={<Navigate to="/dashboard/customer/ongoing" replace />} />
        <Route path="/wallet" element={<Navigate to="/dashboard/customer/wallet" replace />} />
        <Route path="/profile" element={<Navigate to="/dashboard/customer/profile" replace />} />
        <Route path="/driver" element={<Navigate to="/dashboard/driver" replace />} />
        <Route path="/restaurant" element={<Navigate to="/dashboard/restaurant" replace />} />
        <Route path="/admin" element={<Navigate to="/dashboard/admin" replace />} />
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