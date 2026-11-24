import { toBanglaDigits, type MessageKey } from "@rupshi/shared";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink, Card } from "@/components/ui";

export const metadata = { title: "Admin" };

export default async function AdminHome() {
  const { t, locale } = await getT();
  const supabase = await createClient();
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const head = { count: "exact" as const, head: true };
  const [students, teachers, subjects, lessons] = await Promise.all([
    count(supabase.from("profiles").select("id", head).eq("role", "student")),
    count(supabase.from("profiles").select("id", head).eq("role", "teacher")),
    count(supabase.from("subjects").select("id", head).eq("is_active", true)),
    count(supabase.from("lessons").select("id", head)),
  ]);
  const stats: { key: MessageKey; value: number }[] = [
    { key: "admin.stat.students", value: students },
    { key: "admin.stat.teachers", value: teachers },
    { key: "admin.stat.subjects", value: subjects },
    { key: "admin.stat.lessons", value: lessons },
  ];
  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">{t("admin.title")}</h1>
        <ButtonLink href="/admin/lessons/new">{t("admin.lessons.new")}</ButtonLink>
      </div>
      <section className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.key}>
            <div className="text-sm text-neutral-600">{t(s.key)}</div>
            <div className="mt-1 text-3xl font-bold text-primary-700">{locale === "bn" ? toBanglaDigits(s.value) : s.value}</div>
          </Card>
        ))}
      </section>
      <p className="mt-6 text-sm text-neutral-500">{t("admin.more")}</p>
    </main>
  );
}
