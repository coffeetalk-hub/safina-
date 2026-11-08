import { setRequestLocale } from "next-intl/server";
import { ToastProvider } from "@/components/ui/toast";

export default async function PortalLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ToastProvider><div className="min-h-screen bg-muted/30">{children}</div></ToastProvider>;
}
