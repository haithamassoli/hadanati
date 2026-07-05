"use client";

// The concierge onboarding CTA. There is no self-serve signup — every primary
// action opens WhatsApp. The button stays on-system date-palm green (never
// WhatsApp brand green) with an apricot "hug" glow on hover (pure CSS, so it
// costs nothing and honors prefers-reduced-motion via the motion-reduce: variant).

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ponytail: placeholder concierge line — swap for the real WhatsApp business
// number before launch. Kept in one place so there's a single thing to change.
export const WHATSAPP_NUMBER = "962790000000";

export function waLink(prefill: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(prefill)}`;
}

export function WhatsappGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 1.67c2.2 0 4.28.86 5.84 2.42a8.2 8.2 0 0 1 2.42 5.83c0 4.54-3.7 8.24-8.25 8.24a8.2 8.2 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24Zm-2.6 4.06c-.14 0-.36.05-.56.26-.2.21-.75.73-.75 1.78s.77 2.07.88 2.21c.1.14 1.5 2.29 3.64 3.21.51.22.9.35 1.21.45.51.16.97.14 1.34.08.4-.06 1.26-.51 1.44-1.01.18-.5.18-.92.13-1.01-.05-.09-.2-.14-.41-.25-.21-.11-1.26-.62-1.46-.69-.2-.07-.34-.11-.48.1-.14.21-.55.69-.68.83-.12.14-.25.16-.46.05-.21-.11-.9-.33-1.71-1.05-.63-.56-1.06-1.26-1.18-1.47-.12-.21-.01-.32.09-.43.09-.09.21-.24.32-.36.1-.12.14-.21.21-.35.07-.14.03-.26-.02-.37-.05-.11-.47-1.17-.66-1.6-.17-.42-.35-.36-.48-.37h-.42Z" />
    </svg>
  );
}

/**
 * Primary WhatsApp CTA. `prefill` is the message dropped into the chat;
 * `label` is the button text.
 */
export function WhatsappCta({
  label,
  prefill,
  size = "lg",
  className,
}: {
  label: string;
  prefill: string;
  size?: "lg" | "default";
  className?: string;
}) {
  const big = size === "lg";
  return (
    <span className="group relative inline-flex">
      {/* apricot hug — grows on hover, disabled under reduced motion */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-xl bg-accent opacity-25 blur-xl transition duration-300 group-hover:scale-105 group-hover:opacity-60 motion-reduce:transition-none motion-reduce:group-hover:scale-100 motion-reduce:group-hover:opacity-25"
      />
      <Button
        asChild
        size="lg"
        className={cn(
          "rounded-xl gap-2 transition-transform group-hover:-translate-y-px group-active:translate-y-0 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0",
          big ? "h-12 px-6 text-base md:h-14" : "h-11 px-5",
          className,
        )}
      >
        <a href={waLink(prefill)} target="_blank" rel="noopener noreferrer">
          <WhatsappGlyph className={big ? "size-5" : "size-4"} />
          {label}
        </a>
      </Button>
    </span>
  );
}
