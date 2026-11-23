import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n-server";
import { getSession, homePathFor } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { OnboardingForm } from "./OnboardingForm";

export const metadata = { title: "Enrolment" };

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.profile.role !== "student" || session.profile.enrolled_at) redirect(homePathFor(session.profile));
  const { t } = await getT();
  return (
    <main className="page flex justify-center py-10">
      <Card className="w-full max-w-xl p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-neutral-900">{t("onboard.title")}</h1>
        <p className="mb-6 mt-1 text-neutral-600">{t("onboard.subtitle")}</p>
        <OnboardingForm defaultName={session.profile.full_name ?? undefined} />
      </Card>
    </main>
  );
}
