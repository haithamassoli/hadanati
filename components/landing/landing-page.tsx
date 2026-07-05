"use client";

// Public marketing page for Hadanati ("/"). Arabic-first, RTL, concierge model —
// every primary action is the WhatsApp CTA (no self-serve signup). Sections reuse
// the real product components (StatusChip, ProgressChart, WeekRibbon) so the page
// is a truthful preview, not a mockup. The animation budget is spent on the hero
// (AttendanceGridDemo); everything else is calm scroll-reveal.

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "motion/react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock,
  Coins,
  Inbox,
  Languages,
  Layers,
  Printer,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { LocaleToggle } from "@/components/locale-toggle";
import { StatusChip, type ChipStatus } from "@/components/status-chip";
import { WeekRibbon } from "@/components/week-ribbon";
import { ProgressChart, type ProgressPoint } from "@/components/progress-chart";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AttendanceGridDemo } from "./attendance-grid-demo";
import { QuartetLegend, QUARTET } from "./quartet-legend";
import { WhatsappCta } from "./whatsapp-cta";
import { CountUp, Item, Reveal } from "./motion";

const PROGRESS_SAMPLE: ProgressPoint[] = [
  { week: 1, academic: 3, social: 2, motor: 3, behavioral: 4 },
  { week: 2, academic: 3, social: 3, motor: 3, behavioral: 4 },
  { week: 3, academic: 4, social: 3, motor: 4, behavioral: 4 },
  { week: 4, academic: 4, social: 4, motor: 4, behavioral: 5 },
  { week: 5, academic: 5, social: 4, motor: 5, behavioral: 5 },
  { week: 6, academic: 5, social: 5, motor: 5, behavioral: 5 },
];

// Formatters are costly to construct — build once per locale, not per render/item.
const NF: Record<string, Intl.NumberFormat> = {
  ar: new Intl.NumberFormat("ar-JO"),
  en: new Intl.NumberFormat("en-US"),
};
// Small ordinals (step numbers): Eastern-Arabic digits in ar, Western in en.
const ORD: Record<string, Intl.NumberFormat> = {
  ar: new Intl.NumberFormat("ar-EG"),
  en: new Intl.NumberFormat("en-US"),
};
// JOD carries three decimals (fils) — match the finance pillar's own promise.
const DINAR: Record<string, Intl.NumberFormat> = {
  ar: new Intl.NumberFormat("ar-JO", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }),
  en: new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }),
};
const num = (locale: string, n: number) => (NF[locale] ?? NF.en).format(n);
const dinar = (locale: string, n: number) =>
  `${(DINAR[locale] ?? DINAR.en).format(n)} د.أ`;

// ── small shared presentation helpers ──────────────────────────────────────

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-heading text-sm font-semibold tracking-wide text-primary">
      {children}
    </p>
  );
}

function SectionHead({
  eyebrow,
  title,
  subtitle,
  center,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  center?: boolean;
}) {
  return (
    <div className={cn("max-w-2xl", center && "mx-auto text-center")}>
      <Item>
        <Eyebrow>{eyebrow}</Eyebrow>
      </Item>
      <Item>
        <h2 className="mt-2 font-heading text-3xl leading-tight font-semibold text-balance md:text-4xl">
          {title}
        </h2>
      </Item>
      {subtitle && (
        <Item>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground text-pretty">
            {subtitle}
          </p>
        </Item>
      )}
    </div>
  );
}

const SECTION = "px-4 py-16 md:px-6 md:py-24";
const WRAP = "mx-auto w-full max-w-6xl";

// Predictable card surface — the shipped shadcn Card drives its padding through
// an internal --card-spacing var that collides with custom p-* utilities, so the
// landing uses this plain surface and controls its own padding/radius.
function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl bg-card text-card-foreground ring-1 ring-foreground/10",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ── header ──────────────────────────────────────────────────────────────────

