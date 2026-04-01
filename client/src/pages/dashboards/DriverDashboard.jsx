import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  const location = useLocation();

  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [pickupOtp, setPickupOtp] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [profileData, setProfileData] = useState(null);
  const [walletData, setWalletData] = useState(null);
  const [ratingsData, setRatingsData] = useState(null);
  const [profileAddresses, setProfileAddresses] = useState([]);
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [licenseFile, setLicenseFile] = useState(null);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [ratingDrafts, setRatingDrafts] = useState({});
  const [ratingSaving, setRatingSaving] = useState({});

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const token = localStorage.getItem("accessToken");

  const activeSection = useMemo(() => {
    const path = location.pathname.toLowerCase();
    if (path.includes("/dashboard/driver/requests")) return "requests";
    if (path.includes("/dashboard/driver/active")) return "active";
    if (path.includes("/dashboard/driver/history")) return "history";
    if (path.includes("/dashboard/driver/earnings")) return "earnings";
    if (path.includes("/dashboard/driver/wallet")) return "wallet";
    if (path.includes("/dashboard/driver/vehicle")) return "vehicle";
    if (path.includes("/dashboard/driver/documents")) return "docs";
    if (path.includes("/dashboard/driver/ratings")) return "ratings";
    if (path.includes("/dashboard/driver/profile")) return "profile";
    return "home";
  }, [location.pathname]);

  const nav = useMemo(
    () => [
      { id: "home", icon: "⌂", label: "Dashboard", path: "/dashboard/driver" },
      { type: "section", id: "s1", label: "Rides" },
      { id: "requests", icon: "🔔", label: "Ride Requests", badge: String(dashboard?.incomingRequests?.length || 0), path: "/dashboard/driver/requests" },
      { id: "active", icon: "🚗", label: "Active Ride", path: "/dashboard/driver/active" },
      { id: "history", icon: "🕐", label: "Trip History", path: "/dashboard/driver/history" },
      { type: "section", id: "s2", label: "Finance" },
      { id: "earnings", icon: "💰", label: "Earnings", path: "/dashboard/driver/earnings" },
      { id: "wallet", icon: "💳", label: "Wallet", path: "/dashboard/driver/wallet" },
      { type: "section", id: "s3", label: "Profile" },
      { id: "vehicle", icon: "🚙", label: "My Vehicle", path: "/dashboard/driver/vehicle" },
      { id: "docs", icon: "📄", label: "Documents", path: "/dashboard/driver/documents" },
      { id: "ratings", icon: "⭐", label: "My Rating", path: "/dashboard/driver/ratings" },
      { id: "profile", icon: "👤", label: "Profile", path: "/dashboard/driver/profile" },
    ],
    [dashboard?.incomingRequests?.length]
  );

  const profileMenuItems = [
    { id: "pm-profile", icon: "👤", label: "My Profile", path: "/dashboard/driver/profile" },
    { id: "pm-ratings", icon: "⭐", label: "My Rating", path: "/dashboard/driver/ratings" },
    { id: "pm-vehicle", icon: "🚙", label: "Vehicle", path: "/dashboard/driver/vehicle" },
  ];

  const getHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    }),
    [token]
  );

  const loadDashboard = useCallback(
    async ({ silent = false } = {}) => {
      if (!user?.user_id) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        if (!silent) {
          setLoading(true);
        }

        const response = await fetch(`${API_BASE}/api/driver/dashboard/${user.user_id}`, {
          headers: getHeaders(),
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
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [getHeaders, navigate, user?.user_id]
  );

  const loadProfile = useCallback(async () => {
    if (!user?.user_id) return;
    const response = await fetch(`${API_BASE}/api/account/${user.user_id}/profile`, {
      headers: getHeaders(),
      credentials: "include",
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || "Unable to load profile.");
    }
    setProfileData(data.data?.user || null);
    setProfileAddresses(data.data?.savedAddresses || []);
  }, [getHeaders, user?.user_id]);

  const loadWallet = useCallback(async () => {
    if (!user?.user_id) return;
    const response = await fetch(`${API_BASE}/api/account/${user.user_id}/wallet`, {
      headers: getHeaders(),
      credentials: "include",
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || "Unable to load wallet.");
    }
    setWalletData(data.data);
  }, [getHeaders, user?.user_id]);

  const loadRatings = useCallback(async () => {
    if (!user?.user_id) return;
    const response = await fetch(`${API_BASE}/api/account/${user.user_id}/ratings`, {
      headers: getHeaders(),
      credentials: "include",
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || "Unable to load ratings.");
    }
    setRatingsData(data.data);
  }, [getHeaders, user?.user_id]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!user?.user_id) return;

    const refreshId = setInterval(() => {
      loadDashboard({ silent: true });
    }, 15000);

    return () => clearInterval(refreshId);
  }, [loadDashboard, user?.user_id]);

  useEffect(() => {
    const loadSectionData = async () => {
      try {
        if (activeSection === "profile") {
          await loadProfile();
        } else if (activeSection === "wallet") {
          await loadWallet();
        } else if (activeSection === "ratings") {
          await loadRatings();
        }
      } catch (err) {
        setActionMessage(err.message || "Unable to load this section.");
      }
    };

    loadSectionData();
  }, [activeSection, loadProfile, loadRatings, loadWallet]);

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
      loadDashboard({ silent: true });
    };

    const onRidePickedUp = (payload = {}) => {
      if (Number(payload.ride_id) !== Number(activeRideId)) return;
      setDashboard((prev) =>
        prev
          ? {
              ...prev,
              activeRide: {
                ...(prev.activeRide || {}),
                status: payload.status || "in_progress",
              },
            }
          : prev
      );
    };

    const onRideDriverCompleted = (payload = {}) => {
      if (Number(payload.ride_id) !== Number(activeRideId)) return;
      setDashboard((prev) =>
        prev
          ? {
              ...prev,
              activeRide: {
                ...(prev.activeRide || {}),
                status: payload.status || "driver_completed",
                completion_otp: payload.completion_otp || prev.activeRide?.completion_otp,
              },
            }
          : prev
      );
    };

    const onRideCompleted = (payload = {}) => {
      if (Number(payload.ride_id) !== Number(activeRideId)) return;
      setActionMessage("Ride completed by customer confirmation.");
      setDashboard((prev) => (prev ? { ...prev, activeRide: null } : prev));
      setMessages([]);
      loadDashboard({ silent: true });
    };

    const onReceiveMessage = (payload = {}) => {
      if (Number(payload.ride_id) !== Number(activeRideId)) return;
      setMessages((prev) => [...prev, payload]);
    };

    const onNewRideRequest = () => {
      loadDashboard({ silent: true });
    };

    socket.on("new_ride_request", onNewRideRequest);
    socket.on("ride_cancelled", onRideCancelled);
    socket.on("ride_picked_up", onRidePickedUp);
    socket.on("ride_driver_completed", onRideDriverCompleted);
    socket.on("ride_completed", onRideCompleted);
    socket.on("receive_message", onReceiveMessage);

    return () => {
      socket.off("new_ride_request", onNewRideRequest);
      socket.off("ride_cancelled", onRideCancelled);
      socket.off("ride_picked_up", onRidePickedUp);
      socket.off("ride_driver_completed", onRideDriverCompleted);
      socket.off("ride_completed", onRideCompleted);
      socket.off("receive_message", onReceiveMessage);
    };
  }, [dashboard?.activeRide?.ride_id, loadDashboard]);

  const updateStatus = async (nextStatus) => {
    if (!user?.user_id) return;
    try {
      setActionMessage("");
      const response = await fetch(`${API_BASE}/api/driver/${user.user_id}/status`, {
        method: "PATCH",
        headers: getHeaders(),
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
        headers: getHeaders(),
        credentials: "include",
        body: JSON.stringify({ ride_id: rideId }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to accept ride.");
      }
      setActionMessage("Ride accepted.");
      navigate("/dashboard/driver/active");
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
        headers: getHeaders(),
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
        headers: getHeaders(),
        credentials: "include",
        body: JSON.stringify({ ride_id: dashboard.activeRide.ride_id, pickup_otp: pickupOtp }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to start ride.");
      }
      setActionMessage("Ride picked up successfully.");
      setPickupOtp("");
      setDashboard((prev) =>
        prev
          ? {
              ...prev,
              activeRide: {
                ...(prev.activeRide || {}),
                status: data?.data?.status || "in_progress",
              },
            }
          : prev
      );
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
        headers: getHeaders(),
        credentials: "include",
        body: JSON.stringify({ ride_id: dashboard.activeRide.ride_id }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to end ride.");
      }
      setActionMessage("Waiting for customer completion confirmation.");
      setDashboard((prev) =>
        prev
          ? {
              ...prev,
              activeRide: {
                ...(prev.activeRide || {}),
                status: data?.data?.status || "driver_completed",
                completion_otp: data?.data?.completion_otp || prev.activeRide?.completion_otp,
              },
            }
          : prev
      );
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

  const saveProfile = async () => {
    if (!user?.user_id || !profileData) return;
    try {
      setActionMessage("");
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
        throw new Error(data?.message || "Unable to save profile.");
      }

      setActionMessage("Profile updated successfully.");
      const previous = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem(
        "user",
        JSON.stringify({
          ...previous,
          first_name: data?.data?.first_name || profileData.first_name,
          last_name: data?.data?.last_name || profileData.last_name,
        })
      );
      await loadDashboard({ silent: true });
    } catch (err) {
      setActionMessage(err.message || "Unable to save profile.");
    }
  };

  const uploadProfilePicture = async () => {
    if (!user?.user_id || !profilePictureFile) {
      setActionMessage("Select a profile picture first.");
      return;
    }

    try {
      setActionMessage("");
      const formData = new FormData();
      formData.append("profile_picture", profilePictureFile);

      const response = await fetch(`${API_BASE}/api/account/${user.user_id}/profile-picture`, {
        method: "POST",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
        credentials: "include",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to upload profile picture.");
      }

      setProfileData((prev) => ({ ...(prev || {}), profile_picture: data?.data?.profile_picture || prev?.profile_picture }));
      setProfilePictureFile(null);
      setActionMessage("Profile picture updated successfully.");
      await loadDashboard({ silent: true });
    } catch (err) {
      setActionMessage(err.message || "Unable to upload profile picture.");
    }
  };

  const uploadLicenseDocument = async () => {
    if (!user?.user_id || !licenseFile) {
      setActionMessage("Select a license document first.");
      return;
    }

    try {
      setActionMessage("");
      const formData = new FormData();
      formData.append("license_document", licenseFile);

      const response = await fetch(`${API_BASE}/api/account/${user.user_id}/license-document`, {
        method: "POST",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
        credentials: "include",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to upload license document.");
      }

      setProfileData((prev) => ({ ...(prev || {}), license_document: data?.data?.license_document || prev?.license_document }));
      setLicenseFile(null);
      setActionMessage("License document updated successfully.");
    } catch (err) {
      setActionMessage(err.message || "Unable to upload license document.");
    }
  };

  const savePassword = async () => {
    if (!user?.user_id) return;

    try {
      setActionMessage("");
      const response = await fetch(`${API_BASE}/api/account/${user.user_id}/password`, {
        method: "PUT",
        headers: getHeaders(),
        credentials: "include",
        body: JSON.stringify(passwordForm),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to update password.");
      }

      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
      setActionMessage("Password updated successfully.");
    } catch (err) {
      setActionMessage(err.message || "Unable to update password.");
    }
  };

  const setRideDraft = (rideId, patch) => {
    setRatingDrafts((prev) => ({
      ...prev,
      [rideId]: {
        score: prev[rideId]?.score || 5,
        comment: prev[rideId]?.comment || "",
        ...patch,
      },
    }));
  };

  const submitCustomerRating = async (rideId) => {
    const draft = ratingDrafts[rideId] || { score: 5, comment: "" };

    try {
      setRatingSaving((prev) => ({ ...prev, [rideId]: true }));
      setActionMessage("");

      const response = await fetch(`${API_BASE}/api/rides/${rideId}/rate`, {
        method: "POST",
        headers: getHeaders(),
        credentials: "include",
        body: JSON.stringify({
          score: Number(draft.score),
          comment: String(draft.comment || "").trim() || null,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to submit rating.");
      }

      setActionMessage(`Rating submitted for ride #${rideId}.`);
      await loadDashboard({ silent: true });
      if (activeSection === "ratings") {
        await loadRatings();
      }
    } catch (err) {
      setActionMessage(err.message || "Unable to submit rating.");
    } finally {
      setRatingSaving((prev) => ({ ...prev, [rideId]: false }));
    }
  };

  const canShowMap =
    Number.isFinite(dashboard?.activeRide?.pickup_latitude) &&
    Number.isFinite(dashboard?.activeRide?.pickup_longitude) &&
    Number.isFinite(dashboard?.activeRide?.dropoff_latitude) &&
    Number.isFinite(dashboard?.activeRide?.dropoff_longitude);

  const rideStatus = String(dashboard?.activeRide?.status || "").toLowerCase();

  const statCards = [
    {
      title: "Trips Today",
      value: dashboard?.earnings?.trips_today ?? 0,
      icon: "🧾",
    },
    {
      title: "Today Earnings",
      value: `৳ ${dashboard?.earnings?.today ?? 0}`,
      icon: "💵",
    },
    {
      title: "Week Earnings",
      value: `৳ ${dashboard?.earnings?.week ?? 0}`,
      icon: "📈",
    },
    {
      title: "Rating",
      value: dashboard?.user?.rating_avg ? `⭐ ${dashboard.user.rating_avg}` : "No rating",
      icon: "⭐",
    },
  ];

  const renderStatusCard = () => (
    <div className="card" style={{ marginBottom: 14 }}>
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
  );

  const renderRequestsCard = () => (
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
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {r.pickup} → {r.dropoff}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>৳ {r.initial_fare}</div>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-light)", marginBottom: 10 }}>
                {r.distance_km} km · {r.service_type}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  style={{
                    flex: 1,
                    padding: "8px",
                    background: "var(--accent)",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                  onClick={() => acceptRide(r.ride_id)}
                >
                  Accept
                </button>
                <button
                  style={{
                    flex: 1,
                    padding: "8px",
                    background: "var(--content-bg)",
                    color: "var(--text-mid)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                  onClick={() => declineRide(r.ride_id)}
                >
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
  );

  const renderActiveRideCard = () => {
    if (!dashboard?.activeRide) {
      return (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <div className="card-title">Active Ride</div>
          </div>
          <div style={{ padding: "14px 20px", color: "var(--text-light)" }}>No active ride at the moment.</div>
        </div>
      );
    }

    return (
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div className="card-title">Active Ride</div>
          <span className="pill blue">{dashboard.activeRide.status}</span>
        </div>
        <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {dashboard.activeRide.pickup} → {dashboard.activeRide.dropoff}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-light)" }}>
            Customer: {dashboard.activeRide.customer_name || "Customer"}
          </div>

          {canShowMap && (
            <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)" }}>
              <MapContainer
                center={[dashboard.activeRide.pickup_latitude, dashboard.activeRide.pickup_longitude]}
                zoom={13}
                style={{ height: 220, width: "100%" }}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                  attribution="&copy; OpenStreetMap contributors &copy; CARTO"
                />
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
              <button
                style={{
                  padding: "8px 12px",
                  background: "var(--accent)",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={startRide}
              >
                OTP Check & Pick Up
              </button>
            </div>
          )}

          {rideStatus === "in_progress" && (
            <button
              style={{
                width: 180,
                padding: "8px 12px",
                background: "var(--content-bg)",
                color: "var(--text-mid)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontWeight: 600,
                cursor: "pointer",
              }}
              onClick={endRide}
            >
              Complete Ride
            </button>
          )}

          {rideStatus === "driver_completed" && dashboard.activeRide.completion_otp && (
            <div style={{ fontSize: 13, fontWeight: 700 }}>Completion OTP: {dashboard.activeRide.completion_otp}</div>
          )}

          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Chat with Customer</div>
            <div
              style={{
                height: 150,
                overflowY: "auto",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 8,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {messages.length ? (
                messages.map((msg, i) => (
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
                ))
              ) : (
                <div style={{ color: "var(--text-light)", fontSize: 12 }}>No messages yet.</div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type message..."
                style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid var(--border)" }}
              />
              <button
                onClick={sendMessage}
                style={{
                  padding: "8px 12px",
                  background: "var(--accent)",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderLastRides = () => (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-header">
        <div className="card-title">Last 3 Rides</div>
      </div>
      <div className="card-body">
        {dashboard?.lastRides?.length ? (
          dashboard.lastRides.map((r) => (
            <div key={r.ride_id} style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  #{r.ride_id} · {r.pickup} → {r.dropoff}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-light)" }}>{r.status}</div>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-light)", marginTop: 4 }}>
                {r.customer_name || "Customer"} · ৳ {r.fare} · {r.event_time ? new Date(r.event_time).toLocaleString() : ""}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-mid)", marginTop: 4 }}>
                Your Rating: {r.my_rating_to_customer ? `⭐ ${r.my_rating_to_customer}` : "Not submitted"} · Customer Rated You: {r.customer_rating_to_driver ? `⭐ ${r.customer_rating_to_driver}` : "Pending"}
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: "14px 20px", color: "var(--text-light)" }}>No recent rides found.</div>
        )}
      </div>
    </div>
  );

  const renderRatingsSection = () => {
    const rides = dashboard?.lastRides || [];

    return (
      <>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div className="card-title">My Rating Summary</div>
          </div>
          <div style={{ padding: "14px 20px" }}>
            <p>
              <strong>Current Driver Rating:</strong> {dashboard?.user?.rating_avg ? `⭐ ${dashboard.user.rating_avg}` : "No ratings yet"}
            </p>
            <p style={{ marginTop: 8 }}>
              <strong>Total Received Ratings:</strong> {ratingsData?.summary?.totalRatings ?? 0}
            </p>
            <p style={{ marginTop: 8 }}>
              <strong>Total Completed Rides:</strong> {dashboard?.earnings?.total_completed_rides ?? 0}
            </p>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div className="card-title">Rate Your Last Riders</div>
          </div>
          <div className="card-body">
            {rides.length ? (
              rides.map((ride) => {
                const draft = ratingDrafts[ride.ride_id] || { score: 5, comment: "" };
                const isCompleted = String(ride.status || "").toLowerCase() === "completed";
                const alreadyRated = Number.isInteger(ride.my_rating_to_customer) && ride.my_rating_to_customer > 0;

                return (
                  <div key={ride.ride_id} style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>
                      Ride #{ride.ride_id} · {ride.customer_name || "Customer"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-light)", marginBottom: 10 }}>
                      {ride.pickup} → {ride.dropoff} · Status: {ride.status}
                    </div>

                    {alreadyRated ? (
                      <div style={{ fontSize: 12, color: "var(--text-mid)" }}>You already rated this customer: ⭐ {ride.my_rating_to_customer}</div>
                    ) : !isCompleted ? (
                      <div style={{ fontSize: 12, color: "var(--text-mid)" }}>Rating opens after ride completion.</div>
                    ) : (
                      <div style={{ display: "grid", gap: 8 }}>
                        <select
                          value={draft.score}
                          onChange={(e) => setRideDraft(ride.ride_id, { score: Number(e.target.value) })}
                          style={{ width: 160, padding: 8, borderRadius: 8, border: "1px solid var(--border)" }}
                        >
                          <option value={5}>5 - Excellent</option>
                          <option value={4}>4 - Good</option>
                          <option value={3}>3 - Okay</option>
                          <option value={2}>2 - Poor</option>
                          <option value={1}>1 - Bad</option>
                        </select>
                        <input
                          value={draft.comment}
                          onChange={(e) => setRideDraft(ride.ride_id, { comment: e.target.value })}
                          placeholder="Comment (optional)"
                          style={{ padding: "8px", borderRadius: 8, border: "1px solid var(--border)" }}
                        />
                        <button
                          onClick={() => submitCustomerRating(ride.ride_id)}
                          disabled={Boolean(ratingSaving[ride.ride_id])}
                          style={{
                            width: 170,
                            padding: "8px 10px",
                            background: "var(--accent)",
                            color: "white",
                            border: "none",
                            borderRadius: 8,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {ratingSaving[ride.ride_id] ? "Submitting..." : "Submit Rating"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div style={{ padding: "14px 20px", color: "var(--text-light)" }}>No rides available for rating yet.</div>
            )}
          </div>
        </div>
      </>
    );
  };

  const renderSection = () => {
    if (activeSection === "requests") {
      return (
        <>
          {renderStatusCard()}
          {renderRequestsCard()}
        </>
      );
    }

    if (activeSection === "active") {
      return (
        <>
          {renderStatusCard()}
          {renderActiveRideCard()}
        </>
      );
    }

    if (activeSection === "history") {
      return (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div className="card-title">Trip History (Today)</div>
            </div>
            <div className="card-body">
              {dashboard?.tripLogToday?.length ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Ride</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th>Fare</th>
                      <th>My Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.tripLogToday.map((ride) => (
                      <tr key={ride.ride_id}>
                        <td>
                          #{ride.ride_id}<br />
                          <span style={{ fontSize: 12, color: "var(--text-light)" }}>
                            {ride.pickup} → {ride.dropoff}
                          </span>
                        </td>
                        <td>{ride.customer_name || "Customer"}</td>
                        <td>{ride.status}</td>
                        <td>৳ {ride.fare}</td>
                        <td>{ride.my_rating_to_customer ? `⭐ ${ride.my_rating_to_customer}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: "14px 20px", color: "var(--text-light)" }}>No rides logged today.</div>
              )}
            </div>
          </div>
          {renderLastRides()}
        </>
      );
    }

    if (activeSection === "earnings") {
      return (
        <>
          <div className="stats-grid">
            {statCards.map((s) => (
              <div className="stat-card" key={s.title}>
                <div className="stat-top">
                  <div className="stat-icon" style={{ background: "#fff7ed" }}>{s.icon}</div>
                </div>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.title}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Weekly Trend</div>
            </div>
            <div className="card-body">
              {dashboard?.weeklyTrend?.length ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Earnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.weeklyTrend.map((item, idx) => (
                      <tr key={`${item.day}-${idx}`}>
                        <td>{item.day}</td>
                        <td>৳ {item.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: "14px 20px", color: "var(--text-light)" }}>No trend data available.</div>
              )}
            </div>
          </div>
        </>
      );
    }

    if (activeSection === "wallet") {
      return (
        <div className="dashboard-stack">
          <div className="wallet-hero">
            <div>
              <div className="wallet-hero-label">Driver Wallet Balance</div>
              <div className="wallet-hero-value">{walletData?.wallet?.currency || "BDT"} {Number(walletData?.wallet?.balance || 0).toLocaleString("en-BD")}</div>
              <div className="wallet-hero-sub">Last updated: {walletData?.wallet?.last_updated ? new Date(walletData.wallet.last_updated).toLocaleString() : "N/A"}</div>
            </div>
            <div className="wallet-hero-chip">Instant Payout Ready</div>
          </div>

          <div className="stats-grid wallet-mini-stats">
            <div className="stat-card">
              <div className="stat-label">Total Credits</div>
              <div className="stat-value">৳ {Number(walletData?.stats?.total_recharged || 0).toLocaleString("en-BD")}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Debits</div>
              <div className="stat-value">৳ {Number(walletData?.stats?.total_spent || 0).toLocaleString("en-BD")}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Recent Transactions</div>
            </div>
            <div className="card-body">
              {walletData?.transactions?.length ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Description</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {walletData.transactions.slice(0, 12).map((tx) => (
                      <tr key={tx.transaction_id}>
                        <td>{tx.type}</td>
                        <td>৳ {Number(tx.amount || 0).toLocaleString("en-BD")}</td>
                        <td>{tx.description || "No description"}</td>
                        <td>{tx.timestamp ? new Date(tx.timestamp).toLocaleString() : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: "14px 20px", color: "var(--text-light)" }}>No wallet transactions available.</div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (activeSection === "vehicle") {
      return (
        <div className="card">
          <div className="card-header">
            <div className="card-title">My Vehicle</div>
          </div>
          <div style={{ padding: "14px 20px", display: "grid", gap: 8 }}>
            <p><strong>Model:</strong> {dashboard?.user?.vehicle_model || "Not set"}</p>
            <p><strong>Type:</strong> {dashboard?.user?.vehicle_type || "Not set"}</p>
            <p><strong>Plate:</strong> {dashboard?.user?.vehicle_plate || "Not set"}</p>
          </div>
        </div>
      );
    }

    if (activeSection === "docs") {
      return (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Documents</div>
          </div>
          <div className="profile-card-body">
            <p style={{ color: "var(--text-mid)" }}>
              Update your current license document for verification.
            </p>
            <input type="file" accept="image/*,.pdf" onChange={(e) => setLicenseFile(e.target.files?.[0] || null)} />
            <button className="primary-btn" onClick={uploadLicenseDocument} disabled={!licenseFile}>
              Upload License Document
            </button>
            {profileData?.license_document && (
              <a className="link-btn" href={profileData.license_document} target="_blank" rel="noreferrer">
                View Current Document
              </a>
            )}
          </div>
        </div>
      );
    }

    if (activeSection === "ratings") {
      return renderRatingsSection();
    }

    if (activeSection === "profile") {
      const displayName = `${profileData?.first_name || ""} ${profileData?.last_name || ""}`.trim() || "Driver";

      return (
        <div className="dashboard-stack">
          <div className="profile-hero">
            <div className="profile-avatar-wrap">
              {profileData?.profile_picture ? (
                <img className="profile-avatar-img" src={profileData.profile_picture} alt="Driver profile" />
              ) : (
                <div className="profile-avatar-fallback">{displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}</div>
              )}
            </div>
            <div>
              <div className="profile-hero-name">{displayName}</div>
              <div className="profile-hero-sub">Driver ID: {profileData?.user_id || "-"}</div>
              <div className="profile-hero-sub">Status: {profileData?.active_status ? "Online capable" : "Offline"}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Profile Picture</div>
            </div>
            <div className="profile-card-body">
              <input type="file" accept="image/*" onChange={(e) => setProfilePictureFile(e.target.files?.[0] || null)} />
              <button className="primary-btn" onClick={uploadProfilePicture} disabled={!profilePictureFile}>
                Upload Picture
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Basic Information</div>
            </div>
            <div className="form-grid profile-card-body">
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
              <button className="primary-btn" onClick={saveProfile}>Save Profile</button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Driver Details</div>
            </div>
            <div className="profile-card-body profile-data-grid">
              <div><strong>License ID:</strong> {profileData?.licence_id || "N/A"}</div>
              <div><strong>License Expiry:</strong> {profileData?.license_expire ? new Date(profileData.license_expire).toLocaleDateString() : "N/A"}</div>
              <div><strong>Vehicle:</strong> {profileData?.vehicle_model || "N/A"}</div>
              <div><strong>Plate:</strong> {profileData?.vehicle_plate || "N/A"}</div>
              <div><strong>Type:</strong> {profileData?.vehicle_type || "N/A"}</div>
              <div><strong>Color:</strong> {profileData?.vehicle_color || "N/A"}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Security</div>
            </div>
            <div className="form-grid profile-card-body">
              <input
                type="password"
                value={passwordForm.current_password}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, current_password: e.target.value }))}
                placeholder="Current password"
              />
              <input
                type="password"
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, new_password: e.target.value }))}
                placeholder="New password"
              />
              <input
                type="password"
                value={passwordForm.confirm_password}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm_password: e.target.value }))}
                placeholder="Confirm new password"
              />
              <button className="primary-btn" onClick={savePassword}>Update Password</button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Saved Addresses</div>
            </div>
            <div className="card-body">
              {profileAddresses.length ? (
                <ul className="info-list">
                  {profileAddresses.slice(0, 10).map((address) => (
                    <li key={`${address.location_id}-${address.label || "saved"}`}>
                      <strong>{address.label || "Saved place"}</strong> - {address.address_name}
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ padding: "14px 20px", color: "var(--text-light)" }}>No saved addresses available.</div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        {renderStatusCard()}

        <div className="stats-grid">
          {statCards.map((s) => (
            <div className="stat-card" key={s.title}>
              <div className="stat-top">
                <div className="stat-icon" style={{ background: "#fff7ed" }}>{s.icon}</div>
              </div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.title}</div>
            </div>
          ))}
        </div>

        {renderRequestsCard()}
        {renderActiveRideCard()}
        {renderLastRides()}
      </>
    );
  };

  return (
    <Layout
      role="Driver"
      navItems={nav}
      userName={dashboard?.user?.full_name || "Driver"}
      statusLabel={online ? "Online" : "Offline"}
      profileMenuItems={profileMenuItems}
    >
      {loading && <div className="section-label">Loading dashboard...</div>}
      {!!error && (
        <div className="section-label" style={{ color: "var(--red)" }}>
          {error}
        </div>
      )}
      {actionMessage && <div className="section-label">{actionMessage}</div>}

      {!loading && !error && renderSection()}
    </Layout>
  );
}

export default DriverDashboard;