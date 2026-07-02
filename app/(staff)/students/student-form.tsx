"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { formatFils } from "@/convex/lib/shared";
import { useOnline } from "@/lib/offline/use-online";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const RELATION_OPTIONS = [
  { value: "أب", key: "students.relation.father" },
  { value: "أم", key: "students.relation.mother" },
  { value: "جد", key: "students.relation.grandfather" },
  { value: "جدة", key: "students.relation.grandmother" },
  { value: "عم", key: "students.relation.paternalUncle" },
  { value: "خال", key: "students.relation.maternalUncle" },
] as const;

const OTHER = "__other";
const NO_CLASSROOM = "__none";
const NO_PLAN = "__none";

type GuardianRow = {
  name: string;
  phone: string;
  relation: string; // one of RELATION_OPTIONS values or OTHER
  otherRelation: string;
};

function toGuardianRow(g: {
  name: string;
  phone: string;
  relation: string;
}): GuardianRow {
  const known = RELATION_OPTIONS.some((o) => o.value === g.relation);
  return {
    name: g.name,
    phone: g.phone,
    relation: known ? g.relation : OTHER,
    otherRelation: known ? "" : g.relation,
  };
}

const EMPTY_ROW: GuardianRow = {
  name: "",
  phone: "",
  relation: "أب",
  otherRelation: "",
};

