import { test, expect, type Page } from '@playwright/test';
import {
  ACCOUNTANT,
  ADMIN,
  HASHEM,
  LAYAN,
  NURSERY_ID,
  OVERDUE_INVOICE_DESC,
  TEACHER,
  convexRun,
  login,
  type FinanceReport,
  type PortalInvoices,
} from './helpers';

/**
 * M3 finance acceptance (FR-FIN-1..6, FR-PAR-3, FR-NOT-2, PRD §5 print
 * stylesheet) on the production build. Serial suite (workers: 1) — runs
 * after ac-off.spec.ts and before portal.spec.ts; it never touches the
 * state those specs depend on (today's attendance, the 2 seeded
 * announcements, ليان's overdue invoice stays unpaid).
 *
 * Rerun-safe: the invoice chain uses هاشم (no fee plan → bulk generation
 * never bills him) and is always paid down to exactly 0, so earlier runs
 * leave his balance at zero.
 */

const AMOUNT_JOD = '40.000'; // 40000 fils
const PARTIAL_JOD = '15.000'; // 15000 fils
const INVOICE_DESC = 'رسوم بوابة الإطلاق M3';
const OFFLINE_MSG = 'العمليات المالية تتطلب اتصالاً بالإنترنت';
const ZERO_TOAST = 'لا فواتير جديدة — فواتير هذا الشهر مُصدرة مسبقاً';

// Arabic-Indic amounts as rendered by formatFils(..., 'ar') (ar-JO, 3
// decimals). Lookbehind so '٠٫٠٠٠' never matches inside '٤٠٫٠٠٠'.
const AR = {
  amount: /(?<![٠-٩])٤٠٫٠٠٠/, // 40.000
  partial: /(?<![٠-٩])١٥٫٠٠٠/, // 15.000
  remaining: /(?<![٠-٩])٢٥٫٠٠٠/, // 25.000
  zero: /(?<![٠-٩])٠٫٠٠٠/, // 0.000
};

function invoiceCount(): number {
  return convexRun<FinanceReport>('admin:financeReport', {
    nurseryId: NURSERY_ID,
  }).invoiceCount;
}

/** Localized Arabic-Indic amount for an integer-fils value (no currency). */
function arabicJod(fils: number): string {
  return new Intl.NumberFormat('ar-JO', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(fils / 1000);
}

/** Every [data-print-hidden] element must be display:none under print. */
async function printChromeLeaks(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-print-hidden]')]
      .filter((el) => getComputedStyle(el).display !== 'none')
      .map((el) => `${el.tagName}.${el.className}`),
  );
}

async function expectCleanPrint(page: Page, title: string, shot: string) {
  await page.emulateMedia({ media: 'print' });
  // The document itself still renders…
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  // …while ALL staff chrome (sidebar, tab bar, toolbars, nav) is gone.
  expect(await printChromeLeaks(page)).toEqual([]);
  await expect(page.locator('aside')).toBeHidden();
  await page.screenshot({ path: test.info().outputPath(shot), fullPage: true });
  await page.emulateMedia({ media: 'screen' });
}

