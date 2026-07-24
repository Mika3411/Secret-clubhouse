import React from "react";
import { createRoot } from "react-dom/client";
import { PublicApp } from "./PublicApp.jsx";
import "./styles/tokens.css";
import "./fonts.css";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PublicApp />
  </React.StrictMode>,
);
