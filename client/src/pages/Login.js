import React from "react";

function Login() {
  return (
    <div style={{ textAlign: "center", padding: "50px" }}>
      <h2>Login to Urban Pulse</h2>
      <input type="text" placeholder="Email" style={{ padding: "10px", margin: "10px" }} /><br/>
      <input type="password" placeholder="Password" style={{ padding: "10px", margin: "10px" }} /><br/>
      <button style={{ padding: "10px 20px", backgroundColor: "blue", color: "white" }}>
        Sign In
      </button>
    </div>
  );
}

export default Login;