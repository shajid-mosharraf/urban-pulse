import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Layout from "./Layout";

const API_BASE = "http://localhost:5000";
const socket = io("http://localhost:5000");

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

function DriverDashboard() {
  const navigate = useNavigate();
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [pickupOtp, setPickupOtp] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const token = localStorage.getItem("accessToken");

  const nav = [
    { id: "home", icon: "⌂", label: "Dashboard", path: "/dashboard/driver" },
    { type: "section", id: "s1", label: "Rides" },
    { id: "requests", icon: "🔔", label: "Ride Requests", badge: String(dashboard?.incomingRequests?.length || 0) },
    { id: "active", icon: "🚗", label: "Active Ride" },
    { id: "history", icon: "🕐", label: "Trip History" },
    { type: "section", id: "s2", label: "Finance" },
    { id: "earnings", icon: "💰", label: "Earnings" },
    { id: "wallet", icon: "💳", label: "Wallet" },
    { type: "section", id: "s3", label: "Profile" },
    { id: "vehicle", icon: "🚙", label: "My Vehicle" },
    { id: "docs", icon: "📄", label: "Documents" },
    { id: "ratings", icon: "⭐", label: "My Rating" },
  ];

  const loadDashboard = async () => {
    if (!user?.user_id) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/driver/dashboard/${user.user_id}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        credentials: "include",
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to load driver dashboard.");
      }

      setDashboard(data.data);
      setOnline(Boolean(data.data?.user?.active_status));
      setError("");
    } catch (err) {
      setError(err.message || "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [navigate, token, user?.user_id]);

  useEffect(() => {
    const activeRideId = dashboard?.activeRide?.ride_id;
    if (activeRideId) {
      socket.emit("join_ride_room", activeRideId);
    }

    const onRideCancelled = (payload = {}) => {
      if (Number(payload.ride_id) !== Number(activeRideId)) return;
      setActionMessage("Customer cancelled the ride.");
      setDashboard((prev) => (prev ? { ...prev, activeRide: null } : prev));
      setMessages([]);
    };

    const onRidePickedUp = (payload = {}) => {
      if (Number(payload.ride_id) !== Number(activeRideId)) return;
      setDashboard((prev) => prev ? { ...prev, activeRide: { ...(prev.activeRide || {}), status: payload.status || "in_progress" } } : prev);
    };

    const onRideDriverCompleted = (payload = {}) => {
      if (Number(payload.ride_id) !== Number(activeRideId)) return;
      setDashboard((prev) => prev ? {
        ...prev,
        activeRide: {
          ...(prev.activeRide || {}),
          status: payload.status || "driver_completed",
          completion_otp: payload.completion_otp || prev.activeRide?.completion_otp,
        },
      } : prev);
    };

    const onRideCompleted = (payload = {}) => {
      if (Number(payload.ride_id) !== Number(activeRideId)) return;
      setActionMessage("Ride completed by customer confirmation.");
      setDashboard((prev) => (prev ? { ...prev, activeRide: null } : prev));
      setMessages([]);
    };

    const onReceiveMessage = (payload = {}) => {
      if (Number(payload.ride_id) !== Number(activeRideId)) return;
      setMessages((prev) => [...prev, payload]);
    };

    socket.on("ride_cancelled", onRideCancelled);
    socket.on("ride_picked_up", onRidePickedUp);
    socket.on("ride_driver_completed", onRideDriverCompleted);
    socket.on("ride_completed", onRideCompleted);
    socket.on("receive_message", onReceiveMessage);

    return () => {
      socket.off("ride_cancelled", onRideCancelled);
      socket.off("ride_picked_up", onRidePickedUp);
      socket.off("ride_driver_completed", onRideDriverCompleted);
      socket.off("ride_completed", onRideCompleted);
      socket.off("receive_message", onReceiveMessage);
    };
  }, [dashboard?.activeRide?.ride_id]);

  const updateStatus = async (nextStatus) => {
    if (!user?.user_id) return;
    try {
      setActionMessage("");
      const response = await fetch(`${API_BASE}/api/driver/${user.user_id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        credentials: "include",
        body: JSON.stringify({ is_online: nextStatus }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to update status.");
      }
      setOnline(nextStatus);
      setActionMessage("Status updated.");
    } catch (err) {
      setActionMessage(err.message || "Unable to update status.");
    }
  };

  const acceptRide = async (rideId) => {
    if (!user?.user_id) return;
    try {
      setActionMessage("");
      const response = await fetch(`${API_BASE}/api/driver/${user.user_id}/rides/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        credentials: "include",
        body: JSON.stringify({ ride_id: rideId }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to accept ride.");
      }
      setActionMessage("Ride accepted.");
      await loadDashboard();
    } catch (err) {
      setActionMessage(err.message || "Unable to accept ride.");
    }
  };

  const declineRide = async (rideId) => {
    if (!user?.user_id) return;
    try {
      setActionMessage("");
      const response = await fetch(`${API_BASE}/api/driver/${user.user_id}/rides/decline`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        credentials: "include",
        body: JSON.stringify({ ride_id: rideId }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to decline ride.");
      }
      setActionMessage("Ride declined.");
      await loadDashboard();
    } catch (err) {
      setActionMessage(err.message || "Unable to decline ride.");
    }
  };

  const startRide = async () => {
    if (!user?.user_id || !dashboard?.activeRide?.ride_id) return;
    try {
      setActionMessage("");
      const response = await fetch(`${API_BASE}/api/driver/${user.user_id}/rides/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        credentials: "include",
        body: JSON.stringify({ ride_id: dashboard.activeRide.ride_id, pickup_otp: pickupOtp }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to start ride.");
      }
      setActionMessage("Ride picked up successfully.");
      setPickupOtp("");
      setDashboard((prev) => prev ? { ...prev, activeRide: { ...(prev.activeRide || {}), status: data?.data?.status || "in_progress" } } : prev);
    } catch (err) {
      setActionMessage(err.message || "Unable to start ride.");
    }
  };

  const endRide = async () => {
    if (!user?.user_id || !dashboard?.activeRide?.ride_id) return;
    try {
      setActionMessage("");
      const response = await fetch(`${API_BASE}/api/driver/${user.user_id}/rides/end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        credentials: "include",
        body: JSON.stringify({ ride_id: dashboard.activeRide.ride_id }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to end ride.");
      }
      setActionMessage("Waiting for customer completion confirmation.");
      setDashboard((prev) => prev ? {
        ...prev,
        activeRide: {
          ...(prev.activeRide || {}),
          status: data?.data?.status || "driver_completed",
          completion_otp: data?.data?.completion_otp || prev.activeRide?.completion_otp,
        },
      } : prev);
    } catch (err) {
      setActionMessage(err.message || "Unable to end ride.");
    }
  };

  const sendMessage = () => {
    if (!chatInput || !dashboard?.activeRide?.ride_id || !user?.user_id) return;
    socket.emit("send_message", {
      ride_id: dashboard.activeRide.ride_id,
      sender_id: user.user_id,
      sender_role: "driver",
      text: chatInput,
    });
    setChatInput("");
  };

  const canShowMap =
    Number.isFinite(dashboard?.activeRide?.pickup_latitude) &&
    Number.isFinite(dashboard?.activeRide?.pickup_longitude) &&
    Number.isFinite(dashboard?.activeRide?.dropoff_latitude) &&
    Number.isFinite(dashboard?.activeRide?.dropoff_longitude);

  const rideStatus = String(dashboard?.activeRide?.status || "").toLowerCase();

  return (
    <Layout
      role="Driver"
      navItems={nav}
      userName={dashboard?.user?.full_name || "Driver"}
      statusLabel={online ? "Online" : "Offline"}
    >
      {loading && <div className="section-label">Loading dashboard...</div>}
      {!!error && <div className="section-label" style={{ color: "var(--red)" }}>{error}</div>}
      {actionMessage && <div className="section-label">{actionMessage}</div>}

      {!loading && !error && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="toggle-row">
              <div>
                <div className="toggle-label">Driver Status</div>
                <div className="toggle-sub">
                  {online ? "You are visible to customers" : "You are hidden from customers"}
                </div>
              </div>
              <div className={`toggle ${online ? "on" : ""}`} onClick={() => updateStatus(!online)} />
            </div>
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-header">
              <div className="card-title">Incoming Requests</div>
              <span className="pill orange">{dashboard?.incomingRequests?.length || 0} New</span>
            </div>
            <div className="card-body">
              {dashboard?.incomingRequests?.length ? (
                dashboard.incomingRequests.map((r) => (
                  <div key={r.ride_id} style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{r.pickup} → {r.dropoff}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>৳ {r.initial_fare}</div>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-light)", marginBottom: 10 }}>
                      {r.distance_km} km · {r.service_type}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={{ flex: 1, padding: "8px", background: "var(--accent)", color: "white", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 12 }} onClick={() => acceptRide(r.ride_id)}>
                        Accept
                      </button>
                      <button style={{ flex: 1, padding: "8px", background: "var(--content-bg)", color: "var(--text-mid)", border: "1px solid var(--border)", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 12 }} onClick={() => declineRide(r.ride_id)}>
                        Decline
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: "14px 20px", color: "var(--text-light)" }}>No incoming requests.</div>
              )}
            </div>
          </div>

          {dashboard?.activeRide && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-header">
                <div className="card-title">Active Ride</div>
                <span className="pill blue">{dashboard.activeRide.status}</span>
              </div>
              <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{dashboard.activeRide.pickup} → {dashboard.activeRide.dropoff}</div>
                <div style={{ fontSize: 12, color: "var(--text-light)" }}>Customer: {dashboard.activeRide.customer_name || "Customer"}</div>

                {canShowMap && (
                  <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)" }}>
                    <MapContainer center={[dashboard.activeRide.pickup_latitude, dashboard.activeRide.pickup_longitude]} zoom={13} style={{ height: 220, width: "100%" }}>
                      <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution='&copy; OpenStreetMap contributors &copy; CARTO' />
                      <Marker position={[dashboard.activeRide.pickup_latitude, dashboard.activeRide.pickup_longitude]}>
                        <Popup>Pickup: {dashboard.activeRide.pickup}</Popup>
                      </Marker>
                      <Marker position={[dashboard.activeRide.dropoff_latitude, dashboard.activeRide.dropoff_longitude]}>
                        <Popup>Dropoff: {dashboard.activeRide.dropoff}</Popup>
                      </Marker>
                      <Polyline
                        positions={[
                          [dashboard.activeRide.pickup_latitude, dashboard.activeRide.pickup_longitude],
                          [dashboard.activeRide.dropoff_latitude, dashboard.activeRide.dropoff_longitude],
                        ]}
                        pathOptions={{ color: "#f97316", weight: 4 }}
                      />
                    </MapContainer>
                  </div>
                )}

                {(rideStatus === "accepted" || rideStatus === "driver_assigned") && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      value={pickupOtp}
                      onChange={(e) => setPickupOtp(e.target.value)}
                      placeholder="Pickup OTP"
                      style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid var(--border)" }}
                    />
                    <button style={{ padding: "8px 12px", background: "var(--accent)", color: "white", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }} onClick={startRide}>
                      OTP Check & Pick Up
                    </button>
                  </div>
                )}

                {rideStatus === "in_progress" && (
                  <button style={{ width: 180, padding: "8px 12px", background: "var(--content-bg)", color: "var(--text-mid)", border: "1px solid var(--border)", borderRadius: 8, fontWeight: 600, cursor: "pointer" }} onClick={endRide}>
                    Complete Ride
                  </button>
                )}

                {rideStatus === "driver_completed" && dashboard.activeRide.completion_otp && (
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    Completion OTP: {dashboard.activeRide.completion_otp}
                  </div>
                )}

                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Chat with Customer</div>
                  <div style={{ height: 150, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                    {messages.length ? messages.map((msg, i) => (
                      <div
                        key={`${msg.timestamp || i}-${i}`}
                        style={{
                          alignSelf: msg.sender_role === "driver" ? "flex-end" : "flex-start",
                          background: msg.sender_role === "driver" ? "#f97316" : "#f5f5f0",
                          color: msg.sender_role === "driver" ? "white" : "#111",
                          borderRadius: 10,
                          padding: "5px 10px",
                          maxWidth: "75%",
                          fontSize: 12,
                        }}
                      >
                        {msg.text}
                      </div>
                    )) : (
                      <div style={{ color: "var(--text-light)", fontSize: 12 }}>No messages yet.</div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type message..." style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid var(--border)" }} />
                    <button onClick={sendMessage} style={{ padding: "8px 12px", background: "var(--accent)", color: "white", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
                      Send
                    </button>
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

export default DriverDashboard;
