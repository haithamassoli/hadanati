"use client";

import { use, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import {
  ArchiveRestore,
  Archive,
  ArrowRight,
  Camera,
  Pencil,
  Phone,
  Receipt,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatFils } from "@/convex/lib/shared";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { useOnline } from "@/lib/offline/use-online";
import { useT } from "@/lib/i18n";
import { DataAge } from "@/components/data-age";
import { ProgressChart } from "@/components/progress-chart";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { formatAge } from "../format";
import { StudentFormDialog } from "../student-form";
import { AccessCodeCard } from "./access-code-card";

function errorCode(error: unknown): string | null {
  return error instanceof ConvexError && typeof error.data === "string"
    ? error.data
    : null;
}

export default function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const mine = useCachedQuery(api.nurseries.getMine, {});

  if (mine.data === undefined) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }
  if (mine.data === null) {
    return null;
  }
  return (
    <StudentDetail
      nurseryId={mine.data.nursery._id}
      studentId={id as Id<"students">}
      yearId={mine.data.nursery.activeYear.yearId}
      role={mine.data.role}
    />
  );
}

function StudentDetail({
  nurseryId,
  studentId,
  yearId,
  role,
}: {
  nurseryId: Id<"nurseries">;
  studentId: Id<"students">;
  yearId: string;
  role: "admin" | "teacher" | "accountant";
}) {
  const { t, locale } = useT();
  const isAdmin = role === "admin";
  // Finance roles (PRD §6): fee-plan info + statement link. Teachers never.
  const isFinance = role === "admin" || role === "accountant";
  const online = useOnline();

  const dataQ = useCachedQuery(api.students.get, { nurseryId, studentId });
  const data = dataQ.data;
  const historyQ = useCachedQuery(api.enrollments.forStudent, {
    nurseryId,
    studentId,
  });
  const history = historyQ.data;
  const evaluationsQ = useCachedQuery(
    api.evaluations.listForStudent,
    role === "accountant" ? "skip" : { nurseryId, studentId, yearId },
  );
  const evaluations = evaluationsQ.data;
  const stagesQ = useCachedQuery(
    api.stages.list,
    isAdmin ? { nurseryId } : "skip",
  );
  const stages = stagesQ.data;
  const classroomsQ = useCachedQuery(
    api.classrooms.list,
    isAdmin ? { nurseryId } : "skip",
  );
  const classrooms = classroomsQ.data;
  const feePlansQ = useCachedQuery(
    api.feePlans.list,
    isFinance ? { nurseryId } : "skip",
  );
  const feePlans = feePlansQ.data;

  const setStatus = useMutation(api.students.setStatus);
  const generateUploadUrl = useMutation(api.students.generateUploadUrl);
  const setPhoto = useMutation(api.students.setPhoto);
  const removePhoto = useMutation(api.students.removePhoto);
  const moveEnrollment = useMutation(api.enrollments.move);
  const enroll = useMutation(api.enrollments.enroll);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [targetClassroomId, setTargetClassroomId] = useState("");
  const [targetPlanId, setTargetPlanId] = useState("");
  const [movingEnrollment, setMovingEnrollment] = useState(false);

  if (data === undefined) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }
  const { student, photoUrl, enrollment } = data;
  const archived = student.status === "archived";

  async function onToggleStatus() {
    try {
      await setStatus({
        nurseryId,
        studentId,
        status: archived ? "active" : "archived",
      });
      toast.success(
        archived ? t("students.toast.restored") : t("students.toast.archived"),
      );
    } catch {
      toast.error(t("students.toast.error"));
    }
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl({ nurseryId });
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error("upload_failed");
      const { storageId } = (await response.json()) as {
        storageId: Id<"_storage">;
      };
      await setPhoto({ nurseryId, studentId, storageId });
      toast.success(t("students.photo.uploaded"));
    } catch (error) {
      toast.error(
        errorCode(error) === "no_photo_consent"
          ? t("students.photo.noConsent")
          : t("students.photo.error"),
      );
    } finally {
      setUploading(false);
    }
  }

  async function onRemovePhoto() {
    try {
      await removePhoto({ nurseryId, studentId });
      toast.success(t("students.photo.removed"));
    } catch {
      toast.error(t("students.toast.error"));
    }
  }

  async function onMoveOrEnroll() {
    if (targetClassroomId === "") return;
    setMovingEnrollment(true);
    try {
      if (enrollment !== null) {
        await moveEnrollment({
          nurseryId,
          enrollmentId: enrollment._id,
          classroomId: targetClassroomId as Id<"classrooms">,
        });
        toast.success(t("students.toast.moved"));
      } else {
        // New enrollment: the fee plan (FR-FIN-1) rides on the enrollment.
        await enroll({
          nurseryId,
          studentId,
          classroomId: targetClassroomId as Id<"classrooms">,
          yearId,
          feePlanId:
            targetPlanId === ""
              ? undefined
              : (targetPlanId as Id<"feePlans">),
        });
        toast.success(t("students.toast.enrolled"));
      }
      setTargetClassroomId("");
      setTargetPlanId("");
    } catch (error) {
      toast.error(
        errorCode(error) === "already_enrolled"
          ? t("students.error.alreadyEnrolled")
          : t("students.toast.error"),
      );
    } finally {
      setMovingEnrollment(false);
    }
  }

  const stageNameOf = (stageId: Id<"stages">) =>
    stages?.find((s) => s._id === stageId)?.name ?? "";

  const chartData = (evaluations ?? [])
    .map((evaluation) => ({ week: evaluation.week, ...evaluation.scores }))
    .sort((a, b) => a.week - b.week);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4 md:p-8">
      <Link
        href="/students"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4 rtl:rotate-0 ltr:rotate-180" />
        {t("students.detail.back")}
      </Link>

      <DataAge
        isStale={dataQ.isStale}
        updatedAt={dataQ.updatedAt}
        className="-mt-3 self-start"
      />
      {!online && (
        <p className="-mt-3 text-xs text-muted-foreground">
          {t("offline.requiresConnection")}
        </p>
      )}

      {/* Profile header */}
      <div className="flex flex-wrap items-start gap-4 rounded-xl border bg-card p-4 md:p-6">
        <div className="flex flex-col items-center gap-2">
          <Avatar className="size-20 text-2xl">
            {photoUrl !== null && (
              <AvatarImage src={photoUrl} alt={student.nameAr} />
            )}
            <AvatarFallback className="bg-primary/10 text-primary">
              {student.nameAr.trim().charAt(0)}
            </AvatarFallback>
          </Avatar>
          {isAdmin && student.consent.photos && (
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading || !online}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Camera data-icon="inline-start" />
                )}
                {t("students.photo.upload")}
              </Button>
              {photoUrl !== null && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("students.photo.remove")}
                  className="text-destructive hover:text-destructive"
                  disabled={!online}
                  onClick={onRemovePhoto}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl">{student.nameAr}</h1>
            <Badge variant={archived ? "secondary" : "default"}>
              {archived
                ? t("students.status.archived")
                : t("students.status.active")}
            </Badge>
          </div>
          {student.nameEn && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {student.nameEn}
            </p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            {formatAge(student.dob, t, locale)} ·{" "}
            {t(`students.sex.${student.sex}`)}
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil data-icon="inline-start" />
              {t("students.detail.edit")}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={!online}>
                  {archived ? (
                    <ArchiveRestore data-icon="inline-start" />
                  ) : (
                    <Archive data-icon="inline-start" />
                  )}
                  {archived
                    ? t("students.detail.restore")
                    : t("students.detail.archive")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {archived
                      ? t("students.detail.restoreTitle")
                      : t("students.detail.archiveTitle")}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {archived
                      ? t("students.detail.restoreDesc")
                      : t("students.detail.archiveDesc")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    {t("students.detail.cancel")}
                  </AlertDialogCancel>
                  <AlertDialogAction onClick={onToggleStatus}>
                    {t("students.detail.confirm")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Basic info */}
        <Card>
          <CardHeader>
            <CardTitle>{t("students.detail.infoTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">
                {t("students.detail.dob")}
              </span>
              <span dir="ltr" className="tabular-nums">
                {student.dob}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">
                {t("students.detail.age")}
              </span>
              <span>{formatAge(student.dob, t, locale)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">
                {t("students.detail.sex")}
              </span>
              <span>{t(`students.sex.${student.sex}`)}</span>
            </div>
            <Separator />
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">
                {t("students.detail.health")}
              </span>
              <span>
                {student.health && student.health.trim() !== "" ? (
                  student.health
                ) : (
                  <span className="text-muted-foreground">
                    {t("students.detail.noHealth")}
                  </span>
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Guardians */}
        <Card>
          <CardHeader>
            <CardTitle>{t("students.detail.guardiansTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {student.guardians.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("students.detail.noGuardians")}
              </p>
            ) : (
              student.guardians.map((guardian, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 p-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {guardian.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {guardian.relation}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <a href={`tel:${guardian.phone}`}>
                      <Phone data-icon="inline-start" />
                      <span dir="ltr" className="tabular-nums">
                        {guardian.phone}
                      </span>
                    </a>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Enrollment */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{t("students.detail.enrollmentTitle")}</CardTitle>
            {isFinance && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/finance/statement/${studentId}`}>
                  <Receipt data-icon="inline-start" />
                  {t("finance.statementLink")}
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">
                {t("students.detail.currentClassroom")}
              </p>
              {enrollment !== null ? (
                <>
                  <p className="mt-0.5 flex flex-wrap items-baseline gap-2 font-medium">
                    <span>
                      {enrollment.stageName !== ""
                        ? `${enrollment.stageName} — ${enrollment.classroomName}`
                        : enrollment.classroomName}
                    </span>
                    <span
                      dir="ltr"
                      className="text-xs font-normal text-muted-foreground"
                    >
                      {enrollment.yearId}
                    </span>
                  </p>
                  {isFinance && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("finance.plan.label")}:{" "}
                      {(() => {
                        const plan = feePlans?.find(
                          (p) => p._id === enrollment.feePlanId,
                        );
                        return plan !== undefined
                          ? `${plan.name} — ${formatFils(plan.amountFils, locale)}`
                          : t("finance.plan.none");
                      })()}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-0.5 text-muted-foreground">
                  {t("students.detail.notEnrolled")}
                </p>
              )}
            </div>

            {isAdmin && (
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={targetClassroomId}
                  onValueChange={setTargetClassroomId}
                >
                  <SelectTrigger
                    size="sm"
                    className="min-w-44"
                    aria-label={t("students.detail.selectClassroom")}
                  >
                    <SelectValue
                      placeholder={t("students.detail.selectClassroom")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {classrooms
                      ?.filter((c) => c._id !== enrollment?.classroomId)
                      .map((classroom) => (
                        <SelectItem key={classroom._id} value={classroom._id}>
                          {stageNameOf(classroom.stageId)} — {classroom.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {/* Fee plan only applies when CREATING an enrollment; a
                    move keeps the existing plan (enrollments.move). */}
                {enrollment === null &&
                  feePlans !== undefined &&
                  feePlans.length > 0 && (
                    <Select value={targetPlanId} onValueChange={setTargetPlanId}>
                      <SelectTrigger
                        size="sm"
                        className="min-w-44"
                        aria-label={t("finance.plan.label")}
                      >
                        <SelectValue placeholder={t("finance.plan.select")} />
                      </SelectTrigger>
                      <SelectContent>
                        {feePlans.map((plan) => (
                          <SelectItem key={plan._id} value={plan._id}>
                            {plan.name} — {formatFils(plan.amountFils, locale)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                <Button
                  size="sm"
                  disabled={
                    targetClassroomId === "" || movingEnrollment || !online
                  }
                  onClick={onMoveOrEnroll}
                >
                  {movingEnrollment && <Spinner data-icon="inline-start" />}
                  {enrollment !== null
                    ? t("students.detail.move")
                    : t("students.detail.enroll")}
                </Button>
              </div>
            )}
          </div>

          {history !== undefined && history.length > 0 && (
            <>
              <Separator />
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  {t("students.detail.history")}
                </p>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {history.map((entry) => (
                    <li
                      key={entry._id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span>
                        {entry.stageName !== ""
                          ? `${entry.stageName} — ${entry.classroomName}`
                          : entry.classroomName}
                      </span>
                      <span
                        dir="ltr"
                        className="text-xs text-muted-foreground tabular-nums"
                      >
                        {entry.yearId}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Parent portal access code — admin only */}
      {isAdmin && (
        <AccessCodeCard
          nurseryId={nurseryId}
          studentId={studentId}
          studentName={student.nameAr}
          guardianPhone={student.guardians[0]?.phone}
        />
      )}

      {/* Weekly evaluations progress */}
      {role !== "accountant" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("students.progress.title")}</CardTitle>
            <CardDescription>{t("students.progress.desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ProgressChart data={chartData} />
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <StudentFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          nurseryId={nurseryId}
          student={student}
          currentClassroomId={enrollment?.classroomId}
        />
      )}
    </div>
  );
}
