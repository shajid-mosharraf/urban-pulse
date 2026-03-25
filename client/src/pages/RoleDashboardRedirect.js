import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const RoleDashboardRedirect = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const userRaw = localStorage.getItem("user");

    if (!userRaw) {
      navigate("/login", { replace: true });
      return;
    }

    let parsedUser = null;
    try {
      parsedUser = JSON.parse(userRaw);
    } catch (err) {
      localStorage.removeItem("user");
      localStorage.removeItem("accessToken");
      navigate("/login", { replace: true });
      return;
    }

    const role = (parsedUser?.role || "").toLowerCase();

    if (role === "customer") {
      navigate("/dashboard/customer", { replace: true });
      return;
    }

    if (role === "driver") {
      navigate("/dashboard/driver", { replace: true });
      return;
    }

    if (role === "restaurant") {
      navigate("/dashboard/restaurant", { replace: true });
      return;
    }

    if (role === "admin") {
      navigate("/dashboard/admin", { replace: true });
      return;
    }

    navigate("/login", { replace: true });
  }, [navigate]);

  return <div style={{ padding: "24px" }}>Redirecting to your dashboard...</div>;
};

export default RoleDashboardRedirect;
