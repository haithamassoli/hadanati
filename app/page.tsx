import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  CloudOff,
  CreditCard,
  HeartHandshake,
  LineChart,
  LockKeyhole,
  Megaphone,
  School,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UsersRound,
  WalletCards,
  WifiOff,
} from "lucide-react";
import { LocaleToggle } from "@/components/locale-toggle";
import { thmanyahSans } from "@/fonts";

type LandingLocale = "ar" | "en";

const copy = {
  ar: {
    metadata: {
      title: "حضانتي | إدارة الحضانات في الأردن",
      description:
        "منصة عربية لإدارة الحضور، التقييمات، الرسوم، وبوابة أولياء الأمور للحضانات في الأردن.",
    },
    brand: {
      initial: "ح",
      name: "حضانتي",
      tagline: "نظام الحضانات العربي للأردن",
    },
    nav: {
      features: "المزايا",
      offline: "العمل دون شبكة",
      pilot: "الإعداد",
      parentPortal: "بوابة ولي الأمر",
      staffLogin: "دخول الفريق",
    },
    hero: {
      eyebrow: "حضانة كاملة من واتساب إلى لوحة تشغيل في أقل من ساعة",
      title: "يوم الحضانة واضح للمدير، سهل على المعلمة، ومطمئن لولي الأمر.",
      body: "حضانتي منصة إدارة عربية للحضانات في الأردن: حضور يعمل دون إنترنت، تقييمات نمو أسبوعية، رسوم بالدينار الأردني، وبوابة أولياء أمور بلا إنشاء حساب.",
      primaryCta: "اطلب تجهيز حضانتك",
      secondaryCta: "جرّب مدخل ولي الأمر",
    },
    stats: [
      { value: "80%", label: "هدف تسجيل أيام الحضور" },
      { value: "0", label: "طفرات مفقودة دون شبكة" },
      { value: "JOD", label: "فلس دقيق، بلا كسور خاطئة" },
    ],
    mock: {
      morning: "صباح الأحد · صف البستان",
      dashboard: "لوحة تشغيل اليوم",
      presentCount: "18 حاضرين",
      offlineBadge: "دون شبكة",
      queue: "صف الانتظار",
      queueCount: "30",
      queueBody: "25 حضور + 5 تقييمات محفوظة حتى الرجوع",
      balanceLabel: "رصيد عائلة اليوم",
      balance: "42.500 د.أ",
      parentPortal: "بوابة ولي الأمر",
      parentAlertTitle: "جنى اليوم غائبة",
      parentAlertBody: "وصل تنبيه دون أي بيانات حساسة في الإشعار.",
      axes: ["أكاديمي", "اجتماعي", "حركي", "سلوكي"],
      attendanceRows: [
        { name: "ليان", status: "present", label: "حاضرة", time: "08:04" },
        { name: "آدم", status: "late", label: "متأخر", time: "08:27" },
        { name: "جنى", status: "absent", label: "غياب", time: "تنبيه" },
        { name: "سليم", status: "excused", label: "مأذون", time: "ملاحظة" },
      ],
    },
    painPoints: [
      {
        title: "بدل الورق والدفاتر",
        body: "الحضور، الملاحظات، والتقييمات الأسبوعية تعيش في مكان واحد، لا في صور واتساب متفرقة.",
      },
      {
        title: "بدل سؤال: من دفع؟",
        body: "فواتير، دفعات جزئية، رصيد مستحق، ومصاريف الشهر بالدينار الأردني حتى 3 خانات.",
      },
      {
        title: "بدل ضعف الواي فاي",
        body: "الحضور والتقييمات يعملان دون شبكة، ثم تتم المزامنة بصف انتظار واضح عند الرجوع.",
      },
    ],
    featuresIntro: {
      eyebrow: "كل دور له شاشة واضحة",
      title: "منصة واحدة تخدم المدير، المعلمة، المحاسب، وولي الأمر.",
    },
    features: [
      {
        title: "لوحة المدير",
        body: "نظرة مباشرة على حضور اليوم، الغياب حسب الصف، النقد المحصل، والمتأخرات.",
      },
      {
        title: "تطبيق المعلمة",
        body: "شبكة أسماء على الهاتف: ضغطة واحدة تغير الحالة، وملاحظة قصيرة تكفي للتوثيق.",
      },
      {
        title: "بوابة ولي الأمر",
        body: "دخول بكود الطفل فقط، بلا حساب جديد، مع حضور اليوم، ملخص التطور، والرصيد.",
      },
      {
        title: "التقييمات الأسبوعية",
        body: "أربعة محاور واضحة: أكاديمي، اجتماعي، حركي، وسلوكي مع رسوم تقدم عبر السنة.",
      },
      {
        title: "الإعلانات والتنبيهات",
        body: "إعلان للحضانة كلها أو صف واحد، وصندوق إشعارات داخل التطبيق مع Web Push آمن.",
      },
      {
        title: "خصوصية من البداية",
        body: "موافقة ولي الأمر عند التسجيل، صور اختيارية فقط، وأكواد محفوظة بشكل مشفر.",
      },
    ],
    offline: {
      eyebrow: "وعد حضانتي الأساسي",
      title: "إذا انقطع الإنترنت، لا ينقطع يوم الصف.",
      body: "النسخة الأولى لا تعد بكل شيء دون شبكة. تعد بالشيء الأهم داخل الصف: الحضور والتقييمات. تحفظ محليا، تظهر كحالة معلقة، ثم تعاد بالترتيب عند الرجوع مع منع التكرار.",
      cards: [
        { value: "25", label: "علامة حضور" },
        { value: "5", label: "تقييمات أسبوعية" },
        { value: "FIFO", label: "مزامنة بالترتيب" },
      ],
      flow: ["وضع الطيران", "إغلاق التطبيق", "صفر تكرار"],
      note: "هذا ليس وعدا تسويقيا عاما؛ هو معيار قبول محدد: تشغيل صف من 25 طفل مع 5 تقييمات، ثم إغلاق وفتح التطبيق قبل المزامنة.",
    },
    jordan: {
      eyebrow: "تفاصيل أردنية لا تأتي لاحقا",
      title: "النظام مبني من أول يوم على طريقة عمل الحضانات هنا.",
      rules: [
        "الأسبوع يبدأ الأحد وينتهي الخميس، كما تعمل الحضانات في الأردن.",
        "كل المبالغ تحفظ كفلس، لا كأرقام عشرية قابلة للخطأ.",
        "المدفوعات تسجل كاش، CliQ، تحويل بنكي، أو شيك دون بوابة دفع في النسخة الأولى.",
        "لا تسجيل عام للحضانات؛ الإعداد يتم بمرافقة الفريق خلال أقل من ساعة.",
      ],
    },
    pilot: {
      title: "لا يوجد تسجيل عام. يوجد إعداد مرافق، سريع، ومحكوم.",
      body: "حضانتي منتج SaaS للحضانات، لكن دخول الحضانة الأولى لا يبدأ بنموذج طويل. يبدأ بمكالمة قصيرة، ثم تجهيز الصفوف والطلاب والأكواد خلال جلسة واحدة.",
      staffCta: "دخول فريق لديه حساب",
      parentCta: "دخول ولي الأمر بالكود",
      steps: [
        {
          title: "نأخذ بيانات الحضانة",
          body: "المراحل، الصفوف، المعلمات، الطلاب، وخطط الرسوم تدخل مرة واحدة بطريقة منظمة.",
        },
        {
          title: "نجهز الدخول والصلاحيات",
          body: "المدير، المعلمة، والمحاسب يرون فقط ما يخص دورهم داخل نفس الحضانة.",
        },
        {
          title: "نجرب يوم تشغيل حقيقي",
          body: "حضور صف كامل، تقييمات أسبوعية، إشعار ولي الأمر، وفاتورة قابلة للطباعة.",
        },
      ],
      receipt: "إيصال وبيان قابلان للطباعة",
      permissions: "صلاحيات تمنع عبور بيانات الحضانات",
    },
    footer: {
      tagline: "Arabic-first nursery management for Jordan.",
      week: "الأسبوع: الأحد إلى الخميس",
    },
  },
  en: {
    metadata: {
      title: "Hadanati | Nursery management for Jordan",
      description:
        "Arabic-first nursery management for attendance, evaluations, fees, and parent portals in Jordan.",
    },
    brand: {
      initial: "H",
      name: "Hadanati",
      tagline: "Nursery operations for Jordan",
    },
    nav: {
      features: "Features",
      offline: "Offline work",
      pilot: "Setup",
      parentPortal: "Parent portal",
      staffLogin: "Staff login",
    },
    hero: {
      eyebrow:
        "From WhatsApp chaos to a live nursery dashboard in under an hour",
      title:
        "A nursery day that is clear for owners, simple for teachers, and reassuring for parents.",
      body: "Hadanati is a Jordan-first nursery management platform: offline attendance, weekly development evaluations, JOD finance, and a parent portal that does not require another account.",
      primaryCta: "Request nursery setup",
      secondaryCta: "Try parent entry",
    },
    stats: [
      { value: "80%", label: "Attendance-days target" },
      { value: "0", label: "Lost offline mutations" },
      { value: "JOD", label: "Fils-accurate money" },
    ],
    mock: {
      morning: "Sunday morning · Garden class",
      dashboard: "Today operations wall",
      presentCount: "18 present",
      offlineBadge: "Offline",
      queue: "Outbox queue",
      queueCount: "30",
      queueBody: "25 attendance marks + 5 evaluations saved until reconnect",
      balanceLabel: "Family balance today",
      balance: "JOD 42.500",
      parentPortal: "Parent portal",
      parentAlertTitle: "Jana is absent today",
      parentAlertBody: "The push alert arrived without sensitive child data.",
      axes: ["Academic", "Social", "Motor", "Behavioral"],
      attendanceRows: [
        { name: "Layan", status: "present", label: "Present", time: "08:04" },
        { name: "Adam", status: "late", label: "Late", time: "08:27" },
        { name: "Jana", status: "absent", label: "Absent", time: "Alert" },
        { name: "Salem", status: "excused", label: "Excused", time: "Note" },
      ],
    },
    painPoints: [
      {
        title: "Instead of paper logs",
        body: "Attendance, notes, and weekly evaluations live in one place, not scattered across WhatsApp images.",
      },
      {
        title: "Instead of asking who paid",
        body: "Invoices, partial payments, outstanding balances, and monthly expenses in JOD with three decimal places.",
      },
      {
        title: "Instead of weak Wi-Fi",
        body: "Attendance and evaluations work offline, then replay through a visible queue when the connection returns.",
      },
    ],
    featuresIntro: {
      eyebrow: "A clear screen for every role",
      title: "One platform for owners, teachers, accountants, and parents.",
    },
    features: [
      {
        title: "Owner dashboard",
        body: "A live view of today’s attendance, absences by classroom, collected cash, and overdue balances.",
      },
      {
        title: "Teacher app",
        body: "A phone-friendly roster grid: one tap changes status, and one short note documents the day.",
      },
      {
        title: "Parent portal",
        body: "Access by child code only, with today’s attendance, progress summary, and balance due.",
      },
      {
        title: "Weekly evaluations",
        body: "Four simple axes: academic, social, motor, and behavioral, with progress charts across the year.",
      },
      {
        title: "Announcements and alerts",
        body: "Send to the whole nursery or one classroom, with in-app notifications and safe Web Push payloads.",
      },
      {
        title: "Privacy from day one",
        body: "Guardian consent at enrollment, opt-in photos only, and hashed access codes for parent entry.",
      },
    ],
    offline: {
      eyebrow: "Hadanati’s core promise",
      title: "When the internet drops, the classroom day keeps going.",
      body: "Version one does not promise every workflow offline. It promises the classroom essentials: attendance and evaluations. They save locally, show as pending, and replay in order when the connection returns.",
      cards: [
        { value: "25", label: "Attendance marks" },
        { value: "5", label: "Weekly evaluations" },
        { value: "FIFO", label: "Ordered replay" },
      ],
      flow: ["Airplane mode", "App restart", "Zero duplicates"],
      note: "This is not a vague marketing promise. It is a defined acceptance test: mark a class of 25 children, save 5 evaluations, close and reopen the app, then sync.",
    },
    jordan: {
      eyebrow: "Jordan details are not an afterthought",
      title: "The system is built around how nurseries here actually operate.",
      rules: [
        "The week runs Sunday through Thursday, matching Jordanian nursery operations.",
        "Money is stored as fils, never floating-point decimals that corrupt totals.",
        "Payments are recorded as cash, CliQ, bank transfer, or cheque; no payment gateway in v1.",
        "There is no public signup; setup is concierge-led in under one hour.",
      ],
    },
    pilot: {
      title: "No public signup. Guided setup, fast and controlled.",
      body: "Hadanati is SaaS for nurseries, but the first nursery does not start with a long form. It starts with a short call, then one setup session for classrooms, students, and parent codes.",
      staffCta: "Staff with an account",
      parentCta: "Parent with a code",
      steps: [
        {
          title: "We collect nursery data",
          body: "Stages, classrooms, teachers, students, and fee plans are entered once in a structured flow.",
        },
        {
          title: "We set access and roles",
          body: "Owners, teachers, and accountants see only what their role allows inside the nursery.",
        },
        {
          title: "We test a real operating day",
          body: "Full-class attendance, weekly evaluations, a parent notification, and a printable invoice.",
        },
      ],
      receipt: "Printable receipts and statements",
      permissions: "Permissions that prevent cross-nursery data leaks",
    },
    footer: {
      tagline: "Arabic-first nursery management for Jordan.",
      week: "Week: Sunday to Thursday",
    },
  },
} as const;