function Header() {
  const { t } = useT();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b bg-background/80 backdrop-blur transition-colors",
        scrolled ? "border-border" : "border-transparent",
      )}
    >
      <div className={cn(WRAP, "flex h-16 items-center justify-between gap-3 px-4 md:px-6")}>
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary pb-0.5 font-heading text-xl text-primary-foreground">
            ح
          </span>
          <span className="font-heading text-lg">{t("app.name")}</span>
        </Link>
        <nav
          aria-label={t("landing.nav.primary")}
          className="flex items-center gap-0.5 sm:gap-2"
        >
          <Link
            href="/login"
            className="hidden min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            {t("landing.nav.login")}
          </Link>
          <Link
            href="/portal"
            className="hidden min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            {t("landing.nav.portal")}
          </Link>
          <LocaleToggle className="h-11 px-2.5" />
          {/* ponytail: no Sheet menu — login/portal live in the hero + footer on
              mobile; the header keeps a compact WhatsApp CTA at every size. */}
          <WhatsappCta
            size="default"
            label={t("landing.footer.whatsapp")}
            prefill={t("landing.wa.prefill")}
          />
        </nav>
      </div>
    </header>
  );
}

// ── 1 · hero ─────────────────────────────────────────────────────────────────

function Hero() {
  const { t } = useT();
  const reduce = useReducedMotion() ?? false;
  return (
    <section className={cn(SECTION, "pt-10 md:pt-16")}>
      <div className={cn(WRAP, "grid items-center gap-10 md:grid-cols-2 md:gap-12")}>
        <Reveal>
          <Item>
            <Badge className="gap-1.5 rounded-full bg-accent px-3 py-1 text-accent-foreground">
              <span aria-hidden className="flex gap-1">
                {QUARTET.map((s) => (
                  <span key={s} className={cn("size-1.5 rounded-full", `bg-${s}`)} />
                ))}
              </span>
              {t("landing.hero.eyebrow")}
            </Badge>
          </Item>
          <Item>
            <h1 className="mt-4 font-heading text-4xl leading-[1.12] font-bold text-balance md:text-5xl lg:text-6xl">
              {t("landing.hero.title")}
            </h1>
          </Item>
          <Item>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground text-pretty md:text-lg">
              {t("landing.hero.subtitle")}
            </p>
          </Item>
          <Item>
            <QuartetLegend className="mt-6" />
          </Item>
          <Item>
            <div className="mt-7 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <WhatsappCta
                  label={t("landing.hero.ctaPrimary")}
                  prefill={t("landing.wa.prefill")}
                />
                <div className="flex items-center gap-2 text-sm">
                  <Link
                    href="/login"
                    className="inline-flex min-h-11 items-center font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {t("landing.nav.login")}
                  </Link>
                  <span className="text-border">·</span>
                  <Link
                    href="/portal"
                    className="inline-flex min-h-11 items-center font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {t("landing.nav.portal")}
                  </Link>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{t("landing.hero.ctaNote")}</p>
            </div>
          </Item>
        </Reveal>

        <div className="relative flex flex-col items-center">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-70"
            style={{
              background:
                "radial-gradient(60% 55% at 50% 38%, var(--accent) 0%, transparent 70%)",
            }}
          />
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.96 }}
            whileInView={reduce ? undefined : { opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ type: "spring", stiffness: 120, damping: 22 }}
            className="w-full max-w-md"
          >
            <AttendanceGridDemo />
          </motion.div>
          <p className="mt-5 max-w-sm text-center text-sm text-muted-foreground text-pretty">
            {t("landing.demo.caption")}
          </p>
        </div>
      </div>
    </section>
  );
}

// ── 2 · shared language (the quartet) ───────────────────────────────────────

const QUARTET_MEANING: Record<(typeof QUARTET)[number], string> = {
  present: "landing.quartet.presentMeaning",
  absent: "landing.quartet.absentMeaning",
  late: "landing.quartet.lateMeaning",
  excused: "landing.quartet.excusedMeaning",
};

