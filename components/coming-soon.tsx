"use client";

import { Hourglass } from "lucide-react";
import { useT } from "@/lib/i18n";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export function ComingSoon({ titleKey }: { titleKey: string }) {
  const { t } = useT();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-8">
      <h1 className="text-2xl">{t(titleKey)}</h1>
      <Empty className="border py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Hourglass />
          </EmptyMedia>
          <EmptyTitle>{t("common.comingSoon")}</EmptyTitle>
          <EmptyDescription>{t("common.comingSoonDesc")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}
