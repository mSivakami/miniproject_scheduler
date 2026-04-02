// src/auth.ts
import { createAuthClient } from "@neondatabase/auth";
import { BetterAuthReactAdapter } from "@neondatabase/auth/react/adapters";

export const authClient = createAuthClient(import.meta.env.VITE_NEON_AUTH_URL, {
  adapter: BetterAuthReactAdapter(),
});

// session.token is the JWT — confirmed from browser console
export async function getSessionToken(): Promise<string | null> {
  try {
    const result = await authClient.getSession();
    return (result.data?.session as any)?.token ?? null;
  } catch (e) {
    console.error("[auth] getSessionToken error:", e);
    return null;
  }
}
