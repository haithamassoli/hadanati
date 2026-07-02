"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export function LocaleToggle({ className }: { className?: string }) {
  const { t, locale, setLocale } = useT();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
    >
      <Languages data-icon="inline-start" />
      {t("locale.switch")}
    </Button>
  );
}
