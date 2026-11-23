import type { Metadata, Viewport } from "next";
import "@fontsource/hind-siliguri/400.css";
import "@fontsource/hind-siliguri/500.css";
import "@fontsource/hind-siliguri/600.css";
import "@fontsource/hind-siliguri/700.css";
import "./globals.css";
import { translate } from "@rupshi/shared";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { LocaleProvider } from "@/lib/i18n-client";
import { getLocale } from "@/lib/i18n-server";
import { getSession } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: { default: translate(locale, "app.name"), template: `%s · ${translate(locale, "app.org")}` },
    description: translate(locale, "app.tagline"),
  };
}

export const viewport: Viewport = { themeColor: "#006a4e", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const session = await getSession();
  const user = session
    ? {
        name: session.profile.full_name || session.profile.email || session.profile.phone || "",
        role: session.profile.role,
        avatarUrl: session.profile.avatar_url ?? undefined,
        detail: session.profile.student_code ?? undefined,
      }
    : null;
  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col font-sans">
        <LocaleProvider locale={locale}>
          <Header user={user} />
          <div className="flex-1">{children}</div>
          <Footer />
        </LocaleProvider>
      </body>
    </html>
  );
}
