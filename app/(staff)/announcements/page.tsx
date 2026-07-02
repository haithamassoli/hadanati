"use client";

import { useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { useMutation, useQuery } from "convex/react";
import { ImagePlus, Megaphone, Send, Trash2, WifiOff, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

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

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scope, setScope] = useState<string>(isAdmin ? NURSERY_WIDE : "");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim() === "") {
      toast.error(t("announcements.validation.title"));
      return;
    }
    if (body.trim() === "") {
      toast.error(t("announcements.validation.body"));
      return;
    }
    if (scope === "") {
      toast.error(t("announcements.validation.scope"));
      return;
    }
    setPublishing(true);
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
          const json = (await response.json()) as { storageId: Id<"_storage"> };
          imageId = json.storageId;
        } catch {
          toast.error(t("announcements.error.upload"));
          return;
        }
      }
      await create({
        nurseryId,
        classroomId:
          scope === NURSERY_WIDE ? undefined : (scope as Id<"classrooms">),
        title: title.trim(),
        body: body.trim(),
        imageId,
      });
      toast.success(t("announcements.toast.published"));
      setTitle("");
      setBody("");
      setScope(isAdmin ? NURSERY_WIDE : "");
      pickImage(null);
      if (fileInputRef.current !== null) fileInputRef.current.value = "";
    } catch {
      toast.error(t("announcements.error.generic"));
    } finally {
      setPublishing(false);
    }
  }

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
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <fieldset
            disabled={!online || publishing}
            className="flex flex-col gap-4 disabled:opacity-60"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="announcement-title">
                {t("announcements.compose.titleLabel")}
              </Label>
              <Input
                id="announcement-title"
                value={title}
                placeholder={t("announcements.compose.titlePlaceholder")}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="announcement-body">
                {t("announcements.compose.bodyLabel")}
              </Label>
              <Textarea
                id="announcement-body"
                value={body}
                rows={4}
                placeholder={t("announcements.compose.bodyPlaceholder")}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>{t("announcements.compose.scopeLabel")}</Label>
                {!isAdmin && classrooms !== undefined && scopeOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("announcements.compose.noClassrooms")}
                  </p>
                ) : (
                  <Select value={scope} onValueChange={setScope}>
                    <SelectTrigger
                      className="w-full"
                      aria-label={t("announcements.compose.scopeLabel")}
                    >
                      <SelectValue
                        placeholder={t("announcements.compose.scopePlaceholder")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {isAdmin && (
                        <SelectItem value={NURSERY_WIDE}>
                          {t("announcements.compose.scopeNursery")}
                        </SelectItem>
                      )}
                      {scopeOptions.map((classroom) => (
                        <SelectItem key={classroom._id} value={classroom._id}>
                          {classroom.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
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
                disabled={
                  !online ||
                  publishing ||
                  scope === "" ||
                  title.trim() === "" ||
                  body.trim() === ""
                }
              >
                {publishing ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Send data-icon="inline-start" />
                )}
                {t("announcements.compose.publish")}
              </Button>
            </div>
          </fieldset>
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
