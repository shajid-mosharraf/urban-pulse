import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = "http://localhost:5000";

function RestaurantMenuManager() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [menuItems, setMenuItems] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", price: "", description: "" });
  const [actionBusy, setActionBusy] = useState({});

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const token = localStorage.getItem("accessToken");

  // Load menu items
  const loadMenuItems = useCallback(async () => {
    if (!user?.user_id) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/restaurant/menu`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Failed to load menu items.");
      }

      setMenuItems(data.data || []);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load menu items.");
    } finally {
      setLoading(false);
    }
  }, [navigate, token, user?.user_id]);

  // Add new menu item
  const handleAddItem = useCallback(
    async (e) => {
      e.preventDefault();

      if (!formData.name || !formData.price) {
        setError("Name and price are required.");
        return;
      }

      try {
        setActionBusy((prev) => ({ ...prev, add: true }));

        const response = await fetch(`${API_BASE}/api/restaurant/menu`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          credentials: "include",
          body: JSON.stringify({
            name: formData.name,
            price: parseFloat(formData.price),
            description: formData.description || "",
          }),
        });

        const data = await response.json();

        if (!response.ok || !data?.success) {
          throw new Error(data?.message || "Failed to add menu item.");
        }

        setSuccess("Menu item added successfully!");
        setTimeout(() => setSuccess(""), 3000);
        setFormData({ name: "", price: "", description: "" });
        setShowAddForm(false);
        await loadMenuItems();
      } catch (err) {
        setError(err.message || "Failed to add menu item.");
      } finally {
        setActionBusy((prev) => ({ ...prev, add: false }));
      }
    },
    [formData, token, loadMenuItems]
  );

  // Toggle availability
  const handleToggleAvailability = useCallback(
    async (itemId, currentAvailability) => {
      try {
        setActionBusy((prev) => ({ ...prev, [itemId]: true }));

        const response = await fetch(
          `${API_BASE}/api/restaurant/menu/${itemId}/availability`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: token ? `Bearer ${token}` : "",
            },
            credentials: "include",
            body: JSON.stringify({ is_available: !currentAvailability }),
          }
        );

        const data = await response.json();

        if (!response.ok || !data?.success) {
          throw new Error(data?.message || "Failed to update availability.");
        }

        setSuccess("Availability updated!");
        setTimeout(() => setSuccess(""), 2000);
        await loadMenuItems();
      } catch (err) {
        setError(err.message || "Failed to update availability.");
      } finally {
        setActionBusy((prev) => ({ ...prev, [itemId]: false }));
      }
    },
    [token, loadMenuItems]
  );

  useEffect(() => {
    loadMenuItems();
  }, [loadMenuItems]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 20, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1>Restaurant Menu Manager</h1>
        <button
          onClick={() => navigate("/dashboard")}
          style={{
            padding: "8px 16px",
            background: "#6b7280",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Back to Dashboard
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: 12,
            background: "#fee2e2",
            color: "#991b1b",
            borderRadius: 6,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            padding: 12,
            background: "#dcfce7",
            color: "#166534",
            borderRadius: 6,
            marginBottom: 16,
          }}
        >
          {success}
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            padding: "10px 20px",
            background: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {showAddForm ? "Cancel" : "+ Add New Item"}
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAddItem}
          style={{
            padding: 20,
            background: "#f9fafb",
            borderRadius: 8,
            marginBottom: 20,
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
              Item Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Biryani"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 4,
                fontSize: 14,
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
              Price (BDT) *
            </label>
            <input
              type="number"
              value={formData.price}
              onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
              placeholder="e.g., 250"
              step="0.01"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 4,
                fontSize: 14,
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Item description..."
              rows="3"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 4,
                fontSize: 14,
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={actionBusy.add}
            style={{
              padding: "10px 20px",
              background: "#16a34a",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: actionBusy.add ? "default" : "pointer",
              fontWeight: 600,
              opacity: actionBusy.add ? 0.7 : 1,
            }}
          >
            {actionBusy.add ? "Adding..." : "Add Item"}
          </button>
        </form>
      )}

      {loading ? (
        <div>Loading menu items...</div>
      ) : menuItems.length ? (
        <div style={{ display: "grid", gap: 12 }}>
          {menuItems.map((item) => (
            <div
              key={item.item_id}
              style={{
                padding: 16,
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                  {item.name}
                </div>
                <div style={{ color: "#666", fontSize: 13, marginBottom: 4 }}>
                  ৳ {item.price}
                </div>
                {item.description && (
                  <div style={{ color: "#999", fontSize: 12 }}>{item.description}</div>
                )}
              </div>

              <button
                onClick={() => handleToggleAvailability(item.item_id, item.is_available)}
                disabled={actionBusy[item.item_id]}
                style={{
                  padding: "8px 16px",
                  background: item.is_available ? "#16a34a" : "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: actionBusy[item.item_id] ? "default" : "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  opacity: actionBusy[item.item_id] ? 0.7 : 1,
                }}
              >
                {actionBusy[item.item_id]
                  ? "Updating..."
                  : item.is_available
                    ? "Available"
                    : "Out of Stock"}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: 20, textAlign: "center", color: "#666" }}>
          No menu items yet. Add your first item above!
        </div>
      )}
    </div>
  );
}

export default RestaurantMenuManager;
