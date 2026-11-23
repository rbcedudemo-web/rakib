import { toBanglaDigits } from "@rupshi/shared";
import { requireRole } from "@/lib/auth/guards";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";

export const metadata = { title: "Teacher" };

interface Row {
  subject: { id: string; name_bn: string; name_en: string; class_id: number; version: string } | null;
}

export default async function TeacherHome() {
  const { profile } = await requireRole("teacher");
  const { t, locale } = await getT();
  const supabase = await createClient();
  const { data } = await supabase
    .from("teacher_subjects")
    .select("subject:subjects(id, name_bn, name_en, class_id, version)")
    .eq("teacher_id", profile.id)
    .returns<Row[]>();
  const subjects = (data ?? []).flatMap((r) => (r.subject ? [r.subject] : []));

  return (
    <main className="page py-8">
      <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">{t("teacher.title")}</h1>
      <p className="mt-1 text-neutral-600">{profile.full_name}</p>
      <h2 className="mb-3 mt-8 text-xl font-bold text-neutral-900">{t("teacher.subjects")}</h2>
      {subjects.length === 0 ? (
        <Card>{t("teacher.none")}</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s) => (
            <Card key={s.id}>
              <div className="text-xs font-semibold text-primary-700">
                {t("class.label")} {locale === "bn" ? toBanglaDigits(s.class_id) : s.class_id} ·{" "}
                {t(`version.${s.version as "bangla"}`)}
              </div>
              <div className="mt-1 text-lg font-semibold">{locale === "bn" ? s.name_bn : s.name_en}</div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
