/*
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./pageDesign/CustomerPage.css";
import generalImg from "./images/general.jpg";
import restaurantImg from "./images/restaurant.jpg";
import driverImg from "./images/driver.jpeg";

const API_BASE = "http://localhost:5000";

const CustomerPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const token = localStorage.getItem("accessToken");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [walletData, setWalletData] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [rechargeMethod, setRechargeMethod] = useState("bkash");

  const activeSection = useMemo(() => {
    const pathname = location.pathname.toLowerCase();
    if (pathname.includes("/statistics")) return "statistics";
    if (pathname.includes("/ongoing")) return "ongoing";
    if (pathname.includes("/wallet")) return "wallet";
    if (pathname.includes("/profile")) return "profile";
    if (pathname.includes("/ambulance-service")) return "ambulance";
    return "home";
  }, [location.pathname]);

  const getHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  });

  useEffect(() => {
    if (!user?.user_id) {
      navigate("/login", { replace: true });
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError("");
      setSuccess("");

      try {
        if (["home", "statistics", "ongoing"].includes(activeSection)) {
          const response = await fetch(`${API_BASE}/api/customer/dashboard/${user.user_id}`, {
            method: "GET",
            headers: getHeaders(),
            credentials: "include",
          });

          const data = await response.json();
          if (!response.ok || !data?.success) {
            throw new Error(data?.message || "Failed to load customer dashboard.");
          }

          setDashboard(data.data);
        }

        if (activeSection === "wallet") {
          const response = await fetch(`${API_BASE}/api/account/${user.user_id}/wallet`, {
            method: "GET",
            headers: getHeaders(),
            credentials: "include",
          });

          const data = await response.json();
          if (!response.ok || !data?.success) {
            throw new Error(data?.message || "Failed to load wallet data.");
          }

          setWalletData(data.data);
        }

        if (activeSection === "profile") {
          const response = await fetch(`${API_BASE}/api/account/${user.user_id}/profile`, {
            method: "GET",
            headers: getHeaders(),
            credentials: "include",
          });

          const data = await response.json();
          if (!response.ok || !data?.success) {
            throw new Error(data?.message || "Failed to load profile.");
          }

          setProfileData(data.data?.user || null);
        }
      } catch (err) {
        setError(err.message || "Unable to load data.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeSection, navigate, token, user?.user_id]);

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        headers: getHeaders(),
        credentials: "include",
      });
    } catch {
      // Ignore logout API failures and clear local state anyway.
    } finally {
      localStorage.removeItem("user");
      localStorage.removeItem("accessToken");
      navigate("/login");
    }
  };

  const handleRecharge = async () => {
    const amount = Number(rechargeAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid recharge amount.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const response = await fetch(`${API_BASE}/api/account/${user.user_id}/wallet/recharge`, {
        method: "POST",
        headers: getHeaders(),
        credentials: "include",
        body: JSON.stringify({ amount, method: rechargeMethod }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Recharge failed.");
      }

      setSuccess("Wallet recharged successfully.");
      setRechargeAmount("");

      const walletResponse = await fetch(`${API_BASE}/api/account/${user.user_id}/wallet`, {
        method: "GET",
        headers: getHeaders(),
        credentials: "include",
      });

      const walletPayload = await walletResponse.json();
      if (walletResponse.ok && walletPayload?.success) {
        setWalletData(walletPayload.data);
      }
    } catch (err) {
      setError(err.message || "Recharge failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async () => {
    if (!profileData) return;

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const response = await fetch(`${API_BASE}/api/account/${user.user_id}/profile`, {
        method: "PUT",
        headers: getHeaders(),
        credentials: "include",
        body: JSON.stringify({
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          email: profileData.email,
          phone: profileData.phone,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Profile update failed.");
      }

      setSuccess("Profile updated successfully.");

      const previous = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem(
        "user",
        JSON.stringify({
          ...previous,
          first_name: data?.data?.first_name || profileData.first_name,
        })
      );
    } catch (err) {
      setError(err.message || "Profile update failed.");
    } finally {
      setLoading(false);
    }
  };

  const renderMainSection = () => {
    if (loading) {
      return <p className="section-message">Loading...</p>;
    }

    if (activeSection === "home") {
      return (
        <>
          <div className="dashboard-metrics">
            <div className="metric-card">
              <h4>Active Ride</h4>
              <p>{dashboard?.activeRide?.status || "No active ride"}</p>
            </div>
            <div className="metric-card">
              <h4>Rides This Month</h4>
              <p>{dashboard?.wallet?.rides_this_month ?? 0}</p>
            </div>
            <div className="metric-card">
              <h4>Month Spend</h4>
              <p>BDT {dashboard?.wallet?.month_spent ?? 0}</p>
            </div>
          </div>

          <div className="services-section">
            <div className="service-card" onClick={() => navigate("/ride")}>
              <img src={generalImg} alt="Ride Service" />
              <h3>Ride Booking</h3>
            </div>

            <div className="service-card" onClick={() => navigate("/food-service")}>
              <img src={restaurantImg} alt="Food Service" />
              <h3>Food Delivery</h3>
            </div>

            <div className="service-card" onClick={() => navigate("/parcel-service")}>
              <img src={generalImg} alt="Parcel Service" />
              <h3>Parcel Delivery</h3>
            </div>

            <div className="service-card" onClick={() => navigate("/ambulance-service")}>
              <img src={driverImg} alt="Ambulance Service" />
              <h3>Ambulance Service</h3>
            </div>
          </div>
        </>
      );
    }

    if (activeSection === "statistics") {
      return (
        <div className="details-panel">
          <h3>Statistics</h3>
          <p><strong>Lifetime Spend:</strong> BDT {dashboard?.wallet?.lifetime_spent ?? 0}</p>
          <p><strong>Month Spend:</strong> BDT {dashboard?.wallet?.month_spent ?? 0}</p>
          <p><strong>Rides This Month:</strong> {dashboard?.wallet?.rides_this_month ?? 0}</p>
          <p><strong>Customer Rating:</strong> {dashboard?.user?.customer_rating ?? 0}</p>
          <h4>Recent Rides</h4>
          {dashboard?.recentRides?.length ? (
            <ul className="info-list">
              {dashboard.recentRides.map((ride) => (
                <li key={ride.ride_id || `${ride.pickup}-${ride.request_time}`}>
                  {ride.pickup} to {ride.dropoff} - {ride.status} - BDT {ride.fare}
                </li>
              ))}
            </ul>
          ) : (
            <p>No recent rides.</p>
          )}
        </div>
      );
    }

    if (activeSection === "ongoing") {
      const ride = dashboard?.activeRide;
      return (
        <div className="details-panel">
          <h3>Ongoing Request</h3>
          {ride ? (
            <>
              <p><strong>Status:</strong> {ride.status}</p>
              <p><strong>From:</strong> {ride.pickup}</p>
              <p><strong>To:</strong> {ride.dropoff}</p>
              <p><strong>Fare:</strong> BDT {ride.fare}</p>
              <p><strong>Payment:</strong> {ride.payment_method || "cash"}</p>
            </>
          ) : (
            <p>No ongoing ride requests right now.</p>
          )}
        </div>
      );
    }

    if (activeSection === "wallet") {
      return (
        <div className="details-panel">
          <h3>Wallet</h3>
          <p><strong>Balance:</strong> {walletData?.wallet?.currency || "BDT"} {walletData?.wallet?.balance ?? 0}</p>

          <div className="wallet-recharge-row">
            <input
              type="number"
              min="1"
              placeholder="Recharge amount"
              value={rechargeAmount}
              onChange={(e) => setRechargeAmount(e.target.value)}
            />
            <select value={rechargeMethod} onChange={(e) => setRechargeMethod(e.target.value)}>
              <option value="bkash">bKash</option>
              <option value="nagad">Nagad</option>
              <option value="card">Card</option>
            </select>
            <button onClick={handleRecharge} disabled={loading}>Recharge</button>
          </div>

          <h4>Recent Transactions</h4>
          {walletData?.transactions?.length ? (
            <ul className="info-list">
              {walletData.transactions.slice(0, 10).map((tx) => (
                <li key={tx.transaction_id}>
                  {tx.type} - BDT {tx.amount} - {tx.description || "No description"}
                </li>
              ))}
            </ul>
          ) : (
            <p>No wallet transactions yet.</p>
          )}
        </div>
      );
    }

    if (activeSection === "profile") {
      return (
        <div className="details-panel">
          <h3>Profile</h3>
          <div className="profile-form-grid">
            <input
              value={profileData?.first_name || ""}
              onChange={(e) => setProfileData((prev) => ({ ...(prev || {}), first_name: e.target.value }))}
              placeholder="First Name"
            />
            <input
              value={profileData?.last_name || ""}
              onChange={(e) => setProfileData((prev) => ({ ...(prev || {}), last_name: e.target.value }))}
              placeholder="Last Name"
            />
            <input
              value={profileData?.email || ""}
              onChange={(e) => setProfileData((prev) => ({ ...(prev || {}), email: e.target.value }))}
              placeholder="Email"
            />
            <input
              value={profileData?.phone || ""}
              onChange={(e) => setProfileData((prev) => ({ ...(prev || {}), phone: e.target.value }))}
              placeholder="Phone"
            />
          </div>
          <button className="primary-action" onClick={handleProfileUpdate} disabled={loading}>Save Profile</button>
        </div>
      );
    }

    return (
      <div className="details-panel">
        <h3>Ambulance Service</h3>
        <p>This service will be available soon. For emergencies, call 999 immediately.</p>
      </div>
    );
  };

  return (
    <div className="customer-wrapper">
      <div className="customer-container">
        <div className="sidebar">
          <h2>Customer Panel</h2>

          <button className={activeSection === "statistics" ? "active-nav" : ""} onClick={() => navigate("/statistics")}>
            Statistics
          </button>

          <button className={activeSection === "ongoing" ? "active-nav" : ""} onClick={() => navigate("/ongoing")}>
            Ongoing Requests
          </button>

          <button className={activeSection === "wallet" ? "active-nav" : ""} onClick={() => navigate("/wallet")}>
            Wallet
          </button>

          <button className={activeSection === "profile" ? "active-nav" : ""} onClick={() => navigate("/profile")}>
            Profile
          </button>

          <button className={activeSection === "home" ? "active-nav" : ""} onClick={() => navigate("/customer")}>
            Services
          </button>

          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>

        <div className="customer-main">
          {error && <p className="section-error">{error}</p>}
          {success && <p className="section-success">{success}</p>}
          {renderMainSection()}
        </div>
      </div>
    </div>
  );

};

export default CustomerPage;
*/

const CustomerPage = () => null;

export default CustomerPage;
