import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "./Layout";

const nav = [
  { id: "home",      icon: "⌂",  label: "Dashboard", path: "/dashboard/admin" },
  { type: "section", id: "s1",   label: "Users" },
  { id: "users",     icon: "👥", label: "All Users" },
  { id: "drivers",   icon: "🚗", label: "Drivers" },
  { id: "customers", icon: "🙍", label: "Customers" },
  { id: "restaurants",icon:"🍽️", label: "Restaurants" },
  { type: "section", id: "s2",   label: "Operations" },
  { id: "rides",     icon: "📍", label: "Live Rides" },
  { id: "orders",    icon: "📦", label: "All Orders" },
  { id: "payments",  icon: "💳", label: "Payments" },
  { type: "section", id: "s3",   label: "Management" },
  { id: "promos",    icon: "🎟️", label: "Promos" },
  { id: "verify",    icon: "✅", label: "Verifications" },
  { id: "reports",   icon: "📊", label: "Reports" },
  { id: "roles",     icon: "🔐", label: "Roles & Perms" },
];

function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [dashboard, setDashboard] = useState(null);

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const token = localStorage.getItem("accessToken");

  const getHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  });

  useEffect(() => {
    const loadDashboard = async () => {
      if (!user?.user_id) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        setLoading(true);
        setError("");
        const response = await fetch(`http://localhost:5000/api/admin/dashboard/${user.user_id}`, {
          headers: getHeaders(),
          credentials: "include",
        });

        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(data?.message || "Unable to load admin dashboard.");
        }

        setDashboard(data.data);
      } catch (err) {
        setError(err.message || "Unable to load dashboard.");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [navigate, token, user?.user_id]);

  const updateDriverVerification = async (driverUserId, approved) => {
    if (!user?.user_id || !driverUserId) return;

    try {
      setActionMessage("");
      const response = await fetch(`http://localhost:5000/api/admin/drivers/${driverUserId}/verify`, {
        method: "PATCH",
        headers: getHeaders(),
        credentials: "include",
        body: JSON.stringify({ approved }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to update verification.");
      }

      setActionMessage(data.message || "Verification updated.");
      setDashboard((prev) => prev ? {
        ...prev,
        pendingVerifications: prev.pendingVerifications.filter((d) => d.user_id !== driverUserId),
      } : prev);
    } catch (err) {
      setActionMessage(err.message || "Unable to update verification.");
    }
  };

  return (
    <Layout role="Admin" navItems={nav} userName="Admin Panel" statusLabel="System OK">

      {loading && <div className="section-label">Loading dashboard...</div>}
      {!!error && <div className="section-label" style={{ color: "var(--red)" }}>{error}</div>}
      {!!actionMessage && <div className="section-label">{actionMessage}</div>}

      {!loading && !error && dashboard && (
        <>
          {/* Quick Actions */}
          <div className="section-label">Quick Actions</div>
          <div className="quick-actions">
            {[
              { icon: "✅", label: "Verify Drivers",  sub: `${dashboard?.pendingVerifications?.length || 0} pending`, color: "#fff7ed", iconBg: "#ffedd5" },
              { icon: "📍", label: "Live Ride Map",   sub: `${dashboard?.stats?.active_rides ?? 0} active`, color: "#eff6ff", iconBg: "#dbeafe" },
              { icon: "🎟️", label: "Create Promo",   sub: "Discount codes", color: "#f0fdf4", iconBg: "#dcfce7" },
              { icon: "👥", label: "Manage Users",    sub: `${dashboard?.stats?.total_users ?? 0} total`, color: "#faf5ff", iconBg: "#ede9fe" },
              { icon: "📊", label: "View Reports",    sub: "Analytics", color: "#fefce8", iconBg: "#fef9c3" },
              { icon: "🔐", label: "Roles & Perms",   sub: "Access control", color: "#fef2f2", iconBg: "#fee2e2" },
            ].map((a, i) => (
              <div key={i} className="action-card" style={{ background: a.color }}>
                <div className="action-icon" style={{ background: a.iconBg }}>{a.icon}</div>
                <div>
                  <div className="action-label">{a.label}</div>
                  <div className="action-sub">{a.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Platform Stats */}
          <div className="stats-grid">
            {[
              { icon: "👥", label: "Total Users",        value: dashboard?.stats?.total_users ?? 0, change: "Total", bg: "#eff6ff" },
              { icon: "🚗", label: "Active Rides",        value: dashboard?.stats?.active_rides ?? 0, change: "Live now",  bg: "#fff7ed" },
              { icon: "📦", label: "Orders Today",        value: dashboard?.stats?.orders_today ?? 0, change: "Today", bg: "#f0fdf4" },
              { icon: "💰", label: "Revenue Today",       value: `৳ ${dashboard?.stats?.revenue_today ?? 0}`, change: "Today", bg: "#faf5ff" },
              { icon: "🚙", label: "Online Drivers",      value: dashboard?.stats?.online_drivers ?? 0, change: "Active", bg: "#fefce8" },
              { icon: "🍽️",label: "Open Restaurants",    value: dashboard?.stats?.open_restaurants ?? 0, change: "Live", bg: "#fef2f2" },
            ].map((s, i) => (
              <div key={i} className="stat-card">
                <div className="stat-top">
                  <div className="stat-icon" style={{ background: s.bg }}>{s.icon}</div>
                  <span className="stat-change up">{s.change}</span>
                </div>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="two-col">

            {/* Pending Verifications */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">⏳ Pending Driver Verifications</div>
                <span className="pill orange">{dashboard?.pendingVerifications?.length || 0} Pending</span>
              </div>
              <div className="card-body">
                {dashboard?.pendingVerifications?.length ? (
                  dashboard.pendingVerifications.map((v) => (
                    <div key={v.user_id} className="list-item">
                      <div className="list-avatar" style={{ background: "#dcfce7", fontSize: 18 }}>
                        🚗
                      </div>
                      <div className="list-info">
                        <div className="list-name">{v.name}</div>
                        <div className="list-sub">{v.licence_id || "License"} · {new Date(v.created_at).toLocaleString()}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => updateDriverVerification(v.user_id, true)}
                          style={{ padding: "5px 10px", background: "#22c55e", color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => updateDriverVerification(v.user_id, false)}
                          style={{ padding: "5px 10px", background: "#ef4444", color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: "14px 20px", color: "var(--text-light)" }}>No pending verifications.</div>
                )}
              </div>
            </div>

            {/* Recent Registrations */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">👥 Recent Registrations</div>
                <span className="card-action">View All</span>
              </div>
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Role</th><th>Joined</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {dashboard?.recentUsers?.length ? (
                    dashboard.recentUsers.map((u) => (
                      <tr key={u.user_id}>
                        <td style={{ fontWeight: 600 }}>{u.name || "User"}</td>
                        <td>
                          <span className="pill blue">{u.roles || "Unassigned"}</span>
                        </td>
                        <td style={{ color: "var(--text-light)", fontSize: 12 }}>{new Date(u.created_at).toLocaleDateString()}</td>
                        <td><span className={`pill ${u.active ? "green" : "gray"}`}>{u.active ? "Active" : "Inactive"}</span></td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ padding: 12, color: "var(--text-light)" }}>No recent registrations.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>

          {/* Promos + Payments */}
          <div className="two-col" style={{ marginTop: 16 }}>

            <div className="card">
              <div className="card-header">
                <div className="card-title">🎟️ Active Promos</div>
                <span className="card-action">+ New Promo</span>
              </div>
              <table className="table">
                <thead><tr><th>Code</th><th>Discount</th><th>Expiry</th><th>Status</th></tr></thead>
                <tbody>
                  {dashboard?.activePromotions?.length ? (
                    dashboard.activePromotions.map((p) => (
                      <tr key={p.promo_id}>
                        <td><code style={{ background: "#f5f5f0", padding: "2px 6px", borderRadius: 4, fontSize: 12 }}>{p.code}</code></td>
                        <td style={{ fontWeight: 700, color: "var(--accent)" }}>৳ {p.discount_amount}</td>
                        <td style={{ fontSize: 12, color: "var(--text-light)" }}>{p.expiration_date ? new Date(p.expiration_date).toLocaleDateString() : "No expiry"}</td>
                        <td><span className="pill green">Active</span></td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ padding: 12, color: "var(--text-light)" }}>No active promos.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title">💳 Payment Overview</div></div>
              <div className="card-body">
                {dashboard?.paymentsOverview?.length ? (
                  dashboard.paymentsOverview.map((p, i) => (
                    <div key={`${p.method}-${i}`} style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{p.method}</div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>৳ {p.amount}</div>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: "100%", background: "var(--accent)" }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: "14px 20px", color: "var(--text-light)" }}>No payment data today.</div>
                )}
              </div>
            </div>

          </div>
        </>
      )}
    </Layout>
  );
}

export default AdminDashboard;
