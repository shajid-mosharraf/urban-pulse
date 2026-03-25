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

const getStoredAuth = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    const token = localStorage.getItem("accessToken");
    return { user, token };
  } catch {
    return { user: null, token: null };
  }
};

const hasRequiredRole = (user, allowedRoles = []) => {
  if (!user || !allowedRoles.length) return false;

  const primaryRole = String(user.role || "").toLowerCase();
  const roles = Array.isArray(user.roles)
    ? user.roles.map((r) => String(r || "").toLowerCase())
    : [];

  return allowedRoles.some((allowed) => {
    const normalized = String(allowed || "").toLowerCase();
    return primaryRole === normalized || roles.includes(normalized);
  });
};

function ProtectedRoute({ allowedRoles, children }) {
  const { user, token } = getStoredAuth();
  const isAllowed = Boolean(token) && hasRequiredRole(user, allowedRoles);

  if (!isAllowed) {
    return <Navigate to="/" replace />;
  }

  return children;
}

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
        <Route path="/dashboard/customer" element={<ProtectedRoute allowedRoles={["customer"]}><CustomerDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/customer/statistics" element={<ProtectedRoute allowedRoles={["customer"]}><CustomerDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/customer/ongoing" element={<ProtectedRoute allowedRoles={["customer"]}><CustomerDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/customer/wallet" element={<ProtectedRoute allowedRoles={["customer"]}><CustomerDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/customer/profile" element={<ProtectedRoute allowedRoles={["customer"]}><CustomerDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/customer/promos" element={<ProtectedRoute allowedRoles={["customer"]}><CustomerDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/customer/ratings" element={<ProtectedRoute allowedRoles={["customer"]}><CustomerDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/customer/ambulance" element={<ProtectedRoute allowedRoles={["customer"]}><CustomerDashboard /></ProtectedRoute>} />
        <Route path="/ride" element={<ProtectedRoute allowedRoles={["customer"]}><Ride /></ProtectedRoute>} />
        <Route path="/food-service" element={<ProtectedRoute allowedRoles={["customer"]}><FoodServicePage /></ProtectedRoute>} />
        <Route path="/parcel-service" element={<ProtectedRoute allowedRoles={["customer"]}><ParcelDeliveryPage /></ProtectedRoute>} />
        <Route path="/ambulance-service" element={<ProtectedRoute allowedRoles={["customer"]}><CustomerDashboard /></ProtectedRoute>} />
        
        {/* Driver Route */}
        <Route path="/dashboard/driver" element={<ProtectedRoute allowedRoles={["driver"]}><DriverDashboard /></ProtectedRoute>} />

        {/* Restaurant/Admin Routes */}
        <Route path="/dashboard/restaurant" element={<ProtectedRoute allowedRoles={["restaurant"]}><RestaurantDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/admin" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>} />

        {/* Legacy Routes */}
        <Route path="/customer" element={<ProtectedRoute allowedRoles={["customer"]}><Navigate to="/dashboard/customer" replace /></ProtectedRoute>} />
        <Route path="/statistics" element={<ProtectedRoute allowedRoles={["customer"]}><Navigate to="/dashboard/customer/statistics" replace /></ProtectedRoute>} />
        <Route path="/ongoing" element={<ProtectedRoute allowedRoles={["customer"]}><Navigate to="/dashboard/customer/ongoing" replace /></ProtectedRoute>} />
        <Route path="/wallet" element={<ProtectedRoute allowedRoles={["customer"]}><Navigate to="/dashboard/customer/wallet" replace /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute allowedRoles={["customer"]}><Navigate to="/dashboard/customer/profile" replace /></ProtectedRoute>} />
        <Route path="/driver" element={<ProtectedRoute allowedRoles={["driver"]}><Navigate to="/dashboard/driver" replace /></ProtectedRoute>} />
        <Route path="/restaurant" element={<ProtectedRoute allowedRoles={["restaurant"]}><Navigate to="/dashboard/restaurant" replace /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><Navigate to="/dashboard/admin" replace /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
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