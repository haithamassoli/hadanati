import type { Metadata } from "next";
import { Baloo_Bhaijaan_2, IBM_Plex_Sans_Arabic } from "next/font/google";
import { cookies } from "next/headers";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { LocaleProvider, type Locale } from "@/lib/i18n";
import "./globals.css";

const siteUrl =
  process.env.SITE_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://hadanati.app");
const siteName = "حضانتي | Hadanati";
const siteDescription =
  "منصة عربية لإدارة الحضور، التقييمات، الرسوم، وبوابة أولياء الأمور للحضانات في الأردن.";
const socialImage = {
  url: "/opengraph-image.png",
  width: 1200,
  height: 630,
  alt: "حضانتي - منصة إدارة الحضانات في الأردن",
};

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
  metadataBase: new URL(siteUrl),
  title: siteName,
  description: siteDescription,
  applicationName: "Hadanati",
  keywords: [
    "حضانتي",
    "Hadanati",
    "إدارة الحضانات",
    "nursery management Jordan",
    "حضور الطلاب",
    "بوابة أولياء الأمور",
  ],
  authors: [{ name: "Hadanati" }],
  creator: "Hadanati",
  publisher: "Hadanati",
  category: "education",
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "حضانتي",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: siteName,
    description: siteDescription,
    url: "/",
    siteName,
    locale: "ar_JO",
    alternateLocale: ["en_US"],
    type: "website",
    images: [socialImage],
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
    images: [socialImage],
  },
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
