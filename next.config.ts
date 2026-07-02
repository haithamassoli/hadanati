import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// @serwist/next hooks into webpack, which Turbopack (the Next 16 default)
// never invokes. The dev server runs Turbopack, so the service worker is
// prod-only: build with `next build --webpack` (see package.json).
const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  // Serwist's default hard-reloads the page on the 'online' event — fatal
  // for the offline-first outbox UX (PRD §8): reconnect must replay in
  // place, keeping classroom selection and optimistic state intact.
  reloadOnOnline: false,
});

const nextConfig: NextConfig = {
  // Silences Next 16's hard error about a `webpack` config (added by
  // withSerwist) being present while Turbopack is the active bundler.
  turbopack: {},
  // Lets CI/agents build without clobbering a running dev server's .next.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default withSerwist(nextConfig);
