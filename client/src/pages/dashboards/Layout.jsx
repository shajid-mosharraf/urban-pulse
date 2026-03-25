import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./dashboard.css";

const roleColors = {
  Customer:             "#3b82f6",
  Driver:               "#22c55e",
  "Restaurant Manager": "#f97316",
  Admin:                "#8b5cf6",
};

/**
 * Shared dashboard layout — dark sidebar + light content area.
 *
 * Props:
 *  role        — "Customer" | "Driver" | "Restaurant Manager" | "Admin"
 *  navItems    — array of { id, icon, label, badge? } or { type:"section", id, label }
 *  userName    — display name shown in sidebar
 *  statusLabel — text shown in topbar badge (e.g. "Active", "Online", "Open")
 *  children    — page content
 */
function Layout({ role, navItems, children, userName, statusLabel }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeNav, setActiveNav] = useState(navItems[0]?.id);

  const pathBasedNav = useMemo(() => {
    if (!location?.pathname) return null;
    return navItems.find((item) => item.path && location.pathname.startsWith(item.path));
  }, [location.pathname, navItems]);

  useEffect(() => {
    if (pathBasedNav?.id) {
      setActiveNav(pathBasedNav.id);
    }
  }, [pathBasedNav?.id]);

  const handleLogout = async () => {
    try {
      await fetch("http://localhost:5000/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
    } catch {
      // Ignore errors and proceed with local cleanup.
    } finally {
      localStorage.removeItem("user");
      localStorage.removeItem("accessToken");
      navigate("/login");
    }
  };

  return (
    <div className="app">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-text">Urban<span>Pulse</span></div>
          <div className="logo-badge">{role}</div>
        </div>

        <div className="sidebar-user">
          <div
            className="user-avatar"
            style={{ background: `linear-gradient(135deg, ${roleColors[role]}, ${roleColors[role]}99)` }}
          >
            {userName.split(" ").map(n => n[0]).join("")}
          </div>
          <div className="user-info">
            <div className="user-name">{userName}</div>
            <div className="user-role">{role}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) =>
            item.type === "section" ? (
              <div key={item.id} className="nav-section-label">{item.label}</div>
            ) : (
              <div
                key={item.id}
                className={`nav-item ${activeNav === item.id ? "active" : ""}`}
                onClick={() => {
                  setActiveNav(item.id);
                  if (item.path) {
                    navigate(item.path);
                  }
                }}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
                {item.badge && <span className="nav-badge">{item.badge}</span>}
              </div>
            )
          )}
        </nav>

        <div className="sidebar-footer">
          <button
            className="logout-btn"
            onClick={handleLogout}
          >
            ⬤&nbsp; Logout
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main">
        <div className="topbar">
          <div className="topbar-title">
            {navItems.find(n => n.id === activeNav)?.label || "Dashboard"}
          </div>
          <div className="topbar-right">
            {statusLabel && (
              <div className="topbar-badge">
                <div className="status-dot" />
                {statusLabel}
              </div>
            )}
            <div className="notif-btn">
              🔔
              <div className="notif-dot" />
            </div>
          </div>
        </div>

        <div className="content">{children}</div>
      </div>
    </div>
  );
}

export default Layout;
