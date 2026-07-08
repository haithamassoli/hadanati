"use client";

import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { formatFils } from "@/convex/lib/shared";
import { useOnline } from "@/lib/offline/use-online";
import { useAppForm } from "@/lib/form";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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

  const stageName = (stageId: Id<"stages">) =>
    stages?.find((s) => s._id === stageId)?.name ?? "";

  const form = useAppForm({
    defaultValues: {
      nameAr: student?.nameAr ?? "",
      nameEn: student?.nameEn ?? "",
      dob: student?.dob ?? "",
      sex: (student?.sex ?? "") as "m" | "f" | "",
      guardians:
        student && student.guardians.length > 0
          ? student.guardians.map(toGuardianRow)
          : [{ ...EMPTY_ROW }],
      health: student?.health ?? "",
      consentPhotos: student?.consent.photos ?? false,
      classroomId: (currentClassroomId ?? NO_CLASSROOM) as string,
      feePlanId: NO_PLAN as string,
    },
    validators: {
      onChange: z.object({
        nameAr: z.string().refine((v) => v.trim() !== "", {
          message: t("students.form.validation.nameAr"),
        }),
        nameEn: z.string(),
        dob: z.string().refine((v) => v !== "", {
          message: t("students.form.validation.dob"),
        }),
        sex: z.enum(["m", "f", ""]),
        guardians: z
          .array(
            z.object({
              name: z.string(),
              phone: z.string(),
              relation: z.string(),
              otherRelation: z.string(),
            }),
          )
          .superRefine((rows, ctx) => {
            // A guardian row is either blank or complete — a name without a
            // phone (or vice versa) is the only invalid shape.
            rows.forEach((g, i) => {
              const hasName = g.name.trim() !== "";
              const hasPhone = g.phone.trim() !== "";
              if ((hasName || hasPhone) && !(hasName && hasPhone)) {
                ctx.addIssue({
                  code: "custom",
                  message: t("students.form.validation.guardian"),
                  path: [i, hasName ? "phone" : "name"],
                });
              }
            });
          }),
        health: z.string(),
        consentPhotos: z.boolean(),
        classroomId: z.string(),
        feePlanId: z.string(),
      }),
    },
    onSubmit: async ({ value }) => {
      const guardianDocs = value.guardians
        .filter((g) => g.name.trim() !== "" || g.phone.trim() !== "")
        .map((g) => ({
          name: g.name.trim(),
          phone: g.phone.trim(),
          relation:
            g.relation === OTHER
              ? g.otherRelation.trim() || t("students.relation.other")
              : g.relation,
        }));
      try {
        const chosenClassroomId =
          value.classroomId === NO_CLASSROOM
            ? undefined
            : (value.classroomId as Id<"classrooms">);
        const chosenPlanId =
          newEnrollment && value.feePlanId !== NO_PLAN
            ? (value.feePlanId as Id<"feePlans">)
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
          nameAr: value.nameAr.trim(),
          nameEn: value.nameEn.trim() === "" ? undefined : value.nameEn.trim(),
          dob: value.dob,
          sex: (value.sex === "" ? "m" : value.sex) as "m" | "f",
          guardians: guardianDocs,
          health: value.health.trim() === "" ? undefined : value.health.trim(),
          consentPhotos: value.consentPhotos,
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
      }
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <form.AppField name="nameAr">
        {(field) => (
          <field.TextField
            id="student-nameAr"
            dir="rtl"
            label={t("students.form.nameAr")}
          />
        )}
      </form.AppField>

      <form.AppField name="nameEn">
        {(field) => (
          <field.TextField
            id="student-nameEn"
            dir="ltr"
            className="text-start"
            label={t("students.form.nameEn")}
          />
        )}
      </form.AppField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <form.AppField name="dob">
          {(field) => (
            <field.TextField
              id="student-dob"
              type="date"
              label={t("students.form.dob")}
            />
          )}
        </form.AppField>
        <form.AppField name="sex">
          {(field) => (
            <field.SelectField
              label={t("students.form.sex")}
              placeholder={t("students.form.sex")}
              options={[
                { value: "m", label: t("students.sex.m") },
                { value: "f", label: t("students.sex.f") },
              ]}
            />
          )}
        </form.AppField>
      </div>

      <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">
          {t("students.form.guardians")}
        </legend>
        <form.Field name="guardians" mode="array">
          {(guardiansField) => (
            <>
              {guardiansField.state.value.map((guardian, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-2 rounded-md bg-muted/40 p-2"
                >
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <form.AppField name={`guardians[${index}].name`}>
                      {(field) => (
                        <field.TextField
                          aria-label={t("students.form.guardianName")}
                          placeholder={t("students.form.guardianName")}
                        />
                      )}
                    </form.AppField>
                    <form.AppField name={`guardians[${index}].phone`}>
                      {(field) => (
                        <field.TextField
                          type="tel"
                          dir="ltr"
                          className="text-start"
                          aria-label={t("students.form.guardianPhone")}
                          placeholder={t("students.form.guardianPhone")}
                        />
                      )}
                    </form.AppField>
                  </div>
                  <div className="flex items-center gap-2">
                    <form.AppField name={`guardians[${index}].relation`}>
                      {(field) => (
                        <field.SelectField
                          ariaLabel={t("students.form.guardianRelation")}
                          placeholder={t("students.form.guardianRelation")}
                          options={[
                            ...RELATION_OPTIONS.map((option) => ({
                              value: option.value,
                              label: t(option.key),
                            })),
                            {
                              value: OTHER,
                              label: t("students.relation.other"),
                            },
                          ]}
                        />
                      )}
                    </form.AppField>
                    {guardian.relation === OTHER && (
                      <form.AppField name={`guardians[${index}].otherRelation`}>
                        {(field) => (
                          <field.TextField
                            aria-label={t(
                              "students.form.relationOtherPlaceholder",
                            )}
                            placeholder={t(
                              "students.form.relationOtherPlaceholder",
                            )}
                          />
                        )}
                      </form.AppField>
                    )}
                    {guardiansField.state.value.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("students.form.removeGuardian")}
                        className="shrink-0 text-destructive hover:text-destructive"
                        onClick={() => guardiansField.removeValue(index)}
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
                onClick={() => guardiansField.pushValue({ ...EMPTY_ROW })}
              >
                <Plus data-icon="inline-start" />
                {t("students.form.addGuardian")}
              </Button>
            </>
          )}
        </form.Field>
      </fieldset>

      <form.AppField name="health">
        {(field) => (
          <field.TextareaField
            id="student-health"
            placeholder={t("students.form.healthPlaceholder")}
            label={t("students.form.health")}
          />
        )}
      </form.AppField>

      <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="student-consent">
            {t("students.form.consentPhotos")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t("students.form.consentNote")}
          </p>
        </div>
        <form.AppField name="consentPhotos">
          {(field) => (
            <Switch
              id="student-consent"
              checked={field.state.value}
              onCheckedChange={(checked) => field.handleChange(checked)}
            />
          )}
        </form.AppField>
      </div>

      <form.AppField name="classroomId">
        {(field) => (
          <field.SelectField
            label={t("students.form.classroom")}
            ariaLabel={t("students.form.classroom")}
            placeholder={t("students.form.classroom")}
            options={[
              {
                value: NO_CLASSROOM,
                label: t("students.form.noClassroom"),
              },
              ...(classrooms ?? []).map((classroom) => ({
                value: classroom._id,
                label: `${stageName(classroom.stageId)} — ${classroom.name}`,
              })),
            ]}
          />
        )}
      </form.AppField>

      {/* Fee plan (FR-FIN-1) — only for a NEW enrollment with a classroom. */}
      {newEnrollment && feePlans !== undefined && feePlans.length > 0 && (
        <form.Subscribe selector={(s) => s.values.classroomId}>
          {(classroomId) =>
            classroomId !== NO_CLASSROOM ? (
              <form.AppField name="feePlanId">
                {(field) => (
                  <field.SelectField
                    label={t("finance.plan.label")}
                    ariaLabel={t("finance.plan.label")}
                    placeholder={t("finance.plan.select")}
                    options={[
                      { value: NO_PLAN, label: t("finance.plan.none") },
                      ...feePlans.map((plan) => ({
                        value: plan._id,
                        label: `${plan.name} — ${formatFils(plan.amountFils, locale)}`,
                      })),
                    ]}
                  />
                )}
              </form.AppField>
            ) : null
          }
        </form.Subscribe>
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
        <form.AppForm>
          <form.SubmitButton disabled={!online}>
            {student ? t("students.form.save") : t("students.form.create")}
          </form.SubmitButton>
        </form.AppForm>
      </DialogFooter>
    </form>
  );
}
