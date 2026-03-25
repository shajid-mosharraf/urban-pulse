import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./pageDesign/Dashboards.css";

const API_BASE = "http://localhost:5000";

const RestaurantDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState(null);

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const token = localStorage.getItem("accessToken");

  useEffect(() => {
    const loadData = async () => {
      if (!user?.user_id) {
        navigate("/login");
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/api/restaurant/dashboard/${user.user_id}`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          credentials: "include",
        });

        const data = await response.json();

        if (!response.ok || !data?.success) {
          throw new Error(data?.message || "Unable to load restaurant dashboard.");
        }

        setDashboard(data.data);
        setError("");
      } catch (err) {
        setError(err.message || "Unable to load dashboard.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [navigate, token, user?.user_id]);

  return (
    <div className="dashboard-shell">
      <div className="dashboard-topbar">
        <h2>Restaurant Dashboard</h2>
        <div className="dashboard-actions">
          <button onClick={() => navigate("/food-service")}>Food Page</button>
          <button onClick={() => navigate("/dashboard")}>Refresh Role View</button>
        </div>
      </div>

      {loading && <p className="dashboard-message">Loading dashboard...</p>}
      {!!error && <p className="dashboard-error">{error}</p>}

      {!loading && !error && dashboard && (
        <>
          <div className="dashboard-grid-3">
            <div className="dashboard-card">
              <h4>Orders Today</h4>
              <p>{dashboard?.stats?.orders_today ?? 0}</p>
            </div>
            <div className="dashboard-card">
              <h4>Revenue Today</h4>
              <p>৳ {dashboard?.stats?.revenue_today ?? 0}</p>
            </div>
            <div className="dashboard-card">
              <h4>Avg Prep Time</h4>
              <p>{dashboard?.stats?.avg_prep_time ?? 0} min</p>
            </div>
          </div>

          <div className="dashboard-grid-2">
            <div className="dashboard-card">
              <h3>Incoming Orders</h3>
              {dashboard?.incomingOrders?.length ? (
                <ul className="dashboard-list">
                  {dashboard.incomingOrders.map((order) => (
                    <li key={order.order_id}>
                      <strong>#{order.order_id}</strong> • {order.customer_name} • ৳ {order.total_price} • {order.status}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No incoming orders right now.</p>
              )}
            </div>

            <div className="dashboard-card">
              <h3>Top Menu Items</h3>
              {dashboard?.topMenuItems?.length ? (
                <ul className="dashboard-list">
                  {dashboard.topMenuItems.map((item) => (
                    <li key={item.item_id}>
                      {item.name} • ৳ {item.price} • {item.orders_count} orders
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No menu item stats yet.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default RestaurantDashboard;
