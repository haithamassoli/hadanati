"use client";

import { useRef, useState } from "react";
import { z } from "zod";
import Image from "next/image";
import { useMutation, useQuery } from "convex/react";
import { ImagePlus, Megaphone, Send, Trash2, WifiOff, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAppForm } from "@/lib/form";
import { useT, type Locale } from "@/lib/i18n";
import { useOnline } from "@/lib/offline/use-online";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

const NURSERY_WIDE = "__nursery__";

/** "قبل ٥ دقائق" — locale-aware relative time for feed timestamps. */
function relativeTime(timestamp: number, locale: Locale): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return rtf.format(Math.min(seconds, 0), "second");
  if (abs < 3600) return rtf.format(Math.trunc(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.trunc(seconds / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.trunc(seconds / 86400), "day");
  return new Date(timestamp).toLocaleDateString(
    locale === "ar" ? "ar-JO" : "en-GB",
    { year: "numeric", month: "long", day: "numeric" },
  );
}

export default function AnnouncementsPage() {
  const mine = useQuery(api.nurseries.getMine);

  if (mine === undefined) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }
  if (mine === null) {
    return null;
  }
  return (
    <AnnouncementsView
      nurseryId={mine.nursery._id}
      role={mine.role}
      userId={mine.membership.userId}
    />
  );
}

