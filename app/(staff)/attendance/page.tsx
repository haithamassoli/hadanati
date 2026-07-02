"use client";

// /attendance — the core teacher screen. Mobile-first, offline-first:
// roster + attendance are read through useCachedQuery (IndexedDB snapshot
// fallback), taps are written through the write-ahead outbox, and pending
// outbox entries are layered over server rows for an instant echo.

import { useCallback, useMemo, useState } from "react";
import { CalendarDays, StickyNote } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { STATUS_CYCLE, todayISO } from "@/convex/lib/shared";
import { conflictKeyOf, submit, useOutbox } from "@/lib/offline/outbox";
import { useEchoSettled } from "@/lib/offline/use-echo-settled";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ConflictMarker, DataAge } from "@/components/data-age";
import { StatusChip } from "@/components/status-chip";
import { WeekRibbon } from "@/components/week-ribbon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

type Status = (typeof STATUS_CYCLE)[number];

type Rec = { status: Status; note?: string; checkInAt?: number };

const DOT: Record<Status | "unmarked", string> = {
  present: "bg-present",
  absent: "bg-absent",
  late: "bg-late",
  excused: "bg-excused",
  unmarked: "bg-muted-foreground/40",
};

function Loading() {
  return (
    <div className="flex min-h-64 items-center justify-center">
      <Spinner className="size-6 text-primary" />
    </div>
  );
}

function msToTimeInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function timeInputToMs(date: string, time: string): number {
  return new Date(`${date}T${time}:00`).getTime();
}

export default function AttendancePage() {
  const mine = useCachedQuery(api.nurseries.getMine, {});
  // Selection state lives HERE (never unmounts): reconnect blips can flip
  // `mine.data` to loading for a moment, and the classroom/date choice must
  // survive that (bad-Wi-Fi classrooms reconnect constantly).
  const [chosenClassroom, setChosenClassroom] =
    useState<Id<"classrooms"> | null>(null);
  const [date, setDate] = useState(todayISO());
  if (mine.data === undefined || mine.data === null) {
    return <Loading />;
  }
  return (
    <AttendanceScreen
      nursery={mine.data.nursery}
      role={mine.data.role}
      userId={mine.data.membership.userId}
      chosenClassroom={chosenClassroom}
      setChosenClassroom={setChosenClassroom}
      date={date}
      setDate={setDate}
    />
  );
}

