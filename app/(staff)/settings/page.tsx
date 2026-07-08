"use client";

import { useMutation, useQuery } from "convex/react";
import { z } from "zod";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useOnline } from "@/lib/offline/use-online";
import { useAppForm } from "@/lib/form";
import { useT } from "@/lib/i18n";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export default function SettingsPage() {
  const { t } = useT();
  const mine = useQuery(api.nurseries.getMine);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 md:p-8">
      <header>
        <h1 className="text-2xl">{t("settings.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settings.subtitle")}
        </p>
      </header>

      {mine === undefined ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-6 text-primary" />
        </div>
      ) : mine === null || mine.role !== "admin" ? (
        <Alert>
          <ShieldAlert />
          <AlertTitle>{t("settings.adminOnly")}</AlertTitle>
          <AlertDescription>{t("settings.adminOnlyDesc")}</AlertDescription>
        </Alert>
      ) : (
        <SettingsForm key={mine.nursery._id} nursery={mine.nursery} />
      )}
    </div>
  );
}

function SettingsForm({ nursery }: { nursery: Doc<"nurseries"> }) {
  const { t } = useT();
  const online = useOnline();
  const update = useMutation(api.nurseries.update);

  const form = useAppForm({
    defaultValues: {
      name: nursery.name,
      yearId: nursery.activeYear.yearId,
      start: nursery.activeYear.start,
      end: nursery.activeYear.end,
    },
    validators: {
      onChange: z.object({
        name: z.string(),
        yearId: z.string(),
        start: z.string(),
        end: z.string(),
      }),
    },
    onSubmit: async ({ value }) => {
      try {
        await update({
          nurseryId: nursery._id,
          name: value.name.trim(),
          activeYear: {
            yearId: value.yearId.trim(),
            start: value.start,
            end: value.end,
          },
        });
        toast.success(t("settings.saved"));
      } catch {
        toast.error(t("settings.saveError"));
      }
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      className="flex flex-col gap-6"
    >
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.nurseryName")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form.AppField name="name">
            {(field) => <field.TextField required />}
          </form.AppField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.activeYear")}</CardTitle>
          <CardDescription>{t("settings.yearIdHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form.AppField name="yearId">
            {(field) => (
              <field.TextField
                id="yearId"
                required
                dir="ltr"
                className="text-start"
                label={t("settings.yearId")}
              />
            )}
          </form.AppField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <form.AppField name="start">
              {(field) => (
                <field.TextField
                  id="yearStart"
                  type="date"
                  required
                  label={t("settings.yearStart")}
                />
              )}
            </form.AppField>
            <form.AppField name="end">
              {(field) => (
                <field.TextField
                  id="yearEnd"
                  type="date"
                  required
                  label={t("settings.yearEnd")}
                />
              )}
            </form.AppField>
          </div>
        </CardContent>
      </Card>

      {/* Settings are online-only — no outbox (§8 scope). */}
      {!online && (
        <p className="text-xs text-muted-foreground">
          {t("offline.requiresConnection")}
        </p>
      )}
      <form.AppForm>
        <form.SubmitButton size="lg" className="self-start" disabled={!online}>
          {t("common.save")}
        </form.SubmitButton>
      </form.AppForm>
    </form>
  );
}
