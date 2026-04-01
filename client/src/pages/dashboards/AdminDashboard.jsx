import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Layout from "./Layout";

const nav = [
  { id: "dashboard", icon: "⌂",  label: "Dashboard", path: "/dashboard/admin" },
  { type: "section", id: "s1",   label: "Verifications" },
  { id: "drivers",   icon: "🚗", label: "Drivers", path: "/dashboard/admin/drivers" },
  { id: "restaurants", icon:"🍽️", label: "Restaurants", path: "/dashboard/admin/restaurants" },
  { type: "section", id: "s2",   label: "Management" },
  { id: "promos",    icon: "🎟️", label: "Promos", path: "/dashboard/admin/promos" },
  { id: "reports",   icon: "📊", label: "Reports", path: "/dashboard/admin/reports" },
];

function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
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

  const adminDisplayName = useMemo(() => {
    const fullName = String(user?.full_name || "").trim();
    if (fullName) return fullName;

    const first = String(user?.first_name || "").trim();
    const last = String(user?.last_name || "").trim();
    const combined = `${first} ${last}`.trim();
    if (combined) return combined;

    return "Admin";
  }, [user]);

  // Derive activeSection from URL (like driver dashboard)
  const activeSection = useMemo(() => {
    const path = location.pathname.toLowerCase();
    if (path.includes("/admin/drivers")) return "drivers";
    if (path.includes("/admin/restaurants")) return "restaurants";
    if (path.includes("/admin/promos")) return "promos";
    if (path.includes("/admin/reports")) return "reports";
    return "dashboard";
  }, [location.pathname]);

  const getHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",

  }), [token]);
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
  }, [navigate, token, user?.user_id, getHeaders]);

  // 15-second auto-refresh (like driver dashboard)
  useEffect(() => {
    const refreshId = setInterval(async () => {
      if (!user?.user_id) return;
      try {
        const response = await fetch(`http://localhost:5000/api/admin/dashboard/${user.user_id}`, {
          headers: getHeaders(),
          credentials: "include",
        });
        const data = await response.json();
        if (response.ok && data?.success) {
          setDashboard(data.data);
        }
      } catch (err) {
        // Silent refresh - don't show errors
      }
    }, 15000);

    return () => clearInterval(refreshId);
  }, [user?.user_id, getHeaders]);

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

  // Restaurant verification
  const updateRestaurantVerification = async (restaurantUserId, approved) => {
    if (!user?.user_id || !restaurantUserId) return;

    try {
      setActionMessage("");
      const response = await fetch(`http://localhost:5000/api/admin/restaurants/${restaurantUserId}/verify`, {
        method: "PATCH",
        headers: getHeaders(),
        credentials: "include",
        body: JSON.stringify({ approved }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to update verification.");
      }

      setActionMessage(data.message || "Restaurant verification updated.");
        setDashboard((prev) => prev ? {
          ...prev,
          pendingRestaurantVerifications: prev.pendingRestaurantVerifications.filter((r) => r.user_id !== restaurantUserId),
        } : prev);
    } catch (err) {
      setActionMessage(err.message || "Unable to update verification.");
    }
  };

  return (
    <Layout role="Admin" navItems={nav} userName={adminDisplayName}>

      {loading && <div className="section-label">Loading dashboard...</div>}
      {!!error && <div className="section-label" style={{ color: "var(--red)" }}>{error}</div>}
      {!!actionMessage && <div className="section-label">{actionMessage}</div>}

      {!loading && !error && dashboard && (
        <>
          {/* DASHBOARD TAB */}
          {activeSection === "dashboard" && (
            <>
              {/* Platform Stats */}
              <div className="stats-grid">
                {[
                  { icon: "👥", label: "Total Users",        value: dashboard?.stats?.total_users ?? 0, change: "Total", bg: "#eff6ff" },
                  { icon: "🚗", label: "Active Rides",        value: dashboard?.stats?.active_rides ?? 0, change: "Live now",  bg: "#fff7ed" },
                  { icon: "📦", label: "Orders Today",        value: dashboard?.stats?.orders_today ?? 0, change: "Today", bg: "#f0fdf4" },
                  { icon: "💰", label: "Revenue Today",       value: `৳ ${dashboard?.stats?.revenue_today ?? 0}`, change: "Today", bg: "#faf5ff" },
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

          {/* DRIVERS TAB */}
          {activeSection === "drivers" && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">🚗 Driver Verification</div>
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
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => updateDriverVerification(v.user_id, false)}
                          style={{ padding: "5px 10px", background: "#ef4444", color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: "14px 20px", color: "var(--text-light)" }}>No pending driver verifications.</div>
                )}
              </div>
            </div>
          )}

          {/* RESTAURANTS TAB */}
          {activeSection === "restaurants" && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">🍽️ Restaurant Verification</div>
              </div>
              <div className="card-body">
                  {!dashboard?.pendingRestaurantVerifications ? (
                  <div style={{ padding: "14px 20px", color: "var(--text-light)" }}>Loading restaurants...</div>
                  ) : dashboard.pendingRestaurantVerifications?.length ? (
                    dashboard.pendingRestaurantVerifications.map((r) => (
                    <div key={r.user_id} className="list-item">
                      <div className="list-avatar" style={{ background: "#fef3c7", fontSize: 18 }}>
                        🍽️
                      </div>
                      <div className="list-info">
                        <div className="list-name">{r.name}</div>
                          <div className="list-sub">{r.manager_name || r.name || "Manager"} · {new Date(r.created_at).toLocaleString()}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => updateRestaurantVerification(r.user_id, true)}
                          style={{ padding: "5px 10px", background: "#22c55e", color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => updateRestaurantVerification(r.user_id, false)}
                          style={{ padding: "5px 10px", background: "#ef4444", color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: "14px 20px", color: "var(--text-light)" }}>No pending restaurant verifications.</div>
                )}
              </div>
            </div>
          )}

          {/* PROMOS TAB */}
          {activeSection === "promos" && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">🎟️ Manage Promos</div>
                <span className="card-action">+ Create New</span>
              </div>
              <table className="table">
                <thead><tr><th>Code</th><th>Discount</th><th>Expiry</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {dashboard?.activePromotions?.length ? (
                    dashboard.activePromotions.map((p) => (
                      <tr key={p.promo_id}>
                        <td><code style={{ background: "#f5f5f0", padding: "2px 6px", borderRadius: 4, fontSize: 12 }}>{p.code}</code></td>
                        <td style={{ fontWeight: 700, color: "var(--accent)" }}>৳ {p.discount_amount}</td>
                        <td style={{ fontSize: 12, color: "var(--text-light)" }}>{p.expiration_date ? new Date(p.expiration_date).toLocaleDateString() : "No expiry"}</td>
                        <td><span className="pill green">Active</span></td>
                        <td>
                          <button style={{ padding: "3px 8px", background: "#3b82f6", color: "white", border: "none", borderRadius: 4, fontSize: 11, cursor: "pointer" }}>Edit</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: 12, color: "var(--text-light)" }}>No promos available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* REPORTS TAB */}
          {activeSection === "reports" && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">📊 Reports & Analytics</div>
              </div>
              <div className="card-body">
                <div style={{ padding: "20px" }}>
                  <p style={{ marginBottom: 12, fontSize: 14, fontWeight: 500 }}>Key Metrics</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                    {[
                      { label: "Total Users", value: dashboard?.stats?.total_users ?? 0 },
                      { label: "Active Rides Today", value: dashboard?.stats?.active_rides ?? 0 },
                      { label: "Orders Today", value: dashboard?.stats?.orders_today ?? 0 },
                      { label: "Revenue Today", value: `৳ ${dashboard?.stats?.revenue_today ?? 0}` },
                    ].map((metric, i) => (
                      <div key={i} style={{
                        padding: 12,
                        background: "#f9fafb",
                        borderRadius: 8,
                        border: "1px solid var(--border)"
                      }}>
                        <div style={{ fontSize: 12, color: "var(--text-light)", marginBottom: 4 }}>{metric.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 700 }}>{metric.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}

export default AdminDashboard;
