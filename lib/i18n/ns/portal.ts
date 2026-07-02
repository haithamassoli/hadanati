import type { Namespace } from "./types";

// Filled by the portal feature. Keys are dot-namespaced: "portal.*"
export const portal: Namespace = {
  ar: {
    // Shell
    "portal.title": "بوابة أولياء الأمور",
    "portal.tabs.home": "الرئيسية",
    "portal.tabs.progress": "التقدم",
    "portal.tabs.announcements": "الإعلانات",
    "portal.tabs.inbox": "الإشعارات",
    "portal.tabs.payments": "المدفوعات",
    "portal.settingsLabel": "الإعدادات",
    "portal.offline": "بدون اتصال",
    "portal.switchChild": "تبديل الطفل",

    // Code entry
    "portal.entry.title": "أهلاً بك",
    "portal.entry.subtitle": "أدخل رمز الوصول لمتابعة يوم طفلك",
    "portal.entry.codeLabel": "رمز الوصول",
    "portal.entry.submit": "دخول",
    "portal.entry.invalid": "الرمز غير صحيح — تأكد منه وحاول مجدداً",
    "portal.entry.rateLimited": "محاولات كثيرة — انتظر قليلاً ثم حاول مجدداً",
    "portal.entry.offline": "لا يمكن التحقق من الرمز بدون اتصال بالإنترنت",
    "portal.entry.error": "حدث خطأ — حاول مجدداً",
    "portal.entry.whatIsCode": "ما هو رمز الوصول؟",
    "portal.entry.whatIsCodeDesc":
      "الحضانة تزوّدك برمز خاص بطفلك. اطلبه من إدارة الحضانة إن لم يصلك بعد.",
    "portal.entry.added": "أهلاً بك! تمت إضافة {name}",

    // Home
    "portal.home.todayTitle": "حضور اليوم",
    "portal.home.notMarked": "لم يُسجّل بعد",
    "portal.home.checkInAt": "وقت الوصول",
    "portal.home.evalTitle": "آخر تقييم",
    "portal.home.evalWeek": "الأسبوع {n}",
    "portal.home.noEval": "لا توجد تقييمات بعد",
    "portal.home.viewProgress": "عرض التقدم الكامل",
    "portal.home.balanceTitle": "المبلغ المستحق",
    "portal.home.balanceDesc": "للاستفسار عن الدفع يرجى مراجعة إدارة الحضانة",
    "portal.home.invalidCode":
      "لم يعد هذا الرمز صالحاً. اطلب رمزاً جديداً من الحضانة.",
    "portal.home.removeCode": "إزالة الرمز من هذا الجهاز",

    // Push opt-in
    "portal.push.bannerTitle": "فعّل الإشعارات",
    "portal.push.bannerDesc":
      "ليصلك تنبيه فوري عند الغياب والتقييمات والإعلانات",
    "portal.push.enable": "تفعيل",
    "portal.push.later": "لاحقاً",
    "portal.push.enabled": "تم تفعيل الإشعارات",
    "portal.push.disabled": "تم إيقاف الإشعارات",
    "portal.push.denied": "الإشعارات محظورة من إعدادات المتصفح",
    "portal.push.unsupported": "الإشعارات غير متاحة في هذا المتصفح حالياً",
    "portal.push.iosBannerTitle": "أضف التطبيق إلى الشاشة الرئيسية",
    "portal.push.iosBannerDesc": "لتصلك الإشعارات على آيفون وآيباد",
    "portal.push.iosHow": "كيف؟",

    // Progress
    "portal.progress.title": "التقدم الأسبوعي",
    "portal.progress.desc": "تقييم طفلك في المحاور الأربعة خلال السنة",
    "portal.progress.latestTitle": "أحدث النتائج",
    "portal.progress.latestWeek": "الأسبوع {n}",
    "portal.progress.empty": "لا توجد تقييمات بعد",
    "portal.progress.emptyDesc":
      "ستظهر تقييمات طفلك الأسبوعية هنا فور تسجيلها",

    // Announcements
    "portal.ann.title": "الإعلانات",
    "portal.ann.empty": "لا توجد إعلانات بعد",
    "portal.ann.emptyDesc": "ستظهر إعلانات الحضانة والصف هنا",
    "portal.ann.nurseryWide": "إعلان عام",

    // Inbox
    "portal.inbox.title": "الإشعارات",
    "portal.inbox.empty": "لا توجد إشعارات بعد",
    "portal.inbox.emptyDesc": "ستصلك هنا تنبيهات الغياب والتقييمات والإعلانات",
    "portal.inbox.absence": "سُجّل غياب لطفلك بتاريخ {date}",
    "portal.inbox.evaluation": "تقييم جديد للأسبوع {week}",
    "portal.inbox.announcement": "إعلان جديد من الحضانة",
    "portal.inbox.generic": "تحديث جديد حول طفلك",
    "portal.inbox.invoiceIssued": "صدرت فاتورة جديدة لطفلك",
    "portal.inbox.invoiceOverdue": "تذكير: توجد فاتورة متأخرة عن موعد استحقاقها",
    "portal.inbox.unread": "جديد",

    // Payments (FR-PAR-3, read-only)
    "portal.payments.title": "المدفوعات",
    "portal.payments.balanceTitle": "الرصيد المستحق",
    "portal.payments.balanceDesc":
      "للاستفسار عن الدفع يرجى مراجعة إدارة الحضانة",
    "portal.payments.noBalance": "لا مستحقات 🎉",
    "portal.payments.noBalanceDesc": "جميع الفواتير مسددة — شكراً لك",
    "portal.payments.empty": "لا توجد فواتير بعد",
    "portal.payments.emptyDesc": "ستظهر فواتير طفلك ودفعاتها هنا",
    "portal.payments.invoiceFallback": "رسوم الحضانة",
    "portal.payments.status.paid": "مدفوعة",
    "portal.payments.status.overdue": "متأخرة",
    "portal.payments.status.remaining": "متبقٍ {amount}",
    "portal.payments.amount": "قيمة الفاتورة",
    "portal.payments.paid": "المدفوع",
    "portal.payments.dueDate": "الاستحقاق",
    "portal.payments.showPayments": "عرض الدفعات ({n})",
    "portal.payments.hidePayments": "إخفاء الدفعات",
    "portal.payments.noPayments": "لا توجد دفعات مسجّلة بعد",
    "portal.payments.method.cash": "نقداً",
    "portal.payments.method.cliq": "كليك",
    "portal.payments.method.transfer": "حوالة",
    "portal.payments.method.cheque": "شيك",

    // Settings
    "portal.settings.title": "الإعدادات",
    "portal.settings.childrenTitle": "أطفالي",
    "portal.settings.childrenDesc": "الرموز المخزّنة على هذا الجهاز",
    "portal.settings.addCode": "إضافة رمز آخر",
    "portal.settings.activeChild": "المعروض حالياً",
    "portal.settings.switchTo": "عرض",
    "portal.settings.remove": "إزالة",
    "portal.settings.removeTitle": "إزالة الرمز؟",
    "portal.settings.removeDesc":
      "سيُحذف الرمز من هذا الجهاز فقط — يمكنك إضافته مجدداً في أي وقت.",
    "portal.settings.cancel": "إلغاء",
    "portal.settings.confirm": "تأكيد",
    "portal.settings.pushTitle": "الإشعارات",
    "portal.settings.pushDesc": "تنبيهات الغياب والتقييمات والإعلانات",
    "portal.settings.pushToggle": "إشعارات فورية على هذا الجهاز",

    // Add-to-home-screen walkthrough (iOS Safari, not installed)
    "portal.a2hs.title": "أضف التطبيق إلى الشاشة الرئيسية",
    "portal.a2hs.desc":
      "على آيفون وآيباد تعمل الإشعارات فقط بعد تثبيت التطبيق على الشاشة الرئيسية:",
    "portal.a2hs.step1":
      "اضغط زر المشاركة في شريط سفاري (مربع يخرج منه سهم للأعلى)",
    "portal.a2hs.step2": "اختر «إضافة إلى الشاشة الرئيسية» ثم «إضافة»",
    "portal.a2hs.step3":
      "افتح «حضانتي» من الشاشة الرئيسية وفعّل الإشعارات من الإعدادات",

    // Staff: parent access code card (student detail page, admin only)
    "portal.staffCode.title": "رمز ولي الأمر",
    "portal.staffCode.desc": "رمز الدخول إلى بوابة أولياء الأمور لهذا الطالب",
    "portal.staffCode.none": "لا يوجد رمز فعّال",
    "portal.staffCode.activeSince": "رمز فعّال — أُنشئ {time}",
    "portal.staffCode.generate": "إنشاء رمز",
    "portal.staffCode.regenerate": "إعادة الإنشاء",
    "portal.staffCode.regenerateHint": "إعادة الإنشاء تُلغي الرمز القديم فوراً",
    "portal.staffCode.revoke": "إلغاء الرمز",
    "portal.staffCode.revokeTitle": "إلغاء رمز ولي الأمر؟",
    "portal.staffCode.revokeDesc":
      "لن يتمكن ولي الأمر من الدخول إلى البوابة حتى تنشئ رمزاً جديداً.",
    "portal.staffCode.revoked": "تم إلغاء الرمز",
    "portal.staffCode.dialogTitle": "رمز ولي الأمر الجديد",
    "portal.staffCode.copyWarning": "انسخه الآن — لن يظهر مجدداً",
    "portal.staffCode.copy": "نسخ",
    "portal.staffCode.copied": "تم النسخ",
    "portal.staffCode.whatsapp": "إرسال عبر واتساب",
    "portal.staffCode.whatsappText":
      "رمز الدخول إلى بوابة حضانتي الخاص بالطالب {name}: {code} — افتح {url} وأدخل الرمز",
    "portal.staffCode.done": "تم",
    "portal.staffCode.error": "حدث خطأ — حاول مجدداً",

    // Landing
    "portal.landing.parents": "بوابة أولياء الأمور",
  },
  en: {
    "portal.title": "Parent Portal",
    "portal.tabs.home": "Home",
    "portal.tabs.progress": "Progress",
    "portal.tabs.announcements": "News",
    "portal.tabs.inbox": "Alerts",
    "portal.tabs.payments": "Payments",
    "portal.settingsLabel": "Settings",
    "portal.offline": "Offline",
    "portal.switchChild": "Switch child",

    "portal.entry.title": "Welcome",
    "portal.entry.subtitle": "Enter your access code to follow your child's day",
    "portal.entry.codeLabel": "Access code",
    "portal.entry.submit": "Enter",
    "portal.entry.invalid": "That code isn't right — check it and try again",
    "portal.entry.rateLimited": "Too many attempts — wait a bit and try again",
    "portal.entry.offline": "Can't verify the code without an internet connection",
    "portal.entry.error": "Something went wrong — try again",
    "portal.entry.whatIsCode": "What is an access code?",
    "portal.entry.whatIsCodeDesc":
      "The nursery gives you a code for your child. Ask the nursery admin if you haven't received one yet.",
    "portal.entry.added": "Welcome! {name} was added",

    "portal.home.todayTitle": "Today's attendance",
    "portal.home.notMarked": "Not marked yet",
    "portal.home.checkInAt": "Check-in time",
    "portal.home.evalTitle": "Latest evaluation",
    "portal.home.evalWeek": "Week {n}",
    "portal.home.noEval": "No evaluations yet",
    "portal.home.viewProgress": "View full progress",
    "portal.home.balanceTitle": "Balance due",
    "portal.home.balanceDesc": "Please contact the nursery office about payment",
    "portal.home.invalidCode":
      "This code is no longer valid. Ask the nursery for a new one.",
    "portal.home.removeCode": "Remove code from this device",

    "portal.push.bannerTitle": "Turn on notifications",
    "portal.push.bannerDesc":
      "Get instant alerts for absences, evaluations and announcements",
    "portal.push.enable": "Enable",
    "portal.push.later": "Later",
    "portal.push.enabled": "Notifications enabled",
    "portal.push.disabled": "Notifications turned off",
    "portal.push.denied": "Notifications are blocked in your browser settings",
    "portal.push.unsupported": "Notifications aren't available in this browser yet",
    "portal.push.iosBannerTitle": "Add the app to your Home Screen",
    "portal.push.iosBannerDesc": "To receive notifications on iPhone and iPad",
    "portal.push.iosHow": "How?",

    "portal.progress.title": "Weekly progress",
    "portal.progress.desc": "Your child's evaluation across the four axes this year",
    "portal.progress.latestTitle": "Latest results",
    "portal.progress.latestWeek": "Week {n}",
    "portal.progress.empty": "No evaluations yet",
    "portal.progress.emptyDesc":
      "Your child's weekly evaluations will appear here once recorded",

    "portal.ann.title": "Announcements",
    "portal.ann.empty": "No announcements yet",
    "portal.ann.emptyDesc": "Nursery and classroom announcements will appear here",
    "portal.ann.nurseryWide": "Nursery-wide",

    "portal.inbox.title": "Notifications",
    "portal.inbox.empty": "No notifications yet",
    "portal.inbox.emptyDesc":
      "Absence, evaluation and announcement alerts will arrive here",
    "portal.inbox.absence": "An absence was recorded for your child on {date}",
    "portal.inbox.evaluation": "New evaluation for week {week}",
    "portal.inbox.announcement": "New announcement from the nursery",
    "portal.inbox.generic": "A new update about your child",
    "portal.inbox.invoiceIssued": "A new invoice was issued for your child",
    "portal.inbox.invoiceOverdue": "Reminder: an invoice is past its due date",
    "portal.inbox.unread": "New",

    "portal.payments.title": "Payments",
    "portal.payments.balanceTitle": "Balance due",
    "portal.payments.balanceDesc":
      "Please contact the nursery office about payment",
    "portal.payments.noBalance": "Nothing due 🎉",
    "portal.payments.noBalanceDesc": "All invoices are settled — thank you",
    "portal.payments.empty": "No invoices yet",
    "portal.payments.emptyDesc":
      "Your child's invoices and payments will appear here",
    "portal.payments.invoiceFallback": "Nursery fees",
    "portal.payments.status.paid": "Paid",
    "portal.payments.status.overdue": "Overdue",
    "portal.payments.status.remaining": "{amount} remaining",
    "portal.payments.amount": "Invoice amount",
    "portal.payments.paid": "Paid so far",
    "portal.payments.dueDate": "Due",
    "portal.payments.showPayments": "Show payments ({n})",
    "portal.payments.hidePayments": "Hide payments",
    "portal.payments.noPayments": "No payments recorded yet",
    "portal.payments.method.cash": "Cash",
    "portal.payments.method.cliq": "CliQ",
    "portal.payments.method.transfer": "Transfer",
    "portal.payments.method.cheque": "Cheque",

    "portal.settings.title": "Settings",
    "portal.settings.childrenTitle": "My children",
    "portal.settings.childrenDesc": "Codes stored on this device",
    "portal.settings.addCode": "Add another code",
    "portal.settings.activeChild": "Currently shown",
    "portal.settings.switchTo": "Show",
    "portal.settings.remove": "Remove",
    "portal.settings.removeTitle": "Remove this code?",
    "portal.settings.removeDesc":
      "The code is only removed from this device — you can add it again anytime.",
    "portal.settings.cancel": "Cancel",
    "portal.settings.confirm": "Confirm",
    "portal.settings.pushTitle": "Notifications",
    "portal.settings.pushDesc": "Absence, evaluation and announcement alerts",
    "portal.settings.pushToggle": "Push notifications on this device",

    "portal.a2hs.title": "Add the app to your Home Screen",
    "portal.a2hs.desc":
      "On iPhone and iPad, notifications only work after installing the app to the Home Screen:",
    "portal.a2hs.step1":
      "Tap the Share button in Safari's toolbar (a square with an arrow pointing up)",
    "portal.a2hs.step2": 'Choose "Add to Home Screen", then "Add"',
    "portal.a2hs.step3":
      'Open "Hadanati" from your Home Screen and enable notifications in Settings',

    "portal.staffCode.title": "Parent access code",
    "portal.staffCode.desc": "The parent-portal sign-in code for this student",
    "portal.staffCode.none": "No active code",
    "portal.staffCode.activeSince": "Active code — created {time}",
    "portal.staffCode.generate": "Generate code",
    "portal.staffCode.regenerate": "Regenerate",
    "portal.staffCode.regenerateHint":
      "Regenerating immediately invalidates the old code",
    "portal.staffCode.revoke": "Revoke code",
    "portal.staffCode.revokeTitle": "Revoke the parent code?",
    "portal.staffCode.revokeDesc":
      "The parent won't be able to access the portal until you generate a new code.",
    "portal.staffCode.revoked": "Code revoked",
    "portal.staffCode.dialogTitle": "New parent access code",
    "portal.staffCode.copyWarning": "Copy it now — it won't be shown again",
    "portal.staffCode.copy": "Copy",
    "portal.staffCode.copied": "Copied",
    "portal.staffCode.whatsapp": "Send via WhatsApp",
    "portal.staffCode.whatsappText":
      "Hadanati portal access code for {name}: {code} — open {url} and enter the code",
    "portal.staffCode.done": "Done",
    "portal.staffCode.error": "Something went wrong — try again",

    "portal.landing.parents": "Parent Portal",
  },
};
