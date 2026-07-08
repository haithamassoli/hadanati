"use client";

import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useAppForm } from "@/lib/form";
import { useT } from "@/lib/i18n";
import { LocaleToggle } from "@/components/locale-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  const { t } = useT();
  const router = useRouter();

  const form = useAppForm({
    defaultValues: { email: "", password: "" },
    validators: {
      onChange: z.object({ email: z.string(), password: z.string() }),
    },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        { email: value.email, password: value.password },
        {
          onSuccess: () => {
            router.push("/dashboard");
          },
          onError: () => {
            toast.error(t("auth.error"));
          },
        },
      );
    },
  });

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-background p-4">
      <LocaleToggle className="absolute top-4 end-4" />
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-2xl bg-primary pb-1 font-heading text-3xl text-primary-foreground">
            ح
          </div>
          <CardTitle className="font-heading text-2xl">
            {t("auth.welcomeTitle")}
          </CardTitle>
          <CardDescription>{t("auth.welcomeSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
            className="flex flex-col gap-4"
          >
            <form.AppField name="email">
              {(field) => (
                <field.TextField
                  id="email"
                  type="email"
                  dir="ltr"
                  className="text-start"
                  autoComplete="email"
                  required
                  label={t("auth.email")}
                />
              )}
            </form.AppField>
            <form.AppField name="password">
              {(field) => (
                <field.TextField
                  id="password"
                  type="password"
                  dir="ltr"
                  autoComplete="current-password"
                  required
                  label={t("auth.password")}
                />
              )}
            </form.AppField>
            <form.AppForm>
              <form.SubmitButton size="lg">
                {t("auth.signIn")}
              </form.SubmitButton>
            </form.AppForm>
          </form>
        </CardContent>
      </Card>
      <p className="mt-6 font-heading text-sm text-muted-foreground">
        {t("app.name")}
      </p>
    </div>
  );
}
