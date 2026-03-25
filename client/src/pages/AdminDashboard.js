import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./pageDesign/Dashboards.css";

const API_BASE = "http://localhost:5000";

const AdminDashboard = () => {
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
        const response = await fetch(`${API_BASE}/api/admin/dashboard/${user.user_id}`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          credentials: "include",
        });

        const data = await response.json();

        if (!response.ok || !data?.success) {
          throw new Error(data?.message || "Unable to load admin dashboard.");
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
        <h2>Admin Dashboard</h2>
        <div className="dashboard-actions">
          <button onClick={() => navigate("/dashboard")}>Refresh Role View</button>
          <button onClick={() => navigate("/")}>Back Home</button>
        </div>
      </div>

      {loading && <p className="dashboard-message">Loading dashboard...</p>}
      {!!error && <p className="dashboard-error">{error}</p>}

      {!loading && !error && dashboard && (
        <>
          <div className="dashboard-grid-3">
            <div className="dashboard-card"><h4>Total Users</h4><p>{dashboard?.stats?.total_users ?? 0}</p></div>
            <div className="dashboard-card"><h4>Active Rides</h4><p>{dashboard?.stats?.active_rides ?? 0}</p></div>
            <div className="dashboard-card"><h4>Revenue Today</h4><p>৳ {dashboard?.stats?.revenue_today ?? 0}</p></div>
          </div>

          <div className="dashboard-grid-2">
            <div className="dashboard-card">
              <h3>Pending Driver Verifications</h3>
              {dashboard?.pendingVerifications?.length ? (
                <ul className="dashboard-list">
                  {dashboard.pendingVerifications.map((driver) => (
                    <li key={driver.user_id}>{driver.name} • {driver.licence_id}</li>
                  ))}
                </ul>
              ) : (
                <p>No pending verifications.</p>
              )}
            </div>

            <div className="dashboard-card">
              <h3>Recent Users</h3>
              {dashboard?.recentUsers?.length ? (
                <ul className="dashboard-list">
                  {dashboard.recentUsers.map((u) => (
                    <li key={u.user_id}>{u.name} • {u.roles}</li>
                  ))}
                </ul>
              ) : (
                <p>No recent users.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
