import React from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";

import Navbar from "./Navbar";
import SimpleNavbar from "./SimpleNavbar";
import Home from "./Home";
import MultiRoleLogin from "./MultiRoleLogin";
import MultiRoleSignUp from "./MultiRoleSignUp";
import CustomerPage from "./CustomerPage";
import Ride from "./Ride.js";
import FoodServicePage from "./FoodService.js";
import ParcelDeliveryPage from "./ParcelDelivery.js";

function Layout() {
  const location = useLocation();

  const fullNavbarRoutes = ["/", "/signup", "/login"];
  const showFullNavbar = fullNavbarRoutes.includes(location.pathname);

  return (
    <>
      {showFullNavbar ? <Navbar /> : <SimpleNavbar />}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signup" element={<MultiRoleSignUp />} />
        <Route path="/login" element={<MultiRoleLogin />} />
        <Route path="/customer" element={<CustomerPage />} />
        <Route path="/ride" element={<Ride />} />
        <Route path = "/food-service" element = {<FoodServicePage />} />
        <Route path = "/parcel-service" element = {<ParcelDeliveryPage />} />;
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
