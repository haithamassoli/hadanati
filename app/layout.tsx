import type { Metadata } from "next";
import { Baloo_Bhaijaan_2, IBM_Plex_Sans_Arabic } from "next/font/google";
import { cookies } from "next/headers";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { LocaleProvider, type Locale } from "@/lib/i18n";
import "./globals.css";

const heading = Baloo_Bhaijaan_2({
  variable: "--font-heading",
  subsets: ["arabic", "latin"],
});

const sans = IBM_Plex_Sans_Arabic({
  variable: "--font-sans",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "حضانتي",
  description: "نظام إدارة الحضانات في الأردن",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale: Locale = cookieStore.get("locale")?.value === "en" ? "en" : "ar";
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${heading.variable} ${sans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <LocaleProvider locale={locale}>
            {children}
            {/* Toasts are screen chrome — never on printed documents (§5). */}
            <div data-print-hidden>
              <Toaster richColors position="top-center" dir={dir} />
            </div>
          </LocaleProvider>
        </Providers>
      </body>
    </html>
  );
}
