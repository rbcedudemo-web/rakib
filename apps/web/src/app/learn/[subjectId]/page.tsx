import { notFound, redirect } from "next/navigation";
import { isUuid } from "@rupshi/shared";
import { getSession, homePathFor } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { ButtonLink, Card } from "@/components/ui";

interface ListRow { id: string; is_unlocked: boolean; is_completed: boolean }

/** Opens the lesson the student should watch next. */
export default async function SubjectEntry({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params;
  if (!isUuid(subjectId)) notFound();
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.profile.role === "student" && !session.profile.enrolled_at) redirect(homePathFor(session.profile));

  const supabase = await createClient();
  const { data } = await supabase.rpc("subject_lessons", { p_subject_id: subjectId });
  const list = (data ?? []) as ListRow[];
  const target = list.find((l) => l.is_unlocked && !l.is_completed) ?? [...list].reverse().find((l) => l.is_unlocked);
  if (target) redirect(`/learn/${subjectId}/${target.id}`);

  const { t } = await getT();
  return (
    <main className="page py-10">
      <Card className="mx-auto max-w-lg text-center">
        <p className="text-neutral-700">{t("learn.noLessons")}</p>
        <ButtonLink href={homePathFor(session.profile)} variant="secondary" className="mt-4">{t("learn.back")}</ButtonLink>
      </Card>
    </main>
  );
}
