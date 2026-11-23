import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n-server";
import { isSupabaseConfigured } from "@/lib/env";
import { getSession, homePathFor } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Login" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(homePathFor(session.profile));
  const { t } = await getT();
  return (
    <main className="page flex justify-center py-10 sm:py-16">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-neutral-900">{t("login.title")}</h1>
        <p className="mb-6 mt-1 text-neutral-600">{t("login.subtitle")}</p>
        <LoginForm configured={isSupabaseConfigured} />
      </Card>
    </main>
  );
}
