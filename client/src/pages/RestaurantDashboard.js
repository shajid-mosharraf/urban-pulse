import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Store, UtensilsCrossed, Clock, CheckCircle2, 
  ChevronRight, AlertCircle, TrendingUp, Power, Star
} from "lucide-react";
import "./pageDesign/FoodpandaTheme.css"; // The new CSS file

const API_BASE = "http://localhost:5000";

// ============================================================================
// SUB-COMPONENTS (Built for a Tablet POS Interface)
// ============================================================================

const OrderCard = ({ order, onAccept, onReady }) => {
  const isNew = order.status === "Placed";
  
  return (
    <div className={`fp-order-card ${isNew ? 'pulse-new' : ''}`}>
      <div className="fp-order-header">
        <span className="fp-order-id">#{order.order_id}</span>
        <span className="fp-order-time">
          <Clock size={14} /> {new Date(order.order_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </span>
      </div>
      
      <div className="fp-order-body">
        <p className="fp-customer-name">{order.customer_name || "Customer"}</p>
        <p className="fp-order-price">৳ {order.total_price}</p>
        
        {/* Mapping to your order_details table */}
        <ul className="fp-item-list">
          {order.items?.map((item, idx) => (
            <li key={idx}>
              <span className="fp-qty">{item.quantity}x</span> {item.name}
            </li>
          ))}
        </ul>
      </div>

      <div className="fp-order-footer">
        {isNew && (
          <button className="fp-btn-primary full-width" onClick={() => onAccept(order.order_id)}>
            Accept Order
          </button>
        )}
        {order.status === "Preparing" && (
          <button className="fp-btn-success full-width" onClick={() => onReady(order.order_id)}>
            <CheckCircle2 size={18} /> Mark as Ready
          </button>
        )}
      </div>
    </div>
  );
};

const MenuAvailabilityToggle = ({ item, onToggle }) => (
  <div className="fp-menu-toggle-card">
    <div>
      <p className="fp-menu-name">{item.name}</p>
      <p className="fp-menu-price">৳ {item.price}</p>
    </div>
    <label className="fp-switch">
      <input 
        type="checkbox" 
        checked={item.is_available} 
        onChange={() => onToggle(item.item_id, !item.is_available)} 
      />
      <span className="fp-slider round"></span>
    </label>
  </div>
);

// ============================================================================
// MAIN COMPONENT: The Merchant POS
// ============================================================================

const RestaurantTablet = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Placed"); // Maps to food_orders.status
  const [data, setData] = useState({
    restaurant: {},
    orders: [],
    menu: []
  });

  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "null"); } 
    catch { return null; }
  }, []);

  useEffect(() => {
    // Simulated API call matching your DB schema
    const fetchTabletData = async () => {
      setLoading(true);
      try {
        // In reality, this fetches from your API
        // const response = await fetch(`${API_BASE}/api/restaurant/live/${user.user_id}`);
        
        // Mocking the database shape for demonstration
        setTimeout(() => {
          setData({
            restaurant: { name: "Burger King", rating: 4.8, is_open: true },
            orders: [
              { order_id: 1042, status: "Placed", total_price: 450, order_time: new Date().toISOString(), items: [{ quantity: 2, name: "Whopper" }, { quantity: 1, name: "Fries" }] },
              { order_id: 1043, status: "Placed", total_price: 220, order_time: new Date().toISOString(), items: [{ quantity: 1, name: "Chicken Royale" }] },
              { order_id: 1040, status: "Preparing", total_price: 890, order_time: new Date(Date.now() - 600000).toISOString(), items: [{ quantity: 3, name: "Spicy Wrap" }] },
            ],
            menu: [
              { item_id: 1, name: "Whopper", price: 300, is_available: true },
              { item_id: 2, name: "Fries", price: 150, is_available: false },
            ]
          });
          setLoading(false);
        }, 800);
      } catch (err) {
        console.error(err);
      }
    };

    if (user) fetchTabletData();
    else navigate("/login");
  }, [user, navigate]);

  const updateOrderStatus = (orderId, newStatus) => {
    setData(prev => ({
      ...prev,
      orders: prev.orders.map(o => o.order_id === orderId ? { ...o, status: newStatus } : o)
    }));
    // TODO: Fire API call to UPDATE food_orders SET status = newStatus WHERE order_id = orderId
  };

  const toggleMenuItem = (itemId, newStatus) => {
    setData(prev => ({
      ...prev,
      menu: prev.menu.map(m => m.item_id === itemId ? { ...m, is_available: newStatus } : m)
    }));
    // TODO: Fire API call to UPDATE menu_items SET is_available = newStatus WHERE item_id = itemId
  };

  if (loading) {
    return <div className="fp-loader"><UtensilsCrossed className="fp-spin" size={48} /></div>;
  }

  const filteredOrders = data.orders.filter(o => o.status === activeTab);

  return (
    <div className="fp-tablet-layout">
      
      {/* LEFT SIDEBAR: Navigation & Stats */}
      <aside className="fp-sidebar">
        <div className="fp-brand">
          <Store size={28} />
          <h2>Merchant App</h2>
        </div>

        <div className="fp-restaurant-info">
          <h3>{data.restaurant.name}</h3>
          <div className="fp-rating"><Star size={16} fill="#FFD700" color="#FFD700"/> {data.restaurant.rating} Rating</div>
        </div>

        <div className="fp-nav-menu">
          <button className="fp-nav-item active"><UtensilsCrossed size={20} /> Live Orders</button>
          <button className="fp-nav-item"><TrendingUp size={20} /> Performance</button>
        </div>

        <div className="fp-store-status">
          <p>Store Status</p>
          <button className={`fp-status-toggle ${data.restaurant.is_open ? 'open' : 'closed'}`}>
            <Power size={18} /> {data.restaurant.is_open ? "Accepting Orders" : "Closed"}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT: Kanban Order System */}
      <main className="fp-main-content">
        <header className="fp-main-header">
          <h1>Live Orders</h1>
          <div className="fp-tabs">
            <button className={`fp-tab ${activeTab === 'Placed' ? 'active' : ''}`} onClick={() => setActiveTab('Placed')}>
              New Requests <span className="fp-badge">{data.orders.filter(o => o.status === 'Placed').length}</span>
            </button>
            <button className={`fp-tab ${activeTab === 'Preparing' ? 'active' : ''}`} onClick={() => setActiveTab('Preparing')}>
              Preparing <span className="fp-badge">{data.orders.filter(o => o.status === 'Preparing').length}</span>
            </button>
            <button className={`fp-tab ${activeTab === 'Ready' ? 'active' : ''}`} onClick={() => setActiveTab('Ready')}>
              Ready for Pickup
            </button>
          </div>
        </header>

        <div className="fp-order-grid">
          {filteredOrders.length > 0 ? (
            filteredOrders.map(order => (
              <OrderCard 
                key={order.order_id} 
                order={order} 
                onAccept={(id) => updateOrderStatus(id, 'Preparing')}
                onReady={(id) => updateOrderStatus(id, 'Ready')}
              />
            ))
          ) : (
            <div className="fp-empty-orders">
              <AlertCircle size={48} />
              <h2>No {activeTab} Orders</h2>
              <p>When customers place an order, it will appear here.</p>
            </div>
          )}
        </div>
      </main>

      {/* RIGHT SIDEBAR: Quick Menu Toggles */}
      <aside className="fp-right-sidebar">
        <div className="fp-right-header">
          <h2>Menu Availability</h2>
          <p>Turn off items that are out of stock to prevent cancellations.</p>
        </div>
        
        <div className="fp-menu-list">
          {data.menu.map(item => (
            <MenuAvailabilityToggle 
              key={item.item_id} 
              item={item} 
              onToggle={toggleMenuItem} 
            />
          ))}
        </div>
      </aside>

    </div>
  );
};

export default RestaurantTablet;