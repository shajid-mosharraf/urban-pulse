import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import { OpenStreetMapProvider } from "leaflet-geosearch";
import L from "leaflet";
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

const RidePage = () => {
  // Free GraphHopper Key
  const GRAPHHOPPER_KEY = "Eikhane_api_key_ta_bosha"; // Paste your key here

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

  // Refs for Debouncing
  const pickupTimer = useRef(null);
  const destTimer = useRef(null);

  const vehicleRates = {
    bike: { base: 30, perKm: 12 },
    cng: { base: 50, perKm: 18 },
    car: { base: 80, perKm: 25 },
    micro: { base: 100, perKm: 30 },
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

  const confirmRide = () => {
    if (!selectedVehicle || !paymentMethod) return alert("Select vehicle and payment!");

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
    setRouteLine([]);
    setPickupCoords(null);
    setDestCoords(null);
  };

  const sendMessage = () => {
    if (!chatInput) return;
    setMessages([...messages, { sender: "user", text: chatInput }]);
    setChatInput("");
    setTimeout(() => {
      setMessages((prev) => [...prev, { sender: "driver", text: "On my way 🚗" }]);
    }, 1500);
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
            <p><strong>Status:</strong> {rideStatus === "waiting" ? "Waiting for driver..." : "Picked Up"}</p>
            <p><strong>Time:</strong> {requestTime}</p>
            <p><strong>From:</strong> {currentRide.pickup}</p>
            <p><strong>To:</strong> {currentRide.destination}</p>
            <p><strong>Distance:</strong> {distance} km</p>
            <p><strong>Price:</strong> ৳ {currentRide.price}</p>
            <p><strong>Payment:</strong> {currentRide.payment}</p>
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
      <div className="section">
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

        {currentRide && (
          <>
            <h2>Driver Status</h2>
            <div className="driver-info" style={{ background: "#f0f8ff", padding: "10px", borderRadius: "5px" }}>
              <p><strong>Name:</strong> Rahim Uddin</p>
              <p><strong>Vehicle:</strong> DHAKA-METRO-12-3456</p>
              <p><strong>Rating:</strong> ⭐ 4.8</p>
              <p><strong>Phone:</strong> 017XXXXXXXX</p>
            </div>
            <button onClick={cancelRide} style={{ marginTop: "15px", backgroundColor: "#dc3545", color: "white", width: "100%" }}>
              Cancel Ride
            </button>
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
        ) : rideStatus === "picked" ? (
          <>
            <h2>Chat with Driver</h2>
            <div className="chat-box" style={{ height: "150px", overflowY: "auto", border: "1px solid #ddd", padding: "10px", marginBottom: "10px", borderRadius: "5px", display: "flex", flexDirection: "column", gap: "5px" }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ alignSelf: msg.sender === "user" ? "flex-end" : "flex-start", background: msg.sender === "user" ? "#007bff" : "#e9ecef", color: msg.sender === "user" ? "white" : "black", padding: "5px 10px", borderRadius: "10px" }}>
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