import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Globals } from "@react-spring/web";
import App from "./App";
import "./styles.css";

// With reduced motion, springs jump to their end at once
if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) Globals.assign({ skipAnimation: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