export function StudentFormDialog({
  open,
  onOpenChange,
  nurseryId,
  student,
  currentClassroomId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nurseryId: Id<"nurseries">;
  /** Present in edit mode. */
  student?: Doc<"students">;
  /** Active-year classroom, edit mode. */
  currentClassroomId?: Id<"classrooms">;
}) {
  const { t } = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {student ? t("students.form.editTitle") : t("students.form.newTitle")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {student ? t("students.form.editTitle") : t("students.form.newTitle")}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <StudentFormFields
            nurseryId={nurseryId}
            student={student}
            currentClassroomId={currentClassroomId}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function StudentFormFields({
  nurseryId,
  student,
  currentClassroomId,
  onDone,
}: {
  nurseryId: Id<"nurseries">;
  student?: Doc<"students">;
  currentClassroomId?: Id<"classrooms">;
  onDone: () => void;
}) {
  const { t, locale } = useT();
  const online = useOnline();
  const stages = useQuery(api.stages.list, { nurseryId });
  const classrooms = useQuery(api.classrooms.list, { nurseryId });
  const createStudent = useMutation(api.students.create);
  const updateStudent = useMutation(api.students.update);
  // Fee-plan wiring (FR-FIN-1): a plan can be attached only when creating a
  // NEW enrollment (existing enrollments keep their plan — move preserves it).
  const newEnrollment = student === undefined || currentClassroomId === undefined;
  const enroll = useMutation(api.enrollments.enroll);
  const mine = useQuery(api.nurseries.getMine);
  const feePlans = useQuery(
    api.feePlans.list,
    newEnrollment ? { nurseryId } : "skip",
  );

  const [nameAr, setNameAr] = useState(student?.nameAr ?? "");
  const [nameEn, setNameEn] = useState(student?.nameEn ?? "");
  const [dob, setDob] = useState(student?.dob ?? "");
  const [sex, setSex] = useState<"m" | "f" | "">(student?.sex ?? "");
  const [guardians, setGuardians] = useState<GuardianRow[]>(
    student && student.guardians.length > 0
      ? student.guardians.map(toGuardianRow)
      : [{ ...EMPTY_ROW }],
  );
  const [health, setHealth] = useState(student?.health ?? "");
  const [consentPhotos, setConsentPhotos] = useState(
    student?.consent.photos ?? false,
  );
  const [classroomId, setClassroomId] = useState<string>(
    currentClassroomId ?? NO_CLASSROOM,
  );
  const [feePlanId, setFeePlanId] = useState<string>(NO_PLAN);
  const [saving, setSaving] = useState(false);

  const stageName = (stageId: Id<"stages">) =>
    stages?.find((s) => s._id === stageId)?.name ?? "";

  function patchGuardian(index: number, patch: Partial<GuardianRow>) {
    setGuardians((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nameAr.trim() === "") {
      toast.error(t("students.form.validation.nameAr"));
      return;
    }
    if (dob === "") {
      toast.error(t("students.form.validation.dob"));
      return;
    }
    const filled = guardians.filter(
      (g) => g.name.trim() !== "" || g.phone.trim() !== "",
    );
    if (filled.some((g) => g.name.trim() === "" || g.phone.trim() === "")) {
      toast.error(t("students.form.validation.guardian"));
      return;
    }
    const guardianDocs = filled.map((g) => ({
      name: g.name.trim(),
      phone: g.phone.trim(),
      relation:
        g.relation === OTHER
          ? g.otherRelation.trim() || t("students.relation.other")
          : g.relation,
    }));

    setSaving(true);
    try {
      const chosenClassroomId =
        classroomId === NO_CLASSROOM
          ? undefined
          : (classroomId as Id<"classrooms">);
      const chosenPlanId =
        newEnrollment && feePlanId !== NO_PLAN
          ? (feePlanId as Id<"feePlans">)
          : undefined;
      const yearId = mine?.nursery.activeYear.yearId;
      // A fee plan rides on the enrollment, so a new enrollment with a plan
      // goes through enrollments.enroll (which accepts feePlanId).
      const viaEnroll =
        chosenClassroomId !== undefined &&
        chosenPlanId !== undefined &&
        yearId !== undefined;
      const common = {
        nurseryId,
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim() === "" ? undefined : nameEn.trim(),
        dob,
        sex: (sex === "" ? "m" : sex) as "m" | "f",
        guardians: guardianDocs,
        health: health.trim() === "" ? undefined : health.trim(),
        consentPhotos,
        classroomId: viaEnroll ? undefined : chosenClassroomId,
      };
      let targetStudentId: Id<"students">;
      if (student) {
        await updateStudent({ ...common, studentId: student._id });
        targetStudentId = student._id;
      } else {
        targetStudentId = await createStudent(common);
      }
      if (viaEnroll) {
        await enroll({
          nurseryId,
          studentId: targetStudentId,
          classroomId: chosenClassroomId,
          yearId,
          feePlanId: chosenPlanId,
        });
      }
      toast.success(
        student ? t("students.toast.updated") : t("students.toast.created"),
      );
      onDone();
    } catch {
      toast.error(t("students.toast.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="student-nameAr">{t("students.form.nameAr")}</Label>
        <Input
          id="student-nameAr"
          dir="rtl"
          required
          value={nameAr}
          onChange={(e) => setNameAr(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="student-nameEn">{t("students.form.nameEn")}</Label>
        <Input
          id="student-nameEn"
          dir="ltr"
          className="text-start"
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="student-dob">{t("students.form.dob")}</Label>
          <Input
            id="student-dob"
            type="date"
            required
            value={dob}
            onChange={(e) => setDob(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t("students.form.sex")}</Label>
          <Select
            value={sex}
            onValueChange={(value) => setSex(value as "m" | "f")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("students.form.sex")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="m">{t("students.sex.m")}</SelectItem>
              <SelectItem value="f">{t("students.sex.f")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">
          {t("students.form.guardians")}
        </legend>
        {guardians.map((guardian, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-md bg-muted/40 p-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input
                aria-label={t("students.form.guardianName")}
                placeholder={t("students.form.guardianName")}
                value={guardian.name}
                onChange={(e) => patchGuardian(index, { name: e.target.value })}
              />
              <Input
                aria-label={t("students.form.guardianPhone")}
                placeholder={t("students.form.guardianPhone")}
                type="tel"
                dir="ltr"
                className="text-start"
                value={guardian.phone}
                onChange={(e) => patchGuardian(index, { phone: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={guardian.relation}
                onValueChange={(value) =>
                  patchGuardian(index, { relation: value })
                }
              >
                <SelectTrigger
                  className="w-full"
                  aria-label={t("students.form.guardianRelation")}
                >
                  <SelectValue placeholder={t("students.form.guardianRelation")} />
                </SelectTrigger>
                <SelectContent>
                  {RELATION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.key)}
                    </SelectItem>
                  ))}
                  <SelectItem value={OTHER}>
                    {t("students.relation.other")}
                  </SelectItem>
                </SelectContent>
              </Select>
              {guardian.relation === OTHER && (
                <Input
                  aria-label={t("students.form.relationOtherPlaceholder")}
                  placeholder={t("students.form.relationOtherPlaceholder")}
                  value={guardian.otherRelation}
                  onChange={(e) =>
                    patchGuardian(index, { otherRelation: e.target.value })
                  }
                />
              )}
              {guardians.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("students.form.removeGuardian")}
                  className="shrink-0 text-destructive hover:text-destructive"
                  onClick={() =>
                    setGuardians((rows) => rows.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setGuardians((rows) => [...rows, { ...EMPTY_ROW }])}
        >
          <Plus data-icon="inline-start" />
          {t("students.form.addGuardian")}
        </Button>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="student-health">{t("students.form.health")}</Label>
        <Textarea
          id="student-health"
          placeholder={t("students.form.healthPlaceholder")}
          value={health}
          onChange={(e) => setHealth(e.target.value)}
        />
      </div>

      <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="student-consent">
            {t("students.form.consentPhotos")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t("students.form.consentNote")}
          </p>
        </div>
        <Switch
          id="student-consent"
          checked={consentPhotos}
          onCheckedChange={setConsentPhotos}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("students.form.classroom")}</Label>
        <Select value={classroomId} onValueChange={setClassroomId}>
          <SelectTrigger
            className="w-full"
            aria-label={t("students.form.classroom")}
          >
            <SelectValue placeholder={t("students.form.classroom")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CLASSROOM}>
              {t("students.form.noClassroom")}
            </SelectItem>
            {classrooms?.map((classroom) => (
              <SelectItem key={classroom._id} value={classroom._id}>
                {stageName(classroom.stageId)} — {classroom.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Fee plan (FR-FIN-1) — only for a NEW enrollment with a classroom. */}
      {newEnrollment &&
        classroomId !== NO_CLASSROOM &&
        feePlans !== undefined &&
        feePlans.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label>{t("finance.plan.label")}</Label>
            <Select value={feePlanId} onValueChange={setFeePlanId}>
              <SelectTrigger
                className="w-full"
                aria-label={t("finance.plan.label")}
              >
                <SelectValue placeholder={t("finance.plan.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PLAN}>{t("finance.plan.none")}</SelectItem>
                {feePlans.map((plan) => (
                  <SelectItem key={plan._id} value={plan._id}>
                    {plan.name} — {formatFils(plan.amountFils, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

      {/* FR-FIN-6 pattern (§8): student CRUD is online-only — no outbox. */}
      {!online && (
        <p className="text-xs text-muted-foreground">
          {t("offline.requiresConnection")}
        </p>
      )}
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          {t("students.form.cancel")}
        </Button>
        <Button type="submit" disabled={saving || !online}>
          {saving && <Spinner data-icon="inline-start" />}
          {student ? t("students.form.save") : t("students.form.create")}
        </Button>
      </DialogFooter>
    </form>
  );
}
