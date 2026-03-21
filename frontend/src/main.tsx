// src/main.tsx
// Wraps app with BrowserRouter + NeonAuthUIProvider
// Required for AuthView (Google OAuth, sign-in/sign-up pages)
// Per: neon-auth-setup-react-spa.md

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@neondatabase/auth/ui/css";
import App from "./App";
import { AuthProvider } from "./providers";
import "./App.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
