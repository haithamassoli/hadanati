"use client";

// Parent portal shell (FR-PAR-*): its own minimal chrome — soft warm header
// with a child switcher, offline badge, and big bottom tabs. Entirely
// separate from the staff layout (sibling route group).

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  Home,
  Megaphone,
  Receipt,
  Settings,
  TrendingUp,
  WifiOff,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { getCodes, setActive, useCodes } from "@/lib/portal/codes";
import { useOnline } from "@/lib/offline/use-online";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TABS = [
  { href: "/portal", key: "portal.tabs.home", icon: Home },
  { href: "/portal/progress", key: "portal.tabs.progress", icon: TrendingUp },
  {
    href: "/portal/announcements",
    key: "portal.tabs.announcements",
    icon: Megaphone,
  },
  { href: "/portal/payments", key: "portal.tabs.payments", icon: Receipt },
  { href: "/portal/inbox", key: "portal.tabs.inbox", icon: Bell },
] as const;

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export default function PortalLayout({ children }: { children: ReactNode }) {
  const { t } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const { codes, activeIndex, active } = useCodes();
  const online = useOnline();

  // Deep links into tabs without any stored code land on the entry screen.
  // Reads localStorage directly: right after hydration the store snapshot is
  // still the SSR-empty one, which must not trigger a bogus redirect.
  useEffect(() => {
    if (getCodes().codes.length === 0 && pathname !== "/portal") {
      router.replace("/portal");
    }
  }, [codes.length, pathname, router]);

  const hasCodes = codes.length > 0;

  return (
    <div className="flex min-h-dvh w-full flex-col bg-background">
      {/* Soft header */}
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-lg items-center gap-2 px-4">
          {hasCodes && active !== null ? (
            codes.length > 1 ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex min-w-0 items-center gap-2 rounded-full py-1 pe-2 text-start outline-none hover:bg-muted/60"
                  aria-label={t("portal.switchChild")}
                >
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-primary/10 font-heading text-primary">
                      {active.studentName.trim().charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium leading-tight">
                      {firstName(active.studentName)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {active.nurseryName}
                    </p>
                  </div>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {codes.map((entry, index) => (
                    <DropdownMenuItem
                      key={entry.code}
                      className={cn(index === activeIndex && "font-medium")}
                      onSelect={() => setActive(index)}
                    >
                      <Avatar className="size-6">
                        <AvatarFallback className="bg-primary/10 text-xs text-primary">
                          {entry.studentName.trim().charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      {entry.studentName}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex min-w-0 items-center gap-2">
                <Avatar className="size-9">
                  <AvatarFallback className="bg-primary/10 font-heading text-primary">
                    {active.studentName.trim().charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium leading-tight">
                    {firstName(active.studentName)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {active.nurseryName}
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary pb-0.5 font-heading text-lg text-primary-foreground">
                ح
              </div>
              <p className="font-heading text-lg">{t("portal.title")}</p>
            </div>
          )}

          <div className="ms-auto flex items-center gap-1.5">
            {!online && (
              <span className="flex items-center gap-1.5 rounded-full border bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                <WifiOff className="size-3" />
                {t("portal.offline")}
              </span>
            )}
            {hasCodes && (
              <Link
                href="/portal/settings"
                aria-label={t("portal.settingsLabel")}
                className={cn(
                  "flex size-9 items-center justify-center rounded-full transition-colors hover:bg-muted",
                  pathname === "/portal/settings"
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              >
                <Settings className="size-5" />
              </Link>
            )}
          </div>
        </div>
      </header>

      <main
        className={cn(
          "mx-auto w-full max-w-lg flex-1 px-4 pt-4",
          hasCodes ? "pb-24" : "pb-8",
        )}
      >
        {children}
      </main>

      {/* Bottom tabs — big one-hand targets */}
      {hasCodes && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto grid w-full max-w-lg grid-cols-5">
            {TABS.map(({ href, key, icon: Icon }) => {
              const isActive =
                href === "/portal" ? pathname === "/portal" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[0.7rem]",
                    isActive
                      ? "font-medium text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" />
                  {t(key)}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
