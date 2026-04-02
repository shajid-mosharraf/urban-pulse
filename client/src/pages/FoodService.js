import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Search, MapPin, Star, Clock, ArrowLeft, 
  ShoppingBag, Plus, Minus
} from "lucide-react";
import { OpenStreetMapProvider } from "leaflet-geosearch";
import "./pageDesign/FoodpandaCustomer.css"; // We will create this next

const API_BASE = "http://localhost:5000";

// ============================================================================
// 2. REUSABLE UI COMPONENTS
// ============================================================================

const RestaurantCard = ({ restaurant, onClick }) => (
  <div className="fp-rest-card" onClick={() => onClick(restaurant)} role="button" tabIndex={0}>
    <div className="fp-rest-image-wrapper">
      <img
        src={restaurant.image || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80"}
        alt={restaurant.name}
        className="fp-rest-image"
      />
      <div className="fp-delivery-badge">Live Menu</div>
    </div>
    <div className="fp-rest-info">
      <div className="fp-rest-title-row">
        <h3 className="fp-rest-name">{restaurant.name}</h3>
        <span className="fp-rest-rating"><Star size={14} fill="#FFD700" color="#FFD700" /> {restaurant.rating}</span>
      </div>
      <p className="fp-rest-tags">Restaurant</p>
      <p className="fp-rest-address"><MapPin size={12} /> {restaurant.address || "Address unavailable"}</p>
    </div>
  </div>
);

const MenuItemCard = ({ item, cartQuantity, onAdd, onRemove }) => (
  <div className="fp-menu-card">
    <div className="fp-menu-content">
      <h4 className="fp-menu-name">{item.name}</h4>
      <p className="fp-menu-price">৳ {item.price}</p>
      <p className="fp-menu-desc">{item.description || "Freshly prepared."}</p>
    </div>
    <div className="fp-menu-media">
      <img
        src={item.image || "https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=300&q=80"}
        alt={item.name}
        className="fp-menu-img"
      />
      <div className="fp-menu-controls">
        {cartQuantity > 0 ? (
          <div className="fp-qty-control">
            <button type="button" className="fp-qty-btn" onClick={() => onRemove(item)}><Minus size={16} /></button>
            <span className="fp-qty-num">{cartQuantity}</span>
            <button type="button" className="fp-qty-btn" onClick={() => onAdd(item)}><Plus size={16} /></button>
          </div>
        ) : (
          <button type="button" className="fp-add-btn" onClick={() => onAdd(item)}>
            <Plus size={18} />
          </button>
        )}
      </div>
    </div>
  </div>
);

// ============================================================================
// 3. MAIN PAGE COMPONENT
// ============================================================================
const FoodServicePage = () => {
  const navigate = useNavigate();
  const deliverySearchTimerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRest, setSelectedRest] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  
  // Cart State
  const [cart, setCart] = useState([]);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCoords, setDeliveryCoords] = useState(null);
  const [deliverySuggestions, setDeliverySuggestions] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);
  const token = localStorage.getItem("accessToken");

  const geoProvider = useMemo(
    () =>
      new OpenStreetMapProvider({
        params: {
          countrycodes: "bd",
          limit: 5,
        },
      }),
    []
  );

  useEffect(() => {
    const loadRestaurants = async () => {
      if (!user?.user_id) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        setLoading(true);
        setError("");
        const response = await fetch(`${API_BASE}/api/customer/food/restaurants`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          credentials: "include",
        });

        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(data?.message || "Failed to load restaurants.");
        }

        const mappedRestaurants = (data.data || []).map((rest) => ({
          id: rest.restaurant_id,
          name: rest.name,
          address: [rest.address, rest.city].filter(Boolean).join(", ") || "Dhaka",
          rating: rest.rating || 0,
        }));
        setRestaurants(mappedRestaurants);
      } catch (err) {
        setError(err.message || "Failed to load restaurants.");
      } finally {
        setLoading(false);
      }
    };

    loadRestaurants();
  }, [navigate, token, user?.user_id]);

  // --- Handlers ---
  const handleSelectRestaurant = (restaurant) => {
    setSelectedRest(restaurant);
    setSearchTerm("");
    setCart([]);
    setSuccess("");
    setError("");
  };

  const handleBackToRestaurants = () => {
    setSelectedRest(null);
    setSearchTerm("");
    setMenuItems([]);
    setCart([]);
  };

  useEffect(() => {
    const loadMenu = async () => {
      if (!selectedRest?.id) return;

      try {
        setLoading(true);
        setError("");
        const response = await fetch(
          `${API_BASE}/api/customer/food/restaurants/${selectedRest.id}/menu`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: token ? `Bearer ${token}` : "",
            },
            credentials: "include",
          }
        );

        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(data?.message || "Failed to load menu.");
        }

        const mappedItems = (data.data?.items || [])
          .filter((item) => item.is_available)
          .map((item) => ({
            id: item.item_id,
            name: item.name,
            price: item.price,
            description: item.description,
          }));

        setMenuItems(mappedItems);
      } catch (err) {
        setError(err.message || "Failed to load menu.");
      } finally {
        setLoading(false);
      }
    };

    loadMenu();
  }, [selectedRest?.id, token]);

  const handleAddToCart = (item) => {
    const existing = cart.find(c => c.id === item.id);
    
    if (existing) {
      setCart(cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const handleRemoveFromCart = (item) => {
    const existing = cart.find(c => c.id === item.id);
    if (!existing) return;

    if (existing.quantity === 1) {
      setCart(cart.filter(c => c.id !== item.id));
    } else {
      setCart(cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity - 1 } : c));
    }
  };

  const handleCheckout = async () => {
    if (!user?.user_id || !selectedRest?.id || !cart.length) return;

    if (!deliveryAddress.trim() || !deliveryCoords) {
      setError("Please select your delivery location from suggestions or use GPS.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const payload = {
        restaurant_id: selectedRest.id,
        items: cart.map((item) => ({ item_id: item.id, quantity: item.quantity })),
        delivery_address_name: deliveryAddress,
        delivery_lat: deliveryCoords.latitude,
        delivery_lng: deliveryCoords.longitude,
        payment_method: paymentMethod,
      };

      const response = await fetch(`${API_BASE}/api/customer/${user.user_id}/food/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Failed to place order.");
      }

      setSuccess("Order placed. Waiting for restaurant to accept or reject.");
      setCart([]);
      setTimeout(() => navigate("/dashboard/customer"), 900);
    } catch (err) {
      setError(err.message || "Failed to place order.");
    } finally {
      setLoading(false);
    }
  };

  // --- Calculations ---
  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = cartSubtotal > 0 ? 50 : 0;
  const cartTotal = cartSubtotal + deliveryFee;

  const handleDeliveryAddressInput = (value) => {
    setDeliveryAddress(value);
    setDeliveryCoords(null);

    if (deliverySearchTimerRef.current) {
      clearTimeout(deliverySearchTimerRef.current);
    }

    if (!value || value.trim().length < 2) {
      setDeliverySuggestions([]);
      return;
    }

    deliverySearchTimerRef.current = setTimeout(async () => {
      try {
        const results = await geoProvider.search({ query: `${value}, Bangladesh` });
        setDeliverySuggestions(results || []);
      } catch {
        setDeliverySuggestions([]);
      }
    }, 350);
  };

  const selectDeliverySuggestion = (result) => {
    setDeliveryAddress(result.label);
    setDeliveryCoords({ latitude: Number(result.y), longitude: Number(result.x) });
    setDeliverySuggestions([]);
  };

  const useGpsForDelivery = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = Number(position.coords.latitude);
        const lng = Number(position.coords.longitude);

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
          );
          const data = await response.json();
          const label = data?.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          setDeliveryAddress(label);
        } catch {
          setDeliveryAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        }

        setDeliveryCoords({ latitude: lat, longitude: lng });
        setDeliverySuggestions([]);
      },
      () => {
        setError("Unable to get GPS location. Please allow location access.");
      }
    );
  };

  // --- Render Functions ---
  
  // View 1: Restaurant Grid
  const renderRestaurantGrid = () => {
    const filteredRests = restaurants.filter(r => 
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (r.address || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="fp-layout-container">
        <h2 className="fp-section-title">Food delivery in Dhaka</h2>
        <div className="fp-restaurant-grid">
          {filteredRests.length > 0 ? (
            filteredRests.map(r => (
              <RestaurantCard key={r.id} restaurant={r} onClick={handleSelectRestaurant} />
            ))
          ) : (
            <p className="fp-no-results">No restaurants found matching "{searchTerm}"</p>
          )}
        </div>
      </div>
    );
  };

  // View 2: Specific Restaurant Menu & Sticky Cart
  const renderMenuAndCart = () => {
    const filteredMenu = menuItems.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="fp-layout-container fp-store-layout">
        
        {/* Left Side: Store Info & Menu */}
        <div className="fp-store-main">
          <button type="button" className="fp-back-btn" onClick={handleBackToRestaurants}>
            <ArrowLeft size={20} /> Back to restaurants
          </button>
          
          <div className="fp-store-header">
            <img src={selectedRest.image} alt={selectedRest.name} className="fp-store-banner" />
            <div className="fp-store-header-info">
              <h1>{selectedRest.name}</h1>
              <p><Star size={16} fill="#D70F64" color="#D70F64" /> {selectedRest.rating} • Live Menu</p>
            </div>
          </div>

          <h3 className="fp-menu-title">Popular Items</h3>
          <div className="fp-menu-grid">
            {filteredMenu.map(item => {
              const cartItem = cart.find(c => c.id === item.id);
              return (
                <MenuItemCard 
                  key={item.id} 
                  item={item} 
                  cartQuantity={cartItem?.quantity || 0}
                  onAdd={handleAddToCart}
                  onRemove={handleRemoveFromCart}
                />
              )
            })}
          </div>
        </div>

        {/* Right Side: Sticky Cart */}
        <aside className="fp-cart-sidebar">
          <div className="fp-cart-sticky">
            <h2 className="fp-cart-title">Your Order</h2>
            
            {cart.length === 0 ? (
              <div className="fp-empty-cart">
                <ShoppingBag size={48} className="fp-empty-icon" />
                <p>Your cart is empty</p>
                <span>Add items to get started</span>
              </div>
            ) : (
              <div className="fp-cart-content">
                <div className="fp-cart-items">
                  {cart.map(item => (
                    <div key={item.id} className="fp-cart-item">
                      <div className="fp-cart-item-info">
                        <span className="fp-cart-qty">{item.quantity}x</span>
                        <span className="fp-cart-name">{item.name}</span>
                      </div>
                      <span className="fp-cart-price">৳ {item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>
                
                <div className="fp-cart-summary">
                  <div className="fp-summary-row" style={{ display: "block" }}>
                    <div style={{ marginBottom: "8px", fontWeight: 700 }}>Delivery Address</div>
                    <input
                      type="text"
                      value={deliveryAddress}
                      onChange={(e) => handleDeliveryAddressInput(e.target.value)}
                      placeholder="Search your delivery location"
                      style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #d1d5db" }}
                    />
                    <button type="button" onClick={useGpsForDelivery} style={{ marginTop: "8px" }}>
                      Use Current GPS Location
                    </button>
                    {deliverySuggestions.length > 0 && (
                      <div style={{ marginTop: "8px", border: "1px solid #ddd", borderRadius: "8px", maxHeight: "150px", overflowY: "auto", background: "white" }}>
                        {deliverySuggestions.map((item, index) => (
                          <div
                            key={`${item.x}-${item.y}-${index}`}
                            onClick={() => selectDeliverySuggestion(item)}
                            style={{ padding: "8px", cursor: "pointer", borderBottom: "1px solid #eee", fontSize: "0.9em" }}
                          >
                            {item.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="fp-summary-row">
                    <span>Subtotal</span>
                    <span>৳ {cartSubtotal}</span>
                  </div>
                  <div className="fp-summary-row">
                    <span>Delivery Fee</span>
                    <span>৳ {deliveryFee}</span>
                  </div>
                  <div className="fp-summary-row fp-total-row">
                    <span>Total</span>
                    <span>৳ {cartTotal}</span>
                  </div>

                  <div className="fp-summary-row" style={{ display: "block", marginTop: "12px" }}>
                    <div style={{ marginBottom: "8px", fontWeight: 700 }}>Payment Method</div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("cash")}
                        style={{
                          flex: 1,
                          padding: "10px",
                          borderRadius: "8px",
                          border: paymentMethod === "cash" ? "2px solid #111827" : "1px solid #d1d5db",
                          background: paymentMethod === "cash" ? "#f3f4f6" : "white",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Cash
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("wallet")}
                        style={{
                          flex: 1,
                          padding: "10px",
                          borderRadius: "8px",
                          border: paymentMethod === "wallet" ? "2px solid #111827" : "1px solid #d1d5db",
                          background: paymentMethod === "wallet" ? "#f3f4f6" : "white",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Wallet
                      </button>
                    </div>
                  </div>
                </div>

                <button type="button" className="fp-checkout-btn" onClick={handleCheckout}>
                  Place Order
                </button>
              </div>
            )}
          </div>
        </aside>

      </div>
    );
  };

  // --- Main Render ---
  return (
    <div className="fp-app-wrapper">
      {!!error && <div style={{ margin: "8px 20px", color: "#b91c1c", fontWeight: 700 }}>{error}</div>}
      {!!success && <div style={{ margin: "8px 20px", color: "#15803d", fontWeight: 700 }}>{success}</div>}
      
      {/* Universal Top Nav */}
      <nav className="fp-navbar">
        <div className="fp-nav-content">
          <div className="fp-logo" onClick={handleBackToRestaurants}>
            <span className="fp-brand-text">Urban</span><span className="fp-brand-highlight">Pulse</span> Food
          </div>
          <div className="fp-search-wrapper">
            <Search className="fp-search-icon" size={20} />
            <input 
              type="text" 
              className="fp-search-input"
              placeholder={selectedRest ? `Search in ${selectedRest.name}...` : "Search for restaurants or cuisines..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="fp-main">
        {loading ? <p style={{ padding: "12px 20px" }}>Loading...</p> : (!selectedRest ? renderRestaurantGrid() : renderMenuAndCart())}
      </main>

    </div>
  );
};

export default FoodServicePage;