function AnnouncementsView({
  nurseryId,
  role,
  userId,
}: {
  nurseryId: Id<"nurseries">;
  role: "admin" | "teacher" | "accountant";
  userId: Id<"users">;
}) {
  const { t, locale } = useT();
  const feed = useQuery(api.announcements.list, { nurseryId });
  const isAdmin = role === "admin";
  const canCompose = isAdmin || role === "teacher";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 md:p-8">
      <header>
        <h1 className="text-2xl">{t("announcements.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("announcements.subtitle")}
        </p>
      </header>

      {canCompose && (
        <ComposeCard nurseryId={nurseryId} isAdmin={isAdmin} userId={userId} />
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg">{t("announcements.feed.title")}</h2>
        {feed === undefined ? (
          <div className="flex justify-center py-12">
            <Spinner className="size-6 text-primary" />
          </div>
        ) : feed.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Megaphone />
              </EmptyMedia>
              <EmptyTitle>{t("announcements.empty.title")}</EmptyTitle>
              <EmptyDescription>{t("announcements.empty.desc")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          feed.map((announcement) => (
            <FeedCard
              key={announcement._id}
              nurseryId={nurseryId}
              announcement={announcement}
              canDelete={isAdmin || announcement.createdBy === userId}
              locale={locale}
            />
          ))
        )}
      </section>
    </div>
  );
}

function ComposeCard({
  nurseryId,
  isAdmin,
  userId,
}: {
  nurseryId: Id<"nurseries">;
  isAdmin: boolean;
  userId: Id<"users">;
}) {
  const { t } = useT();
  const online = useOnline();
  const classrooms = useQuery(api.classrooms.list, { nurseryId });
  const create = useMutation(api.announcements.create);
  const generateUploadUrl = useMutation(api.announcements.generateUploadUrl);

  // Image upload is imperative (object URLs, revoke) — kept outside the form.
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Teachers may only post to their own classrooms; admins to any or nursery-wide.
  const scopeOptions = (classrooms ?? []).filter(
    (classroom) => isAdmin || classroom.teacherIds.includes(userId),
  );

  function pickImage(picked: File | null) {
    if (previewUrl !== null) URL.revokeObjectURL(previewUrl);
    setFile(picked);
    setPreviewUrl(picked !== null ? URL.createObjectURL(picked) : null);
  }

  const form = useAppForm({
    defaultValues: { title: "", body: "", scope: isAdmin ? NURSERY_WIDE : "" },
    validators: {
      onChange: z.object({
        title: z.string().refine((v) => v.trim() !== "", {
          message: t("announcements.validation.title"),
        }),
        body: z.string().refine((v) => v.trim() !== "", {
          message: t("announcements.validation.body"),
        }),
        scope: z.string().min(1, { message: t("announcements.validation.scope") }),
      }),
    },
    onSubmit: async ({ value }) => {
      try {
        let imageId: Id<"_storage"> | undefined;
        if (file !== null) {
          try {
            const uploadUrl = await generateUploadUrl({ nurseryId });
            const response = await fetch(uploadUrl, {
              method: "POST",
              headers: { "Content-Type": file.type },
              body: file,
            });
            if (!response.ok) throw new Error("upload_failed");
            const json = (await response.json()) as {
              storageId: Id<"_storage">;
            };
            imageId = json.storageId;
          } catch {
            toast.error(t("announcements.error.upload"));
            return;
          }
        }
        await create({
          nurseryId,
          classroomId:
            value.scope === NURSERY_WIDE
              ? undefined
              : (value.scope as Id<"classrooms">),
          title: value.title.trim(),
          body: value.body.trim(),
          imageId,
        });
        toast.success(t("announcements.toast.published"));
        form.reset();
        pickImage(null);
        if (fileInputRef.current !== null) fileInputRef.current.value = "";
      } catch {
        toast.error(t("announcements.error.generic"));
      }
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("announcements.compose.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {!online && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-dashed bg-muted/50 p-3 text-sm text-muted-foreground">
            <WifiOff className="size-4 shrink-0" />
            {t("announcements.compose.offline")}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
          className="flex flex-col gap-4"
        >
          <form.Subscribe
            selector={(s) => ({
              submitting: s.isSubmitting,
              ready:
                s.values.title.trim() !== "" &&
                s.values.body.trim() !== "" &&
                s.values.scope !== "",
            })}
          >
            {({ submitting, ready }) => (
              <fieldset
                disabled={!online || submitting}
                className="flex flex-col gap-4 disabled:opacity-60"
              >
                <form.AppField name="title">
                  {(field) => (
                    <field.TextField
                      id="announcement-title"
                      label={t("announcements.compose.titleLabel")}
                      placeholder={t("announcements.compose.titlePlaceholder")}
                    />
                  )}
                </form.AppField>
                <form.AppField name="body">
                  {(field) => (
                    <field.TextareaField
                      id="announcement-body"
                      rows={4}
                      label={t("announcements.compose.bodyLabel")}
                      placeholder={t("announcements.compose.bodyPlaceholder")}
                    />
                  )}
                </form.AppField>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {!isAdmin &&
                  classrooms !== undefined &&
                  scopeOptions.length === 0 ? (
                    <div className="flex flex-col gap-2">
                      <Label>{t("announcements.compose.scopeLabel")}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t("announcements.compose.noClassrooms")}
                      </p>
                    </div>
                  ) : (
                    <form.AppField name="scope">
                      {(field) => (
                        <field.SelectField
                          label={t("announcements.compose.scopeLabel")}
                          ariaLabel={t("announcements.compose.scopeLabel")}
                          placeholder={t(
                            "announcements.compose.scopePlaceholder",
                          )}
                          options={[
                            ...(isAdmin
                              ? [
                                  {
                                    value: NURSERY_WIDE,
                                    label: t(
                                      "announcements.compose.scopeNursery",
                                    ),
                                  },
                                ]
                              : []),
                            ...scopeOptions.map((classroom) => ({
                              value: classroom._id,
                              label: classroom.name,
                            })),
                          ]}
                        />
                      )}
                    </form.AppField>
                  )}
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="announcement-image">
                      {t("announcements.compose.imageLabel")}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <ImagePlus data-icon="inline-start" />
                        {t("announcements.compose.addImage")}
                      </Button>
                      {file !== null && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("announcements.compose.removeImage")}
                          onClick={() => {
                            pickImage(null);
                            if (fileInputRef.current !== null) {
                              fileInputRef.current.value = "";
                            }
                          }}
                        >
                          <X />
                        </Button>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      id="announcement-image"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </div>
                {previewUrl !== null && (
                  // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                  <img
                    src={previewUrl}
                    alt={t("announcements.imageAlt")}
                    className="max-h-56 w-fit rounded-lg border object-cover"
                  />
                )}
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={!online || submitting || !ready}
                  >
                    {submitting ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <Send data-icon="inline-start" />
                    )}
                    {t("announcements.compose.publish")}
                  </Button>
                </div>
              </fieldset>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  );
}

function FeedCard({
  nurseryId,
  announcement,
  canDelete,
  locale,
}: {
  nurseryId: Id<"nurseries">;
  announcement: {
    _id: Id<"announcements">;
    title: string;
    body: string;
    classroomName: string | null;
    authorName: string;
    createdAt: number;
    imageUrl: string | null;
  };
  canDelete: boolean;
  locale: Locale;
}) {
  const { t } = useT();
  const remove = useMutation(api.announcements.remove);

  async function onDelete() {
    try {
      await remove({ nurseryId, announcementId: announcement._id });
      toast.success(t("announcements.toast.deleted"));
    } catch {
      toast.error(t("announcements.error.generic"));
    }
  }

  return (
    <Card className="gap-3">
      <CardHeader className="gap-1">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="min-w-0 break-words text-base">
            {announcement.title}
          </CardTitle>
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("announcements.delete")}
                  className="-mt-1 shrink-0 text-destructive hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("announcements.deleteTitle")}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("announcements.deleteDesc")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    {t("announcements.cancel")}
                  </AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={onDelete}>
                    {t("announcements.deleteConfirm")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <Badge
            variant={announcement.classroomName === null ? "default" : "secondary"}
          >
            {announcement.classroomName ?? t("announcements.badge.nursery")}
          </Badge>
          <span>{announcement.authorName}</span>
          <span aria-hidden>·</span>
          <time dateTime={new Date(announcement.createdAt).toISOString()}>
            {relativeTime(announcement.createdAt, locale)}
          </time>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {announcement.body}
        </p>
        {announcement.imageUrl !== null && (
          <Image
            src={announcement.imageUrl}
            alt={t("announcements.imageAlt")}
            width={640}
            height={360}
            unoptimized
            className="h-auto w-full max-w-md rounded-lg border object-cover"
          />
        )}
      </CardContent>
    </Card>
  );
}
