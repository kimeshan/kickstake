import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

const baseURL =
  typeof window !== "undefined"
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3801");

export const authClient = createAuthClient({
  baseURL,
  basePath: "/api/auth",
  plugins: [emailOTPClient()],
  fetchOptions: {
    credentials: "include",
  },
});

export const { useSession, signIn, signOut, emailOtp } = authClient;
