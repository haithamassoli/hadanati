"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueries, type RequestForQueries } from "convex/react";
import { Plus, Search, UsersRound } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { useT } from "@/lib/i18n";
import { DataAge } from "@/components/data-age";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatAge, formatCount } from "./format";
import { StudentFormDialog } from "./student-form";

export default function StudentsPage() {
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
    <StudentsView
      nurseryId={mine.data.nursery._id}
      yearId={mine.data.nursery.activeYear.yearId}
      isAdmin={mine.data.role === "admin"}
    />
  );
}

function StudentsView({
  nurseryId,
  yearId,
  isAdmin,
}: {
  nurseryId: Id<"nurseries">;
  yearId: string;
  isAdmin: boolean;
}) {
  const { t, locale } = useT();
  const router = useRouter();
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const studentsQ = useCachedQuery(api.students.list, {
    nurseryId,
    status: tab,
  });
  const classroomsQ = useCachedQuery(api.classrooms.list, { nurseryId });
  const students = studentsQ.data;
  const classrooms = classroomsQ.data;

  // Per-classroom rosters (active year) → studentId → classroom name.
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

  const classroomByStudent = useMemo(() => {
    const map = new Map<string, string>();
    for (const classroom of classrooms ?? []) {
      const roster = rosters[classroom._id];
      if (Array.isArray(roster)) {
        for (const student of roster as Doc<"students">[]) {
          map.set(student._id, classroom.name);
        }
      }
    }
    return map;
  }, [classrooms, rosters]);

  // Avoid flashing "no classroom" while the per-classroom rosters load.
  const rostersLoading =
    classrooms === undefined ||
    Object.values(rosters).some((roster) => roster === undefined);

  const filtered = useMemo(() => {
    if (students === undefined) return undefined;
    const term = search.trim().toLowerCase();
    if (term === "") return students;
    return students.filter(
      (student) =>
        student.nameAr.includes(term) ||
        (student.nameEn ?? "").toLowerCase().includes(term) ||
        student.guardians.some((g) => g.phone.includes(term)),
    );
  }, [students, search]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl">{t("students.title")}</h1>
            <DataAge
              isStale={studentsQ.isStale}
              updatedAt={studentsQ.updatedAt}
            />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {students === undefined
              ? t("common.loading")
              : formatCount(students.length, "students.count", t, locale)}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus data-icon="inline-start" />
            {t("students.new")}
          </Button>
        )}
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("students.searchPlaceholder")}
            className="ps-9"
          />
        </div>
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as "active" | "archived")}
        >
          <TabsList>
            <TabsTrigger value="active">{t("students.tabs.active")}</TabsTrigger>
            <TabsTrigger value="archived">
              {t("students.tabs.archived")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filtered === undefined ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-6 text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersRound />
            </EmptyMedia>
            <EmptyTitle>
              {search.trim() !== ""
                ? t("students.empty.noResults")
                : tab === "archived"
                  ? t("students.empty.archivedTitle")
                  : t("students.empty.title")}
            </EmptyTitle>
            {search.trim() === "" && (
              <EmptyDescription>
                {tab === "archived"
                  ? t("students.empty.archivedDesc")
                  : t("students.empty.desc")}
              </EmptyDescription>
            )}
          </EmptyHeader>
          {isAdmin && tab === "active" && search.trim() === "" && (
            <EmptyContent>
              <Button onClick={() => setFormOpen(true)}>
                <Plus data-icon="inline-start" />
                {t("students.empty.cta")}
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("students.table.name")}</TableHead>
                <TableHead>{t("students.table.classroom")}</TableHead>
                <TableHead>{t("students.table.age")}</TableHead>
                <TableHead className="hidden sm:table-cell">
                  {t("students.table.guardianPhone")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((student) => (
                <TableRow
                  key={student._id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/students/${student._id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-9">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {student.nameAr.trim().charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{student.nameAr}</p>
                        {student.nameEn && (
                          <p className="truncate text-xs text-muted-foreground">
                            {student.nameEn}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {classroomByStudent.get(student._id) ?? (
                      <span className="text-muted-foreground">
                        {rostersLoading ? "—" : t("students.noClassroom")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{formatAge(student.dob, t, locale)}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {student.guardians[0] ? (
                      <span dir="ltr" className="text-start tabular-nums">
                        {student.guardians[0].phone}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <StudentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        nurseryId={nurseryId}
      />
    </div>
  );
}
