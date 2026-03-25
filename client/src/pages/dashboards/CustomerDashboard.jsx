import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Layout from "./Layout";

const API_BASE = "http://localhost:5000";

const nav = [
  { id: "home",      icon: "⌂",  label: "Dashboard", path: "/dashboard/customer" },
  { type: "section", id: "s1",   label: "Travel" },
  { id: "ride",      icon: "🚗", label: "Book a Ride", path: "/ride" },
  { id: "ongoing",   icon: "📍", label: "Ongoing", path: "/dashboard/customer/ongoing" },
  { id: "statistics",icon: "🕐", label: "Statistics", path: "/dashboard/customer/statistics" },
  { type: "section", id: "s2",   label: "Food & More" },
  { id: "food",      icon: "🍔", label: "Order Food", path: "/food-service" },
  { id: "courier",   icon: "📦", label: "Send Parcel", path: "/parcel-service" },
  { id: "emergency", icon: "🏥", label: "Emergency", path: "/dashboard/customer/ambulance" },
  { type: "section", id: "s3",   label: "Account" },
  { id: "wallet",    icon: "💳", label: "Wallet", path: "/dashboard/customer/wallet" },
  { id: "profile",   icon: "👤", label: "Profile", path: "/dashboard/customer/profile" },
  { id: "ratings",   icon: "⭐", label: "Ratings", path: "/dashboard/customer/ratings" },
  { id: "promos",    icon: "🎟️", label: "Promos", path: "/dashboard/customer/promos" },
];

function CustomerDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [walletData, setWalletData] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [ratingsData, setRatingsData] = useState(null);
  const [completionOtp, setCompletionOtp] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [rechargeMethod, setRechargeMethod] = useState("bkash");

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
    if (path.includes("/dashboard/customer/statistics")) return "statistics";
    if (path.includes("/dashboard/customer/ongoing")) return "ongoing";
    if (path.includes("/dashboard/customer/wallet")) return "wallet";
    if (path.includes("/dashboard/customer/profile")) return "profile";
    if (path.includes("/dashboard/customer/promos")) return "promos";
    if (path.includes("/dashboard/customer/ratings")) return "ratings";
    if (path.includes("/dashboard/customer/ambulance")) return "ambulance";
    return "home";
  }, [location.pathname]);

  const getHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  });

  useEffect(() => {
    const loadData = async () => {
      if (!user?.user_id) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        setLoading(true);
        setError("");
        setSuccess("");

        const response = await fetch(`${API_BASE}/api/customer/dashboard/${user.user_id}`, {
          headers: getHeaders(),
          credentials: "include",
        });

        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(data?.message || "Unable to load customer dashboard.");
        }

        setDashboard(data.data);

        if (activeSection === "wallet") {
          const response = await fetch(`${API_BASE}/api/account/${user.user_id}/wallet`, {
            headers: getHeaders(),
            credentials: "include",
          });

          const data = await response.json();
          if (!response.ok || !data?.success) {
            throw new Error(data?.message || "Unable to load wallet data.");
          }

          setWalletData(data.data);
        }

        if (activeSection === "profile") {
          const response = await fetch(`${API_BASE}/api/account/${user.user_id}/profile`, {
            headers: getHeaders(),
            credentials: "include",
          });

          const data = await response.json();
          if (!response.ok || !data?.success) {
            throw new Error(data?.message || "Unable to load profile.");
          }

          setProfileData(data.data?.user || null);
        }

        if (activeSection === "ratings") {
          const response = await fetch(`${API_BASE}/api/account/${user.user_id}/ratings`, {
            headers: getHeaders(),
            credentials: "include",
          });

          const data = await response.json();
          if (!response.ok || !data?.success) {
            throw new Error(data?.message || "Unable to load ratings.");
          }

          setRatingsData(data.data);
        }
      } catch (err) {
        setError(err.message || "Unable to load data.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeSection, navigate, token, user?.user_id]);

  const activeRide = dashboard?.activeRide;

  const handleConfirmCompletion = async () => {
    if (!user?.user_id || !activeRide?.ride_id) {
      return;
    }

    try {
      setActionMessage("");
      const response = await fetch(
        `${API_BASE}/api/customer/${user.user_id}/rides/${activeRide.ride_id}/confirm`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          credentials: "include",
          body: JSON.stringify({ otp: completionOtp }),
        }
      );

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to confirm completion.");
      }

      setActionMessage("Ride completed successfully.");
      setCompletionOtp("");
    } catch (err) {
      setActionMessage(err.message || "Unable to confirm completion.");
    }
  };

  const handleRecharge = async () => {
    if (!user?.user_id) return;

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
        headers: getHeaders(),
        credentials: "include",
      });

      const walletPayload = await walletResponse.json();
      if (walletResponse.ok && walletPayload?.success) {
        setWalletData(walletPayload.data);
        setDashboard((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            wallet: {
              ...(prev.wallet || {}),
              balance: walletPayload.data?.wallet?.balance ?? prev.wallet?.balance ?? 0,
            },
          };
        });
      }
    } catch (err) {
      setError(err.message || "Recharge failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async () => {
    if (!user?.user_id || !profileData) return;

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

  const renderSection = () => {
    if (loading) {
      return <div className="section-label">Loading dashboard...</div>;
    }

    if (activeSection === "statistics") {
      return (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Statistics</div>
          </div>
          <div className="card-body">
            <div style={{ padding: "14px 20px" }}>
              <p><strong>Lifetime Spend:</strong> BDT {dashboard?.wallet?.lifetime_spent ?? 0}</p>
              <p><strong>Month Spend:</strong> BDT {dashboard?.wallet?.month_spent ?? 0}</p>
              <p><strong>Rides This Month:</strong> {dashboard?.wallet?.rides_this_month ?? 0}</p>
              <p><strong>Customer Rating:</strong> {dashboard?.user?.customer_rating ?? 0}</p>
            </div>
          </div>
        </div>
      );
    }

    if (activeSection === "ongoing") {
      const ride = dashboard?.activeRide;
      return (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Ongoing Request</div>
          </div>
          <div className="card-body">
            <div style={{ padding: "14px 20px" }}>
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
          </div>
        </div>
      );
    }

    if (activeSection === "wallet") {
      return (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Wallet</div>
          </div>
          <div className="card-body">
            <div style={{ padding: "14px 20px" }}>
              <p><strong>Balance:</strong> {walletData?.wallet?.currency || "BDT"} {walletData?.wallet?.balance ?? 0}</p>

              <div style={{ display: "flex", gap: 10, marginTop: 12, marginBottom: 16 }}>
                <input
                  type="number"
                  min="1"
                  placeholder="Recharge amount"
                  value={rechargeAmount}
                  onChange={(e) => setRechargeAmount(e.target.value)}
                  style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid var(--border)" }}
                />
                <select
                  value={rechargeMethod}
                  onChange={(e) => setRechargeMethod(e.target.value)}
                  style={{ padding: "8px", borderRadius: 8, border: "1px solid var(--border)" }}
                >
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="card">Card</option>
                </select>
                <button
                  onClick={handleRecharge}
                  disabled={loading}
                  style={{ padding: "8px 12px", background: "var(--accent)", color: "white", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
                >
                  Recharge
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeSection === "profile") {
      return (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Profile</div>
          </div>
          <div className="card-body">
            <div style={{ padding: "14px 20px", display: "grid", gap: 10 }}>
              <input
                value={profileData?.first_name || ""}
                onChange={(e) => setProfileData((prev) => ({ ...(prev || {}), first_name: e.target.value }))}
                placeholder="First Name"
                style={{ padding: "8px", borderRadius: 8, border: "1px solid var(--border)" }}
              />
              <input
                value={profileData?.last_name || ""}
                onChange={(e) => setProfileData((prev) => ({ ...(prev || {}), last_name: e.target.value }))}
                placeholder="Last Name"
                style={{ padding: "8px", borderRadius: 8, border: "1px solid var(--border)" }}
              />
              <input
                value={profileData?.email || ""}
                onChange={(e) => setProfileData((prev) => ({ ...(prev || {}), email: e.target.value }))}
                placeholder="Email"
                style={{ padding: "8px", borderRadius: 8, border: "1px solid var(--border)" }}
              />
              <input
                value={profileData?.phone || ""}
                onChange={(e) => setProfileData((prev) => ({ ...(prev || {}), phone: e.target.value }))}
                placeholder="Phone"
                style={{ padding: "8px", borderRadius: 8, border: "1px solid var(--border)" }}
              />
              <button
                onClick={handleProfileUpdate}
                disabled={loading}
                style={{ padding: "8px 12px", background: "var(--accent)", color: "white", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
              >
                Save Profile
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (activeSection === "promos") {
      return (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Promos</div>
          </div>
          <div className="card-body">
            <div style={{ padding: "14px 20px" }}>
              {dashboard?.promotions?.length ? (
                <ul className="info-list">
                  {dashboard.promotions.map((promo) => (
                    <li key={promo.promo_id}>
                      {promo.promo_code} - BDT {promo.discount_amount} - {promo.valid_until ? new Date(promo.valid_until).toLocaleDateString() : "No expiry"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No active promotions right now.</p>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (activeSection === "ratings") {
      return (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Ratings</div>
          </div>
          <div className="card-body">
            <div style={{ padding: "14px 20px" }}>
              {ratingsData?.ratings?.length ? (
                <ul className="info-list">
                  {ratingsData.ratings.map((rating) => (
                    <li key={rating.rating_id || `${rating.ride_id}-${rating.created_at}` }>
                      Ride #{rating.ride_id} - {rating.score} ⭐ - {rating.comment || "No comment"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No ratings available yet.</p>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (activeSection === "ambulance") {
      return (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Ambulance Service</div>
          </div>
          <div className="card-body">
            <div style={{ padding: "14px 20px" }}>
              <p>This service will be available soon. For emergencies, call 999 immediately.</p>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Layout
      role="Customer"
      navItems={nav}
      userName={dashboard?.user?.full_name || "Customer"}
      statusLabel="Active"
    >
      {!!error && <div className="section-label" style={{ color: "var(--red)" }}>{error}</div>}
      {!!success && <div className="section-label" style={{ color: "var(--green)" }}>{success}</div>}
      {!!actionMessage && <div className="section-label">{actionMessage}</div>}

      {!loading && !error && (
        <>
          {/* Quick Actions */}
          <div className="section-label">Quick Actions</div>
          <div className="quick-actions">
            {[
              { icon: "🚗", label: "Book Ride",     sub: "Car, Bike, CNG",     color: "#eff6ff", iconBg: "#dbeafe", path: "/ride" },
              { icon: "🍔", label: "Order Food",     sub: "50+ restaurants",    color: "#fff7ed", iconBg: "#ffedd5", path: "/food-service" },
              { icon: "📦", label: "Send Parcel",    sub: "Fast delivery",      color: "#faf5ff", iconBg: "#ede9fe", path: "/parcel-service" },
              { icon: "🏥", label: "Emergency",      sub: "Nearest hospital",   color: "#fef2f2", iconBg: "#fee2e2", path: "/ambulance-service" },
              { icon: "📌", label: "Saved Places",   sub: `${dashboard?.savedPlaces ?? 0} saved`,      color: "#f0fdf4", iconBg: "#dcfce7" },
              { icon: "🎟️", label: "Promo Codes",   sub: `${dashboard?.promotions?.length || 0} active`,     color: "#fefce8", iconBg: "#fef9c3" },
            ].map((a, i) => (
              <div
                key={i}
                className="action-card"
                style={{ background: a.color }}
                onClick={() => a.path && navigate(a.path)}
              >
                <div className="action-icon" style={{ background: a.iconBg }}>{a.icon}</div>
                <div>
                  <div className="action-label">{a.label}</div>
                  <div className="action-sub">{a.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Active Ride + Wallet */}
          {activeSection === "home" && (
            <div className="two-col">

              {/* Active Ride */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">🚗 Active Ride</div>
                  <span className={`pill ${activeRide ? "orange" : "gray"}`}>
                    {activeRide ? "ON" : "OFF"}
                  </span>
                </div>
                <div className="card-body">
                  <div style={{ padding: "14px 20px" }}>
                    {activeRide ? (
                      <>
                        <p><strong>Status:</strong> {activeRide.status || "in_progress"}</p>
                        <p><strong>Route:</strong> {activeRide.pickup || "Pickup"} → {activeRide.dropoff || "Dropoff"}</p>
                        <p><strong>Fare:</strong> ৳ {activeRide.fare}</p>
                        {["driver_completed", "waiting_completion_otp"].includes(String(activeRide.status || "").toLowerCase()) && (
                          <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: 12, color: "var(--text-light)", marginBottom: 6 }}>
                              Enter completion OTP to finish ride
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <input
                                value={completionOtp}
                                onChange={(e) => setCompletionOtp(e.target.value)}
                                placeholder="6-digit OTP"
                                style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid var(--border)" }}
                              />
                              <button
                                onClick={handleConfirmCompletion}
                                style={{ padding: "8px 12px", background: "var(--accent)", color: "white", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
                              >
                                Confirm
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ fontSize: 13, color: "var(--text-light)" }}>No active ride right now.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Wallet */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">💳 Wallet</div>
                </div>
                <div className="card-body">
                  <div style={{ padding: "14px 20px" }}>
                    <p><strong>Balance:</strong> ৳ {dashboard?.wallet?.balance ?? 0}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Ride History */}
          {activeSection === "home" && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-header">
                <div className="card-title">Recent Rides</div>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Route</th>
                    <th>Driver</th>
                    <th>Distance</th>
                    <th>Fare</th>
                    <th>Status</th>
                    <th>Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard?.recentRides?.length ? (
                    dashboard.recentRides.map((r) => (
                      <tr key={r.ride_id}>
                        <td><div style={{ fontWeight: 600 }}>{r.pickup} → {r.dropoff}</div></td>
                        <td>{r.driver_name || "—"}</td>
                        <td style={{ color: "var(--text-light)" }}>{r.distance_km} km</td>
                        <td style={{ fontWeight: 700 }}>৳ {r.fare}</td>
                        <td><span className={`pill ${String(r.status).toLowerCase() === "completed" ? "green" : "red"}`}>{r.status}</span></td>
                        <td>{r.rating ? `⭐ ${r.rating}` : "—"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ padding: 12, color: "var(--text-light)" }}>No recent rides.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeSection === "home" && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-header">
                <div className="card-title">Latest Food Orders</div>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Restaurant</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {(dashboard?.latestFoodOrders || dashboard?.recentFoodDeliveries)?.length ? (
                    (dashboard.latestFoodOrders || dashboard.recentFoodDeliveries).map((o) => (
                      <tr key={o.order_id}>
                        <td>#{o.order_id}</td>
                        <td>{o.restaurant_name || "Restaurant"}</td>
                        <td>৳ {o.total_price ?? 0}</td>
                        <td><span className="pill blue">{o.status || "placed"}</span></td>
                        <td>{o.order_time ? new Date(o.order_time).toLocaleString() : "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: 12, color: "var(--text-light)" }}>No recent food orders.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeSection === "home" && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-header">
                <div className="card-title">Recent Parcel Deliveries</div>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Parcel</th>
                    <th>Route</th>
                    <th>Fare</th>
                    <th>Status</th>
                    <th>Requested</th>
                  </tr>
                </thead>
                <tbody>
                  {(dashboard?.latestParcelDeliveries || dashboard?.recentParcelDeliveries)?.length ? (
                    (dashboard.latestParcelDeliveries || dashboard.recentParcelDeliveries).map((p) => (
                      <tr key={p.courier_id}>
                        <td>#{p.courier_id}</td>
                        <td>{p.pickup || "Pickup"} → {p.dropoff || "Dropoff"}</td>
                        <td>৳ {p.fare ?? 0}</td>
                        <td><span className="pill orange">{p.status || "requested"}</span></td>
                        <td>{p.request_time ? new Date(p.request_time).toLocaleString() : "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: 12, color: "var(--text-light)" }}>No recent parcel deliveries.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeSection !== "home" && renderSection()}
        </>
      )}

    </Layout>
  );
}

export default CustomerDashboard;
