import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Import Components and Pages
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

function App() {
  return (
    <Router>
      {/* Navbar is outside Routes so it shows on EVERY page */}
      <Navbar />
      
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default App;