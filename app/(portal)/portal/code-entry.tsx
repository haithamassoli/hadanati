"use client";

// Access-code entry — the parent's first impression. Big friendly input,
// auto-formats XXXX-XXXX-XXXX, paste-tolerant. The verified code is stored
// locally (lib/portal/codes); the code itself is the credential (FR-AUTH-2).

import { useState } from "react";
import { z } from "zod";
import { useMutation } from "convex/react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useAppForm } from "@/lib/form";
import { useT } from "@/lib/i18n";
import { addCode } from "@/lib/portal/codes";
import { formatCodeInput, isCompleteCode } from "@/lib/portal/format";
import { useOnline } from "@/lib/offline/use-online";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export function CodeEntryForm({ onAdded }: { onAdded?: () => void }) {
  const { t } = useT();
  const online = useOnline();
  const verify = useMutation(api.portal.verify);
  // Server response feedback (rate-limited / invalid / offline) — not field
  // validation, so it stays outside the form.
  const [error, setError] = useState<string | null>(null);

  const form = useAppForm({
    defaultValues: { code: "" },
    validators: { onChange: z.object({ code: z.string() }) },
    onSubmit: async ({ value }) => {
      if (!isCompleteCode(value.code)) return;
      if (!online) {
        setError(t("portal.entry.offline"));
        return;
      }
      setError(null);
      try {
        const result = await verify({ code: value.code });
        if (result.ok) {
          addCode({
            code: value.code,
            studentName: result.student.nameAr,
            nurseryName: result.nurseryName,
          });
          toast.success(
            t("portal.entry.added").replace("{name}", result.student.nameAr),
          );
          form.reset();
          onAdded?.();
        } else {
          setError(
            result.reason === "rate_limited"
              ? t("portal.entry.rateLimited")
              : t("portal.entry.invalid"),
          );
        }
      } catch {
        setError(t("portal.entry.error"));
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
      <div className="flex flex-col gap-2">
        <Label htmlFor="portal-code">{t("portal.entry.codeLabel")}</Label>
        <form.AppField name="code">
          {(field) => (
            <Input
              id="portal-code"
              dir="ltr"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="XXXX-XXXX-XXXX"
              className="h-14 text-center font-mono text-xl tracking-[0.2em] placeholder:tracking-normal"
              value={field.state.value}
              onChange={(e) => {
                field.handleChange(formatCodeInput(e.target.value));
                setError(null);
              }}
            />
          )}
        </form.AppField>
        {error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <form.Subscribe
        selector={(s) => ({
          complete: isCompleteCode(s.values.code),
          submitting: s.isSubmitting,
        })}
      >
        {({ complete, submitting }) => (
          <Button
            type="submit"
            size="lg"
            className="h-12 text-base"
            disabled={!complete || submitting}
          >
            {submitting && <Spinner data-icon="inline-start" />}
            {t("portal.entry.submit")}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

/** Full-screen centered welcome card shown when no code is stored yet. */
export function CodeEntryScreen() {
  const { t } = useT();
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <KeyRound className="size-7" />
          </div>
          <CardTitle className="font-heading text-2xl">
            {t("portal.entry.title")}
          </CardTitle>
          <CardDescription className="text-base">
            {t("portal.entry.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CodeEntryForm />
        </CardContent>
      </Card>
      <div className="mt-6 max-w-sm text-center">
        <p className="text-sm font-medium">{t("portal.entry.whatIsCode")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("portal.entry.whatIsCodeDesc")}
        </p>
      </div>
    </div>
  );
}
