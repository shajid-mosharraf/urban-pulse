import React, { useState } from "react";
import "./pageDesign/FoodService.css";
import { useNavigate } from "react-router-dom";

const FoodServicePage = () => {

  const navigate = useNavigate();

  // 🔥 Section 1: Restaurants (Fake Data)
  // TODO API CALLING: Fetch restaurants from backend
  const restaurants = [
    { id: 1, name: "Spice Garden", address: "12 Main Street, Downtown" },
    { id: 2, name: "Urban Bites", address: "45 Lake Road, City Center" },
    { id: 3, name: "Royal Kitchen", address: "78 Market Avenue" }
  ];

  // 🔥 Section 2: Food Items (Fake Data)
  // TODO API CALLING: Fetch menu by restaurant id
  const foodData = {
    1: [
      { id: 1, name: "Chicken Biryani", price: 250, image: "/images/food1.jpg" },
      { id: 2, name: "Beef Curry", price: 300, image: "/images/food2.jpg" }
    ],
    2: [
      { id: 3, name: "Burger", price: 200, image: "/images/food3.jpg" },
      { id: 4, name: "Pizza", price: 400, image: "/images/food4.jpg" }
    ],
    3: [
      { id: 5, name: "Pasta", price: 350, image: "/images/food5.jpg" },
      { id: 6, name: "Grilled Chicken", price: 450, image: "/images/food6.jpg" }
    ]
  };

  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // 🔥 Enforce Single Restaurant Ordering
  const handleRestaurantSelect = (restaurantId) => {
    if (selectedRestaurant && selectedRestaurant !== restaurantId) {
      setCart([]); // Auto clear cart
    }
    setSelectedRestaurant(restaurantId);
  };

  // 🔥 Add to cart
  const addToCart = (item, quantity) => {
    if (quantity <= 0) return;

    const existing = cart.find(c => c.id === item.id);

    if (existing) {
      setCart(cart.map(c =>
        c.id === item.id
          ? { ...c, quantity: c.quantity + quantity }
          : c
      ));
    } else {
      setCart([...cart, { ...item, quantity }]);
    }
  };

  // 🔥 Remove item
  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  // 🔥 Decrease quantity
  const decreaseQuantity = (id) => {
    setCart(cart.map(item =>
      item.id === id
        ? item.quantity > 1
          ? { ...item, quantity: item.quantity - 1 }
          : item
        : item
    ));
  };

  const totalPrice = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const handleConfirm = () => {
    if (cart.length === 0) {
      alert("Your cart is empty!");
      return;
    }

    alert("Order sent to restaurant. Waiting for confirmation...");

    // TODO API CALLING: Send order to backend

    setCart([]);
    setSelectedRestaurant(null);

    setTimeout(() => {
      navigate("/customer");
    }, 1500);
  };

  // 🔥 SEARCH LOGIC
  const allFoods = Object.keys(foodData).flatMap(restId =>
    foodData[restId].map(food => ({
      ...food,
      restaurantId: parseInt(restId)
    }))
  );

  const filteredFoods = allFoods.filter(food =>
    food.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="food-container">

      {/* 🔍 SEARCH BAR */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search food..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <div className="search-results">
            {filteredFoods.map(food => (
              <div
                key={food.id}
                className="search-item"
                onClick={() => {
                  handleRestaurantSelect(food.restaurantId);
                  setSearchTerm("");
                }}
              >
                {food.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 1 - Restaurants */}
      <div className="restaurant-section">
        <h2>Restaurants</h2>
        {restaurants.map(r => (
          <div
            key={r.id}
            className={`restaurant-item ${
              selectedRestaurant === r.id ? "active-restaurant" : ""
            }`}
            onClick={() => handleRestaurantSelect(r.id)}
          >
            <h3>{r.name}</h3>
            <p>{r.address}</p>
          </div>
        ))}
      </div>

      {/* SECTION 2 - Menu */}
      <div className="food-section">
        <h2>Menu</h2>

        {selectedRestaurant &&
          foodData[selectedRestaurant].map(item => (
            <FoodCard
              key={item.id}
              item={item}
              addToCart={addToCart}
            />
          ))
        }
      </div>

      {/* SECTION 3 - Cart */}
      <div className="cart-section">
        <h2>Your Order</h2>

        {cart.map(item => (
          <div key={item.id} className="cart-item">

            <div>
              <strong>{item.name}</strong><br />
              {item.quantity} x {item.price} = {item.price * item.quantity}
            </div>

            <div className="cart-buttons">
              <button onClick={() => decreaseQuantity(item.id)}>-</button>
              <button onClick={() => removeFromCart(item.id)}>Remove</button>
            </div>

          </div>
        ))}

        <div className="total-price">
          Total: {totalPrice}
        </div>

        <button className="confirm-btn" onClick={handleConfirm}>
          Confirm & Pay
        </button>
      </div>

    </div>
  );
};

// 🔥 Food Card Component
const FoodCard = ({ item, addToCart }) => {
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="food-card">
      <img src={item.image} alt={item.name} />
      <h3>{item.name}</h3>
      <p>Price: {item.price}</p>

      <input
        type="number"
        min="1"
        value={quantity}
        onChange={(e) => setQuantity(parseInt(e.target.value))}
      />

      <button onClick={() => addToCart(item, quantity)}>
        Select
      </button>
    </div>
  );
};

export default FoodServicePage;