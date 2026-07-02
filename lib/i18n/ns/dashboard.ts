import type { Namespace } from "./types";

// Filled by the dashboard feature. Keys are dot-namespaced: "dashboard.*"
// Base keys (dashboard.greeting, dashboard.week, …) live in lib/i18n/ar.ts.
export const dashboard: Namespace = {
  ar: {
    "dashboard.unmarked": "غير مسجّل",
    "dashboard.totalStudents": "إجمالي الطلاب",
    "dashboard.classrooms": "الصفوف",
    "dashboard.absentees": "غيابات اليوم",
    "dashboard.noAbsentees": "لا غيابات اليوم، الجميع حاضرون",
    "dashboard.emptyDay": "لم يُسجَّل حضور اليوم بعد",
    "dashboard.emptyDayDesc": "ابدئي بتسجيل حضور الصفوف لعرض ملخص اليوم هنا",
    "dashboard.startAttendance": "ابدأ تسجيل الحضور",
    "dashboard.weekend": "عطلة نهاية الأسبوع",
    "dashboard.weekendDesc": "اليوم عطلة، نلقاكم يوم الأحد بإذن الله",
    "dashboard.marked": "مسجّل",
    "dashboard.of": "من",
  },
  en: {
    "dashboard.unmarked": "Unmarked",
    "dashboard.totalStudents": "Total students",
    "dashboard.classrooms": "Classrooms",
    "dashboard.absentees": "Today's absences",
    "dashboard.noAbsentees": "No absences today, everyone is here",
    "dashboard.emptyDay": "No attendance recorded today yet",
    "dashboard.emptyDayDesc":
      "Start marking classroom attendance to see today's summary here",
    "dashboard.startAttendance": "Start taking attendance",
    "dashboard.weekend": "Weekend",
    "dashboard.weekendDesc": "It's the weekend — see you on Sunday",
    "dashboard.marked": "Marked",
    "dashboard.of": "of",
  },
};
