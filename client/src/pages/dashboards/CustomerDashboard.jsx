import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import Layout from "./Layout";

const API_BASE = "http://localhost:5000";

const nav = [
  { id: "home",      icon: "⌂",  label: "Dashboard", path: "/dashboard/customer" },
  { type: "section", id: "s1",   label: "Travel" },
  { id: "ride",      icon: "🚗", label: "Book a Ride", path: "/ride" },
  { id: "food",      icon: "🍔", label: "Book Delivery Ride", path: "/delivery-ride" },
  { id: "ongoing",   icon: "📍", label: "Ongoing Trips", path: "/dashboard/customer/ongoing" },
  { id: "statistics",icon: "🕐", label: "Statistics", path: "/dashboard/customer/statistics" },
  { type: "section", id: "s2",   label: "Food & More" },
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
  const [profileAddresses, setProfileAddresses] = useState([]);
  const [ratingsData, setRatingsData] = useState(null);
  const [completionOtp, setCompletionOtp] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [rechargeMethod, setRechargeMethod] = useState("bkash");
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

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

  const getHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    }),
    [token]
  );

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
          setProfileAddresses(data.data?.savedAddresses || []);
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
  }, [activeSection, getHeaders, navigate, token, user?.user_id]);

  useEffect(() => {
    if (!dashboard?.activeRide?.ride_id) {
      return undefined;
    }

    const socket = io(API_BASE, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    const rideId = dashboard.activeRide.ride_id;

    socket.emit("join_ride_room", rideId);

    const handleCompletionOtpReady = (payload = {}) => {
      if (Number(payload.ride_id) !== Number(rideId)) {
        return;
      }

      setDashboard((prev) => {
        if (!prev?.activeRide || Number(prev.activeRide.ride_id) !== Number(rideId)) {
          return prev;
        }

        return {
          ...prev,
          activeRide: {
            ...prev.activeRide,
            status: payload.status || prev.activeRide.status,
            completion_otp: payload.completion_otp || prev.activeRide.completion_otp,
          },
        };
      });

      if (payload.completion_otp) {
        setCompletionOtp(String(payload.completion_otp));
      }
    };

    socket.on("delivery_completion_otp_ready", handleCompletionOtpReady);

    return () => {
      socket.off("delivery_completion_otp_ready", handleCompletionOtpReady);
      socket.disconnect();
    };
  }, [dashboard?.activeRide?.ride_id]);

  // Auto-refresh active ride data to fetch OTP when driver confirms
  useEffect(() => {
    if (!dashboard?.activeRide || dashboard.activeRide.completion_otp) {
      return; // Don't poll if no active ride or OTP already exists
    }

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/api/customer/dashboard/${user.user_id}`, {
          headers: getHeaders(),
          credentials: "include",
        });

        const data = await response.json();
        if (response.ok && data?.success) {
          setDashboard(data.data);
        }
      } catch (err) {
        // Silent error on polling
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [dashboard?.activeRide, getHeaders, user?.user_id, API_BASE]);

  const activeRide = dashboard?.activeRide;

  const formatMoney = (value) => {
    const amount = Number(value || 0);
    return amount.toLocaleString("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const profileDisplayName = `${profileData?.first_name || ""} ${profileData?.last_name || ""}`.trim() || "Customer";

  const handleConfirmCompletion = async () => {
    if (!user?.user_id || !activeRide?.ride_id) {
      console.warn("[Confirm] Missing user or ride ID", { userId: user?.user_id, rideId: activeRide?.ride_id });
      return;
    }

    const otpToConfirm = String(completionOtp || activeRide?.completion_otp || "").trim();

    if (!otpToConfirm) {
      console.warn("[Confirm] No OTP available", { inputOtp: completionOtp, displayOtp: activeRide?.completion_otp });
      setActionMessage("Please wait for the completion OTP to appear or enter it manually.");
      return;
    }

    console.log("[Confirm] Sending confirmation", { rideId: activeRide.ride_id, otp: otpToConfirm, status: activeRide.status });

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
          body: JSON.stringify({ otp: otpToConfirm }),
        }
      );

      console.log("[Confirm] Response status:", response.status);
      const data = await response.json();
      console.log("[Confirm] Response body:", data);

      if (!response.ok || !data?.success) {
        console.error("[Confirm] Backend error:", data?.message);
        throw new Error(data?.message || "Unable to confirm completion.");
      }

      setActionMessage("Ride completed successfully.");
      setCompletionOtp("");
    } catch (err) {
      console.error("[Confirm] Error:", err);
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

  const handleProfilePictureUpload = async () => {
    if (!user?.user_id || !profilePictureFile) {
      setError("Please choose a profile picture first.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

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
        throw new Error(data?.message || "Profile picture update failed.");
      }

      setProfileData((prev) => ({ ...(prev || {}), profile_picture: data?.data?.profile_picture || prev?.profile_picture }));
      setProfilePictureFile(null);
      setSuccess("Profile picture updated successfully.");
    } catch (err) {
      setError(err.message || "Profile picture update failed.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (!user?.user_id) return;

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const response = await fetch(`${API_BASE}/api/account/${user.user_id}/password`, {
        method: "PUT",
        headers: getHeaders(),
        credentials: "include",
        body: JSON.stringify(passwordForm),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Password update failed.");
      }

      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
      setSuccess("Password updated successfully.");
    } catch (err) {
      setError(err.message || "Password update failed.");
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
        <div className="dashboard-stack">
          <div className="wallet-hero">
            <div>
              <div className="wallet-hero-label">Available Balance</div>
              <div className="wallet-hero-value">
                {(walletData?.wallet?.currency || "BDT")} {formatMoney(walletData?.wallet?.balance)}
              </div>
              <div className="wallet-hero-sub">Last updated: {walletData?.wallet?.last_updated ? new Date(walletData.wallet.last_updated).toLocaleString() : "N/A"}</div>
            </div>
            <div className="wallet-hero-chip">Secure Wallet</div>
          </div>

          <div className="stats-grid wallet-mini-stats">
            <div className="stat-card">
              <div className="stat-label">Total Recharged</div>
              <div className="stat-value">৳ {formatMoney(walletData?.stats?.total_recharged)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Spent</div>
              <div className="stat-value">৳ {formatMoney(walletData?.stats?.total_spent)}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Recharge Wallet</div>
            </div>
            <div className="card-body">
              <div className="form-grid profile-card-body">
                <input
                  type="number"
                  min="1"
                  placeholder="Recharge amount"
                  value={rechargeAmount}
                  onChange={(e) => setRechargeAmount(e.target.value)}
                />
                <select
                  value={rechargeMethod}
                  onChange={(e) => setRechargeMethod(e.target.value)}
                >
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="card">Card</option>
                </select>
                <button className="primary-btn" onClick={handleRecharge} disabled={loading}>
                  Recharge Now
                </button>
              </div>
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
                        <td>৳ {formatMoney(tx.amount)}</td>
                        <td>{tx.description || "No description"}</td>
                        <td>{tx.timestamp ? new Date(tx.timestamp).toLocaleString() : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: "14px 20px", color: "var(--text-light)" }}>No wallet transactions yet.</div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (activeSection === "profile") {
      return (
        <div className="dashboard-stack">
          <div className="profile-hero">
            <div className="profile-avatar-wrap">
              {profileData?.profile_picture ? (
                <img className="profile-avatar-img" src={profileData.profile_picture} alt="Profile" />
              ) : (
                <div className="profile-avatar-fallback">{profileDisplayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}</div>
              )}
            </div>
            <div>
              <div className="profile-hero-name">{profileDisplayName}</div>
              <div className="profile-hero-sub">Role: {(profileData?.roles || []).join(", ") || "customer"}</div>
              <div className="profile-hero-sub">Joined: {profileData?.created_at ? new Date(profileData.created_at).toLocaleDateString() : "N/A"}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Profile Picture</div>
            </div>
            <div className="card-body">
              <div className="profile-card-body">
                <input type="file" accept="image/*" onChange={(e) => setProfilePictureFile(e.target.files?.[0] || null)} />
                <button className="primary-btn" onClick={handleProfilePictureUpload} disabled={loading || !profilePictureFile}>
                  Upload Picture
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Basic Information</div>
            </div>
            <div className="card-body">
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
                <button className="primary-btn" onClick={handleProfileUpdate} disabled={loading}>
                  Save Profile
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Security</div>
            </div>
            <div className="card-body">
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
                <button className="primary-btn" onClick={handlePasswordUpdate} disabled={loading}>
                  Update Password
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Saved Addresses</div>
            </div>
            <div className="card-body">
              {profileAddresses?.length ? (
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
              <p><strong>Average Rating Received:</strong> {ratingsData?.summary?.averageRating ? `⭐ ${ratingsData.summary.averageRating}` : "No ratings"}</p>
              <p style={{ marginTop: 6, marginBottom: 12 }}><strong>Total Ratings Received:</strong> {ratingsData?.summary?.totalRatings ?? 0}</p>
              {ratingsData?.ratings?.length ? (
                <ul className="info-list">
                  {ratingsData.ratings.map((rating) => (
                    <li key={rating.rating_id || `${rating.ride_id}-${rating.created_at}` }>
                      Ride #{rating.ride_id} - {rating.score} ⭐ - {rating.comment || "No comment"} ({rating.rater_role} → {rating.receiver_role})
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
              { icon: "🚗", label: "Book a Ride",        sub: "Car, Bike, CNG",      color: "#eff6ff", iconBg: "#dbeafe", path: "/ride" },
              { icon: "🍔", label: "Book Delivery Ride", sub: "Food delivery trips", color: "#fff7ed", iconBg: "#ffedd5", path: "/delivery-ride" },
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
                        {["in_progress", "driver_completed", "waiting_completion_otp"].includes(String(activeRide.status || "").toLowerCase()) && activeRide.completion_otp && (
                          <div style={{ marginTop: 12, padding: "10px", background: "#fff8e1", borderRadius: 8, borderLeft: "3px solid #ff9800" }}>
                            <div style={{ fontSize: 11, color: "var(--text-light)", marginBottom: 4 }}>
                              DELIVERY COMPLETION OTP
                            </div>
                            <div style={{ fontSize: 18, fontWeight: "bold", color: "#ff9800", letterSpacing: "2px", marginBottom: 8 }}>
                              {activeRide.completion_otp}
                            </div>
                          </div>
                        )}
                        {String(activeRide.status || "").toLowerCase() === "in_progress" && !activeRide.completion_otp && (
                          <div style={{ marginTop: 12, padding: "10px", background: "#e3f2fd", borderRadius: 8, borderLeft: "3px solid #2196f3" }}>
                            <div style={{ fontSize: 12, color: "#1976d2", fontWeight: 500 }}>
                              ⏳ Waiting for driver to arrive...
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-light)", marginTop: 4 }}>
                              OTP will appear here once driver reaches delivery location
                            </div>
                          </div>
                        )}
                        {["driver_completed", "waiting_completion_otp"].includes(String(activeRide.status || "").toLowerCase()) && !activeRide.completion_otp && (
                          <div style={{ marginTop: 12, padding: "10px", background: "#fff3e0", borderRadius: 8, borderLeft: "3px solid #f57c00" }}>
                            <div style={{ fontSize: 12, color: "#e65100", fontWeight: 500 }}>
                              🔄 Refreshing OTP...
                            </div>
                          </div>
                        )}
                        {["in_progress", "driver_completed", "waiting_completion_otp"].includes(String(activeRide.status || "").toLowerCase()) && (
                          <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: 12, color: "var(--text-light)", marginBottom: 6 }}>
                              Enter completion OTP to finalize delivery
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
                <div className="card-title">Recent Normal Rides</div>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Route</th>
                    <th>Driver</th>
                    <th>Distance</th>
                    <th>Fare</th>
                    <th>Status</th>
                    <th>Your Rating</th>
                    <th>Driver Rated You</th>
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
                        <td>{r.my_rating_to_driver ? `⭐ ${r.my_rating_to_driver}` : "—"}</td>
                        <td>{r.driver_rating_to_customer ? `⭐ ${r.driver_rating_to_customer}` : "—"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ padding: 12, color: "var(--text-light)" }}>No recent rides.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeSection === "home" && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-header">
                <div className="card-title">Recent Delivery Rides</div>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Ride</th>
                    <th>Restaurant</th>
                    <th>Route</th>
                    <th>Total</th>
                    <th>Fare</th>
                    <th>Status</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {(dashboard?.latestFoodOrders || dashboard?.recentFoodDeliveries)?.length ? (
                    (dashboard.latestFoodOrders || dashboard.recentFoodDeliveries).map((o) => (
                      <tr key={o.order_id}>
                        <td>#{o.order_id}</td>
                        <td>{o.ride_id ? `#${o.ride_id}` : "—"}</td>
                        <td>{o.restaurant_name || "Restaurant"}</td>
                        <td><div style={{ fontWeight: 600 }}>{o.pickup || "Pickup"} → {o.dropoff || "Dropoff"}</div></td>
                        <td>৳ {o.total_price ?? 0}</td>
                        <td>৳ {o.fare ?? o.total_price ?? 0}</td>
                        <td><span className="pill blue">{o.status || "placed"}</span></td>
                        <td>{o.order_time ? new Date(o.order_time).toLocaleString() : "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} style={{ padding: 12, color: "var(--text-light)" }}>No recent delivery rides.</td>
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
