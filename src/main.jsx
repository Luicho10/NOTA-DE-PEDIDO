import React from "react";
import { createRoot } from "react-dom/client";
import AuthGate from "./AuthGate";
import "./styles.css";
import "./logo-original.css";
import "./currencyDisplay.js";

createRoot(document.getElementById("root")).render(<AuthGate />);
