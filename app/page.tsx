"use client";

// Root "/" wears two hats. For fresh web visitors it's the marketing landing.
// For people who already belong to the app it stays the quiet router it always
// was: a returning parent (stored access code) → portal; an installed PWA or a
// signed-in staff member → dashboard. Only the marketing audience sees the page.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useCodes } from "@/lib/portal/codes";
import { Spinner } from "@/components/ui/spinner";
import { LandingPage } from "@/components/landing/landing-page";

export default function Home() {
  const router = useRouter();
  const { codes } = useCodes();
  const { data: session } = authClient.useSession();
  const [standalone] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(display-mode: standalone)").matches,
  );

  const hasCodes = codes.length > 0;
  const target = hasCodes
    ? "/portal"
    : standalone || session
      ? "/dashboard"
      : null;

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  // ponytail: only the marketing audience (no code, not installed) sees the
  // landing. Returning/installed users get a spinner then bounce. A signed-in
  // staffer in a plain tab may glimpse the landing before the async session
  // resolves — acceptable; blocking every visitor on that check would defeat
  // the point of a fast public page.
  if (hasCodes || standalone) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  return <LandingPage />;
}