const painPointIcons = [CalendarCheck, WalletCards, WifiOff] as const;
const featureIcons = [
  School,
  Smartphone,
  UsersRound,
  LineChart,
  Megaphone,
  ShieldCheck,
] as const;
const offlineIcons = [CheckCircle2, Sparkles, Clock3] as const;

const statusTone = {
  present: "bg-present-soft text-present ring-present/20",
  absent: "bg-absent-soft text-absent ring-absent/20",
  late: "bg-late-soft text-late-foreground ring-late/20",
  excused: "bg-excused-soft text-excused ring-excused/20",
} as const;

async function getLandingLocale(): Promise<LandingLocale> {
  const cookieStore = await cookies();
  return cookieStore.get("locale")?.value === "en" ? "en" : "ar";
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLandingLocale();
  return copy[locale].metadata;
}

export default async function LandingPage() {
  const locale = await getLandingLocale();
  const t = copy[locale];
  const isArabic = locale === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const headingClass = isArabic ? "font-black" : "font-heading";
  const arrowClass = isArabic ? "" : "rotate-180";
  const cardArrowClass = isArabic
    ? "group-hover:-translate-x-1"
    : "rotate-180 group-hover:translate-x-1";

  return (
    <main
      dir={dir}
      className={`min-h-dvh overflow-hidden bg-background text-foreground ${
        isArabic ? thmanyahSans.className : ""
      }`}
    >
      <section className="relative isolate border-b bg-[radial-gradient(circle_at_12%_12%,var(--accent)_0,transparent_30%),linear-gradient(145deg,var(--background)_0%,var(--secondary)_52%,var(--background)_100%)]">
        <div className="absolute inset-0 -z-10 opacity-[0.18] [background-image:linear-gradient(var(--foreground)_1px,transparent_1px),linear-gradient(90deg,var(--foreground)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-5 sm:px-6 lg:gap-9 lg:px-8">
          <header className="flex items-center justify-between gap-4 rounded-3xl border bg-card/70 px-4 py-3 shadow-sm backdrop-blur md:px-5">
            <Link href="/" className="flex items-center gap-3">
              <span
                className={`flex size-11 items-center justify-center rounded-2xl bg-primary pb-1 text-2xl text-primary-foreground shadow-sm ${headingClass}`}
              >
                {t.brand.initial}
              </span>
              <span className="leading-tight">
                <span className={`block text-xl ${headingClass}`}>
                  {t.brand.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t.brand.tagline}
                </span>
              </span>
            </Link>
            <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
              <a href="#features" className="hover:text-foreground">
                {t.nav.features}
              </a>
              <a href="#offline" className="hover:text-foreground">
                {t.nav.offline}
              </a>
              <a href="#pilot" className="hover:text-foreground">
                {t.nav.pilot}
              </a>
            </nav>
            <div className="flex items-center gap-2">
              <LocaleToggle className="hidden sm:inline-flex" />
              <Link
                href="/portal"
                className="hidden rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground lg:inline-flex"
              >
                {t.nav.parentPortal}
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {t.nav.staffLogin}
              </Link>
            </div>
          </header>

          <div className="grid items-center gap-8 pb-12 pt-1 lg:grid-cols-2 lg:gap-10 lg:pb-20 lg:pt-2">
            <div className="min-w-0 max-w-3xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card/80 px-3 py-1.5 text-sm font-medium text-primary shadow-sm backdrop-blur">
                <Sparkles className="size-4" />
                {t.hero.eyebrow}
              </div>
              <h1
                className={`${headingClass} text-[2.25rem] leading-[1.1] tracking-tight text-balance sm:text-[2.75rem] lg:text-[3.25rem] xl:text-[3.375rem]`}
              >
                {t.hero.title}
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
                {t.hero.body}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#pilot"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-base font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {t.hero.primaryCta}
                  <ArrowLeft className={`size-4 ${arrowClass}`} />
                </a>
                <Link
                  href="/portal"
                  className="inline-flex h-12 items-center justify-center rounded-2xl border bg-card/80 px-6 text-base font-semibold shadow-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {t.hero.secondaryCta}
                </Link>
              </div>
              <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3 text-sm">
                {t.stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border bg-card/65 p-3 backdrop-blur"
                  >
                    <span
                      className={`block text-2xl text-primary ${headingClass}`}
                    >
                      {stat.value}
                    </span>
                    <span className="text-muted-foreground">{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-2xl lg:ms-auto">
              <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-accent/45 blur-3xl" />
              <div className="rounded-[2rem] border bg-card/90 p-3 shadow-2xl shadow-primary/10 backdrop-blur">
                <div className="rounded-[1.5rem] border bg-background p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {t.mock.morning}
                      </p>
                      <h2 className={`${headingClass} text-2xl`}>
                        {t.mock.dashboard}
                      </h2>
                    </div>
                    <div className="rounded-full bg-present-soft px-3 py-1 text-sm font-semibold text-present">
                      {t.mock.presentCount}
                    </div>
                  </div>

                  <div className="grid gap-3 py-4 sm:grid-cols-[1fr_0.75fr]">
                    <div className="space-y-2">
                      {t.mock.attendanceRows.map((row) => (
                        <div
                          key={row.name}
                          className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-2xl border bg-card px-3 py-2.5"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex size-9 items-center justify-center rounded-full bg-secondary text-primary ${headingClass}`}
                            >
                              {row.name.slice(0, 1)}
                            </span>
                            <span className="font-semibold">{row.name}</span>
                          </div>
                          <span
                            className={`${statusTone[row.status]} rounded-full px-2.5 py-1 text-xs font-bold ring-1`}
                          >
                            {row.label}
                          </span>
                          <span className="tabular text-sm text-muted-foreground">
                            {row.time}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-3">
                      <div className="rounded-2xl border bg-primary p-4 text-primary-foreground">
                        <div className="flex items-center justify-between gap-2">
                          <CloudOff className="size-5" />
                          <span className="rounded-full bg-primary-foreground/15 px-2 py-1 text-xs">
                            {t.mock.offlineBadge}
                          </span>
                        </div>
                        <p className="mt-5 text-sm opacity-80">
                          {t.mock.queue}
                        </p>
                        <p className={`${headingClass} text-4xl leading-none`}>
                          {t.mock.queueCount}
                        </p>
                        <p className="mt-1 text-sm opacity-85">
                          {t.mock.queueBody}
                        </p>
                      </div>
                      <div className="rounded-2xl border bg-card p-4">
                        <p className="text-sm font-medium text-muted-foreground">
                          {t.mock.balanceLabel}
                        </p>
                        <p className={`${headingClass} mt-2 text-3xl`}>
                          {t.mock.balance}
                        </p>
                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full w-2/3 rounded-full bg-late" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 border-t pt-4 sm:grid-cols-4">
                    {t.mock.axes.map((axis, index) => (
                      <div key={axis} className="rounded-2xl bg-muted/70 p-3">
                        <p className="text-xs text-muted-foreground">{axis}</p>
                        <div className="mt-3 flex items-end gap-1.5">
                          {[2, 4, 3, 5].map((height, barIndex) => (
                            <span
                              key={`${axis}-${barIndex}`}
                              className="w-2 rounded-full bg-chart-1/80"
                              style={{
                                height: `${height * 10 + index * 2}px`,
                                backgroundColor: `var(--chart-${index + 1})`,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div
                className={`absolute -bottom-8 hidden w-52 rounded-[1.75rem] border bg-card p-3 shadow-xl md:block ${
                  isArabic ? "-left-3" : "-right-3"
                }`}
              >
                <div className="rounded-2xl bg-secondary p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t.mock.parentPortal}
                  </p>
                  <p className={`${headingClass} mt-2 text-xl`}>
                    {t.mock.parentAlertTitle}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.mock.parentAlertBody}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-14 sm:px-6 md:grid-cols-3 lg:px-8">
        {t.painPoints.map((point, index) => {
          const Icon = painPointIcons[index];
          return (
            <article
              key={point.title}
              className="rounded-3xl border bg-card p-6 shadow-sm"
            >
              <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary">
                <Icon className="size-5" />
              </div>
              <h2 className={`${headingClass} mt-5 text-2xl`}>{point.title}</h2>
              <p className="mt-3 leading-7 text-muted-foreground">
                {point.body}
              </p>
            </article>
          );
        })}
      </section>

      <section id="features" className="border-y bg-card/45">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-primary">
              {t.featuresIntro.eyebrow}
            </p>
            <h2
              className={`${headingClass} mt-3 text-4xl leading-tight sm:text-5xl`}
            >
              {t.featuresIntro.title}
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {t.features.map((feature, index) => {
              const Icon = featureIcons[index];
              return (
                <article
                  key={feature.title}
                  className="group rounded-3xl border bg-background p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                      <Icon className="size-5" />
                    </div>
                    <ArrowLeft
                      className={`size-5 text-muted-foreground transition group-hover:text-primary ${cardArrowClass}`}
                    />
                  </div>
                  <h3 className={`${headingClass} mt-6 text-2xl`}>
                    {feature.title}
                  </h3>
                  <p className="mt-3 leading-7 text-muted-foreground">
                    {feature.body}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="offline"
        className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8"
      >
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">
            <CloudOff className="size-4" />
            {t.offline.eyebrow}
          </div>
          <h2
            className={`${headingClass} mt-5 text-4xl leading-tight sm:text-5xl`}
          >
            {t.offline.title}
          </h2>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            {t.offline.body}
          </p>
        </div>
        <div className="rounded-[2rem] border bg-card p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            {t.offline.cards.map((card, index) => {
              const Icon = offlineIcons[index];
              const tones = [
                "bg-present-soft text-present",
                "bg-excused-soft text-excused",
                "bg-late-soft text-late-foreground",
              ];
              return (
                <div
                  key={card.label}
                  className={`rounded-3xl p-5 ${tones[index]}`}
                >
                  <Icon className="size-6" />
                  <p className={`${headingClass} mt-8 text-3xl`}>
                    {card.value}
                  </p>
                  <p className="text-sm font-semibold">{card.label}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-5 rounded-3xl border bg-background p-5">
            <div className="flex flex-wrap items-center gap-3">
              {t.offline.flow.map((item, index) => (
                <span key={item} className="contents">
                  {index > 0 && <span className="h-px flex-1 bg-border" />}
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${
                      index === t.offline.flow.length - 1
                        ? "bg-present-soft font-bold text-present"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {item}
                  </span>
                </span>
              ))}
            </div>
            <p className="mt-4 leading-7 text-muted-foreground">
              {t.offline.note}
            </p>
          </div>
        </div>
      </section>

      <section className="border-y bg-secondary/70">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-primary">
              {t.jordan.eyebrow}
            </p>
            <h2 className={`${headingClass} mt-3 text-4xl leading-tight`}>
              {t.jordan.title}
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {t.jordan.rules.map((rule) => (
              <div
                key={rule}
                className="flex gap-3 rounded-3xl border bg-card p-5"
              >
                <CheckCircle2 className="mt-1 size-5 shrink-0 text-primary" />
                <p className="leading-7 text-muted-foreground">{rule}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="pilot"
        className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8"
      >
        <div className="grid gap-8 lg:grid-cols-[1fr_0.95fr]">
          <div className="rounded-[2rem] bg-primary p-6 text-primary-foreground sm:p-8">
            <HeartHandshake className="size-9" />
            <h2
              className={`${headingClass} mt-8 text-4xl leading-tight sm:text-5xl`}
            >
              {t.pilot.title}
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-primary-foreground/80">
              {t.pilot.body}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-primary-foreground px-6 font-semibold text-primary transition hover:bg-primary-foreground/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary-foreground/50"
              >
                {t.pilot.staffCta}
              </Link>
              <Link
                href="/portal"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-primary-foreground/25 px-6 font-semibold transition hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary-foreground/50"
              >
                {t.pilot.parentCta}
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            {t.pilot.steps.map((step, index) => (
              <article
                key={step.title}
                className="rounded-3xl border bg-card p-6 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <span
                    className={`flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-xl text-accent-foreground ${headingClass}`}
                  >
                    {index + 1}
                  </span>
                  <div>
                    <h3 className={`${headingClass} text-2xl`}>{step.title}</h3>
                    <p className="mt-2 leading-7 text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                </div>
              </article>
            ))}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border bg-card p-5">
                <CreditCard className="size-6 text-primary" />
                <p className={`${headingClass} mt-5 text-2xl`}>
                  {t.pilot.receipt}
                </p>
              </div>
              <div className="rounded-3xl border bg-card p-5">
                <LockKeyhole className="size-6 text-primary" />
                <p className={`${headingClass} mt-5 text-2xl`}>
                  {t.pilot.permissions}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t bg-card/70">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-8 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <p className={`${headingClass} text-lg text-foreground`}>
              {t.brand.name}
            </p>
            <p>{t.footer.tagline}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/login" className="hover:text-foreground">
              {t.nav.staffLogin}
            </Link>
            <Link href="/portal" className="hover:text-foreground">
              {t.nav.parentPortal}
            </Link>
            <span>{t.footer.week}</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
