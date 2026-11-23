import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n-server";
import { isSupabaseConfigured } from "@/lib/env";
import { getSession, homePathFor } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { AdminLoginForm } from "./AdminLoginForm";

export const metadata = { title: "Admin login", robots: { index: false } };

export default async function AdminLoginPage() {
  const session = await getSession();
  if (session) redirect(homePathFor(session.profile));
  const { t } = await getT();
  return (
    <main className="page flex justify-center py-10 sm:py-16">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <h1 className="mb-6 text-2xl font-bold text-neutral-900">{t("login.admin.title")}</h1>
        <AdminLoginForm configured={isSupabaseConfigured} />
      </Card>
    </main>
  );
}
