import type { Namespace } from "./types";

// Filled by the attendance feature. Keys are dot-namespaced: "attendance.*"
// (plus the nav.* keys for the two sidebar items this feature's layout owns).
export const attendance: Namespace = {
  ar: {
    // Nav (sidebar owned by the attendance feature)
    "nav.classrooms": "الصفوف",
    "nav.staff": "الطاقم",

    // Statuses beyond the base four (attendance.present/absent/late/excused
    // live in the base dictionary)
    "attendance.unmarked": "غير مسجَّل",

    // Page
    "attendance.title": "تسجيل الحضور",
    "attendance.subtitle": "انقر على الطالب لتبديل حالة الحضور",
    "attendance.classroom": "الصف",
    "attendance.selectClassroom": "اختر الصف",
    "attendance.noClassrooms": "لا توجد صفوف متاحة لك بعد",
    "attendance.noStudents": "لا يوجد طلاب في هذا الصف",
    "attendance.noStudentsDesc": "أضف الطلاب إلى الصف لتتمكن من تسجيل الحضور",
    "attendance.pickDate": "تاريخ آخر",
    "attendance.teacherTodayOnly": "يمكن للمعلمة تسجيل الحضور لليوم الحالي فقط",
    "attendance.readOnly": "عرض فقط — تسجيل الحضور متاح للإدارة والمعلمات",

    // Note / check-in dialog
    "attendance.note": "ملاحظة",
    "attendance.noteTitle": "ملاحظة ووقت الوصول",
    "attendance.notePlaceholder": "مثال: اتصل ولي الأمر وأبلغ عن موعد طبي",
    "attendance.checkInTime": "وقت الوصول",
    "attendance.noteDraftHint":
      "الطالب غير مسجَّل بعد — ستُحفظ الملاحظة مع أول حالة تسجّلها له",
    "attendance.cancel": "إلغاء",

    // Summary bar / bulk action
    "attendance.markRest": "تحضير الباقي",
    "attendance.markRestTitle": "تحضير جميع الباقين؟",
    "attendance.markRestDesc":
      "سيتم تسجيل جميع الطلاب غير المسجَّلين كحاضرين لهذا اليوم",
    "attendance.markRestConfirm": "نعم، سجّلهم حاضرين",

    // Offline
    "attendance.staleSince": "بيانات محفوظة محلياً —",

    // Offline shared keys (owned by the offline feature; used app-wide)
    "offline.lastUpdated": "آخر تحديث",
    "offline.requiresConnection": "هذه العملية تتطلب اتصالاً بالإنترنت",
    "offline.conflict": "تم التحديث أثناء المزامنة",
    "offline.error.forbidden": "ليست لديك صلاحية لهذه العملية",
    "offline.error.unauthorized": "انتهت الجلسة، سجّل الدخول مجدداً",
    "offline.error.no_photo_consent": "لا توجد موافقة على الصور لهذا الطالب",
    "offline.error.already_enrolled": "الطالب مسجَّل بالفعل في صف لهذه السنة",
    "offline.error.invalid_score": "قيمة تقييم غير صالحة",
  },
  en: {
    "nav.classrooms": "Classrooms",
    "nav.staff": "Staff",

    "attendance.unmarked": "Unmarked",

    "attendance.title": "Attendance",
    "attendance.subtitle": "Tap a student to cycle their attendance status",
    "attendance.classroom": "Classroom",
    "attendance.selectClassroom": "Select a classroom",
    "attendance.noClassrooms": "No classrooms available to you yet",
    "attendance.noStudents": "No students in this classroom",
    "attendance.noStudentsDesc": "Add students to the classroom to take attendance",
    "attendance.pickDate": "Other date",
    "attendance.teacherTodayOnly": "Teachers can record attendance for today only",
    "attendance.readOnly": "View only — attendance is recorded by admins and teachers",

    "attendance.note": "Note",
    "attendance.noteTitle": "Note & check-in time",
    "attendance.notePlaceholder": "e.g. guardian called about a doctor appointment",
    "attendance.checkInTime": "Check-in time",
    "attendance.noteDraftHint":
      "Not marked yet — the note will be saved with the first status you record",
    "attendance.cancel": "Cancel",

    "attendance.markRest": "Mark the rest present",
    "attendance.markRestTitle": "Mark everyone remaining present?",
    "attendance.markRestDesc":
      "All unmarked students will be recorded as present for this day",
    "attendance.markRestConfirm": "Yes, mark them present",

    "attendance.staleSince": "Locally saved data —",

    "offline.lastUpdated": "Last updated",
    "offline.requiresConnection": "This action requires an internet connection",
    "offline.conflict": "Updated during sync",
    "offline.error.forbidden": "You don't have permission for this action",
    "offline.error.unauthorized": "Session expired — sign in again",
    "offline.error.no_photo_consent": "No photo consent for this student",
    "offline.error.already_enrolled": "Student is already enrolled for this year",
    "offline.error.invalid_score": "Invalid evaluation score",
  },
};
