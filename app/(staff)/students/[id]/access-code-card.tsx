"use client";

// Admin-only "رمز ولي الأمر" card on the student detail page (FR-AUTH-2).
// The raw code is shown exactly ONCE in the dialog after generation —
// afterwards only active/inactive metadata exists (hashes never leave the
// server). Regenerating invalidates every previous code.

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Copy, KeyRound, MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useOnline } from "@/lib/offline/use-online";
import { useT } from "@/lib/i18n";
import { formatCodeInput, formatRelativeTime } from "@/lib/portal/format";
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
import { Spinner } from "@/components/ui/spinner";

/** "0791234567" → "962791234567" for wa.me deep links. */
function waPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return `962${digits.slice(1)}`;
  return digits;
}

export function AccessCodeCard({
  nurseryId,
  studentId,
  studentName,
  guardianPhone,
}: {
  nurseryId: Id<"nurseries">;
  studentId: Id<"students">;
  studentName: string;
  guardianPhone?: string;
}) {
  const { t, locale } = useT();
  const online = useOnline();
  const codes = useQuery(api.accessCodes.listForStudent, {
    nurseryId,
    studentId,
  });
  const generate = useMutation(api.accessCodes.generate);
  const revoke = useMutation(api.accessCodes.revoke);

  const [generating, setGenerating] = useState(false);
  const [rawCode, setRawCode] = useState<string | null>(null);

  const activeCode = codes?.find((c) => c.active) ?? null;

  async function onGenerate() {
    setGenerating(true);
    try {
      const { code } = await generate({ nurseryId, studentId });
      setRawCode(formatCodeInput(code));
    } catch {
      toast.error(t("portal.staffCode.error"));
    } finally {
      setGenerating(false);
    }
  }

  async function onRevoke() {
    if (activeCode === null) return;
    try {
      await revoke({ nurseryId, accessCodeId: activeCode._id });
      toast.success(t("portal.staffCode.revoked"));
    } catch {
      toast.error(t("portal.staffCode.error"));
    }
  }

  async function onCopy() {
    if (rawCode === null) return;
    try {
      await navigator.clipboard.writeText(rawCode);
      toast.success(t("portal.staffCode.copied"));
    } catch {
      toast.error(t("portal.staffCode.error"));
    }
  }

  const whatsappHref =
    rawCode !== null && guardianPhone !== undefined
      ? `https://wa.me/${waPhone(guardianPhone)}?text=${encodeURIComponent(
          t("portal.staffCode.whatsappText")
            .replace("{name}", studentName)
            .replace("{code}", rawCode)
            .replace(
              "{url}",
              `${typeof window !== "undefined" ? window.location.origin : ""}/portal`,
            ),
        )}`
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4 text-primary" />
          {t("portal.staffCode.title")}
        </CardTitle>
        <CardDescription>{t("portal.staffCode.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {activeCode !== null ? (
            <Badge variant="secondary" className="bg-present-soft text-present-foreground">
              {t("portal.staffCode.activeSince").replace(
                "{time}",
                formatRelativeTime(activeCode._creationTime, locale),
              )}
            </Badge>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("portal.staffCode.none")}
            </p>
          )}

          <div className="flex items-center gap-2">
            {activeCode !== null && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={!online}
                  >
                    {t("portal.staffCode.revoke")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t("portal.staffCode.revokeTitle")}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("portal.staffCode.revokeDesc")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>
                      {t("students.detail.cancel")}
                    </AlertDialogCancel>
                    <AlertDialogAction onClick={onRevoke}>
                      {t("students.detail.confirm")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button
              size="sm"
              disabled={generating || !online}
              onClick={onGenerate}
            >
              {generating ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}
              {activeCode !== null
                ? t("portal.staffCode.regenerate")
                : t("portal.staffCode.generate")}
            </Button>
          </div>
        </div>
        {activeCode !== null && (
          <p className="text-xs text-muted-foreground">
            {t("portal.staffCode.regenerateHint")}
          </p>
        )}
        {/* Code management is online-only — no outbox (§8 scope). */}
        {!online && (
          <p className="text-xs text-muted-foreground">
            {t("offline.requiresConnection")}
          </p>
        )}
      </CardContent>

      {/* One-time raw code dialog */}
      <Dialog
        open={rawCode !== null}
        onOpenChange={(open) => {
          if (!open) setRawCode(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("portal.staffCode.dialogTitle")}</DialogTitle>
            <DialogDescription className="text-destructive">
              {t("portal.staffCode.copyWarning")}
            </DialogDescription>
          </DialogHeader>
          <div
            dir="ltr"
            className="select-all rounded-xl border bg-muted/40 p-4 text-center font-mono text-2xl tracking-[0.15em]"
            data-testid="raw-access-code"
          >
            {rawCode}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onCopy}>
              <Copy data-icon="inline-start" />
              {t("portal.staffCode.copy")}
            </Button>
            {whatsappHref !== null && (
              <Button asChild variant="outline">
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                  <MessageCircle data-icon="inline-start" />
                  {t("portal.staffCode.whatsapp")}
                </a>
              </Button>
            )}
            <Button onClick={() => setRawCode(null)}>
              {t("portal.staffCode.done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
