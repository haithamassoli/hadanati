"use client";

import type { ReactNode } from "react";
import {
  ConvexBetterAuthProvider,
  type AuthClient,
} from "@convex-dev/better-auth/react";
import { authClient } from "@/lib/auth-client";
import { convexClient } from "@/lib/convex";
import { OutboxReplayer } from "@/lib/offline/replayer";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConvexBetterAuthProvider
      client={convexClient}
      // The component's AuthClient type infers `useSession().data` as `never`
      // against better-auth 1.6.23, so no concrete client assigns to it.
      // Runtime shape is exactly what the provider needs.
      authClient={authClient as unknown as AuthClient}
    >
      <OutboxReplayer />
      {children}
    </ConvexBetterAuthProvider>
  );
}
