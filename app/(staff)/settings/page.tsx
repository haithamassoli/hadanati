"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useOnline } from "@/lib/offline/use-online";
import { useT } from "@/lib/i18n";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  const [name, setName] = useState(nursery.name);
  const [yearId, setYearId] = useState(nursery.activeYear.yearId);
  const [start, setStart] = useState(nursery.activeYear.start);
  const [end, setEnd] = useState(nursery.activeYear.end);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await update({
        nurseryId: nursery._id,
        name: name.trim(),
        activeYear: { yearId: yearId.trim(), start, end },
      });
      toast.success(t("settings.saved"));
    } catch {
      toast.error(t("settings.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.nurseryName")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.activeYear")}</CardTitle>
          <CardDescription>{t("settings.yearIdHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="yearId">{t("settings.yearId")}</Label>
            <Input
              id="yearId"
              required
              dir="ltr"
              className="text-start"
              value={yearId}
              onChange={(e) => setYearId(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="yearStart">{t("settings.yearStart")}</Label>
              <Input
                id="yearStart"
                type="date"
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="yearEnd">{t("settings.yearEnd")}</Label>
              <Input
                id="yearEnd"
                type="date"
                required
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings are online-only — no outbox (§8 scope). */}
      {!online && (
        <p className="text-xs text-muted-foreground">
          {t("offline.requiresConnection")}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        className="self-start"
        disabled={saving || !online}
      >
        {saving && <Spinner data-icon="inline-start" />}
        {saving ? t("common.saving") : t("common.save")}
      </Button>
    </form>
  );
}
