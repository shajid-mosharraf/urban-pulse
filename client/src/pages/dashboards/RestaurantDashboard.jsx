import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "./Layout";

const API_BASE = "http://localhost:5000";

function RestaurantDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [actionBusy, setActionBusy] = useState({});
  const [deliveryReady, setDeliveryReady] = useState({});
  const deliveryTimersRef = useRef({});

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const token = localStorage.getItem("accessToken");

  const loadDashboard = useCallback(async () => {
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
  }, [navigate, token, user?.user_id]);

  const handleOrderDecision = useCallback(async (order, decision) => {
    const key = `order-${order.order_id}-${decision}`;

    try {
      setActionBusy((prev) => ({ ...prev, [key]: true }));

      const response = await fetch(
        `${API_BASE}/api/restaurant/orders/${order.order_id}/decision`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          credentials: "include",
          body: JSON.stringify({ decision }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Failed to update order decision.");
      }

      setSuccess(
        decision === "accept"
          ? `Order #${order.order_id} accepted. Cooking started.`
          : `Order #${order.order_id} rejected.`
      );
      setTimeout(() => setSuccess(""), 3000);
      await loadDashboard();
    } catch (err) {
      setError(err.message || "Failed to update order decision.");
    } finally {
      setActionBusy((prev) => ({ ...prev, [key]: false }));
    }
  }, [loadDashboard, token]);

  const handleReadyForDelivery = useCallback(async (order) => {
    const key = `order-${order.order_id}-ready`;

    try {
      setActionBusy((prev) => ({ ...prev, [key]: true }));

      const response = await fetch(
        `${API_BASE}/api/restaurant/orders/${order.order_id}/ready-for-delivery`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Failed to mark order ready for delivery.");
      }

      setDeliveryReady((prev) => ({ ...prev, [order.order_id]: false }));
      setSuccess(`Order ready for delivery. ${data?.data?.drivers_notified || 0} drivers notified.`);
      setTimeout(() => setSuccess(""), 3000);
      await loadDashboard();
    } catch (err) {
      setError(err.message || "Failed to mark order ready for delivery.");
    } finally {
      setActionBusy((prev) => ({ ...prev, [key]: false }));
    }
  }, [loadDashboard, token]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const cookingOrders = (dashboard?.incomingOrders || []).filter(
      (order) => String(order.status).toLowerCase() === "cooking"
    );

    cookingOrders.forEach((order) => {
      const timerKey = String(order.order_id);

      if (deliveryReady[order.order_id] || deliveryTimersRef.current[timerKey]) {
        return;
      }

      deliveryTimersRef.current[timerKey] = setTimeout(() => {
        setDeliveryReady((prev) => ({ ...prev, [order.order_id]: true }));
        delete deliveryTimersRef.current[timerKey];
      }, 10000);
    });

    return () => {
      Object.entries(deliveryTimersRef.current).forEach(([timerKey, timerId]) => {
        clearTimeout(timerId);
        delete deliveryTimersRef.current[timerKey];
      });
    };
  }, [dashboard?.incomingOrders, deliveryReady]);

  const nav = [
    { id: "home", icon: "⌂", label: "Dashboard", path: "/dashboard/restaurant" },
    { type: "section", id: "s1", label: "Orders" },
    { id: "incoming", icon: "🔔", label: "Incoming Orders", badge: String(dashboard?.incomingOrders?.length || 0) },
    { id: "active", icon: "🍳", label: "Preparing" },
    { id: "history", icon: "🕐", label: "Order History" },
    { type: "section", id: "s2", label: "Menu" },
    { id: "menu", icon: "📋", label: "Menu Items" },
    { id: "additem", icon: "➕", label: "Add Item" },
    { type: "section", id: "s3", label: "Finance" },
    { id: "revenue", icon: "💰", label: "Revenue" },
    { id: "payments", icon: "💳", label: "Payments" },
    { type: "section", id: "s4", label: "Settings" },
    { id: "profile", icon: "🏪", label: "Restaurant Profile" },
    { id: "ratings", icon: "⭐", label: "Reviews" },
  ];

  const getStatusClass = (status) => {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "placed") return "orange";
    if (normalized === "cooking") return "blue";
    if (normalized === "ready_for_delivery") return "blue";
    if (normalized === "on_the_way") return "green";
    if (normalized === "delivered") return "green";
    if (normalized === "rejected") return "red";
    return "gray";
  };

  return (
    <Layout
      role="Restaurant Manager"
      navItems={nav}
      userName={dashboard?.restaurant?.name || "Restaurant"}
      statusLabel="Open"
    >
      {loading && <div className="section-label">Loading dashboard...</div>}
      {!!error && <div className="section-label" style={{ color: "var(--red)" }}>{error}</div>}
      {!!success && <div className="section-label" style={{ color: "#16a34a" }}>{success}</div>}

      {!loading && !error && (
        <>
          <div className="section-label">Quick Actions</div>
          <div className="quick-actions">
            {[
              { 
                icon: "🔔", 
                label: "New Orders", 
                sub: `${dashboard?.incomingOrders?.length || 0} waiting`, 
                color: "#fff7ed", 
                iconBg: "#ffedd5",
                onClick: () => window.scrollTo({ top: document.querySelector('.two-col')?.offsetTop || 0, behavior: 'smooth' })
              },
              { 
                icon: "📋", 
                label: "Manage Menu", 
                sub: `${dashboard?.topMenuItems?.length || 0} items`, 
                color: "#eff6ff", 
                iconBg: "#dbeafe",
                onClick: () => navigate("/restaurant-menu")
              },
              { 
                icon: "➕", 
                label: "Add Menu Item", 
                sub: "Quick add", 
                color: "#f0fdf4", 
                iconBg: "#dcfce7",
                onClick: () => navigate("/restaurant-menu")
              },
              { 
                icon: "💰", 
                label: "Today Revenue", 
                sub: `৳ ${dashboard?.stats?.revenue_today ?? 0}`, 
                color: "#faf5ff", 
                iconBg: "#ede9fe",
                onClick: () => window.alert(`Today's Revenue: ৳${dashboard?.stats?.revenue_today || 0}\nOrders: ${dashboard?.stats?.orders_today || 0}\nAvg Prep Time: ${dashboard?.stats?.avg_prep_time || 0} min`)
              },
              { 
                icon: "⭐", 
                label: "Reviews", 
                sub: dashboard?.restaurant?.rating ? `${dashboard.restaurant.rating} rating` : "No ratings", 
                color: "#fefce8", 
                iconBg: "#fef9c3",
                onClick: () => window.alert("Review analytics coming soon!")
              },
              { 
                icon: "📊", 
                label: "Analytics", 
                sub: "View reports", 
                color: "#fef2f2", 
                iconBg: "#fee2e2",
                onClick: () => window.alert("Analytics dashboard coming soon!")
              },
            ].map((a, i) => (
              <button
                key={i}
                type="button"
                onClick={a.onClick}
                className="action-card"
                style={{ 
                  background: a.color,
                  border: "none",
                  cursor: "pointer",
                  padding: 16,
                  borderRadius: 8,
                  marginBottom: 0
                }}
              >
                <div className="action-icon" style={{ background: a.iconBg }}>{a.icon}</div>
                <div>
                  <div className="action-label">{a.label}</div>
                  <div className="action-sub">{a.sub}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="stats-grid">
            {[
              { icon: "📦", label: "Orders Today", value: dashboard?.stats?.orders_today ?? 0, change: "Today", bg: "#fff7ed" },
              { icon: "💰", label: "Revenue Today", value: `৳ ${dashboard?.stats?.revenue_today ?? 0}`, change: "Today", bg: "#f0fdf4" },
              { icon: "⏱️", label: "Avg Prep Time", value: `${dashboard?.stats?.avg_prep_time ?? 0} min`, change: "Daily", bg: "#eff6ff" },
              { icon: "⭐", label: "Rating", value: dashboard?.restaurant?.rating ?? "—", change: "Current", bg: "#faf5ff" },
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
            <div>
              <div className="section-label">Incoming Orders</div>
              {dashboard?.incomingOrders?.length ? (
                dashboard.incomingOrders.map((o) => {
                  const status = String(o.status).toLowerCase();
                  const readyKey = `order-${o.order_id}-ready`;
                  const readyButtonEnabled = Boolean(deliveryReady[o.order_id]);

                  return (
                    <div key={o.order_id} className="order-card">
                      <div className="order-top">
                        <div className="order-id">#{o.order_id}</div>
                        <span className={`pill ${getStatusClass(o.status)}`}>
                          {status === "placed"
                            ? "Placed"
                            : status === "cooking"
                              ? "Cooking"
                              : status === "ready_for_delivery"
                                ? "Ready for Driver"
                                : status === "on_the_way"
                                  ? "On the way"
                                  : status === "delivered"
                                    ? "Delivered"
                                    : o.status}
                        </span>
                      </div>
                      <div className="order-items">{o.items}</div>
                      <div className="order-bottom">
                        <div className="order-price">৳ {o.total_price}</div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          <div className="order-time">{new Date(o.order_time).toLocaleTimeString()}</div>
                          {status === "placed" && (
                            <button
                              type="button"
                              onClick={() => handleOrderDecision(o, "accept")}
                              disabled={actionBusy[`order-${o.order_id}-accept`] || actionBusy[`order-${o.order_id}-reject`]}
                              style={{ padding: "5px 12px", background: "#16a34a", color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", opacity: actionBusy[`order-${o.order_id}-accept`] ? 0.7 : 1 }}
                            >
                              {actionBusy[`order-${o.order_id}-accept`] ? "Saving..." : "Accept"}
                            </button>
                          )}
                          {status === "cooking" && !readyButtonEnabled && (
                            <span className="pill blue">Delivery available in 10 sec</span>
                          )}
                          {status === "cooking" && readyButtonEnabled && (
                            <button
                              type="button"
                              onClick={() => handleReadyForDelivery(o)}
                              disabled={actionBusy[readyKey]}
                              style={{ padding: "5px 12px", background: "#0891b2", color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: actionBusy[readyKey] ? "default" : "pointer", opacity: actionBusy[readyKey] ? 0.7 : 1 }}
                            >
                              {actionBusy[readyKey] ? "Sending..." : "Ready for Delivery"}
                            </button>
                          )}
                          {status === "ready_for_delivery" && (
                            <span className="pill blue">Waiting for Driver Accept</span>
                          )}
                          {status === "on_the_way" && (
                            <span className="pill green">On the way</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="order-card">No incoming orders.</div>
              )}
            </div>

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
                  <span className="card-action" onClick={() => navigate("/restaurant-menu")}>Manage Menu</span>
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