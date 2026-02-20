import React, { useState, useEffect } from "react";
import "./pageDesign/ParcelDelivery.css";

const ParcelDeliveryPage = () => {
  // Parcel info
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [distance, setDistance] = useState(null);
  const [eta, setEta] = useState(null);

  // Parcel details
  const [weight, setWeight] = useState(1); // Weight approx
  const [receiverPhone, setReceiverPhone] = useState(""); // Receiver phone
  const [description, setDescription] = useState("");

  // Vehicle selection
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const vehicleRates = {
    motorcycle: { base: 30, perKm: 10 },
    pickup: { base: 50, perKm: 15 },
    cng: { base: 40, perKm: 12 },
  };
  const [prices, setPrices] = useState(null);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState(null);

  // Current parcel order & status
  const [currentParcel, setCurrentParcel] = useState(null);
  const [parcelStatus, setParcelStatus] = useState(null);
  const [requestTime, setRequestTime] = useState(null);

  // Chat messages
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");

  // Calculate distance & price
  const calculateParcel = () => {
    if (!pickup || !destination) return;

    const fakeDistance = Math.floor(Math.random() * 15) + 1; // km
    const fakeEta = fakeDistance * 3; // minutes
    setDistance(fakeDistance);
    setEta(fakeEta);

    const calculatedPrices = {};
    Object.keys(vehicleRates).forEach((type) => {
      const rate = vehicleRates[type];
      calculatedPrices[type] =
        rate.base + fakeDistance * rate.perKm + weight * 5;
    });
    setPrices(calculatedPrices);
  };

  const confirmParcel = () => {
    if (!selectedVehicle || !paymentMethod) {
      alert("Select vehicle and payment method!");
      return;
    }

    const parcel = {
      pickup,
      destination,
      vehicle: selectedVehicle,
      weight,
      receiverPhone,
      description,
      price: prices[selectedVehicle],
      payment: paymentMethod,
    };

    setCurrentParcel(parcel);
    setParcelStatus("waiting");
    setRequestTime(new Date().toLocaleTimeString());
  };

  // Simulate delivery progress
  useEffect(() => {
    if (parcelStatus === "waiting") {
      const timer = setTimeout(() => {
        setParcelStatus("picked");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [parcelStatus]);

  const cancelParcel = () => {
    setCurrentParcel(null);
    setParcelStatus(null);
    setPrices(null);
    setSelectedVehicle(null);
    setPaymentMethod(null);
    setPickup("");
    setDestination("");
    setWeight(1);
    setReceiverPhone("");
    setDescription("");
    setMessages([]);
  };

  const sendMessage = () => {
    if (!chatInput) return;
    setMessages([...messages, { sender: "user", text: chatInput }]);
    setChatInput("");

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { sender: "courier", text: "Parcel is on the way 📦" },
      ]);
    }, 1500);
  };

  return (
    <div className="parcel-container">
      {/* ================= SECTION 1 ================= */}
      <div className="section">
        {!currentParcel ? (
          <>
            <h2>Parcel Delivery</h2>

            <input
              placeholder="Pickup Location"
              value={pickup}
              onChange={(e) => setPickup(e.target.value)}
            />
            <input
              placeholder="Destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
            <input
              type="number"
              min="0.5"
              placeholder="Weight Approx (kg)"
              value={weight}
              onChange={(e) => setWeight(parseFloat(e.target.value))}
            />
            <input
              placeholder="Receiver Phone Number"
              value={receiverPhone}
              onChange={(e) => setReceiverPhone(e.target.value)}
            />
            <input
              placeholder="Parcel Description / Caution"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <button onClick={calculateParcel}>Check</button>

            {distance && (
              <>
                <p>Distance: {distance} km</p>
                <p>ETA: {eta} min</p>
              </>
            )}
          </>
        ) : (
          <>
            <h2>Parcel Info</h2>
            <p>
              <strong>Status:</strong>{" "}
              {parcelStatus === "waiting"
                ? "Waiting for courier..."
                : "Picked Up"}
            </p>
            <p><strong>Request Time:</strong> {requestTime}</p>
            <p><strong>Pickup:</strong> {currentParcel.pickup}</p>
            <p><strong>Destination:</strong> {currentParcel.destination}</p>
            <p><strong>Weight:</strong> {currentParcel.weight} kg</p>
            <p><strong>Receiver Phone:</strong> {currentParcel.receiverPhone}</p>
            <p><strong>Description:</strong> {currentParcel.description}</p>
            <p><strong>Price:</strong> ৳ {currentParcel.price}</p>
            <p><strong>Payment:</strong> {currentParcel.payment}</p>
          </>
        )}
      </div>

      {/* ================= SECTION 2 ================= */}
      <div className="section">
        {!currentParcel && prices && (
          <>
            <h2>Select Vehicle</h2>
            {Object.keys(prices).map((type) => (
              <div
                key={type}
                className={`vehicle-card ${
                  selectedVehicle === type ? "selected" : ""
                }`}
                onClick={() => setSelectedVehicle(type)}
              >
                <strong>{type.toUpperCase()}</strong>
                <p>৳ {prices[type]}</p>
              </div>
            ))}
          </>
        )}

        {currentParcel && (
          <>
            <h2>Courier Info</h2>
            <div className="driver-info">
              <p><strong>Name:</strong> Al Amin</p>
              <p><strong>Vehicle No:</strong> DHAKA-CNG-9876</p>
              <p><strong>Rating:</strong> ⭐ 4.7</p>
              <p><strong>Phone:</strong> 018XXXXXXXX</p>
            </div>
            <div className="map-placeholder">Map Here</div>
            <button onClick={cancelParcel}>Cancel Delivery</button>
          </>
        )}
      </div>

      {/* ================= SECTION 3 ================= */}
      <div className="section">
        {!currentParcel ? (
          <>
            <h2>Payment</h2>
            <div
              className={`pay-card ${paymentMethod === "cash" ? "selected" : ""}`}
              onClick={() => setPaymentMethod("cash")}
            >
              Cash
            </div>
            <div
              className={`pay-card ${paymentMethod === "wallet" ? "selected" : ""}`}
              onClick={() => setPaymentMethod("wallet")}
            >
              Wallet
            </div>

            {prices && (
              <button onClick={confirmParcel}>Confirm Delivery</button>
            )}
          </>
        ) : parcelStatus === "picked" ? (
          <>
            <h2>Chat</h2>
            <div className="chat-box">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={msg.sender === "user" ? "user-msg" : "driver-msg"}
                >
                  {msg.text}
                </div>
              ))}
            </div>
            <div className="chat-input">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type message..."
              />
              <button onClick={sendMessage}>Send</button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default ParcelDeliveryPage;