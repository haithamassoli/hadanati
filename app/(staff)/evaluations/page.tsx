"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, School, Users } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { academicWeek, todayISO } from "@/convex/lib/shared";
import { conflictKeyOf, submit, useOutbox } from "@/lib/offline/outbox";
import { useEchoSettled } from "@/lib/offline/use-echo-settled";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ConflictMarker, DataAge } from "@/components/data-age";
import { EVAL_AXES, type EvalAxis } from "@/components/progress-chart";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

type Scores = Record<EvalAxis, number>;
type EvalDraft = { scores: Scores; note?: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC Dates of Sunday and Thursday of the given academic week. */
function weekRange(yearStartISO: string, week: number): [Date, Date] {
  const start = new Date(`${yearStartISO}T00:00:00Z`);
  const sunday =
    start.getTime() - start.getUTCDay() * DAY_MS + (week - 1) * 7 * DAY_MS;
  return [new Date(sunday), new Date(sunday + 4 * DAY_MS)];
}

function Loading() {
  return (
    <div className="flex min-h-64 items-center justify-center">
      <Spinner className="size-6 text-primary" />
    </div>
  );
}

export default function EvaluationsPage() {
  const { t } = useT();
  const mine = useCachedQuery(api.nurseries.getMine, {});
  // Selection state lives HERE (never unmounts): reconnect blips can flip
  // `mine.data` to loading for a moment, and the classroom/week choice must
  // survive that (bad-Wi-Fi classrooms reconnect constantly).
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [week, setWeek] = useState<number | null>(null);

  if (mine.data === undefined) {
    return <Loading />;
  }
  if (mine.data === null) {
    return null;
  }
  if (mine.data.role === "accountant") {
    return (
      <div className="mx-auto w-full max-w-2xl p-4 md:p-8">
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>{t("evaluations.noAccess")}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }
  return (
    <EvaluationsScreen
      nursery={mine.data.nursery}
      role={mine.data.role}
      userId={mine.data.membership.userId}
      selectedId={selectedId}
      setSelectedId={setSelectedId}
      chosenWeek={week}
      setChosenWeek={setWeek}
    />
  );
}

function EvaluationsScreen({
  nursery,
  role,
  userId,
  selectedId,
  setSelectedId,
  chosenWeek,
  setChosenWeek,
}: {
  nursery: Doc<"nurseries">;
  role: "admin" | "teacher";
  userId: Id<"users">;
  selectedId: string | undefined;
  setSelectedId: (id: string) => void;
  chosenWeek: number | null;
  setChosenWeek: (week: number) => void;
}) {
  const { t, locale } = useT();
  const fmt = new Intl.NumberFormat(locale === "ar" ? "ar-JO" : "en-US");
  const isRtl = locale === "ar";
  const nurseryId = nursery._id;
  const yearId = nursery.activeYear.yearId;
  const yearStart = nursery.activeYear.start;
  const currentWeek = Math.max(1, academicWeek(todayISO(), yearStart));

  const classrooms = useCachedQuery(api.classrooms.list, { nurseryId });
  const visible = useMemo(
    () =>
      (classrooms.data ?? []).filter(
        (c) => role === "admin" || c.teacherIds.includes(userId),
      ),
    [classrooms.data, role, userId],
  );

  const classroomId = selectedId ?? visible[0]?._id;
  const week = chosenWeek ?? currentWeek;

  const [rangeStart, rangeEnd] = weekRange(yearStart, week);
  const rangeLabel = new Intl.DateTimeFormat(
    locale === "ar" ? "ar-JO" : "en-US",
    { day: "numeric", month: "long", timeZone: "UTC" },
  ).formatRange(rangeStart, rangeEnd);

  // Direction-aware chevrons: "previous" points toward the reading start.
  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  if (classrooms.data === undefined) {
    return <Loading />;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-4 md:p-8">
      <header>
        <h1 className="text-2xl">{t("evaluations.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("evaluations.subtitle")}
        </p>
      </header>

      {visible.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <School />
            </EmptyMedia>
            <EmptyTitle>{t("evaluations.noClassrooms")}</EmptyTitle>
            <EmptyDescription>
              {t("evaluations.noClassroomsDesc")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <Select
              value={classroomId}
              onValueChange={(value) => setSelectedId(value)}
            >
              <SelectTrigger className="w-full" aria-label={t("evaluations.classroom")}>
                <SelectValue placeholder={t("evaluations.selectClassroom")} />
              </SelectTrigger>
              <SelectContent>
                {visible.map((classroom) => (
                  <SelectItem key={classroom._id} value={classroom._id}>
                    {classroom.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center justify-between gap-2 rounded-xl border bg-card px-2 py-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("evaluations.prevWeek")}
                disabled={week <= 1}
                onClick={() => setChosenWeek(Math.max(1, week - 1))}
              >
                <PrevIcon className="size-5" />
              </Button>
              <div className="flex flex-col items-center">
                <span className="font-heading text-base leading-tight">
                  {t("evaluations.week")} {fmt.format(week)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {rangeLabel}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("evaluations.nextWeek")}
                disabled={week >= currentWeek}
                onClick={() => setChosenWeek(Math.min(currentWeek, week + 1))}
              >
                <NextIcon className="size-5" />
              </Button>
            </div>
          </div>

          {classroomId !== undefined && (
            <WeekRoster
              key={`${classroomId}:${week}`}
              nurseryId={nurseryId}
              classroomId={classroomId as Id<"classrooms">}
              yearId={yearId}
              week={week}
            />
          )}
        </>
      )}
    </div>
  );
}

function WeekRoster({
  nurseryId,
  classroomId,
  yearId,
  week,
}: {
  nurseryId: Id<"nurseries">;
  classroomId: Id<"classrooms">;
  yearId: string;
  week: number;
}) {
  const { t, locale } = useT();
  const fmt = new Intl.NumberFormat(locale === "ar" ? "ar-JO" : "en-US");
  const avgFmt = new Intl.NumberFormat(locale === "ar" ? "ar-JO" : "en-US", {
    maximumFractionDigits: 1,
  });

  const students = useCachedQuery(api.students.listForClassroom, {
    nurseryId,
    classroomId,
    yearId,
  });
  const evaluations = useCachedQuery(api.evaluations.listForClassroomWeek, {
    nurseryId,
    classroomId,
    yearId,
    week,
  });
  const { pending, conflictKeys } = useOutbox();

  // Instant local echo layered over pending outbox entries + server rows.
  const [local, setLocal] = useState<Record<string, EvalDraft>>({});
  const [openStudent, setOpenStudent] = useState<Doc<"students"> | null>(null);

  const serverByStudent = useMemo(() => {
    const map: Record<string, EvalDraft> = {};
    for (const row of evaluations.data ?? []) {
      if (row.evaluation !== null) {
        map[row.studentId] = {
          scores: row.evaluation.scores,
          note: row.evaluation.note,
        };
      }
    }
    return map;
  }, [evaluations.data]);

  // `pending` is FIFO by createdAt, so later entries win.
  const pendingByStudent = useMemo(() => {
    const map: Record<string, EvalDraft> = {};
    for (const entry of pending) {
      if (entry.name !== "evaluations.upsert") continue;
      const args = entry.args as {
        studentId?: string;
        yearId?: string;
        week?: number;
        scores?: Scores;
        note?: string;
      };
      if (
        args.yearId === yearId &&
        args.week === week &&
        args.studentId &&
        args.scores
      ) {
        map[args.studentId] = { scores: args.scores, note: args.note };
      }
    }
    return map;
  }, [pending, yearId, week]);

  // Once a queued write drains, drop its local echo so the reactive server
  // row becomes the truth again (multi-device LWW convergence, PRD §8.5).
  useEchoSettled(
    pending,
    useCallback(
      (entry) => {
        if (entry.name !== "evaluations.upsert") return null;
        const args = entry.args as {
          studentId?: string;
          yearId?: string;
          week?: number;
        };
        return args.yearId === yearId &&
          args.week === week &&
          args.studentId !== undefined
          ? args.studentId
          : null;
      },
      [yearId, week],
    ),
    useCallback((studentIds: string[]) => {
      setLocal((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const id of studentIds) {
          if (id in next) {
            delete next[id];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, []),
  );

  function effective(studentId: string): EvalDraft | undefined {
    return (
      local[studentId] ?? pendingByStudent[studentId] ?? serverByStudent[studentId]
    );
  }

  if (students.data === undefined || evaluations.data === undefined) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (students.data.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Users />
          </EmptyMedia>
          <EmptyTitle>{t("evaluations.noStudents")}</EmptyTitle>
          <EmptyDescription>{t("evaluations.noStudentsDesc")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  // Classroom-week axis averages over effective (local + pending + server).
  const evaluated = students.data
    .map((s) => effective(s._id))
    .filter((d): d is EvalDraft => d !== undefined);

  function save(studentId: Id<"students">, scores: Scores, note: string) {
    const trimmed = note.trim();
    const draft: EvalDraft = {
      scores,
      ...(trimmed !== "" ? { note: trimmed } : {}),
    };
    setLocal((prev) => ({ ...prev, [studentId]: draft }));
    void submit("evaluations.upsert", {
      nurseryId,
      studentId,
      yearId,
      week,
      scores,
      ...(trimmed !== "" ? { note: trimmed } : {}),
    });
    toast.success(t("evaluations.saved"));
    setOpenStudent(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <DataAge
        isStale={students.isStale || evaluations.isStale}
        updatedAt={students.updatedAt ?? evaluations.updatedAt}
        className="self-start"
      />
      {evaluated.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            {t("evaluations.weekAverages")}
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {EVAL_AXES.map((axis) => {
              const sum = evaluated.reduce(
                (acc, d) => acc + d.scores[axis.key],
                0,
              );
              return (
                <span
                  key={axis.key}
                  className="flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs"
                >
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ backgroundColor: axis.color }}
                  />
                  <span className="text-muted-foreground">
                    {t(`evaluations.axis.${axis.key}`)}
                  </span>
                  <span className="font-medium">
                    {avgFmt.format(sum / evaluated.length)}
                  </span>
                </span>
              );
            })}
          </div>
        </section>
      )}

      <div className="flex flex-col gap-1.5">
        {students.data.map((student, index) => {
          const draft = effective(student._id);
          const conflicted = conflictKeys.has(
            conflictKeyOf("evaluations.upsert", {
              nurseryId,
              studentId: student._id,
              week,
            }),
          );
          return (
            <button
              key={student._id}
              type="button"
              data-testid="eval-row"
              data-student-id={student._id}
              data-evaluated={draft !== undefined}
              onClick={() => setOpenStudent(student)}
              className="flex min-h-14 items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2 text-start transition-colors hover:bg-accent"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="w-6 shrink-0 text-xs text-muted-foreground">
                  {fmt.format(index + 1)}
                </span>
                <span className="truncate text-sm">{student.nameAr}</span>
                <ConflictMarker show={conflicted} />
              </span>
              {draft ? (
                <span className="flex shrink-0 items-center gap-1">
                  {EVAL_AXES.map((axis) => (
                    <span
                      key={axis.key}
                      title={t(`evaluations.axis.${axis.key}`)}
                      className="flex size-6 items-center justify-center rounded-full text-[11px] font-medium text-white"
                      style={{ backgroundColor: axis.color }}
                    >
                      {fmt.format(draft.scores[axis.key])}
                    </span>
                  ))}
                  <Check
                    aria-label={t("evaluations.evaluated")}
                    className="ms-1 size-4 text-present"
                  />
                </span>
              ) : (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {t("evaluations.notEvaluated")}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Sheet
        open={openStudent !== null}
        onOpenChange={(open) => {
          if (!open) setOpenStudent(null);
        }}
      >
        {openStudent !== null && (
          <EntrySheet
            key={`${openStudent._id}:${week}`}
            student={openStudent}
            week={week}
            initial={effective(openStudent._id)}
            onSave={save}
          />
        )}
      </Sheet>
    </div>
  );
}

function EntrySheet({
  student,
  week,
  initial,
  onSave,
}: {
  student: Doc<"students">;
  week: number;
  initial: EvalDraft | undefined;
  onSave: (studentId: Id<"students">, scores: Scores, note: string) => void;
}) {
  const { t, locale } = useT();
  const fmt = new Intl.NumberFormat(locale === "ar" ? "ar-JO" : "en-US");
  const [scores, setScores] = useState<Record<EvalAxis, number | null>>({
    academic: initial?.scores.academic ?? null,
    social: initial?.scores.social ?? null,
    motor: initial?.scores.motor ?? null,
    behavioral: initial?.scores.behavioral ?? null,
  });
  const [note, setNote] = useState(initial?.note ?? "");
  const complete = EVAL_AXES.every((axis) => scores[axis.key] !== null);

  return (
    <SheetContent
      side="bottom"
      className="mx-auto max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl px-4 pb-6"
    >
      <SheetHeader className="px-0">
        <SheetTitle className="font-heading text-lg">
          {student.nameAr}
        </SheetTitle>
        <SheetDescription>
          {t("evaluations.week")} {fmt.format(week)}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-4">
        {EVAL_AXES.map((axis) => (
          <div key={axis.key} className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ backgroundColor: axis.color }}
              />
              {t(`evaluations.axis.${axis.key}`)}
            </span>
            <div
              role="radiogroup"
              aria-label={t(`evaluations.axis.${axis.key}`)}
              className="grid grid-cols-5 gap-1.5"
            >
              {[1, 2, 3, 4, 5].map((value) => {
                const selected = scores[axis.key] === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    data-testid={`score-${axis.key}-${value}`}
                    aria-checked={selected}
                    onClick={() =>
                      setScores((prev) => ({ ...prev, [axis.key]: value }))
                    }
                    className={cn(
                      "h-11 rounded-lg border text-sm font-medium transition-colors",
                      selected
                        ? "text-white"
                        : "bg-background hover:bg-accent",
                    )}
                    style={
                      selected
                        ? { backgroundColor: axis.color, borderColor: axis.color }
                        : undefined
                    }
                  >
                    {fmt.format(value)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="eval-note" className="text-sm font-medium">
            {t("evaluations.note")}
          </label>
          <Textarea
            id="eval-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t("evaluations.notePlaceholder")}
            rows={2}
          />
        </div>
      </div>

      <SheetFooter className="px-0">
        {!complete && (
          <p className="text-center text-xs text-muted-foreground">
            {t("evaluations.pickAll")}
          </p>
        )}
        <Button
          type="button"
          size="lg"
          data-testid="eval-save"
          disabled={!complete}
          onClick={() => onSave(student._id, scores as Scores, note)}
        >
          {t("common.save")}
        </Button>
      </SheetFooter>
    </SheetContent>
  );
}
