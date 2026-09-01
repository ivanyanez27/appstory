import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./brand.css";

// One view. Every path renders the canvas application, because the
// single-page-application fallback serves `index.html` for any route.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
