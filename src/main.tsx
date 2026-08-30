import { lazy, StrictMode, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Landing } from "./Landing.tsx";
import "./brand.css";

// The canvas app pulls in tldraw (~1.9 MB). Load it only when a visitor opens
// `/app`, so the landing page stays light.
const App = lazy(() => import("./App.tsx"));

const APP_PATH = "/app";

function Root() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = (next: string) => {
    if (window.location.pathname !== next) {
      window.history.pushState(null, "", next);
    }
    setPath(next);
  };

  if (path === APP_PATH) {
    return (
      <Suspense fallback={null}>
        <App />
      </Suspense>
    );
  }
  return <Landing onLaunch={() => navigate(APP_PATH)} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
