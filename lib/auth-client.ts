import { createAuthClient } from "better-auth/react";
import {
  convexClient,
  crossDomainClient,
} from "@convex-dev/better-auth/client/plugins";
// Talks directly to the Convex-hosted Better Auth routes (cross-domain
// setup — no Next.js /api/auth proxy route needed).
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_CONVEX_SITE_URL!,
  plugins: [convexClient(), crossDomainClient()],
});
