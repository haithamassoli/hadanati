"use client";

// Landing: devices with stored parent codes go straight to the portal;
// everyone else keeps the staff redirect. A visible portal link covers the
// brief moment before redirect (and parents who haven't added a code yet).

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { getCodes } from "@/lib/portal/codes";
import { Spinner } from "@/components/ui/spinner";

export default function Home() {
  const { t } = useT();
  const router = useRouter();

  useEffect(() => {
    router.replace(getCodes().codes.length > 0 ? "/portal" : "/dashboard");
  }, [router]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-4">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary pb-1 font-heading text-3xl text-primary-foreground">
        ح
      </div>
      <Spinner className="size-5 text-primary" />
      <Link
        href="/portal"
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        {t("portal.landing.parents")}
      </Link>
    </div>
  );
}
