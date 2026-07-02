"use client";

// Announcements feed (FR-PAR-4): nursery-wide + the child's classroom,
// newest first, text + optional image.

import Image from "next/image";
import { Megaphone } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useT } from "@/lib/i18n";
import { useCodes } from "@/lib/portal/codes";
import { formatRelativeTime } from "@/lib/portal/format";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { DataAge } from "@/components/data-age";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

export default function PortalAnnouncementsPage() {
  const { active } = useCodes();
  if (active === null) return null;
  return <Announcements key={active.code} code={active.code} />;
}

function Announcements({ code }: { code: string }) {
  const { t, locale } = useT();
  const { data, isStale, updatedAt } = useCachedQuery(
    api.portal.announcementsFeed,
    { code },
  );

  if (data === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <DataAge updatedAt={updatedAt} isStale={isStale} />
      <h1 className="font-heading text-2xl">{t("portal.ann.title")}</h1>

      {data.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Megaphone />
            </EmptyMedia>
            <EmptyTitle>{t("portal.ann.empty")}</EmptyTitle>
            <EmptyDescription>{t("portal.ann.emptyDesc")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((announcement) => (
            <li key={announcement._id}>
              <Card className="overflow-hidden">
                {announcement.imageUrl !== null && (
                  <div className="relative -mt-6 aspect-video w-full bg-muted">
                    <Image
                      src={announcement.imageUrl}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover"
                      sizes="(max-width: 512px) 100vw, 512px"
                    />
                  </div>
                )}
                <CardContent className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {announcement.classroomName ?? t("portal.ann.nurseryWide")}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(announcement.createdAt, locale)}
                    </span>
                  </div>
                  <h2 className="font-heading text-lg leading-snug">
                    {announcement.title}
                  </h2>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {announcement.body}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
