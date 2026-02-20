import React, { useState, useEffect } from "react";
import "./pageDesign/Ride.css";

const RidePage = () => {
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [distance, setDistance] = useState(null);
  const [eta, setEta] = useState(null);
  const [prices, setPrices] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);

  const [currentRide, setCurrentRide] = useState(null);
  const [rideStatus, setRideStatus] = useState(null);
  const [requestTime, setRequestTime] = useState(null);

  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");

  const vehicleRates = {
    bike: { base: 30, perKm: 12 },
    cng: { base: 50, perKm: 18 },
    car: { base: 80, perKm: 25 },
    micro: { base: 100, perKm: 30 },
  };

  const calculateRide = () => {
    if (!pickup || !destination) return;

    const fakeDistance = Math.floor(Math.random() * 15) + 1;
    const fakeEta = fakeDistance * 3;

    setDistance(fakeDistance);
    setEta(fakeEta);

    const calculatedPrices = {};
    Object.keys(vehicleRates).forEach((type) => {
      const rate = vehicleRates[type];
      calculatedPrices[type] =
        rate.base + fakeDistance * rate.perKm;
    });

    setPrices(calculatedPrices);
  };

  const confirmRide = () => {
    if (!selectedVehicle || !paymentMethod)
      return alert("Select vehicle and payment!");

    const ride = {
      pickup,
      destination,
      vehicle: selectedVehicle,
      price: prices[selectedVehicle],
      payment: paymentMethod,
    };

    setCurrentRide(ride);
    setRideStatus("waiting");
    setRequestTime(new Date().toLocaleTimeString());
  };

  useEffect(() => {
    if (rideStatus === "waiting") {
      const timer = setTimeout(() => {
        setRideStatus("picked");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [rideStatus]);

  const cancelRide = () => {
    setCurrentRide(null);
    setRideStatus(null);
    setPrices(null);
    setSelectedVehicle(null);
    setPaymentMethod(null);
    setPickup("");
    setDestination("");
    setMessages([]);
  };

  const sendMessage = () => {
    if (!chatInput) return;

    setMessages([...messages, { sender: "user", text: chatInput }]);
    setChatInput("");

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { sender: "driver", text: "On my way 🚗" },
      ]);
    }, 1500);
  };

  return (
    <div className="ride-container">

      {/* ================= SECTION 1 ================= */}
      <div className="section">

        {!currentRide ? (
          <>
            <h2>Book Ride</h2>

            <input
              placeholder="Pickup"
              value={pickup}
              onChange={(e) => setPickup(e.target.value)}
            />

            <input
              placeholder="Destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />

            <button onClick={calculateRide}>Check</button>

            {distance && (
              <>
                <p>Distance: {distance} km</p>
                <p>ETA: {eta} min</p>
              </>
            )}
          </>
        ) : (
          <>
            <h2>Ride Info</h2>

            <p>
              <strong>Status:</strong>{" "}
              {rideStatus === "waiting"
                ? "Waiting for driver..."
                : "Picked Up"}
            </p>

            <p><strong>Request Time:</strong> {requestTime}</p>
            <p><strong>Pickup:</strong> {currentRide.pickup}</p>
            <p><strong>Destination:</strong> {currentRide.destination}</p>
            <p><strong>Distance:</strong> {distance} km</p>
            <p><strong>Price:</strong> ৳ {currentRide.price}</p>
            <p><strong>Payment:</strong> {currentRide.payment}</p>
          </>
        )}

      </div>

      {/* ================= SECTION 2 ================= */}
      <div className="section">

        {!currentRide && prices && (
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

        {currentRide && (
          <>
            <h2>Driver Status</h2>

            <div className="driver-info">
              <p><strong>Name:</strong> Rahim Uddin</p>
              <p><strong>Vehicle No:</strong> DHAKA-METRO-12-3456</p>
              <p><strong>Rating:</strong> ⭐ 4.8</p>
              <p><strong>Phone:</strong> 017XXXXXXXX</p>
            </div>

            <div className="map-placeholder">Map Here</div>

            <button onClick={cancelRide}>Cancel Ride</button>
          </>
        )}

      </div>

      {/* ================= SECTION 3 ================= */}
      <div className="section">

        {!currentRide ? (
          <>
            <h2>Payment</h2>

            <div
              className={`pay-card ${
                paymentMethod === "cash" ? "selected" : ""
              }`}
              onClick={() => setPaymentMethod("cash")}
            >
              Cash
            </div>

            <div
              className={`pay-card ${
                paymentMethod === "wallet" ? "selected" : ""
              }`}
              onClick={() => setPaymentMethod("wallet")}
            >
              Wallet
            </div>

            {prices && (
              <button onClick={confirmRide}>
                Confirm Ride
              </button>
            )}
          </>
        ) : rideStatus === "picked" ? (
          <>
            <h2>Chat</h2>

            <div className="chat-box">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={
                    msg.sender === "user"
                      ? "user-msg"
                      : "driver-msg"
                  }
                >
                  {msg.text}
                </div>
              ))}
            </div>

            <div className="chat-input">
              <input
                value={chatInput}
                onChange={(e) =>
                  setChatInput(e.target.value)
                }
                placeholder="Type message..."
              />
              <button onClick={sendMessage}>
                Send
              </button>
            </div>
          </>
        ) : null}

      </div>

    </div>
  );
};

export default RidePage;