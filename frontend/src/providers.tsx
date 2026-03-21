// src/providers.tsx
// NeonAuthUIProvider setup for React SPA
// Enables Google OAuth button + pre-built auth pages

import { NeonAuthUIProvider } from "@neondatabase/auth/react/ui";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { authClient } from "./auth";
import type { ReactNode } from "react";

// Adapter so NeonAuth UI uses react-router-dom's Link
function Link({
  href,
  ...props
}: { href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <RouterLink to={href} {...(props as any)} />;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  return (
    <NeonAuthUIProvider
      authClient={authClient}
      navigate={(path) => navigate(path)}
      replace={(path) => navigate(path, { replace: true })}
      onSessionChange={() => {
        // Clear cached store data when auth state changes
      }}
      Link={Link}
      social={{
        providers: ["google"], // enables Google sign-in button
      }}
    >
      {children}
    </NeonAuthUIProvider>
  );
}