test('FR-FIN-1/2/3/5 + FR-PAR-3/FR-NOT-2: plan → generate idempotency → invoice → payments → paid → parent portal → print QA', async ({
  browser,
}) => {
  test.setTimeout(420_000);

  const acct = await browser.newContext();
  const page = await acct.newPage();
  await login(page, ACCOUNTANT.email, ACCOUNTANT.password);

  // ---- Accountant sees المالية in the sidebar and can enter (PRD §6) ----
  const financeLink = page.locator('aside').getByRole('link', { name: 'المالية' });
  await expect(financeLink).toBeVisible({ timeout: 30_000 });
  await financeLink.click();
  await expect(page.getByText('المحصّل هذا الشهر')).toBeVisible({
    timeout: 30_000,
  });

  // ---- FR-FIN-1: the seeded fee plan is listed; deleting it is blocked ----
  await page.getByRole('link', { name: 'خطط الرسوم' }).click();
  const planRow = page.getByRole('row').filter({ hasText: 'قسط شهري' }).first();
  await expect(planRow).toBeVisible({ timeout: 30_000 });
  await expect(planRow.getByText('شهري', { exact: true })).toBeVisible();
  await planRow.getByRole('button', { name: 'حذف الخطة' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'حذف' }).click();
  await expect(
    page.getByText('لا يمكن حذف خطة مستخدمة في تسجيلات الطلاب'),
  ).toBeVisible({ timeout: 30_000 });
  await expect(planRow).toBeVisible(); // plan_in_use → still there

  // ---- FR-FIN-2: bulk generation is idempotent (click twice → 2nd is 0) ----
  await page.getByRole('link', { name: 'الفواتير' }).click();
  const generate = page.getByRole('button', { name: 'إصدار فواتير الشهر' });
  await expect(generate).toBeEnabled({ timeout: 30_000 });

  await generate.click();
  await expect(
    page.getByText(/أُنشئت|لا فواتير جديدة/).first(),
  ).toBeVisible({ timeout: 30_000 });
  const afterFirst = invoiceCount();
  // Let the first toast dismiss so the second click's toast is unambiguous.
  await expect(page.getByText(/أُنشئت|لا فواتير جديدة/)).toHaveCount(0, {
    timeout: 20_000,
  });

  await generate.click();
  await expect(page.getByText(ZERO_TOAST)).toBeVisible({ timeout: 30_000 });
  const afterSecond = invoiceCount();
  expect(afterSecond).toBe(afterFirst); // rerun created NOTHING new

  // ---- Manual invoice for هاشم (fresh — bulk generation never bills him) ----
  await page.getByRole('button', { name: 'فاتورة جديدة' }).click();
  const newInvoice = page.getByRole('dialog').filter({ hasText: 'فاتورة يدوية' });
  await newInvoice.getByRole('combobox', { name: 'الطالب' }).click();
  await page.getByRole('option', { name: HASHEM.name }).click();
  await newInvoice.locator('#invoice-amount').fill(AMOUNT_JOD);
  await newInvoice.locator('#invoice-description').fill(INVOICE_DESC);
  await newInvoice.getByRole('button', { name: 'إنشاء الفاتورة' }).click();
  await expect(page.getByText('تم إنشاء الفاتورة')).toBeVisible({
    timeout: 30_000,
  });
  expect(invoiceCount()).toBe(afterSecond + 1);

  // ---- Open its detail sheet (newest-first ⇒ first matching row) ----
  await page.getByPlaceholder('ابحث باسم الطالب…').fill(HASHEM.name);
  await page.getByRole('row').filter({ hasText: HASHEM.name }).first().click();
  const sheet = page.getByRole('dialog').filter({ hasText: 'تفاصيل الفاتورة' });
  await expect(sheet.getByText(INVOICE_DESC)).toBeVisible({ timeout: 30_000 });
  await expect(sheet.getByText('صادرة')).toBeVisible();
  await expect(sheet.getByText(AR.amount).first()).toBeVisible();

  // ---- FR-FIN-3: partial payment → مدفوعة جزئياً ----
  await sheet.getByRole('button', { name: 'تسجيل دفعة' }).click();
  const payDialog = page
    .getByRole('dialog')
    .filter({ hasText: 'سجّل دفعة مقبوضة' });
  // Prefilled with the full remaining balance; we pay part of it (cash).
  await expect(payDialog.locator('#payment-amount')).toHaveValue(AMOUNT_JOD);
  await payDialog.locator('#payment-amount').fill(PARTIAL_JOD);
  await payDialog.getByRole('button', { name: 'تسجيل الدفعة' }).click();
  await expect(page.getByText('تم تسجيل الدفعة')).toBeVisible({
    timeout: 30_000,
  });
  await expect(sheet.getByText('مدفوعة جزئياً')).toBeVisible();
  await expect(sheet.getByText(AR.remaining).first()).toBeVisible();

  // ---- Parent portal (FR-PAR-3): fresh code for a child WITH invoices ----
  const staff = await browser.newContext();
  const staffPage = await staff.newPage();
  await login(staffPage, ADMIN.email, ADMIN.password);
  await staffPage.goto(`/students/${HASHEM.id}`);
  const generateCode = staffPage.getByRole('button', {
    name: /إنشاء رمز|إعادة الإنشاء/,
  });
  await expect(generateCode).toBeVisible({ timeout: 45_000 });
  await generateCode.click();
  const rawCode = staffPage.getByTestId('raw-access-code');
  await expect(rawCode).toBeVisible({ timeout: 30_000 });
  const code = (await rawCode.textContent())!.trim();
  await staff.close();

  // Server truth: nonzero balance (closes the M2 balance>0 verification gap).
  const portalTruth = convexRun<PortalInvoices>('portal:invoices', { code });
  expect(portalTruth.totals.balanceFils).toBeGreaterThan(0);
  expect(portalTruth.invoices.length).toBeGreaterThan(0);

  const parent = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const portalPage = await parent.newPage();
  const portalErrors: string[] = [];
  portalPage.on('console', (msg) => {
    if (msg.type() === 'error') {
      portalErrors.push(`[console] ${portalPage.url()} :: ${msg.text()}`);
    }
  });
  portalPage.on('pageerror', (err) => {
    portalErrors.push(`[pageerror] ${portalPage.url()} :: ${err.message}`);
  });

  await portalPage.goto('/portal');
  await portalPage.locator('#portal-code').fill(code);
  await portalPage.getByRole('button', { name: 'دخول' }).click();
  await expect(
    portalPage.getByRole('heading', { name: HASHEM.name }),
  ).toBeVisible({ timeout: 30_000 });

  // Home shows a NONZERO balance card that deep-links to the payments tab.
  const balanceCard = portalPage
    .locator('a[href="/portal/payments"]')
    .filter({ hasText: 'المبلغ المستحق' });
  await expect(balanceCard).toBeVisible({ timeout: 30_000 });
  await expect(balanceCard).toContainText(
    arabicJod(portalTruth.totals.balanceFils),
  );
  // 5th bottom tab (FR-PAR-3).
  await expect(
    portalPage.getByRole('link', { name: 'المدفوعات' }),
  ).toBeVisible();

  await balanceCard.click();
  await portalPage.waitForURL('**/portal/payments');
  await expect(
    portalPage.getByRole('heading', { name: 'المدفوعات' }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(portalPage.getByText('الرصيد المستحق')).toBeVisible();

  // Our invoice card: amount / paid / remaining badge / payment row.
  const card = portalPage.locator('li').filter({ hasText: INVOICE_DESC }).first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card.getByText(/متبقٍ/)).toBeVisible();
  await expect(card.getByText(AR.remaining)).toBeVisible();
  await expect(card.getByText(AR.amount)).toBeVisible();
  await card.getByRole('button', { name: /عرض الدفعات/ }).click();
  await expect(card.getByText('نقداً')).toBeVisible();
  await expect(card.getByText(AR.partial).first()).toBeVisible();

  // Inbox renders the invoice notification as Arabic text (FR-NOT-2), not a
  // raw type — emitted by createManual above, so it exists on every run.
  await portalPage.getByRole('link', { name: 'الإشعارات' }).click();
  await expect(
    portalPage.getByText('صدرت فاتورة جديدة لطفلك').first(),
  ).toBeVisible({ timeout: 30_000 });

  expect(portalErrors).toEqual([]); // portal payments/inbox console clean
  await parent.close();

  // ---- Closing payment → مدفوعة, pay control gone ----
  await sheet.getByRole('button', { name: 'تسجيل دفعة' }).click();
  const payDialog2 = page
    .getByRole('dialog')
    .filter({ hasText: 'سجّل دفعة مقبوضة' });
  // Prefill = exact remaining fils rendered back as JOD text.
  await expect(payDialog2.locator('#payment-amount')).toHaveValue('25.000');
  await payDialog2.getByRole('button', { name: 'تسجيل الدفعة' }).click();
  await expect(page.getByText('تم تسجيل الدفعة').first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(sheet.getByText('مدفوعة', { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    sheet.getByRole('button', { name: 'تسجيل دفعة' }),
  ).toHaveCount(0);
  await expect(sheet.getByText(AR.zero).first()).toBeVisible(); // remaining 0
  await expect(sheet.getByRole('link', { name: 'إيصال' })).toHaveCount(2);

  // ---- Receipt (FR-FIN-3, §5): renders + prints clean ----
  await sheet.getByRole('link', { name: 'إيصال' }).first().click();
  await page.waitForURL('**/finance/receipt/**');
  await expect(
    page.getByRole('heading', { name: 'إيصال قبض' }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(HASHEM.name)).toBeVisible();
  await expect(page.getByText('المبلغ المقبوض')).toBeVisible();
  await expect(page.getByText('أُنشئ بواسطة حضانتي')).toBeVisible();
  await expectCleanPrint(page, 'إيصال قبض', 'receipt-print.png');

  // ---- Statement (FR-FIN-5, §5): running balance ends at exactly 0 ----
  await page.goto(`/finance/statement/${HASHEM.id}`);
  await expect(
    page.getByRole('heading', { name: 'كشف حساب' }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(HASHEM.name)).toBeVisible();
  await expect(
    page.getByRole('row').filter({ hasText: INVOICE_DESC }).first(),
  ).toBeVisible();
  // Last chronological line closes the chain at 0 …
  await expect(
    page.locator('tbody tr').last().locator('td').last(),
  ).toContainText(AR.zero);
  // … and the totals agree (invoiced == paid, balance 0).
  const balanceRow = page
    .locator('tfoot tr')
    .filter({ hasText: 'الرصيد المستحق' });
  await expect(balanceRow).toContainText(AR.zero);
  await expectCleanPrint(page, 'كشف حساب', 'statement-print.png');

  await acct.close();
});

test('FR-FIN-2/5: seeded overdue invoice surfaces in المتأخرة filter and the overview list', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await login(page, ACCOUNTANT.email, ACCOUNTANT.password);

  // المتأخرة filter tab → the seeded overdue 'رسوم أنشطة' for ليان.
  await page.goto('/finance/invoices');
  await page.getByRole('tab', { name: 'متأخرة' }).click();
  const row = page
    .getByRole('row')
    .filter({ hasText: LAYAN.name })
    .filter({ hasText: OVERDUE_INVOICE_DESC })
    .first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect(row.getByText('متأخرة', { exact: true })).toBeVisible();

  // Overview: stat cards + the same invoice in the overdue list with a
  // days-late badge.
  await page.goto('/finance');
  await expect(page.getByText('المحصّل هذا الشهر')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('المستحق غير المدفوع')).toBeVisible();
  await expect(page.getByText('المتأخرات')).toBeVisible();
  await expect(page.getByText('مصاريف الشهر')).toBeVisible();
  await expect(page.getByText('الفواتير المتأخرة')).toBeVisible();
  const overdueRow = page
    .getByRole('row')
    .filter({ hasText: LAYAN.name })
    .first();
  await expect(overdueRow).toBeVisible({ timeout: 30_000 });
  await expect(overdueRow.getByText(/متأخرة/)).toBeVisible();
});

test('PRD §6: teacher has no finance nav and /finance is gated', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await login(page, TEACHER.email, TEACHER.password);

  // Sidebar fully resolved (a teacher-visible role-gated item is present)…
  await expect(
    page.locator('aside').getByRole('link', { name: 'الإعلانات' }),
  ).toBeVisible({ timeout: 30_000 });
  // …and المالية is NOT offered.
  await expect(
    page.locator('aside').getByRole('link', { name: 'المالية' }),
  ).toHaveCount(0);

  // Direct navigation hits the friendly gate, never the money desk.
  await page.goto('/finance');
  await expect(page.getByText('غير مصرّح')).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByText('هذه الصفحة متاحة للمدير والمحاسب فقط'),
  ).toBeVisible();
  await expect(page.getByText('المحصّل هذا الشهر')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'إصدار فواتير الشهر' }),
  ).toHaveCount(0);
});

test('FR-FIN-6: finance write controls disable offline with the explicit Arabic message', async ({
  context,
  page,
}) => {
  test.setTimeout(180_000);
  await login(page, ACCOUNTANT.email, ACCOUNTANT.password);
  await page.goto('/finance');
  await expect(page.getByText('المحصّل هذا الشهر')).toBeVisible({
    timeout: 30_000,
  });

  const newInvoice = page.getByRole('button', { name: 'فاتورة جديدة' });
  const generate = page.getByRole('button', { name: 'إصدار فواتير الشهر' });
  await expect(newInvoice).toBeEnabled();
  await expect(generate).toBeEnabled();
  await expect(page.getByTestId('finance-offline')).toHaveCount(0);

  await context.setOffline(true);
  await expect(newInvoice).toBeDisabled();
  await expect(generate).toBeDisabled();
  const note = page.getByTestId('finance-offline').first();
  await expect(note).toBeVisible();
  await expect(note).toHaveText(OFFLINE_MSG);
  await context.setOffline(false);

  // Back online → controls re-enable, message clears.
  await expect(newInvoice).toBeEnabled();
  await expect(page.getByTestId('finance-offline')).toHaveCount(0);
});
