import type { Namespace } from "./types";

// Filled by the staff feature. Keys are dot-namespaced: "staff.*"
export const staff: Namespace = {
  ar: {
    "staff.title": "الطاقم",
    "staff.subtitle": "إدارة موظفي الحضانة وصلاحياتهم",
    "staff.adminOnly": "للمدير فقط",
    "staff.adminOnlyDesc": "هذه الصفحة متاحة لمدير الحضانة فقط",
    "staff.add": "إضافة موظف",
    "staff.empty": "لا يوجد موظفون بعد",

    // Table
    "staff.table.name": "الاسم",
    "staff.table.email": "البريد الإلكتروني",
    "staff.table.role": "الدور",
    "staff.table.actions": "إجراءات",
    "staff.role.admin": "مدير",
    "staff.role.teacher": "معلم",
    "staff.role.accountant": "محاسب",
    "staff.changeRole": "تغيير الدور",
    "staff.remove": "إزالة الموظف",
    "staff.removeTitle": "إزالة الموظف؟",
    "staff.removeDesc": "سيفقد الموظف صلاحية الوصول إلى الحضانة",
    "staff.removeConfirm": "إزالة",
    "staff.cancel": "إلغاء",

    // Add form
    "staff.form.title": "إضافة موظف",
    "staff.form.desc": "أنشئ حساباً جديداً لموظف في الحضانة",
    "staff.form.name": "الاسم",
    "staff.form.email": "البريد الإلكتروني",
    "staff.form.password": "كلمة المرور",
    "staff.form.passwordHint": "٨ أحرف على الأقل",
    "staff.form.showPassword": "إظهار كلمة المرور",
    "staff.form.hidePassword": "إخفاء كلمة المرور",
    "staff.form.role": "الدور",
    "staff.form.create": "إضافة",
    "staff.form.creating": "جارٍ الإضافة…",
    "staff.form.cancel": "إلغاء",
    "staff.form.validation.password":
      "كلمة المرور يجب أن تكون ٨ أحرف على الأقل",

    // Toasts / errors
    "staff.toast.created":
      "تم إنشاء الحساب — شارك البريد الإلكتروني وكلمة المرور مع الموظف",
    "staff.toast.roleChanged": "تم تغيير الدور",
    "staff.toast.removed": "تمت إزالة الموظف",
    "staff.error.emailExists": "هذا البريد الإلكتروني مستخدم مسبقاً",
    "staff.error.lastAdmin": "لا يمكن إزالة أو تغيير دور آخر مدير في الحضانة",
    "staff.error.generic": "حدث خطأ، حاول مرة أخرى",
  },
  en: {
    "staff.title": "Staff",
    "staff.subtitle": "Manage the nursery's staff and their roles",
    "staff.adminOnly": "Admins only",
    "staff.adminOnlyDesc": "This page is available to the nursery admin only",
    "staff.add": "Add staff member",
    "staff.empty": "No staff members yet",

    // Table
    "staff.table.name": "Name",
    "staff.table.email": "Email",
    "staff.table.role": "Role",
    "staff.table.actions": "Actions",
    "staff.role.admin": "Admin",
    "staff.role.teacher": "Teacher",
    "staff.role.accountant": "Accountant",
    "staff.changeRole": "Change role",
    "staff.remove": "Remove member",
    "staff.removeTitle": "Remove member?",
    "staff.removeDesc": "They will lose access to the nursery",
    "staff.removeConfirm": "Remove",
    "staff.cancel": "Cancel",

    // Add form
    "staff.form.title": "Add staff member",
    "staff.form.desc": "Create a new account for a nursery staff member",
    "staff.form.name": "Name",
    "staff.form.email": "Email",
    "staff.form.password": "Password",
    "staff.form.passwordHint": "At least 8 characters",
    "staff.form.showPassword": "Show password",
    "staff.form.hidePassword": "Hide password",
    "staff.form.role": "Role",
    "staff.form.create": "Add",
    "staff.form.creating": "Adding…",
    "staff.form.cancel": "Cancel",
    "staff.form.validation.password":
      "Password must be at least 8 characters",

    // Toasts / errors
    "staff.toast.created":
      "Account created — share the email and password with the staff member",
    "staff.toast.roleChanged": "Role updated",
    "staff.toast.removed": "Member removed",
    "staff.error.emailExists": "This email is already in use",
    "staff.error.lastAdmin":
      "You cannot remove or demote the nursery's last admin",
    "staff.error.generic": "Something went wrong, try again",
  },
};
