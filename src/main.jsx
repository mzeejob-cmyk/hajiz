import React from "react"
import ReactDOM from "react-dom/client"
import App from "./app/App.jsx"
import "./index.css"
import "./design-system/index.css"
import "./features/home/home-v2.css"
import "./features/flights/flight-results-v2.css"
import "./features/flights/checkout-v2.css"
import "./features/flights/payments-v2.css"

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode><App /></React.StrictMode>,
)
