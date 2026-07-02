"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueries, type RequestForQueries } from "convex/react";
import { ConvexError } from "convex/values";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Pencil,
  Plus,
  School,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { useOnline } from "@/lib/offline/use-online";
import { useT } from "@/lib/i18n";
import { DataAge } from "@/components/data-age";
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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { formatCount } from "../students/format";

type Member = {
  membershipId: Id<"memberships">;
  role: "admin" | "teacher" | "accountant";
  userId: Id<"users">;
  name: string;
  email: string;
};

function errorCode(error: unknown): string | null {
  return error instanceof ConvexError && typeof error.data === "string"
    ? error.data
    : null;
}

export default function ClassroomsPage() {
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
    <ClassroomsView
      nurseryId={mine.data.nursery._id}
      yearId={mine.data.nursery.activeYear.yearId}
      isAdmin={mine.data.role === "admin"}
    />
  );
}

function ClassroomsView({
  nurseryId,
  yearId,
  isAdmin,
}: {
  nurseryId: Id<"nurseries">;
  yearId: string;
  isAdmin: boolean;
}) {
  const { t, locale } = useT();
  const online = useOnline();
  const stagesQ = useCachedQuery(api.stages.list, { nurseryId });
  const stages = stagesQ.data;
  const classroomsQ = useCachedQuery(api.classrooms.list, { nurseryId });
  const classrooms = classroomsQ.data;
  const membersQ = useCachedQuery(
    api.staff.listMembers,
    isAdmin ? { nurseryId } : "skip",
  );
  const members = membersQ.data;

  // Lazy per-classroom student counts (active year rosters).
  const rosterQueries = useMemo(() => {
    const queries: RequestForQueries = {};
    for (const classroom of classrooms ?? []) {
      queries[classroom._id] = {
        query: api.students.listForClassroom,
        args: { nurseryId, classroomId: classroom._id, yearId },
      };
    }
    return queries;
  }, [classrooms, nurseryId, yearId]);
  const rosters = useQueries(rosterQueries);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Doc<"classrooms"> | null>(null);

  const teacherName = (userId: Id<"users">) =>
    members?.find((m) => m.userId === userId)?.name;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 md:p-8">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl">{t("classrooms.title")}</h1>
          <DataAge
            isStale={classroomsQ.isStale || stagesQ.isStale}
            updatedAt={classroomsQ.updatedAt ?? stagesQ.updatedAt}
          />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("classrooms.subtitle")}
        </p>
        {/* Classroom/stage CRUD is online-only — no outbox (§8 scope). */}
        {isAdmin && !online && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t("offline.requiresConnection")}
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <StagesPanel nurseryId={nurseryId} stages={stages} isAdmin={isAdmin} />

        {/* Classrooms grouped by stage */}
        <div className="flex flex-col gap-4 lg:order-first">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg">{t("classrooms.list.title")}</h2>
            {isAdmin && (
              <Button
                size="sm"
                disabled={!online}
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus data-icon="inline-start" />
                {t("classrooms.new")}
              </Button>
            )}
          </div>

          {stages === undefined || classrooms === undefined ? (
            <div className="flex justify-center py-12">
              <Spinner className="size-6 text-primary" />
            </div>
          ) : classrooms.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <School />
                </EmptyMedia>
                <EmptyTitle>{t("classrooms.empty.title")}</EmptyTitle>
                <EmptyDescription>{t("classrooms.empty.desc")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            stages.map((stage) => {
              const stageClassrooms = classrooms.filter(
                (c) => c.stageId === stage._id,
              );
              if (stageClassrooms.length === 0) return null;
              return (
                <section key={stage._id} className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {stage.name}
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {stageClassrooms.map((classroom) => {
                      const roster = rosters[classroom._id];
                      return (
                        <Card key={classroom._id} className="gap-3 py-4">
                          <CardHeader className="px-4">
                            <CardTitle className="flex items-center justify-between gap-2">
                              <span className="truncate">{classroom.name}</span>
                              <Badge variant="secondary">{stage.name}</Badge>
                            </CardTitle>
                            <CardDescription>
                              {Array.isArray(roster)
                                ? formatCount(
                                    roster.length,
                                    "students.count",
                                    t,
                                    locale,
                                  )
                                : t("common.loading")}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="flex items-end justify-between gap-2 px-4">
                            {isAdmin ? (
                              <div className="min-w-0 text-sm">
                                <p className="text-xs text-muted-foreground">
                                  {t("classrooms.card.teachers")}
                                </p>
                                {classroom.teacherIds.length === 0 ? (
                                  <p className="text-muted-foreground">
                                    {t("classrooms.card.noTeachers")}
                                  </p>
                                ) : (
                                  <p className="truncate">
                                    {classroom.teacherIds
                                      .map((id) => teacherName(id) ?? "—")
                                      .join("، ")}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div />
                            )}
                            {isAdmin && (
                              <div className="flex shrink-0 items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={t("classrooms.edit")}
                                  disabled={!online}
                                  onClick={() => {
                                    setEditing(classroom);
                                    setFormOpen(true);
                                  }}
                                >
                                  <Pencil />
                                </Button>
                                <DeleteClassroomButton
                                  nurseryId={nurseryId}
                                  classroom={classroom}
                                />
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
        </div>
      </div>

      {isAdmin && (
        <ClassroomFormDialog
          key={`${editing?._id ?? "new"}-${formOpen}`}
          open={formOpen}
          onOpenChange={setFormOpen}
          nurseryId={nurseryId}
          stages={stages ?? []}
          teachers={(members ?? []).filter((m) => m.role === "teacher")}
          classroom={editing ?? undefined}
        />
      )}
    </div>
  );
}

function StagesPanel({
  nurseryId,
  stages,
  isAdmin,
}: {
  nurseryId: Id<"nurseries">;
  stages: Doc<"stages">[] | undefined;
  isAdmin: boolean;
}) {
  const { t } = useT();
  const online = useOnline();
  const createStage = useMutation(api.stages.create);
  const updateStage = useMutation(api.stages.update);
  const removeStage = useMutation(api.stages.remove);

  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<Id<"stages"> | null>(null);
  const [draftName, setDraftName] = useState("");

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newName.trim() === "") return;
    setAdding(true);
    try {
      await createStage({ nurseryId, name: newName.trim() });
      setNewName("");
      toast.success(t("classrooms.toast.stageAdded"));
    } catch {
      toast.error(t("classrooms.error.generic"));
    } finally {
      setAdding(false);
    }
  }

  async function onRename(stageId: Id<"stages">) {
    if (draftName.trim() === "") return;
    try {
      await updateStage({ nurseryId, stageId, name: draftName.trim() });
      toast.success(t("classrooms.toast.stageRenamed"));
      setEditingId(null);
    } catch {
      toast.error(t("classrooms.error.generic"));
    }
  }

  async function onSwap(index: number, direction: -1 | 1) {
    if (stages === undefined) return;
    const a = stages[index];
    const b = stages[index + direction];
    if (a === undefined || b === undefined) return;
    try {
      await Promise.all([
        updateStage({ nurseryId, stageId: a._id, order: b.order }),
        updateStage({ nurseryId, stageId: b._id, order: a.order }),
      ]);
    } catch {
      toast.error(t("classrooms.error.generic"));
    }
  }

  async function onDelete(stageId: Id<"stages">) {
    try {
      await removeStage({ nurseryId, stageId });
      toast.success(t("classrooms.toast.stageDeleted"));
    } catch (error) {
      toast.error(
        errorCode(error) === "stage_has_classrooms"
          ? t("classrooms.error.stageHasClassrooms")
          : t("classrooms.error.generic"),
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("classrooms.stages.title")}</CardTitle>
        <CardDescription>{t("classrooms.stages.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isAdmin && (
          <form onSubmit={onAdd} className="flex items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("classrooms.stages.addPlaceholder")}
            />
            <Button
              type="submit"
              size="sm"
              disabled={adding || newName.trim() === "" || !online}
            >
              {adding ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Plus data-icon="inline-start" />
              )}
              {t("classrooms.stages.add")}
            </Button>
          </form>
        )}

        {stages === undefined ? (
          <div className="flex justify-center py-6">
            <Spinner className="size-5 text-primary" />
          </div>
        ) : stages.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t("classrooms.stages.empty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {stages.map((stage, index) => (
              <li
                key={stage._id}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-muted/50"
              >
                {editingId === stage._id ? (
                  <>
                    <Input
                      autoFocus
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void onRename(stage._id);
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="h-8 flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("classrooms.stages.save")}
                      disabled={!online}
                      onClick={() => onRename(stage._id)}
                    >
                      <Check />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("classrooms.stages.cancel")}
                      onClick={() => setEditingId(null)}
                    >
                      <X />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 truncate text-sm">{stage.name}</span>
                    {isAdmin && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("classrooms.stages.moveUp")}
                          disabled={index === 0 || !online}
                          onClick={() => onSwap(index, -1)}
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("classrooms.stages.moveDown")}
                          disabled={index === stages.length - 1 || !online}
                          onClick={() => onSwap(index, 1)}
                        >
                          <ArrowDown />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("classrooms.stages.rename")}
                          disabled={!online}
                          onClick={() => {
                            setEditingId(stage._id);
                            setDraftName(stage.name);
                          }}
                        >
                          <Pencil />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t("classrooms.stages.delete")}
                              className="text-destructive hover:text-destructive"
                              disabled={!online}
                            >
                              <Trash2 />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {t("classrooms.stages.deleteTitle")}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("classrooms.stages.deleteDesc")}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>
                                {t("classrooms.stages.cancel")}
                              </AlertDialogCancel>
                              <AlertDialogAction
                                variant="destructive"
                                onClick={() => onDelete(stage._id)}
                              >
                                {t("classrooms.stages.deleteConfirm")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DeleteClassroomButton({
  nurseryId,
  classroom,
}: {
  nurseryId: Id<"nurseries">;
  classroom: Doc<"classrooms">;
}) {
  const { t } = useT();
  const online = useOnline();
  const removeClassroom = useMutation(api.classrooms.remove);

  async function onDelete() {
    try {
      await removeClassroom({ nurseryId, classroomId: classroom._id });
      toast.success(t("classrooms.toast.deleted"));
    } catch (error) {
      toast.error(
        errorCode(error) === "classroom_has_enrollments"
          ? t("classrooms.error.hasEnrollments")
          : t("classrooms.error.generic"),
      );
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("classrooms.delete")}
          className="text-destructive hover:text-destructive"
          disabled={!online}
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("classrooms.deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("classrooms.deleteDesc")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("classrooms.form.cancel")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDelete}>
            {t("classrooms.deleteConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ClassroomFormDialog({
  open,
  onOpenChange,
  nurseryId,
  stages,
  teachers,
  classroom,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nurseryId: Id<"nurseries">;
  stages: Doc<"stages">[];
  teachers: Member[];
  classroom?: Doc<"classrooms">;
}) {
  const { t } = useT();
  const online = useOnline();
  const createClassroom = useMutation(api.classrooms.create);
  const updateClassroom = useMutation(api.classrooms.update);

  const [name, setName] = useState(classroom?.name ?? "");
  const [stageId, setStageId] = useState<string>(classroom?.stageId ?? "");
  const [teacherIds, setTeacherIds] = useState<Id<"users">[]>(
    classroom?.teacherIds ?? [],
  );
  const [saving, setSaving] = useState(false);

  function toggleTeacher(userId: Id<"users">, checked: boolean) {
    setTeacherIds((ids) =>
      checked ? [...ids, userId] : ids.filter((id) => id !== userId),
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim() === "") {
      toast.error(t("classrooms.form.validation.name"));
      return;
    }
    if (stageId === "") {
      toast.error(t("classrooms.form.validation.stage"));
      return;
    }
    setSaving(true);
    try {
      if (classroom !== undefined) {
        await updateClassroom({
          nurseryId,
          classroomId: classroom._id,
          name: name.trim(),
          stageId: stageId as Id<"stages">,
          teacherIds,
        });
        toast.success(t("classrooms.toast.updated"));
      } else {
        await createClassroom({
          nurseryId,
          name: name.trim(),
          stageId: stageId as Id<"stages">,
          teacherIds,
        });
        toast.success(t("classrooms.toast.created"));
      }
      onOpenChange(false);
    } catch {
      toast.error(t("classrooms.error.generic"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {classroom !== undefined
              ? t("classrooms.form.editTitle")
              : t("classrooms.form.newTitle")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {classroom !== undefined
              ? t("classrooms.form.editTitle")
              : t("classrooms.form.newTitle")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="classroom-name">{t("classrooms.form.name")}</Label>
            <Input
              id="classroom-name"
              required
              value={name}
              placeholder={t("classrooms.form.namePlaceholder")}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t("classrooms.form.stage")}</Label>
            <Select value={stageId} onValueChange={setStageId}>
              <SelectTrigger
                className="w-full"
                aria-label={t("classrooms.form.stage")}
              >
                <SelectValue placeholder={t("classrooms.form.stagePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage._id} value={stage._id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t("classrooms.form.teachers")}</Label>
            {teachers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("classrooms.form.noTeachers")}
              </p>
            ) : (
              <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border p-2">
                {teachers.map((teacher) => (
                  <label
                    key={teacher.userId}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={teacherIds.includes(teacher.userId)}
                      onChange={(e) =>
                        toggleTeacher(teacher.userId, e.target.checked)
                      }
                    />
                    {teacher.name}
                  </label>
                ))}
              </div>
            )}
          </div>
          {!online && (
            <p className="text-xs text-muted-foreground">
              {t("offline.requiresConnection")}
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("classrooms.form.cancel")}
            </Button>
            <Button type="submit" disabled={saving || !online}>
              {saving && <Spinner data-icon="inline-start" />}
              {classroom !== undefined
                ? t("classrooms.form.save")
                : t("classrooms.form.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
