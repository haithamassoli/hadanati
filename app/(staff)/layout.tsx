"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarCheck,
  LayoutDashboard,
  LogOut,
  Megaphone,
  School,
  Settings,
  Sparkles,
  Users,
  Users2,
  Wallet,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { LocaleToggle } from "@/components/locale-toggle";
import { OfflineChip } from "@/components/offline-chip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";

// Mobile bottom bar — unchanged 5 items.
const NAV_ITEMS = [
  { href: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/attendance", key: "nav.attendance", icon: CalendarCheck },
  { href: "/evaluations", key: "nav.evaluations", icon: Sparkles },
  { href: "/students", key: "nav.students", icon: Users },
  { href: "/settings", key: "nav.settings", icon: Settings },
] as const;

// Desktop sidebar — role-gated items per PRD §6.
const SIDEBAR_ITEMS = [
  { href: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/attendance", key: "nav.attendance", icon: CalendarCheck },
  { href: "/evaluations", key: "nav.evaluations", icon: Sparkles },
  { href: "/students", key: "nav.students", icon: Users },
  {
    href: "/announcements",
    key: "nav.announcements",
    icon: Megaphone,
    roles: ["admin", "teacher"],
  },
  {
    href: "/classrooms",
    key: "nav.classrooms",
    icon: School,
    roles: ["admin", "teacher"],
  },
  {
    href: "/finance",
    key: "nav.finance",
    icon: Wallet,
    roles: ["admin", "accountant"],
  },
  { href: "/staff", key: "nav.staff", icon: Users2, roles: ["admin"] },
  { href: "/settings", key: "nav.settings", icon: Settings },
] as const;

function subscribeToConnection(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export default function StaffLayout({ children }: { children: ReactNode }) {
  const { t } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();
  // Cached read: while offline the sidebar still shows the nursery name and
  // role-gated items from the last IndexedDB snapshot.
  const mine = useCachedQuery(
    api.nurseries.getMine,
    session ? {} : "skip",
  ).data;
  const online = useSyncExternalStore(
    subscribeToConnection,
    () => navigator.onLine,
    () => true,
  );

  // Once a session has been seen, revalidation blips (useSession refetches
  // on reconnect/focus, briefly flipping isPending) must NOT unmount the
  // app: pages hold offline state (classroom selection, local echoes).
  // Render-phase state adjustment (React's documented latch pattern).
  const [hadSession, setHadSession] = useState(false);
  if (session && !hadSession) {
    setHadSession(true);
  }

  useEffect(() => {
    // Offline + no session (yet) must NOT redirect: the session check can't
    // reach the server, and cached data still lets staff work offline.
    if (!isPending && !session && online) {
      router.replace("/login");
    }
  }, [isPending, session, router, online]);

  if (!session && !hadSession && (isPending || online)) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  async function signOut() {
    await authClient.signOut();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-dvh w-full">
      {/* Sidebar — md and up */}
      <aside
        data-print-hidden
        className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-e bg-sidebar text-sidebar-foreground md:flex"
      >
        <div className="flex items-center gap-2.5 px-4 py-5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary pb-0.5 font-heading text-xl text-primary-foreground">
            ح
          </div>
          <div className="min-w-0">
            <p className="font-heading text-lg leading-tight">{t("app.name")}</p>
            {mine === undefined ? (
              <Skeleton className="mt-1 h-3 w-24" />
            ) : (
              <p className="truncate text-xs text-muted-foreground">
                {mine?.nursery.name}
              </p>
            )}
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {SIDEBAR_ITEMS.filter(
            (item) =>
              !("roles" in item) ||
              (mine != null &&
                (item.roles as readonly string[]).includes(mine.role)),
          ).map(({ href, key, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {t(key)}
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-col gap-1 p-3">
          <Separator className="mb-2" />
          <p className="truncate px-3 text-sm font-medium">
            {session?.user.name}
          </p>
          <LocaleToggle className="justify-start" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-start text-destructive hover:text-destructive"
            onClick={signOut}
          >
            <LogOut data-icon="inline-start" />
            {t("auth.signOut")}
          </Button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 pb-20 md:pb-0">{children}</main>

      {/* Bottom tab bar — mobile */}
      <nav
        data-print-hidden
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {NAV_ITEMS.map(({ href, key, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 py-2 text-[0.65rem]",
                active ? "font-medium text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {t(key)}
            </Link>
          );
        })}
      </nav>

      {/* Floating chrome must not print (FR-FIN-3/5 clean documents). */}
      <div data-print-hidden>
        <OfflineChip />
      </div>
    </div>
  );
}
