"use client";

import { useState, type FormEvent } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Eye, EyeOff, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useOnline } from "@/lib/offline/use-online";
import { useT } from "@/lib/i18n";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Role = "admin" | "teacher" | "accountant";

const ROLES: Role[] = ["admin", "teacher", "accountant"];

function errorCode(error: unknown): string | null {
  return error instanceof ConvexError && typeof error.data === "string"
    ? error.data
    : null;
}

export default function StaffPage() {
  const { t } = useT();
  const mine = useQuery(api.nurseries.getMine);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4 md:p-8">
      <header>
        <h1 className="text-2xl">{t("staff.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("staff.subtitle")}
        </p>
      </header>

      {mine === undefined ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-6 text-primary" />
        </div>
      ) : mine === null || mine.role !== "admin" ? (
        <Alert>
          <ShieldAlert />
          <AlertTitle>{t("staff.adminOnly")}</AlertTitle>
          <AlertDescription>{t("staff.adminOnlyDesc")}</AlertDescription>
        </Alert>
      ) : (
        <StaffView
          nurseryId={mine.nursery._id}
          myMembershipId={mine.membership._id}
        />
      )}
    </div>
  );
}

function StaffView({
  nurseryId,
  myMembershipId,
}: {
  nurseryId: Id<"nurseries">;
  myMembershipId: Id<"memberships">;
}) {
  const { t } = useT();
  const online = useOnline();
  const members = useQuery(api.staff.listMembers, { nurseryId });
  const updateRole = useMutation(api.staff.updateRole);
  const removeMember = useMutation(api.staff.removeMember);
  const [addOpen, setAddOpen] = useState(false);

  async function onChangeRole(membershipId: Id<"memberships">, role: Role) {
    try {
      await updateRole({ nurseryId, membershipId, role });
      toast.success(t("staff.toast.roleChanged"));
    } catch (error) {
      toast.error(
        errorCode(error) === "last_admin"
          ? t("staff.error.lastAdmin")
          : t("staff.error.generic"),
      );
    }
  }

  async function onRemove(membershipId: Id<"memberships">) {
    try {
      await removeMember({ nurseryId, membershipId });
      toast.success(t("staff.toast.removed"));
    } catch (error) {
      toast.error(
        errorCode(error) === "last_admin"
          ? t("staff.error.lastAdmin")
          : t("staff.error.generic"),
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-3">
        {/* Staff management is online-only — no outbox (§8 scope). */}
        {!online && (
          <p className="text-xs text-muted-foreground">
            {t("offline.requiresConnection")}
          </p>
        )}
        <Button disabled={!online} onClick={() => setAddOpen(true)}>
          <Plus data-icon="inline-start" />
          {t("staff.add")}
        </Button>
      </div>

      {members === undefined ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-6 text-primary" />
        </div>
      ) : members.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("staff.empty")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("staff.table.name")}</TableHead>
                <TableHead className="hidden sm:table-cell">
                  {t("staff.table.email")}
                </TableHead>
                <TableHead>{t("staff.table.role")}</TableHead>
                <TableHead className="sr-only">
                  {t("staff.table.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.membershipId}>
                  <TableCell>
                    <p className="font-medium">{member.name}</p>
                    <p
                      dir="ltr"
                      className="text-xs text-muted-foreground sm:hidden"
                    >
                      {member.email}
                    </p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span dir="ltr">{member.email}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          member.role === "admin" ? "default" : "secondary"
                        }
                      >
                        {t(`staff.role.${member.role}`)}
                      </Badge>
                      <Select
                        value={member.role}
                        disabled={!online}
                        onValueChange={(role) =>
                          onChangeRole(member.membershipId, role as Role)
                        }
                      >
                        <SelectTrigger
                          size="sm"
                          aria-label={t("staff.changeRole")}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {t(`staff.role.${role}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                  <TableCell className="text-end">
                    {member.membershipId !== myMembershipId && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("staff.remove")}
                            className="text-destructive hover:text-destructive"
                            disabled={!online}
                          >
                            <Trash2 />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t("staff.removeTitle")}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("staff.removeDesc")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              {t("staff.cancel")}
                            </AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              onClick={() => onRemove(member.membershipId)}
                            >
                              {t("staff.removeConfirm")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AddStaffDialog
        key={String(addOpen)}
        open={addOpen}
        onOpenChange={setAddOpen}
        nurseryId={nurseryId}
      />
    </div>
  );
}

function AddStaffDialog({
  open,
  onOpenChange,
  nurseryId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nurseryId: Id<"nurseries">;
}) {
  const { t } = useT();
  const createStaff = useAction(api.staff.createStaff);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<Role>("teacher");
  const [creating, setCreating] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      toast.error(t("staff.form.validation.password"));
      return;
    }
    setCreating(true);
    try {
      await createStaff({
        nurseryId,
        name: name.trim(),
        email: email.trim(),
        password,
        role,
      });
      toast.success(t("staff.toast.created"));
      onOpenChange(false);
    } catch (error) {
      toast.error(
        errorCode(error) === "email_exists"
          ? t("staff.error.emailExists")
          : t("staff.error.generic"),
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("staff.form.title")}</DialogTitle>
          <DialogDescription>{t("staff.form.desc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="staff-name">{t("staff.form.name")}</Label>
            <Input
              id="staff-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="staff-email">{t("staff.form.email")}</Label>
            <Input
              id="staff-email"
              type="email"
              required
              dir="ltr"
              className="text-start"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="staff-password">{t("staff.form.password")}</Label>
            <div className="relative">
              <Input
                id="staff-password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                dir="ltr"
                className="pe-10 text-start"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute end-1 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-label={
                  showPassword
                    ? t("staff.form.hidePassword")
                    : t("staff.form.showPassword")
                }
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("staff.form.passwordHint")}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t("staff.form.role")}</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as Role)}
            >
              <SelectTrigger className="w-full" aria-label={t("staff.form.role")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`staff.role.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("staff.form.cancel")}
            </Button>
            <Button type="submit" disabled={creating}>
              {creating && <Spinner data-icon="inline-start" />}
              {creating ? t("staff.form.creating") : t("staff.form.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
