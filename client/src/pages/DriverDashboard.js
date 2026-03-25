import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import "./pageDesign/Driver.css"; // We'll create a little CSS for this

// Connect to your Node.js backend
const socket = io("http://localhost:5000");

const DriverDashboard = () => {
  // 1. Get the logged-in Driver's ID from localStorage
  const userString = localStorage.getItem("user");
  const loggedInDriver = userString ? JSON.parse(userString) : null;
  const driverId = loggedInDriver ? loggedInDriver.user_id : null;
  const accessToken = localStorage.getItem("accessToken");

  // 2. Component State
  const [isOnline, setIsOnline] = useState(false);
  const [incomingRide, setIncomingRide] = useState(null);
  const [activeRide, setActiveRide] = useState(null);
  const [rideFlowStatus, setRideFlowStatus] = useState(null);
  // (Put these right under your other state variables)
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [pickupOtpInput, setPickupOtpInput] = useState("");
  const [completionOtpCode, setCompletionOtpCode] = useState(null);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingMessage, setRatingMessage] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  const watchIdRef = useRef(null);

  // 3. Socket.io Listeners
  useEffect(() => {
    if (!driverId) return;

    // Listen for new ride requests broadcasted by the backend
    socket.on("new_ride_request", (rideData) => {
      console.log("INCOMING RIDE!", rideData);
      
      // Only show the popup if the driver isn't already on a ride
      if (!activeRide) {
        // Play a sound here in a real app! 🔔
        setIncomingRide(rideData);
      }
    });
    socket.on("receive_message", (messageData) => {
      setMessages((prev) => [...prev, messageData]);
    });

    socket.on("ride_picked_up", (payload) => {
      if (activeRide && Number(payload?.ride_id) === Number(activeRide.ride_id)) {
        setRideFlowStatus("in_progress");
      }
    });

    socket.on("ride_driver_completed", (payload) => {
      if (activeRide && Number(payload?.ride_id) === Number(activeRide.ride_id)) {
        setRideFlowStatus("waiting_customer_confirmation");
        if (payload?.completion_otp) {
          setCompletionOtpCode(payload.completion_otp);
        }
      }
    });

    socket.on("ride_completed", (payload) => {
      if (activeRide && Number(payload?.ride_id) === Number(activeRide.ride_id)) {
        setRideFlowStatus("completed");
      }
    });

    socket.on("ride_cancelled", (payload) => {
      if (activeRide && Number(payload?.ride_id) === Number(activeRide.ride_id)) {
        setActiveRide(null);
        setRideFlowStatus(null);
        setPickupOtpInput("");
        setCompletionOtpCode(null);
        setMessages([]);
      }
    });

    // Cleanup listener on unmount
    return () => {
      socket.off("new_ride_request");
      socket.off("receive_message");
      socket.off("ride_picked_up");
      socket.off("ride_driver_completed");
      socket.off("ride_completed");
      socket.off("ride_cancelled");
    };
  }, [driverId, activeRide]);

  // 4. Toggle Online/Offline Status
 const toggleOnlineStatus = () => {
    if (!isOnline) {
      // INSTANT FAILSAFE: Immediately put the driver in Dhaka so the DB is never NULL
      console.log("Setting failsafe coordinates to Dhaka...");
      socket.emit("update_location", { driver_id: driverId, lat: 23.8103, lng: 90.4125 });
      
      socket.emit("driver_online", driverId);
      setIsOnline(true);
      // 1. Ask browser for GPS permission and start tracking
      if ("geolocation" in navigator) {
        const id = navigator.geolocation.watchPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            // Send live coordinates to Node.js
            socket.emit("update_location", { driver_id: driverId, lat, lng });
          },
          (error) => {
            console.error("GPS Error:", error);
            alert("Please allow location access to receive rides!");
          },
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );
        watchIdRef.current = id; // Save the tracker ID
        
        socket.emit("driver_online", driverId);
        setIsOnline(true);
      } else {
        alert("Geolocation is not supported by your browser.");
      }
    } else {
      // 2. Stop Tracking when going offline
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      
      socket.emit("driver_offline", driverId);
      setIsOnline(false);
      setIncomingRide(null);
    }
  };

  // 5. Handle Accepting the Ride
  // 5. Handle Accepting the Ride
  const acceptRide = async () => {
    if (!incomingRide) return;

    try {
      // Send a request to the backend to officially claim this ride
      const response = await fetch("http://localhost:5000/api/rides/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: accessToken ? `Bearer ${accessToken}` : "",
        },
        credentials: "include",
        body: JSON.stringify({
          ride_id: incomingRide.ride_id,
        }),
      });

      const data = await response.json();

      if (response.ok && data?.success) {
        const payload = data.data || {};
        // We got it! Move from "incoming" to "active"
        setActiveRide(incomingRide);
        setRideFlowStatus("accepted");
        setIncomingRide(null);
        setPickupOtpInput("");
        setCompletionOtpCode(null);
        setRatingScore(5);
        setRatingComment("");
        setRatingMessage("");
        setRatingSubmitting(false);
        setRatingSubmitted(false);
        socket.emit("join_ride_room", incomingRide.ride_id);
        
        // SAFE FALLBACK: If driverDetails is missing, use an empty object so it doesn't crash!
        const safeDriver = payload.driverDetails || {};

        // Tell the server to notify the customer that we accepted!
        socket.emit("ride_accepted_by_driver", {
          ride_id: incomingRide.ride_id,
          driverDetails: {
            name: safeDriver.first_name || "Your Driver",
            phone: safeDriver.phone || "Phone not available",
            vehicle: safeDriver.licence_no || safeDriver.licence_id || "Vehicle not assigned",
            rating: safeDriver.rating_avg || "5.0"
          }
        });
      } else {
        alert("Sorry, another driver accepted this ride first! " + (data?.message || ""));
        setIncomingRide(null);
      }
    } catch (error) {
      console.error("Error accepting ride:", error);
    }
  };

  const declineRide = () => {
    setIncomingRide(null);
    // In a real app, you might emit an event so the server pings the NEXT closest driver
  };

  const startRide = async () => {
    if (!activeRide) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/driver/${driverId}/rides/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: accessToken ? `Bearer ${accessToken}` : "",
        },
        credentials: "include",
        body: JSON.stringify({
          ride_id: activeRide.ride_id,
          pickup_otp: pickupOtpInput,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to start ride.");
      }

      setRideFlowStatus("in_progress");
    } catch (error) {
      alert(error.message || "Unable to start ride.");
    }
  };

  const markRideForCompletion = async () => {
    if (!activeRide) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/driver/${driverId}/rides/end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: accessToken ? `Bearer ${accessToken}` : "",
        },
        credentials: "include",
        body: JSON.stringify({
          ride_id: activeRide.ride_id,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to mark ride completion.");
      }

      setRideFlowStatus("waiting_customer_confirmation");
      setCompletionOtpCode(data?.data?.completion_otp || null);
    } catch (error) {
      alert(error.message || "Unable to mark ride completion.");
    }
  };

  const submitCustomerRating = async () => {
    if (!activeRide?.ride_id) {
      return;
    }

    try {
      setRatingSubmitting(true);
      setRatingMessage("");

      const response = await fetch(`http://localhost:5000/api/rides/${activeRide.ride_id}/rate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: accessToken ? `Bearer ${accessToken}` : "",
        },
        credentials: "include",
        body: JSON.stringify({
          score: Number(ratingScore),
          comment: ratingComment.trim() || null,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to submit rating.");
      }

      setRatingSubmitted(true);
      setRatingMessage("Thanks. Your rating has been submitted.");
    } catch (error) {
      setRatingMessage(error.message || "Unable to submit rating.");
    } finally {
      setRatingSubmitting(false);
    }
  };

  const resetActiveRide = () => {
    setActiveRide(null);
    setRideFlowStatus(null);
    setMessages([]);
    setPickupOtpInput("");
    setCompletionOtpCode(null);
    setRatingScore(5);
    setRatingComment("");
    setRatingMessage("");
    setRatingSubmitting(false);
    setRatingSubmitted(false);
  };

  if (!driverId) {
    return <div className="driver-container"><h2>Please log in as a Driver first.</h2></div>;
  }

  return (
    <div className="driver-container">
      <div className="driver-header">
        <h2>Driver Dashboard</h2>
        <div className="status-toggle">
          <span className={isOnline ? "status-text online" : "status-text offline"}>
            {isOnline ? "🟢 Online" : "🔴 Offline"}
          </span>
          <button onClick={toggleOnlineStatus} className={isOnline ? "btn-stop" : "btn-start"}>
            {isOnline ? "Go Offline" : "Go Online"}
          </button>
        </div>
      </div>

      {/* --- IDLE STATE --- */}
      {isOnline && !incomingRide && !activeRide && (
        <div className="radar-container">
          <div className="radar"></div>
          <p>Searching for nearby riders...</p>
        </div>
      )}

      {/* --- INCOMING RIDE POPUP --- */}
      {incomingRide && (
        <div className="incoming-request-card">
          <div className="request-header">
            <h3>🚨 New Ride Request!</h3>
            <span className="price-tag">৳ {incomingRide.fare}</span>
          </div>
          <div className="request-details">
            <p><strong>Pickup:</strong> {incomingRide.pickup_address}</p>
            <p><strong>Dropoff:</strong> {incomingRide.dropoff_address}</p>
            <p><strong>Distance:</strong> {incomingRide.distance} km</p>
          </div>
          <div className="request-actions">
            <button className="btn-decline" onClick={declineRide}>Decline</button>
            <button className="btn-accept" onClick={acceptRide}>ACCEPT RIDE</button>
          </div>
        </div>
      )}

      {/* --- ACTIVE RIDE STATE --- */}
      {activeRide && (
        <div className="active-ride-card">
          <h3>🚗 Ride in Progress</h3>
          <p><strong>Pickup Customer At:</strong> {activeRide.pickup_address}</p>
          <p><strong>Destination:</strong> {activeRide.dropoff_address}</p>
          <p><strong>Status:</strong> {
            rideFlowStatus === "accepted"
              ? "Accepted - waiting to start"
              : rideFlowStatus === "in_progress"
              ? "In progress"
              : rideFlowStatus === "waiting_customer_confirmation"
              ? "Waiting for customer OTP confirmation"
              : rideFlowStatus === "completed"
              ? "Completed"
              : "Pending"
          }</p>

          {rideFlowStatus === "accepted" && (
            <div style={{ marginTop: "12px", marginBottom: "12px" }}>
              <p style={{ marginBottom: "8px" }}><strong>Enter pickup OTP to start ride:</strong></p>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  value={pickupOtpInput}
                  onChange={(e) => setPickupOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit pickup OTP"
                  inputMode="numeric"
                  maxLength={6}
                  style={{ flex: 1 }}
                />
                <button onClick={startRide} style={{ width: "auto" }}>Start Ride</button>
              </div>
            </div>
          )}

          {completionOtpCode && (
            <p><strong>Completion OTP:</strong> {completionOtpCode}</p>
          )}
          
          {/* DRIVER CHAT UI */}
          <div style={{ marginTop: "15px" }}>
            <h4>Chat with Customer</h4>
            <div className="chat-box" style={{ height: "150px", overflowY: "auto", border: "1px solid #ddd", padding: "10px", marginBottom: "10px", borderRadius: "5px", display: "flex", flexDirection: "column", gap: "5px" }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ alignSelf: msg.sender_role === "driver" ? "flex-end" : "flex-start", background: msg.sender_role === "driver" ? "#28a745" : "#e9ecef", color: msg.sender_role === "driver" ? "white" : "black", padding: "5px 10px", borderRadius: "10px" }}>
                  {msg.text}
                </div>
              ))}
            </div>
            <div className="chat-input" style={{ display: "flex", gap: "5px", marginBottom: "15px" }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Message customer..."
                style={{ flex: 1, padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
              />
              <button 
                onClick={() => {
                  if (!chatInput) return;
                  socket.emit("send_message", {
                    ride_id: activeRide.ride_id,
                    sender_id: driverId,
                    sender_role: "driver",
                    text: chatInput
                  });
                  setChatInput("");
                }}
              >
                Send
              </button>
            </div>
          </div>

          {rideFlowStatus === "in_progress" && (
            <button className="btn-complete" onClick={markRideForCompletion}>
              Complete Ride
            </button>
          )}

          {rideFlowStatus === "completed" && (
            <div style={{ marginTop: "14px", paddingTop: "10px", borderTop: "1px solid #e2e8f0" }}>
              <h4 style={{ marginTop: 0 }}>Rate Customer</h4>
              <div style={{ display: "grid", gap: "8px" }}>
                <label><strong>Score (out of 5)</strong></label>
                <select
                  value={ratingScore}
                  onChange={(e) => setRatingScore(Number(e.target.value))}
                  disabled={ratingSubmitted || ratingSubmitting}
                >
                  {[5, 4, 3, 2, 1].map((score) => (
                    <option key={score} value={score}>{score}</option>
                  ))}
                </select>
                <label><strong>Comment (optional)</strong></label>
                <textarea
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  rows={3}
                  placeholder="Share your feedback"
                  disabled={ratingSubmitted || ratingSubmitting}
                />
                {!ratingSubmitted && (
                  <button onClick={submitCustomerRating} disabled={ratingSubmitting}>
                    {ratingSubmitting ? "Submitting..." : "Submit Rating"}
                  </button>
                )}
                {ratingMessage && (
                  <p style={{ margin: 0, color: ratingSubmitted ? "#198754" : "#dc3545" }}>
                    {ratingMessage}
                  </p>
                )}
                <button onClick={resetActiveRide} style={{ backgroundColor: "#0d6efd", color: "white" }}>
                  Back to Waiting
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DriverDashboard;