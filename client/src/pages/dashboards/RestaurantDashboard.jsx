import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "./Layout";

const API_BASE = "http://localhost:5000";

function RestaurantDashboard() {
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

  const nav = [
    { id: "home",     icon: "⌂",  label: "Dashboard", path: "/dashboard/restaurant" },
    { type: "section", id: "s1",  label: "Orders" },
    { id: "incoming", icon: "🔔", label: "Incoming Orders", badge: String(dashboard?.incomingOrders?.length || 0) },
    { id: "active",   icon: "🍳", label: "Preparing" },
    { id: "history",  icon: "🕐", label: "Order History" },
    { type: "section", id: "s2",  label: "Menu" },
    { id: "menu",     icon: "📋", label: "Menu Items" },
    { id: "additem",  icon: "➕", label: "Add Item" },
    { type: "section", id: "s3",  label: "Finance" },
    { id: "revenue",  icon: "💰", label: "Revenue" },
    { id: "payments", icon: "💳", label: "Payments" },
    { type: "section", id: "s4",  label: "Settings" },
    { id: "profile",  icon: "🏪", label: "Restaurant Profile" },
    { id: "ratings",  icon: "⭐", label: "Reviews" },
  ];

  useEffect(() => {
    const loadDashboard = async () => {
      if (!user?.user_id) {
        navigate("/login", { replace: true });
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

    loadDashboard();
  }, [navigate, token, user?.user_id]);

  return (
    <Layout
      role="Restaurant Manager"
      navItems={nav}
      userName={dashboard?.restaurant?.name || "Restaurant"}
      statusLabel="Open"
    >
      {loading && <div className="section-label">Loading dashboard...</div>}
      {!!error && <div className="section-label" style={{ color: "var(--red)" }}>{error}</div>}

      {!loading && !error && (
        <>

          {/* Quick Actions */}
          <div className="section-label">Quick Actions</div>
          <div className="quick-actions">
            {[
              { icon: "🔔", label: "New Orders",      sub: `${dashboard?.incomingOrders?.length || 0} waiting`,    color: "#fff7ed", iconBg: "#ffedd5" },
              { icon: "📋", label: "Manage Menu",      sub: `${dashboard?.topMenuItems?.length || 0} items`,     color: "#eff6ff", iconBg: "#dbeafe" },
              { icon: "➕", label: "Add Menu Item",    sub: "Quick add",    color: "#f0fdf4", iconBg: "#dcfce7" },
              { icon: "💰", label: "Today Revenue",    sub: `৳ ${dashboard?.stats?.revenue_today ?? 0}`,    color: "#faf5ff", iconBg: "#ede9fe" },
              { icon: "⭐", label: "Reviews",          sub: dashboard?.restaurant?.rating ? `${dashboard.restaurant.rating} rating` : "No ratings",   color: "#fefce8", iconBg: "#fef9c3" },
              { icon: "📊", label: "Analytics",        sub: "View reports", color: "#fef2f2", iconBg: "#fee2e2" },
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

      {/* Stats */}
          <div className="stats-grid">
            {[
              { icon: "📦", label: "Orders Today",   value: dashboard?.stats?.orders_today ?? 0,   change: "Today",   bg: "#fff7ed" },
              { icon: "💰", label: "Revenue Today",  value: `৳ ${dashboard?.stats?.revenue_today ?? 0}`, change: "Today",    bg: "#f0fdf4" },
              { icon: "⏱️", label: "Avg Prep Time",  value: `${dashboard?.stats?.avg_prep_time ?? 0} min`, change: "Daily", bg: "#eff6ff" },
              { icon: "⭐", label: "Rating",         value: dashboard?.restaurant?.rating ?? "—",    change: "Current",   bg: "#faf5ff" },
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

            {/* Incoming Orders */}
            <div>
              <div className="section-label">Incoming Orders</div>
              {dashboard?.incomingOrders?.length ? (
                dashboard.incomingOrders.map((o) => (
                  <div key={o.order_id} className="order-card">
                    <div className="order-top">
                      <div className="order-id">#{o.order_id}</div>
                      <span className={`pill ${String(o.status).toLowerCase() === "placed" ? "orange" : String(o.status).toLowerCase() === "preparing" ? "blue" : "green"}`}>
                        {o.status}
                      </span>
                    </div>
                    <div className="order-items">{o.items}</div>
                    <div className="order-bottom">
                      <div className="order-price">৳ {o.total_price}</div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <div className="order-time">{new Date(o.order_time).toLocaleTimeString()}</div>
                        <button style={{ padding: "5px 12px", background: "var(--accent)", color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          {String(o.status).toLowerCase() === "placed" ? "Accept" : String(o.status).toLowerCase() === "preparing" ? "Ready" : "Dispatch"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="order-card">No incoming orders.</div>
              )}
            </div>

            {/* Revenue + Menu */}
            <div>
              <div className="earnings-big" style={{ marginBottom: 14 }}>
                <div className="earnings-label">Today's Revenue</div>
                <div className="earnings-value">৳ {dashboard?.stats?.revenue_today ?? 0}</div>
                <div className="earnings-sub">{dashboard?.stats?.orders_today ?? 0} orders</div>
                <div className="earnings-row">
                  <div className="earnings-mini">
                    <div className="earnings-mini-label">This Week</div>
                    <div className="earnings-mini-value">৳ {dashboard?.finance?.week_revenue ?? 0}</div>
                  </div>
                  <div className="earnings-mini">
                    <div className="earnings-mini-label">Pending Pay</div>
                    <div className="earnings-mini-value">৳ {dashboard?.finance?.pending_payments ?? 0}</div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title">Top Menu Items</div>
                  <span className="card-action" onClick={() => navigate("/food-service")}>Manage Menu</span>
                </div>
                <div className="card-body">
                  {dashboard?.topMenuItems?.length ? (
                    dashboard.topMenuItems.map((item) => (
                      <div key={item.item_id} className="list-item">
                        <div className="list-avatar" style={{ background: "#fff7ed", fontSize: 18 }}>🍽️</div>
                        <div className="list-info">
                          <div className="list-name">{item.name}</div>
                          <div className="list-sub">{item.orders_count} orders · ৳ {item.price}</div>
                        </div>
                        <span className={`pill ${item.is_available ? "green" : "red"}`}>
                          {item.is_available ? "Available" : "Off"}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: "10px 20px", color: "var(--text-light)" }}>No menu stats yet.</div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </>
      )}
    </Layout>
  );
}

export default RestaurantDashboard;