function AttendanceScreen({
  nursery,
  role,
  userId,
  chosenClassroom,
  setChosenClassroom,
  date,
  setDate,
}: {
  nursery: Doc<"nurseries">;
  role: "admin" | "teacher" | "accountant";
  userId: Id<"users">;
  chosenClassroom: Id<"classrooms"> | null;
  setChosenClassroom: (id: Id<"classrooms">) => void;
  date: string;
  setDate: (iso: string) => void;
}) {
  const { t } = useT();
  const nurseryId = nursery._id;
  const today = todayISO();
  const isTeacher = role === "teacher";
  // PRD §6: accountant is read-only — server rejects upserts, so don't offer them.
  const readOnly = role === "accountant";

  const classrooms = useCachedQuery(api.classrooms.list, { nurseryId });
  const stages = useCachedQuery(api.stages.list, { nurseryId });

  const visible = useMemo(() => {
    const all = classrooms.data ?? [];
    return isTeacher ? all.filter((c) => c.teacherIds.includes(userId)) : all;
  }, [classrooms.data, isTeacher, userId]);

  // Auto-select the first available classroom (derived; no effect needed).
  const classroomId = chosenClassroom ?? visible[0]?._id ?? null;

  // Group classrooms by stage (admin/accountant view).
  const groups = useMemo(() => {
    const stageList = stages.data ?? [];
    const byStage = new Map<string, typeof visible>();
    const orphans: typeof visible = [];
    for (const c of visible) {
      const stage = stageList.find((s) => s._id === c.stageId);
      if (stage === undefined) {
        orphans.push(c);
        continue;
      }
      const bucket = byStage.get(stage._id) ?? [];
      bucket.push(c);
      byStage.set(stage._id, bucket);
    }
    const result = stageList
      .filter((s) => byStage.has(s._id))
      .map((s) => ({ label: s.name, rooms: byStage.get(s._id)! }));
    if (orphans.length > 0) {
      result.push({ label: "", rooms: orphans });
    }
    return result;
  }, [stages.data, visible]);

  if (classrooms.data === undefined) {
    return <Loading />;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl">{t("attendance.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {readOnly ? t("attendance.readOnly") : t("attendance.subtitle")}
        </p>
      </header>

      {visible.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("attendance.noClassrooms")}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <Select
              value={classroomId ?? undefined}
              onValueChange={(value) =>
                setChosenClassroom(value as Id<"classrooms">)
              }
            >
              <SelectTrigger
                className="w-full"
                aria-label={t("attendance.classroom")}
              >
                <SelectValue placeholder={t("attendance.selectClassroom")} />
              </SelectTrigger>
              <SelectContent>
                {isTeacher
                  ? visible.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.name}
                      </SelectItem>
                    ))
                  : groups.map((group, i) => (
                      <SelectGroup key={group.label || `g${i}`}>
                        {group.label !== "" && (
                          <SelectLabel>{group.label}</SelectLabel>
                        )}
                        {group.rooms.map((c) => (
                          <SelectItem key={c._id} value={c._id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
              </SelectContent>
            </Select>

            <WeekRibbon
              selectedDate={date}
              onSelect={(iso) => {
                if (isTeacher && iso !== today) return;
                setDate(iso);
              }}
              isDayDisabled={isTeacher ? (iso) => iso !== today : undefined}
            />

            {isTeacher ? (
              <p className="text-xs text-muted-foreground">
                {t("attendance.teacherTodayOnly")}
              </p>
            ) : (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="size-4 shrink-0" />
                <span>{t("attendance.pickDate")}</span>
                <Input
                  type="date"
                  value={date}
                  onChange={(event) => {
                    if (event.target.value !== "") setDate(event.target.value);
                  }}
                  className="h-8 w-auto"
                />
              </label>
            )}
          </div>

          {classroomId !== null && (
            <Roster
              key={`${classroomId}:${date}`}
              nurseryId={nurseryId}
              classroomId={classroomId}
              yearId={nursery.activeYear.yearId}
              date={date}
              readOnly={readOnly}
            />
          )}
        </>
      )}
    </div>
  );
}

function Roster({
  nurseryId,
  classroomId,
  yearId,
  date,
  readOnly = false,
}: {
  nurseryId: Id<"nurseries">;
  classroomId: Id<"classrooms">;
  yearId: string;
  date: string;
  readOnly?: boolean;
}) {
  const { t, locale } = useT();
  const num = new Intl.NumberFormat(locale === "ar" ? "ar-JO" : "en-US");

  const students = useCachedQuery(api.students.listForClassroom, {
    nurseryId,
    classroomId,
    yearId,
  });
  const attendance = useCachedQuery(api.attendance.listForClassroomDate, {
    nurseryId,
    classroomId,
    date,
  });
  const { pending, conflictKeys } = useOutbox();

  // ---- Merge: local echo ▸ pending outbox (FIFO, later wins) ▸ server ----
  const [local, setLocal] = useState<Record<string, Rec>>({});
  // Note drafts for still-unmarked students (merged into their next submit).
  const [drafts, setDrafts] = useState<
    Record<string, { note?: string; checkInAt?: number }>
  >({});
  const [noteFor, setNoteFor] = useState<Doc<"students"> | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Once a queued write drains, drop its local echo so the reactive server
  // row becomes the truth again (multi-device LWW convergence, PRD §8.5).
  useEchoSettled(
    pending,
    useCallback(
      (entry) => {
        if (entry.name !== "attendance.upsert") return null;
        const args = entry.args as {
          classroomId?: string;
          studentId?: string;
          date?: string;
        };
        return args.classroomId === classroomId &&
          args.date === date &&
          args.studentId !== undefined
          ? args.studentId
          : null;
      },
      [classroomId, date],
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

  const serverRec: Record<string, Rec> = {};
  for (const row of attendance.data ?? []) {
    serverRec[row.studentId] = {
      status: row.status,
      note: row.note,
      checkInAt: row.checkInAt,
    };
  }
  const pendingRec: Record<string, Rec> = {};
  for (const entry of pending) {
    if (entry.name !== "attendance.upsert") continue;
    const args = entry.args as {
      classroomId?: string;
      studentId?: string;
      date?: string;
      status?: Status;
      note?: string;
      checkInAt?: number;
    };
    if (
      args.classroomId === classroomId &&
      args.date === date &&
      args.studentId !== undefined &&
      args.status !== undefined
    ) {
      pendingRec[args.studentId] = {
        status: args.status,
        note: args.note,
        checkInAt: args.checkInAt,
      };
    }
  }
  const effective = (studentId: string): Rec | undefined =>
    local[studentId] ?? pendingRec[studentId] ?? serverRec[studentId];

  function send(studentId: Id<"students">, rec: Rec) {
    setLocal((prev) => ({ ...prev, [studentId]: rec }));
    const args: Record<string, unknown> = {
      nurseryId,
      classroomId,
      studentId,
      date,
      status: rec.status,
    };
    if (rec.note !== undefined && rec.note !== "") args.note = rec.note;
    if (rec.checkInAt !== undefined) args.checkInAt = rec.checkInAt;
    return submit("attendance.upsert", args);
  }

  function cycle(student: Doc<"students">) {
    const current = effective(student._id);
    const index =
      current === undefined ? -1 : STATUS_CYCLE.indexOf(current.status);
    const next = STATUS_CYCLE[(index + 1) % STATUS_CYCLE.length];
    const draft = drafts[student._id];
    if (draft !== undefined) {
      setDrafts((prev) => {
        const rest = { ...prev };
        delete rest[student._id];
        return rest;
      });
    }
    void send(student._id, {
      status: next,
      note: draft?.note ?? current?.note,
      checkInAt: draft?.checkInAt ?? current?.checkInAt,
    });
  }

  function saveNote(
    student: Doc<"students">,
    note: string,
    checkInAt: number | undefined,
  ) {
    const current = effective(student._id);
    if (current === undefined) {
      // Unmarked: keep as a draft, merged into the next status submit.
      setDrafts((prev) => ({
        ...prev,
        [student._id]: { note: note === "" ? undefined : note, checkInAt },
      }));
      return;
    }
    void send(student._id, {
      status: current.status,
      note: note === "" ? undefined : note,
      checkInAt,
    });
  }

  const roster = students.data ?? [];
  const counts = { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 };
  for (const student of roster) {
    const rec = effective(student._id);
    counts[rec?.status ?? "unmarked"] += 1;
  }
  const unmarkedStudents = roster.filter((s) => effective(s._id) === undefined);

  async function markRestPresent() {
    setBulkBusy(true);
    try {
      for (const student of unmarkedStudents) {
        const draft = drafts[student._id];
        await send(student._id, {
          status: "present",
          note: draft?.note,
          checkInAt: draft?.checkInAt,
        });
      }
      setDrafts({});
    } finally {
      setBulkBusy(false);
    }
  }

  const isStale = students.isStale || attendance.isStale;
  const staleAt = students.updatedAt ?? attendance.updatedAt;

  if (students.data === undefined) {
    return <Loading />;
  }

  return (
    <div className="flex flex-col gap-3">
      <DataAge isStale={isStale} updatedAt={staleAt} className="self-start" />

      {roster.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("attendance.noStudents")}</EmptyTitle>
            <EmptyDescription>
              {t("attendance.noStudentsDesc")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <ul className="flex flex-col gap-1.5">
            {roster.map((student) => {
              const rec = effective(student._id);
              const conflicted = conflictKeys.has(
                conflictKeyOf("attendance.upsert", {
                  nurseryId,
                  studentId: student._id,
                  date,
                }),
              );
              const hasNote =
                (rec?.note !== undefined && rec.note !== "") ||
                rec?.checkInAt !== undefined ||
                drafts[student._id] !== undefined;
              return (
                <li
                  key={student._id}
                  className="flex items-center gap-1 rounded-xl border bg-card pe-1.5"
                >
                  <button
                    type="button"
                    data-testid="student-row"
                    data-student-id={student._id}
                    data-status={rec?.status ?? "unmarked"}
                    onClick={readOnly ? undefined : () => cycle(student)}
                    className={cn(
                      "flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-s-xl ps-3 pe-1 text-start transition-colors",
                      !readOnly && "hover:bg-accent/50",
                      readOnly && "cursor-default",
                    )}
                  >
                    <span
                      aria-hidden
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary font-heading text-secondary-foreground"
                    >
                      {student.nameAr.trim().charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {student.nameAr}
                      </span>
                      {rec?.note !== undefined && rec.note !== "" && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {rec.note}
                        </span>
                      )}
                    </span>
                    <ConflictMarker show={conflicted} />
                    <StatusChip
                      status={rec?.status ?? "unmarked"}
                      size="sm"
                      className="pointer-events-none"
                    />
                  </button>
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("attendance.note")}
                      className={cn(
                        "size-11 shrink-0 text-muted-foreground",
                        hasNote && "text-primary",
                      )}
                      onClick={() => setNoteFor(student)}
                    >
                      <StickyNote className="size-4.5" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Sticky summary bar — pins above the mobile tab bar / viewport bottom. */}
          <div className="sticky bottom-[4.75rem] z-30 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border bg-card/95 px-3 py-2 shadow-md backdrop-blur md:bottom-4">
            {(
              ["present", "absent", "late", "excused", "unmarked"] as const
            ).map((status) => (
              <span
                key={status}
                className="flex items-center gap-1 text-xs"
                data-testid={`count-${status}`}
                data-count={counts[status]}
              >
                <span
                  aria-hidden
                  className={cn("size-2 rounded-full", DOT[status])}
                />
                <span className="text-muted-foreground">
                  {t(`attendance.${status}`)}
                </span>
                <span className="font-medium">{num.format(counts[status])}</span>
              </span>
            ))}
            {!readOnly && (
              <Button
                type="button"
                size="sm"
                className="ms-auto"
                disabled={unmarkedStudents.length === 0 || bulkBusy}
                data-testid="mark-rest"
                onClick={() => {
                  if (unmarkedStudents.length > 5) {
                    setConfirmBulk(true);
                  } else {
                    void markRestPresent();
                  }
                }}
              >
                {bulkBusy && <Spinner className="size-3.5" />}
                {t("attendance.markRest")}
              </Button>
            )}
          </div>
        </>
      )}

      <NoteDialog
        student={noteFor}
        date={date}
        initial={
          noteFor !== null
            ? (drafts[noteFor._id] ?? effective(noteFor._id))
            : undefined
        }
        isUnmarked={noteFor !== null && effective(noteFor._id) === undefined}
        onClose={() => setNoteFor(null)}
        onSave={saveNote}
      />

      <AlertDialog open={confirmBulk} onOpenChange={setConfirmBulk}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("attendance.markRestTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("attendance.markRestDesc")} (
              {num.format(unmarkedStudents.length)})
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("attendance.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              data-testid="mark-rest-confirm"
              onClick={() => void markRestPresent()}
            >
              {t("attendance.markRestConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NoteDialog({
  student,
  date,
  initial,
  isUnmarked,
  onClose,
  onSave,
}: {
  student: Doc<"students"> | null;
  date: string;
  initial: { note?: string; checkInAt?: number } | undefined;
  isUnmarked: boolean;
  onClose: () => void;
  onSave: (
    student: Doc<"students">,
    note: string,
    checkInAt: number | undefined,
  ) => void;
}) {
  const { t } = useT();
  const [note, setNote] = useState("");
  const [time, setTime] = useState("");
  const [seededFor, setSeededFor] = useState<string | null>(null);

  // Re-seed the form whenever a (new) student is opened.
  if (student !== null && seededFor !== student._id) {
    setSeededFor(student._id);
    setNote(initial?.note ?? "");
    setTime(
      initial?.checkInAt !== undefined ? msToTimeInput(initial.checkInAt) : "",
    );
  }
  if (student === null && seededFor !== null) {
    setSeededFor(null);
  }

  return (
    <Dialog open={student !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {t("attendance.noteTitle")}
            {student !== null ? ` — ${student.nameAr}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="attendance-note">{t("attendance.note")}</Label>
            <Textarea
              id="attendance-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("attendance.notePlaceholder")}
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="attendance-checkin">
              {t("attendance.checkInTime")}
            </Label>
            <Input
              id="attendance-checkin"
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
          </div>
          {isUnmarked && (
            <p className="text-xs text-muted-foreground">
              {t("attendance.noteDraftHint")}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("attendance.cancel")}
          </Button>
          <Button
            type="button"
            data-testid="note-save"
            onClick={() => {
              if (student !== null) {
                onSave(
                  student,
                  note.trim(),
                  time !== "" ? timeInputToMs(date, time) : undefined,
                );
              }
              onClose();
            }}
          >
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
