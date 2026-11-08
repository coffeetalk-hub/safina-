import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import localFont from "next/font/local";
import { routing, dirOf } from "@/i18n/routing";
import { ToastProvider } from "@/components/ui/toast";
import "../globals.css";

// Local fonts (no network needed at build). IBM Plex Sans Arabic covers Arabic + Latin.
const arabic = localFont({
  src: [
    { path: "../../../public/fonts/IBMPlexSansArabic-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../../public/fonts/IBMPlexSansArabic-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Safina ERP", template: "%s · Safina ERP" },
  description: "Safina ERP — The Sailors",
};

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <html lang={locale} dir={dirOf(locale)} className={arabic.variable} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <NextIntlClientProvider>
          <ToastProvider>{children}</ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
