import { toBanglaDigits, type MessageKey } from "@rupshi/shared";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Badge, ButtonLink, Card } from "@/components/ui";

export const metadata = { title: "Admin" };

export default async function AdminHome() {
  const { t, locale } = await getT();
  const supabase = await createClient();
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const head = { count: "exact" as const, head: true };
  const [students, teachers, subjects, lessons, waiting] = await Promise.all([
    count(supabase.from("profiles").select("id", head).eq("role", "student")),
    count(supabase.from("profiles").select("id", head).eq("role", "teacher")),
    count(supabase.from("subjects").select("id", head).eq("is_active", true)),
    count(supabase.from("lessons").select("id", head)),
    supabase.rpc("marking_pending_count").then((r) => Number(r.data ?? 0)),
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
      <section className="mt-4 grid gap-4 sm:grid-cols-2">
        <Link href="/admin/marking" className="rounded-card border border-neutral-200 bg-white p-5 shadow-sm transition-colors hover:border-primary-600">
          <div className="flex items-center justify-between gap-2">
            <span className="text-lg font-semibold text-neutral-900">{t("marking.title")}</span>
            {waiting > 0 && <Badge tone="amber">{t("teacher.waiting", { n: locale === "bn" ? toBanglaDigits(waiting) : waiting })}</Badge>}
          </div>
          <p className="mt-1 text-sm text-neutral-600">{t("teacher.reviewNote")}</p>
        </Link>
        <Link href="/admin/results" className="rounded-card border border-neutral-200 bg-white p-5 shadow-sm transition-colors hover:border-primary-600">
          <span className="text-lg font-semibold text-neutral-900">{t("results.title")}</span>
          <p className="mt-1 text-sm text-neutral-600">{t("teacher.resultsNote")}</p>
        </Link>
      </section>
      <p className="mt-6 text-sm text-neutral-500">{t("admin.more")}</p>
    </main>
  );
}
