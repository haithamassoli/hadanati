"use client";

// Portal settings: manage child codes (add / switch / remove), push toggle,
// and the iOS add-to-home-screen walkthrough.

import { useEffect, useState, useSyncExternalStore } from "react";

// UA/standalone never changes within a page lifetime — no events to watch.
function subscribeNever() {
  return () => {};
}
import { Check, Plus, Share, SquarePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { formatRelativeTime } from "@/lib/portal/format";
import {
  removeCode,
  setActive,
  useCodes,
} from "@/lib/portal/codes";
import {
  disablePushSubscription,
  ensurePushSubscription,
  getPushSubscription,
  isIosBrowserNotInstalled,
  isPushSupported,
} from "@/lib/portal/push";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CodeEntryForm } from "../code-entry";

export default function PortalSettingsPage() {
  const { t, locale } = useT();
  const { codes, activeIndex, active } = useCodes();
  const [adding, setAdding] = useState(false);
  // useSyncExternalStore keeps the iOS-only branch hydration-safe
  // (server snapshot false, client snapshot re-evaluated after hydration).
  const iosNotInstalled = useSyncExternalStore(
    subscribeNever,
    isIosBrowserNotInstalled,
    () => false,
  );

  if (active === null) return null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-2xl">{t("portal.settings.title")}</h1>

      {/* Children / stored codes */}
      <Card>
        <CardHeader>
          <CardTitle>{t("portal.settings.childrenTitle")}</CardTitle>
          <CardDescription>{t("portal.settings.childrenDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {codes.map((entry, index) => (
            <div
              key={entry.code}
              className="flex items-center gap-3 rounded-xl bg-muted/40 p-3"
            >
              <Avatar className="size-10">
                <AvatarFallback className="bg-primary/10 font-heading text-primary">
                  {entry.studentName.trim().charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {entry.studentName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {entry.nurseryName} ·{" "}
                  {formatRelativeTime(entry.addedAt, locale)}
                </p>
              </div>
              {index === activeIndex ? (
                <Badge>
                  <Check data-icon="inline-start" />
                  {t("portal.settings.activeChild")}
                </Badge>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActive(index)}
                >
                  {t("portal.settings.switchTo")}
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("portal.settings.remove")}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t("portal.settings.removeTitle")}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("portal.settings.removeDesc")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>
                      {t("portal.settings.cancel")}
                    </AlertDialogCancel>
                    <AlertDialogAction onClick={() => removeCode(entry.code)}>
                      {t("portal.settings.confirm")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}

          {adding ? (
            <div className="rounded-xl border p-4">
              <CodeEntryForm onAdded={() => setAdding(false)} />
            </div>
          ) : (
            <Button
              variant="outline"
              className="justify-center"
              onClick={() => setAdding(true)}
            >
              <Plus data-icon="inline-start" />
              {t("portal.settings.addCode")}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>{t("portal.settings.pushTitle")}</CardTitle>
          <CardDescription>{t("portal.settings.pushDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {iosNotInstalled ? (
            <A2hsWalkthrough />
          ) : (
            <PushToggle code={active.code} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PushToggle({ code }: { code: string }) {
  const { t } = useT();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const supported = isPushSupported();

  useEffect(() => {
    if (!supported) return;
    void getPushSubscription().then((subscription) => {
      setEnabled(subscription !== null && Notification.permission === "granted");
    });
  }, [supported]);

  if (!supported) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("portal.push.unsupported")}
      </p>
    );
  }

  async function onToggle(next: boolean) {
    setBusy(true);
    try {
      if (next) {
        const result = await ensurePushSubscription(code);
        if (result === "subscribed") {
          setEnabled(true);
          toast.success(t("portal.push.enabled"));
        } else {
          setEnabled(false);
          toast.error(
            result === "denied"
              ? t("portal.push.denied")
              : t("portal.push.unsupported"),
          );
        }
      } else {
        await disablePushSubscription(code);
        setEnabled(false);
        toast.success(t("portal.push.disabled"));
      }
    } catch {
      toast.error(t("portal.push.unsupported"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor="push-toggle" className="text-sm">
        {t("portal.settings.pushToggle")}
      </Label>
      <Switch
        id="push-toggle"
        dir="ltr"
        checked={enabled}
        disabled={busy}
        onCheckedChange={(checked) => void onToggle(checked)}
      />
    </div>
  );
}

/** iOS Safari (not installed): push needs the app on the Home Screen first. */
function A2hsWalkthrough() {
  const { t } = useT();
  const steps = [
    { icon: Share, text: t("portal.a2hs.step1") },
    { icon: SquarePlus, text: t("portal.a2hs.step2") },
    { icon: Check, text: t("portal.a2hs.step3") },
  ];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">{t("portal.a2hs.title")}</p>
      <p className="text-sm text-muted-foreground">{t("portal.a2hs.desc")}</p>
      <ol className="flex flex-col gap-2.5">
        {steps.map((step, index) => (
          <li key={index} className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <step.icon className="size-4" />
            </span>
            <span className="text-sm leading-snug">{step.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