function SharedLanguage() {
  const { t, locale } = useT();
  return (
    <section className={cn(SECTION, "bg-secondary/40")}>
      <div className={WRAP}>
        <Reveal>
          <SectionHead
            center
            eyebrow={t("landing.quartet.eyebrow")}
            title={t("landing.quartet.title")}
            subtitle={t("landing.quartet.subtitle")}
          />

          {/* The same status, two surfaces: the teacher's one tap becomes the
              family's reassurance at home. */}
          <div className="mx-auto mt-10 grid max-w-2xl items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <Item>
              <Panel className="gap-2 p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("landing.quartet.teacherLabel")}
                </p>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">سارة</span>
                  <StatusChip status="present" size="sm" />
                </div>
              </Panel>
            </Item>
            <Item className="flex justify-center">
              <ArrowLeft
                aria-hidden
                className={cn(
                  "size-5 shrink-0 -rotate-90 text-primary",
                  locale === "en" ? "sm:rotate-180" : "sm:rotate-0",
                )}
              />
            </Item>
            <Item>
              <Panel className="gap-2 p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("landing.quartet.parentLabel")}
                </p>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-sm">
                    <Clock className="size-3.5 text-muted-foreground" />
                    وقت الوصول ٧:٣٨ ص
                  </span>
                  <StatusChip status="present" size="sm" />
                </div>
              </Panel>
            </Item>
          </div>

          <div className="mx-auto mt-6 grid max-w-3xl gap-3 sm:grid-cols-2">
            {QUARTET.map((status) => (
              <Item key={status}>
                <Panel className="p-4">
                  <div className="flex items-center gap-3">
                    <StatusChip status={status} size="md" />
                    <p className="text-sm text-muted-foreground text-pretty">
                      {t(QUARTET_MEANING[status])}
                    </p>
                  </div>
                </Panel>
              </Item>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ── 3 · why switch (from → to) ──────────────────────────────────────────────

function WhySwitch() {
  const { t, locale } = useT();
  const rows = [
    { from: "landing.switch.from1", to: "landing.switch.to1" },
    { from: "landing.switch.from2", to: "landing.switch.to2" },
    { from: "landing.switch.from3", to: "landing.switch.to3" },
  ];
  return (
    <section className={SECTION}>
      <div className={WRAP}>
        <Reveal>
          <SectionHead eyebrow={t("landing.switch.eyebrow")} title={t("landing.switch.title")} />
          <div className="mt-10 flex flex-col gap-3">
            {rows.map((row) => (
              <Item key={row.from}>
                <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:gap-5">
                  <span className="flex-1 text-muted-foreground line-through decoration-muted-foreground/40">
                    {t(row.from)}
                  </span>
                  <ArrowLeft
                    className={cn(
                      "hidden size-4 shrink-0 text-primary sm:block",
                      locale === "en" && "rotate-180",
                    )}
                  />
                  <span className="flex flex-1 items-center gap-2 font-medium">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-present-soft text-present">
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                    {t(row.to)}
                  </span>
                </div>
              </Item>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ── 4 · offline mechanism + proof stats ─────────────────────────────────────

function OfflineMechanism() {
  const { t } = useT();
  const steps = [
    { icon: Inbox, title: "landing.offline.step1Title", body: "landing.offline.step1Body" },
    { icon: Layers, title: "landing.offline.step2Title", body: "landing.offline.step2Body" },
    { icon: RefreshCw, title: "landing.offline.step3Title", body: "landing.offline.step3Body" },
  ];
  const stats = [
    { value: "landing.offline.stat1Value", label: "landing.offline.stat1Label" },
    { value: "landing.offline.stat2Value", label: "landing.offline.stat2Label" },
    { value: "landing.offline.stat3Value", label: "landing.offline.stat3Label" },
  ];
  return (
    <section className={cn(SECTION, "bg-secondary/30")}>
      <div className={WRAP}>
        <Reveal>
          <SectionHead
            eyebrow={t("landing.offline.eyebrow")}
            title={t("landing.offline.title")}
            subtitle={t("landing.offline.subtitle")}
          />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, body }) => (
              <Item key={title}>
                <Panel className="h-full gap-3 p-5 ring-1 ring-foreground/10">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="font-heading text-lg">{t(title)}</h3>
                  <p className="text-sm text-muted-foreground text-pretty">{t(body)}</p>
                </Panel>
              </Item>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {stats.map(({ value, label }) => (
              <Item key={value}>
                <div className="rounded-2xl border border-dashed border-border p-5 text-center">
                  <p className="font-heading text-2xl font-semibold text-primary text-balance">
                    {t(value)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground text-pretty">{t(label)}</p>
                </div>
              </Item>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ── 5 · daily loop (attendance + evaluations) ───────────────────────────────

function CyclingChip() {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "0px" });
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce || !inView) return;
    const id = setInterval(() => setI((v) => (v + 1) % QUARTET.length), 1400);
    return () => clearInterval(id);
  }, [reduce, inView]);
  if (reduce) {
    return (
      <div ref={ref} className="grid grid-cols-2 gap-2">
        {QUARTET.map((s) => (
          <StatusChip key={s} status={s} size="sm" />
        ))}
      </div>
    );
  }
  const status: ChipStatus = QUARTET[i];
  return (
    <div ref={ref}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={status}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{
            scale: 1,
            opacity: 1,
            transition: { type: "spring", stiffness: 380, damping: 30 },
          }}
          exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.15 } }}
        >
          <StatusChip status={status} size="md" />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function DailyLoop() {
  const { t } = useT();
  const roster = ["لمى", "عمر", "سارة"];
  return (
    <section className={SECTION}>
      <div className={WRAP}>
        <Reveal>
          <SectionHead
            eyebrow={t("landing.daily.eyebrow")}
            title={t("landing.daily.title")}
            subtitle={t("landing.daily.subtitle")}
          />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <Item>
              <Panel className="h-full gap-4 p-5 ring-1 ring-foreground/10">
                <div>
                  <h3 className="font-heading text-lg">{t("landing.daily.attTitle")}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t("landing.daily.attCaption")}</p>
                </div>
                <div className="flex flex-col gap-2 rounded-2xl bg-muted/40 p-3">
                  {roster.map((name, idx) => (
                    <div key={name} className="flex items-center justify-between gap-3 rounded-xl bg-card px-3 py-2 ring-1 ring-foreground/5">
                      <span className="text-sm">{name}</span>
                      {idx === 0 ? <CyclingChip /> : <StatusChip status="present" size="sm" />}
                    </div>
                  ))}
                </div>
                <p className="text-sm font-medium text-primary">{t("landing.daily.attNote")}</p>
              </Panel>
            </Item>
            <Item>
              <Panel className="h-full gap-4 p-5 ring-1 ring-foreground/10">
                <div>
                  <h3 className="font-heading text-lg">{t("landing.daily.evalTitle")}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t("landing.daily.evalCaption")}</p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-2">
                  <ProgressChart data={PROGRESS_SAMPLE} height={200} />
                </div>
                <p className="text-sm font-medium text-primary">{t("landing.daily.evalNote")}</p>
              </Panel>
            </Item>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ── 6 · owner view + finance ────────────────────────────────────────────────

function OwnerFinance() {
  const { t, locale } = useT();
  const points = ["landing.finance.point1", "landing.finance.point2", "landing.finance.point3"];
  return (
    <section className={cn(SECTION, "bg-secondary/30")}>
      <div className={WRAP}>
        <Reveal>
          <SectionHead
            eyebrow={t("landing.owner.eyebrow")}
            title={t("landing.owner.title")}
            subtitle={t("landing.owner.subtitle")}
          />
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            <Item className="lg:col-span-1">
              <Panel className="gap-3 p-4 ring-1 ring-foreground/10">
                <KpiTile label={t("landing.owner.kpiPresent")} tone="present">
                  <CountUp to={42} format={(n) => num(locale, Math.round(n))} />
                </KpiTile>
                <KpiTile label={t("landing.owner.kpiCollected")} tone="neutral">
                  <CountUp to={3450} format={(n) => dinar(locale, n)} />
                </KpiTile>
                <KpiTile label={t("landing.owner.kpiOverdue")} tone="absent">
                  <CountUp to={620} format={(n) => dinar(locale, n)} />
                </KpiTile>
              </Panel>
            </Item>
            <Item className="lg:col-span-2">
              <Panel className="h-full gap-4 p-6 ring-1 ring-foreground/10">
                <div>
                  <h3 className="font-heading text-xl">{t("landing.finance.title")}</h3>
                  <p className="mt-2 text-sm text-muted-foreground text-pretty">
                    {t("landing.finance.subtitle")}
                  </p>
                </div>
                <ul className="grid gap-2 sm:grid-cols-3">
                  {[Coins, RefreshCw, Printer].map((Icon, i) => (
                    <li key={points[i]} className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2.5 text-sm">
                      <Icon className="size-4 shrink-0 text-primary" />
                      <span className="text-pretty">{t(points[i])}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </Item>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function KpiTile({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "present" | "absent" | "neutral";
  children: ReactNode;
}) {
  const toneClass =
    tone === "present"
      ? "text-present"
      : tone === "absent"
        ? "text-absent"
        : "text-foreground";
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-xl bg-muted/40 px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("font-heading text-xl font-semibold tabular-nums", toneClass)}>
        {children}
      </span>
    </div>
  );
}

// ── 7 · parent portal ────────────────────────────────────────────────────────

function ParentPortal() {
  const { t, locale } = useT();
  const assurances = ["landing.parent.assure1", "landing.parent.assure2", "landing.parent.assure3"];
  return (
    <section className={SECTION}>
      <div className={cn(WRAP, "grid items-center gap-10 md:grid-cols-2 md:gap-12")}>
        <Reveal>
          <SectionHead
            eyebrow={t("landing.parent.eyebrow")}
            title={t("landing.parent.title")}
            subtitle={t("landing.parent.subtitle")}
          />
          <Item>
            <div className="mt-7 max-w-sm">
              <label className="text-sm font-medium" htmlFor="demo-code">
                {t("landing.parent.codeLabel")}
              </label>
              {/* ponytail: marketing mock — a styled read-only field, not a live
                  verifier; the real entry lives at /portal. */}
              <Input
                id="demo-code"
                dir="ltr"
                readOnly
                aria-hidden
                tabIndex={-1}
                placeholder={t("landing.parent.codePlaceholder")}
                className="mt-2 text-center font-mono tracking-widest"
              />
            </div>
          </Item>
          <Item>
            <div className="mt-4 flex flex-wrap gap-2">
              {assurances.map((key) => (
                <Badge key={key} variant="secondary" className="gap-1.5 rounded-full px-3 py-1">
                  <Check className="size-3 text-present" strokeWidth={3} />
                  {t(key)}
                </Badge>
              ))}
            </div>
          </Item>
          <Item>
            <p className="mt-5 text-sm text-muted-foreground text-pretty">{t("landing.parent.notify")}</p>
          </Item>
        </Reveal>

        <Reveal>
          <Item>
            <Panel className="mx-auto w-full max-w-sm gap-4 p-5 ring-1 ring-foreground/10">
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-present-soft/60 p-3">
                <div>
                  <p className="text-xs text-muted-foreground">{t("attendance.present")}</p>
                  <p className="font-heading text-sm">وقت الوصول ٧:٣٨ ص</p>
                </div>
                <StatusChip status="present" size="sm" />
              </div>
              <div className="rounded-2xl bg-muted/40 p-2">
                <ProgressChart data={PROGRESS_SAMPLE} height={140} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-card px-3 py-2.5 ring-1 ring-foreground/10">
                <span className="text-sm text-muted-foreground">{t("landing.parent.balanceLabel")}</span>
                <span className="font-heading text-base font-semibold tabular-nums">
                  <CountUp to={60} format={(n) => dinar(locale, n)} />
                </span>
              </div>
            </Panel>
          </Item>
        </Reveal>
      </div>
    </section>
  );
}

// ── 8 · built for Jordan ─────────────────────────────────────────────────────

function JordanTrust() {
  const { t } = useT();
  return (
    <section className={cn(SECTION, "bg-secondary/30")}>
      <div className={WRAP}>
        <Reveal>
          <SectionHead eyebrow={t("landing.jordan.eyebrow")} title={t("landing.jordan.title")} />
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* hero card — the real week strip, Sun→Thu with Fri/Sat muted */}
            <Item className="md:col-span-2">
              <Panel className="gap-4 p-6 ring-1 ring-foreground/10">
                <div className="flex items-center gap-2">
                  <CalendarDays className="size-5 text-primary" />
                  <h3 className="font-heading text-lg">{t("landing.jordan.weekTitle")}</h3>
                </div>
                {/* ponytail: reuse the shipped WeekRibbon in display mode (no
                    onSelect) — it already mutes Fri/Sat; skipped a bespoke
                    scroll-fill variant that would fork the component. */}
                <WeekRibbon selectedDate="2026-02-01" />
                <p className="text-sm text-muted-foreground text-pretty">{t("landing.jordan.weekBody")}</p>
              </Panel>
            </Item>
            <TrustCard icon={ShieldCheck} title="landing.jordan.pdplTitle" body="landing.jordan.pdplBody">
              <Switch defaultChecked aria-hidden tabIndex={-1} className="pointer-events-none" />
            </TrustCard>
            <TrustCard icon={Coins} title="landing.jordan.filsTitle" body="landing.jordan.filsBody">
              <span className="font-heading text-sm font-semibold text-primary tabular-nums">٤٥٫٠٠٠ د.أ</span>
            </TrustCard>
            <TrustCard icon={Languages} title="landing.jordan.rtlTitle" body="landing.jordan.rtlBody" />
            <TrustCard icon={Smartphone} title="landing.jordan.pwaTitle" body="landing.jordan.pwaBody" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function TrustCard({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: typeof Coins;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  const { t } = useT();
  return (
    <Item>
      <Panel className="h-full gap-3 p-5 ring-1 ring-foreground/10">
        <div className="flex items-center justify-between gap-2">
          <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" />
          </span>
          {children}
        </div>
        <h3 className="font-heading text-base">{t(title)}</h3>
        <p className="text-sm text-muted-foreground text-pretty">{t(body)}</p>
      </Panel>
    </Item>
  );
}

// ── 9 · onboarding + final CTA + footer ──────────────────────────────────────

function OnboardingFinalFooter() {
  const { t, locale } = useT();
  const steps = [
    { title: "landing.steps.step1Title", body: "landing.steps.step1Body" },
    { title: "landing.steps.step2Title", body: "landing.steps.step2Body" },
    { title: "landing.steps.step3Title", body: "landing.steps.step3Body" },
  ];
  return (
    <>
      {/* onboarding — the only numbered sequence on the page (order is real) */}
      <section className={cn(SECTION, "bg-accent/40")}>
        <div className={WRAP}>
          <Reveal>
            <SectionHead
              center
              eyebrow={t("landing.steps.eyebrow")}
              title={t("landing.steps.title")}
              subtitle={t("landing.steps.subtitle")}
            />
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {steps.map((step, i) => (
                <Item key={step.title}>
                  <li className="flex h-full flex-col gap-3 rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
                    <span className="grid size-9 place-items-center rounded-full bg-primary font-heading text-base text-primary-foreground tabular-nums">
                      {(ORD[locale] ?? ORD.en).format(i + 1)}
                    </span>
                    <h3 className="font-heading text-lg">{t(step.title)}</h3>
                    <p className="text-sm text-muted-foreground text-pretty">{t(step.body)}</p>
                  </li>
                </Item>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      {/* final CTA — subtle date-palm wash for a confident close */}
      <section className={cn(SECTION, "bg-primary/5")}>
        <div className={cn(WRAP, "flex flex-col items-center text-center")}>
          <Reveal className="flex flex-col items-center">
            <Item>
              <h2 className="max-w-2xl font-heading text-3xl leading-tight font-semibold text-balance md:text-4xl">
                {t("landing.final.title")}
              </h2>
            </Item>
            <Item>
              <p className="mt-3 max-w-xl text-base text-muted-foreground text-pretty">
                {t("landing.final.subtitle")}
              </p>
            </Item>
            <Item>
              <div className="mt-8">
                <WhatsappCta label={t("landing.final.cta")} prefill={t("landing.wa.prefill")} />
              </div>
            </Item>
            <Item>
              <p className="mt-4 text-sm text-muted-foreground">{t("landing.final.note")}</p>
            </Item>
          </Reveal>
        </div>
      </section>

      <Footer />
    </>
  );
}

function Footer() {
  const { t } = useT();
  return (
    <footer className="border-t bg-background">
      <div className={cn(WRAP, "px-4 py-12 md:px-6")}>
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary pb-0.5 font-heading text-xl text-primary-foreground">
                ح
              </span>
              <span className="font-heading text-lg">{t("app.name")}</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground text-pretty">{t("landing.footer.tagline")}</p>
            <QuartetLegend className="mt-4" />
          </div>
          <nav
            aria-label={t("landing.nav.footer")}
            className="flex flex-col gap-1 text-sm"
          >
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("landing.footer.staff")}
            </Link>
            <Link
              href="/portal"
              className="inline-flex min-h-11 items-center text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("landing.footer.parents")}
            </Link>
            <div className="pt-1">
              <WhatsappCta
                size="default"
                label={t("landing.footer.whatsapp")}
                prefill={t("landing.wa.prefill")}
              />
            </div>
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-1.5 border-t pt-6 text-xs text-muted-foreground">
          <p>{t("landing.footer.pdpl")}</p>
          <p>{t("landing.footer.week")}</p>
          <p className="tabular-nums">{t("landing.footer.rights")}</p>
        </div>
      </div>
    </footer>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Header />
      <main className="flex-1">
        <Hero />
        <SharedLanguage />
        <WhySwitch />
        <OfflineMechanism />
        <DailyLoop />
        <OwnerFinance />
        <ParentPortal />
        <JordanTrust />
        <OnboardingFinalFooter />
      </main>
    </div>
  );
}
