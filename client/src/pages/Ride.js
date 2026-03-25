import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import { OpenStreetMapProvider } from "leaflet-geosearch";
import L from "leaflet";
import io from "socket.io-client";
import { useNavigate } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import "./pageDesign/Ride.css";

// Fix for default Leaflet marker icons not rendering correctly in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

// Component to automatically center map when route updates
const MapUpdater = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);
  return null;
};
// A stylish green dot for the Pickup location
const pickupIcon = new L.divIcon({
  className: "custom-pickup-icon",
  html: `<div style="background-color: #28a745; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11] // Centers the dot directly over the coordinate
});

// A stylish black square for the Destination
const destIcon = new L.divIcon({
  className: "custom-dest-icon",
  html: `<div style="background-color: #000; width: 16px; height: 16px; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});
const socket = io("http://localhost:5000");

const RidePage = () => {
  const navigate = useNavigate();
  // Free GraphHopper Key
  const GRAPHHOPPER_KEY = "5aafda93-5123-4de4-a72d-fee29fc1e489"; // Paste your key here
  const userString = localStorage.getItem("user");
  const loggedInUser = userString ? JSON.parse(userString) : null;
  const actualUserId = loggedInUser ? loggedInUser.user_id : null;
  const accessToken = localStorage.getItem("accessToken");

  // Input & Dropdown States
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [destSuggestions, setDestSuggestions] = useState([]);
  
  // Coordinate & Map States
  const [pickupCoords, setPickupCoords] = useState(null);
  const [destCoords, setDestCoords] = useState(null);
  const [routeLine, setRouteLine] = useState([]);
  const [mapBounds, setMapBounds] = useState([]);

  // Ride Details States
  const [distance, setDistance] = useState(null);
  const [eta, setEta] = useState(null);
  const [prices, setPrices] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);

  // Active Ride States
  const [currentRide, setCurrentRide] = useState(null);
  const [rideStatus, setRideStatus] = useState(null);
  const [requestTime, setRequestTime] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  // NEW: Add a bucket to hold the driver's real info
  const [assignedDriver, setAssignedDriver] = useState(null);
  const [pickupOtpCode, setPickupOtpCode] = useState(null);
  const [completionOtpCode, setCompletionOtpCode] = useState(null);
  const [completionOtpInput, setCompletionOtpInput] = useState("");
  const [completionMessage, setCompletionMessage] = useState("");

  // Refs for Debouncing
  const pickupTimer = useRef(null);
  const destTimer = useRef(null);

  const vehicleRates = {
    bike: { base: 30, perKm: 12 },
    cng: { base: 50, perKm: 18 },
    car: { base: 80, perKm: 25 },
    micro: { base: 100, perKm: 30 },
  };

  const confirmCompletionOtp = async () => {
    if (!actualUserId || !currentRide?.ride_id) {
      return;
    }

    try {
      setCompletionMessage("");
      const response = await fetch(
        `http://localhost:5000/api/customer/${actualUserId}/rides/${currentRide.ride_id}/confirm`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: accessToken ? `Bearer ${accessToken}` : "",
          },
          credentials: "include",
          body: JSON.stringify({ otp: completionOtpInput }),
        }
      );

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to confirm completion OTP.");
      }

      setCompletionMessage("Ride completed successfully.");
      setRideStatus("completed");
      setCompletionOtpInput("");
      setTimeout(() => {
        navigate("/dashboard/customer");
      }, 1000);
    } catch (err) {
      setCompletionMessage(err.message || "Unable to confirm completion OTP.");
    }
  };
  
  const geoProvider = new OpenStreetMapProvider({
    params: {
      countrycodes: 'bd',
      limit: 5
    }
  });

  // --- AUTOCOMPLETE LOGIC ---
  const handleInputType = (text, type) => {
    if (type === "pickup") setPickup(text);
    else setDestination(text);

    if (text.length < 2) {
      if (type === "pickup") setPickupSuggestions([]);
      else setDestSuggestions([]);
      return;
    }

    const timerRef = type === "pickup" ? pickupTimer : destTimer;
    clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        const results = await geoProvider.search({ query: `${text}, Dhaka` });
        if (type === "pickup") setPickupSuggestions(results);
        else setDestSuggestions(results);
      } catch (error) {
        console.error("Search error:", error);
      }
    }, 500);
  };

  const handleSelectLocation = (location, type) => {
    // Keep UI clean (remove long address tails)
    const cleanName = location.label.split(',')[0];
    
    if (type === "pickup") {
      setPickup(cleanName);
      setPickupCoords([location.y, location.x]);
      setPickupSuggestions([]);
    } else {
      setDestination(cleanName);
      setDestCoords([location.y, location.x]);
      setDestSuggestions([]);
    }
  };

  // --- ROUTING LOGIC ---
  const calculateRide = async () => {
    if (!pickupCoords || !destCoords) {
      return alert("Please select locations from the dropdown suggestions.");
    }

    try {
      const url = `https://graphhopper.com/api/1/route?point=${pickupCoords[0]},${pickupCoords[1]}&point=${destCoords[0]},${destCoords[1]}&vehicle=car&locale=en&points_encoded=false&key=${GRAPHHOPPER_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.paths && data.paths.length > 0) {
        const path = data.paths[0];
        const realDistance = (path.distance / 1000).toFixed(1); // km
        const realEta = Math.round(path.time / 60000); // mins

        const formattedRoute = path.points.coordinates.map(coord => [coord[1], coord[0]]);
        
        setRouteLine(formattedRoute);
        setMapBounds([pickupCoords, destCoords]);
        setDistance(realDistance);
        setEta(realEta);

        const calculatedPrices = {};
        Object.keys(vehicleRates).forEach((type) => {
          const rate = vehicleRates[type];
          calculatedPrices[type] = Math.round(rate.base + realDistance * rate.perKm);
        });

        setPrices(calculatedPrices);
      } else {
        alert("Could not calculate a route between these points.");
      }
    } catch (error) {
      console.error("Routing error:", error);
      alert("Error connecting to routing service.");
    }
  };

  const confirmRide = async () => {
    if (!selectedVehicle || !paymentMethod) return alert("Select vehicle and payment!");
    
    if (!actualUserId) {
      return alert("You must be logged in as a customer to request a ride!");
    }

    const rideRequestData = {
      customer_id: actualUserId, // DYNAMIC USER ID!
      pickup_name: pickup,
      pickup_lat: pickupCoords[0],
      pickup_lng: pickupCoords[1],
      dropoff_name: destination,
      dropoff_lat: destCoords[0],
      dropoff_lng: destCoords[1],
      service_type: selectedVehicle,
      distance_km: distance,
      initial_fare: prices[selectedVehicle],
      payment_method: paymentMethod,
    };

    try {
      const response = await fetch("http://localhost:5000/api/rides/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: accessToken ? `Bearer ${accessToken}` : "",
        },
        credentials: "include",
        body: JSON.stringify(rideRequestData),
      });

      const data = await response.json();

      if (response.ok && data?.success) {
        const payload = data.data || {};
        const createdRide = payload.ride || {};
        console.log(`Ride requested! Pinging ${payload.nearbyDriversCount || 0} drivers.`);
        
        setCurrentRide({
          ride_id: createdRide.ride_id, // Save the DB ID so we can track it
          pickup,
          destination,
          vehicle: selectedVehicle,
          price: prices[selectedVehicle],
          payment: paymentMethod,
        });
        
        setRideStatus("waiting_driver");
        setRequestTime(new Date().toLocaleTimeString());

        // Tell the socket server that this customer is waiting
        if (createdRide.ride_id) {
          socket.emit("customer_waiting", createdRide.ride_id);
        }
      } else {
        alert("Failed to request ride: " + (data?.message || "Unknown error"));
      }
    } catch (error) {
      console.error("Server connection error:", error);
      alert("Could not connect to the server.");
    }
  };

  useEffect(() => {
    // Listen for the backend telling us a driver accepted!
    socket.on("ride_accepted", (driverDetails) => {
      console.log("A driver accepted your ride!", driverDetails);
      setRideStatus("driver_assigned");
      setAssignedDriver(driverDetails);
      if (driverDetails?.pickup_otp) {
        setPickupOtpCode(driverDetails.pickup_otp);
      }
    });

    socket.on("ride_picked_up", () => {
      setRideStatus("picked_up");
    });

    socket.on("ride_driver_completed", (payload) => {
      setRideStatus("waiting_completion_otp");
      if (payload?.completion_otp) {
        setCompletionOtpCode(payload.completion_otp);
      }
    });

    socket.on("ride_completed", () => {
      setRideStatus("completed");
      setTimeout(() => {
        navigate("/dashboard/customer");
      }, 1200);
    });

    socket.on("ride_cancelled", () => {
      setRideStatus("cancelled");
      setTimeout(() => {
        cancelRideLocal();
        navigate("/dashboard/customer");
      }, 800);
    });

    socket.on("receive_message", (messageData) => {
      console.log("Customer received message:", messageData); 
      setMessages((prevMessages) => [...prevMessages, messageData]);
    });

    // Cleanup the listener when the component unmounts
    return () => {
      socket.off("ride_accepted");
      socket.off("ride_picked_up");
      socket.off("ride_driver_completed");
      socket.off("ride_completed");
      socket.off("ride_cancelled");
      socket.off("receive_message");
    };
  }, [navigate]);

  const cancelRideLocal = () => {
    setCurrentRide(null);
    setRideStatus(null);
    setPrices(null);
    setSelectedVehicle(null);
    setPaymentMethod(null);
    setPickup("");
    setDestination("");
    setMessages([]);
    setRouteLine([]);
    setPickupCoords(null);
    setDestCoords(null);
    setAssignedDriver(null);
    setPickupOtpCode(null);
    setCompletionOtpCode(null);
    setCompletionOtpInput("");
    setCompletionMessage("");
  };

  const cancelRide = async () => {
    if (!currentRide?.ride_id) {
      cancelRideLocal();
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/rides/${currentRide.ride_id}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: accessToken ? `Bearer ${accessToken}` : "",
        },
        credentials: "include",
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to cancel ride.");
      }

      cancelRideLocal();
      navigate("/dashboard/customer");
    } catch (err) {
      alert(err.message || "Unable to cancel ride.");
    }
  };

  const sendMessage = () => {
    if (!chatInput || !currentRide) return;
    
    const messageData = {
      ride_id: currentRide.ride_id,
      sender_id: actualUserId, // NEW: Real DB ID!
      sender_role: "customer", // Helps the frontend know which color to make the bubble
      text: chatInput
    };

    socket.emit("send_message", messageData);
    setChatInput(""); 
  };

  return (
    <div className="ride-container">
      {/* ================= SECTION 1: SEARCH & RIDE INFO ================= */}
      <div className="section">
        {!currentRide ? (
          <>
            <h2>Book Ride</h2>
            
            <div className="autocomplete-wrapper">
              <input
                placeholder="Pickup Location (e.g. BUET)"
                value={pickup}
                onChange={(e) => handleInputType(e.target.value, "pickup")}
              />
              {pickupSuggestions.length > 0 && (
                <ul className="suggestions-list">
                  {pickupSuggestions.map((loc, index) => (
                    <li key={index} onClick={() => handleSelectLocation(loc, "pickup")}>
                      {loc.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="autocomplete-wrapper">
              <input
                placeholder="Destination (e.g. Dhanmondi)"
                value={destination}
                onChange={(e) => handleInputType(e.target.value, "dest")}
              />
              {destSuggestions.length > 0 && (
                <ul className="suggestions-list">
                  {destSuggestions.map((loc, index) => (
                    <li key={index} onClick={() => handleSelectLocation(loc, "dest")}>
                      {loc.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button onClick={calculateRide} style={{ width: "100%", marginTop: "10px" }}>
              Calculate Fare
            </button>

            {distance && (
              <div style={{ marginTop: "15px", padding: "10px", background: "#f9f9f9", borderRadius: "5px" }}>
                <p><strong>Distance:</strong> {distance} km</p>
                <p><strong>ETA:</strong> {eta} min</p>
              </div>
            )}
          </>
        ) : (
          <>
            <h2>Ride Info</h2>
            <p><strong>Status:</strong> {
              rideStatus === "waiting_driver" ? "Waiting for driver..." :
              rideStatus === "driver_assigned" ? "Driver Assigned" :
              rideStatus === "picked_up" ? "Picked Up" :
              rideStatus === "waiting_completion_otp" ? "Waiting completion confirmation" :
              rideStatus === "completed" ? "Completed" :
              rideStatus === "cancelled" ? "Cancelled" : "Pending"
            }</p>
            <p><strong>Time:</strong> {requestTime}</p>
            <p><strong>From:</strong> {currentRide.pickup}</p>
            <p><strong>To:</strong> {currentRide.destination}</p>
            <p><strong>Distance:</strong> {distance} km</p>
            <p><strong>Price:</strong> ৳ {currentRide.price}</p>
            <p><strong>Payment:</strong> {currentRide.payment}</p>
            {pickupOtpCode && <p><strong>Pickup OTP:</strong> {pickupOtpCode}</p>}
            {completionOtpCode && <p><strong>Completion OTP:</strong> {completionOtpCode}</p>}
          </>
        )}
      </div>

      {/* ================= SECTION 2: MAP ================= */}
      {(pickupCoords || destCoords) && (
        <div className="section map-section">
          <MapContainer 
            center={pickupCoords || [23.8103, 90.4125]} 
            zoom={13} 
            className="leaflet-map-container"
          >
            {/* Sleek Light Theme (Carto Voyager) */}
<TileLayer 
  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
/>
            
            {pickupCoords && (
  <Marker position={pickupCoords} icon={pickupIcon}>
    <Popup>Pickup: {pickup}</Popup>
  </Marker>
)}

{destCoords && (
  <Marker position={destCoords} icon={destIcon}>
    <Popup>Dropoff: {destination}</Popup>
  </Marker>
)}

           {routeLine.length > 0 && (
  <>
    {/* Thick background line for the border/shadow */}
    <Polyline positions={routeLine} color="#000000" weight={7} opacity={0.6} />
    {/* Thinner inner line for the actual path */}
    <Polyline positions={routeLine} color="#00a8ff" weight={4} opacity={1} />
  </>
)}
            
            <MapUpdater bounds={mapBounds} />
          </MapContainer>
        </div>
      )}

      {/* ================= SECTION 3: VEHICLES & DRIVER STATUS ================= */}
      {/* ================= SECTION 3: VEHICLES & DRIVER STATUS ================= */}
      <div className="section">
        
        {/* State 1: Before confirming ride (Show Vehicles) */}
        {!currentRide && prices && (
          <>
            <h2>Select Vehicle</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              {Object.keys(prices).map((type) => (
                <div
                  key={type}
                  className={`vehicle-card ${selectedVehicle === type ? "selected" : ""}`}
                  onClick={() => setSelectedVehicle(type)}
                  style={{ padding: "10px", border: "1px solid #ddd", borderRadius: "5px", cursor: "pointer", textAlign: "center" }}
                >
                  <strong>{type.toUpperCase()}</strong>
                  <p style={{ margin: "5px 0 0 0" }}>৳ {prices[type]}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* State 2: Ride Confirmed, Waiting for Driver to Accept */}
        {currentRide && !assignedDriver && rideStatus === "waiting_driver" && (
          <>
            <h2>Driver Status</h2>
            <div className="driver-info" style={{ background: "#fff3cd", padding: "15px", borderRadius: "5px", textAlign: "center" }}>
              <h4 style={{ margin: 0, color: "#856404" }}>⏳ Request Sent!</h4>
              <p style={{ margin: "5px 0 0 0", color: "#856404" }}>Waiting for a nearby driver to accept...</p>
            </div>
            <button onClick={cancelRide} style={{ marginTop: "15px", backgroundColor: "#dc3545", color: "white", width: "100%" }}>
              Cancel Request
            </button>
          </>
        )}

        {/* State 3: Driver Accepted! Show their real info */}
        {currentRide && assignedDriver && ["driver_assigned", "picked_up", "waiting_completion_otp"].includes(rideStatus) && (
          <>
            <h2>Driver Status</h2>
            <div className="driver-info" style={{ background: "#d4edda", padding: "10px", borderRadius: "5px", border: "1px solid #c3e6cb" }}>
              <p><strong>Name:</strong> {assignedDriver.name}</p>
              <p><strong>Vehicle:</strong> {assignedDriver.vehicle}</p>
              <p><strong>Rating:</strong> ⭐ {assignedDriver.rating || "5.0"}</p>
              <p><strong>Phone:</strong> {assignedDriver.phone}</p>
              {pickupOtpCode && <p><strong>Pickup OTP:</strong> {pickupOtpCode}</p>}
              {completionOtpCode && <p><strong>Completion OTP:</strong> {completionOtpCode}</p>}
              {rideStatus === "waiting_completion_otp" && (
                <div style={{ marginTop: "8px" }}>
                  <p style={{ margin: "6px 0" }}><strong>Enter completion OTP to finish ride:</strong></p>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      value={completionOtpInput}
                      onChange={(e) => setCompletionOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="Enter completion OTP"
                      inputMode="numeric"
                      maxLength={6}
                      style={{ flex: 1, minWidth: 0, marginBottom: 0 }}
                    />
                    <button onClick={confirmCompletionOtp} style={{ width: "auto", marginTop: 0, padding: "10px 14px" }}>Confirm</button>
                  </div>
                  {completionMessage && (
                    <p style={{ marginTop: "8px", color: completionMessage.toLowerCase().includes("success") ? "#198754" : "#dc3545" }}>
                      {completionMessage}
                    </p>
                  )}
                </div>
              )}
            </div>
            {rideStatus === "driver_assigned" && (
              <button onClick={cancelRide} style={{ marginTop: "15px", backgroundColor: "#dc3545", color: "white", width: "100%" }}>
                Cancel Ride
              </button>
            )}
          </>
        )}
      </div>

      {/* ================= SECTION 4: PAYMENT & CHAT ================= */}
      <div className="section">
        {!currentRide ? (
          <>
            <h2>Payment</h2>
            <div style={{ display: "flex", gap: "10px" }}>
              <div
                className={`pay-card ${paymentMethod === "cash" ? "selected" : ""}`}
                onClick={() => setPaymentMethod("cash")}
                style={{ flex: 1, padding: "10px", border: "1px solid #ddd", borderRadius: "5px", cursor: "pointer", textAlign: "center" }}
              >
                Cash
              </div>
              <div
                className={`pay-card ${paymentMethod === "wallet" ? "selected" : ""}`}
                onClick={() => setPaymentMethod("wallet")}
                style={{ flex: 1, padding: "10px", border: "1px solid #ddd", borderRadius: "5px", cursor: "pointer", textAlign: "center" }}
              >
                Wallet
              </div>
            </div>

            {prices && (
              <button onClick={confirmRide} style={{ marginTop: "15px", width: "100%", backgroundColor: "#28a745", color: "white" }}>
                Confirm Ride
              </button>
            )}
          </>
        ) : ["driver_assigned", "picked_up", "waiting_completion_otp"].includes(rideStatus) ? (
          <>
            <h2>Chat with Driver</h2>
            <div className="chat-box" style={{ height: "150px", overflowY: "auto", border: "1px solid #ddd", padding: "10px", marginBottom: "10px", borderRadius: "5px", display: "flex", flexDirection: "column", gap: "5px" }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ 
                  alignSelf: msg.sender_role === "customer" ? "flex-end" : "flex-start", 
                  background: msg.sender_role === "customer" ? "#007bff" : "#e9ecef", 
                  color: msg.sender_role === "customer" ? "white" : "black", 
                  padding: "5px 10px", 
                  borderRadius: "10px",
                  maxWidth: "75%"
                }}>
                  {msg.text}
                </div>
              ))}
            </div>

            <div className="chat-input" style={{ display: "flex", gap: "5px" }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type message..."
                style={{ flex: 1 }}
              />
              <button onClick={sendMessage}>Send</button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default RidePage;