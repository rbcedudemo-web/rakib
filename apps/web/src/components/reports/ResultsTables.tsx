import Link from "next/link";
import { toBanglaDigits, type MessageKey } from "@rupshi/shared";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { scoreText } from "@/lib/exam";
import type { LessonResultRow, OverviewRow } from "@/lib/marking/types";
import { cn } from "@/lib/cn";
import { Badge, Card } from "@/components/ui";

const th = "px-4 py-3 font-semibold";
const td = "px-4 py-3";

function percentTone(p: number | null) {
  if (p === null) return "text-neutral-500";
  return p >= 80 ? "text-primary-700" : p >= 50 ? "text-[#7a5300]" : "text-accent-700";
}

/** Staff: one row per lesson with exams. basePath links each lesson to its student list. */
export async function ResultsOverview({ basePath, reviewPath }: { basePath: string; reviewPath: string }) {
  const { t, locale } = await getT();
  const num = (n: number | string) => (locale === "bn" ? toBanglaDigits(n) : String(n));
  const supabase = await createClient();
  const { data } = await supabase.rpc("results_overview", {});
  const rows = (data ?? []) as OverviewRow[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">{t("results.title")}</h1>
        <p className="mt-1 max-w-3xl text-sm text-neutral-600">{t("results.note")}</p>
      </div>
      {rows.length === 0 ? (
        <Card className="text-neutral-600">{t("results.empty")}</Card>
      ) : (
        <div className="overflow-x-auto rounded-card border border-neutral-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className={th}>{t("report.col.lesson")}</th>
                <th className={th}>{t("report.col.students")}</th>
                <th className={th}>{t("report.col.attempts")}</th>
                <th className={th}>{t("report.col.average")}</th>
                <th className={th}>{t("report.col.waiting")}</th>
                <th className={th}><span className="sr-only">{t("report.view")}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r) => (
                <tr key={r.lesson_id}>
                  <td className={td}>
                    <div className="text-xs font-semibold text-primary-700">
                      {t("class.label")} {num(r.class_id)} · {t(`version.${r.version}` as MessageKey)} · {locale === "bn" ? r.subject_bn : r.subject_en}
                    </div>
                    <div className="font-semibold text-neutral-900">{num(r.sequence)}. {r.lesson_title}</div>
                  </td>
                  <td className={cn(td, "tabular-nums")}>{num(r.students)}</td>
                  <td className={cn(td, "tabular-nums")}>{num(r.attempts)}</td>
                  <td className={cn(td, "font-bold tabular-nums", percentTone(r.avg_best_percent))}>
                    {r.avg_best_percent === null ? "–" : `${num(r.avg_best_percent)}%`}
                  </td>
                  <td className={td}>
                    {r.pending > 0 ? <Link href={reviewPath} className="hover:underline"><Badge tone="amber">{num(r.pending)}</Badge></Link> : <span className="text-neutral-400">–</span>}
                  </td>
                  <td className={td}>
                    <Link href={`${basePath}/${r.lesson_id}`} className="inline-flex min-h-11 items-center font-semibold text-primary-700 hover:underline">{t("report.view")}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Staff: every student of one lesson, best first. */
export async function LessonResults({ lessonId, backPath }: { lessonId: string; backPath: string }) {
  const { t, locale } = await getT();
  const num = (n: number | string) => (locale === "bn" ? toBanglaDigits(n) : String(n));
  const date = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" });
  const supabase = await createClient();
  const [{ data, error }, { data: lesson }] = await Promise.all([
    supabase.rpc("lesson_results", { p_lesson_id: lessonId }),
    supabase.from("lessons").select("title, subject_id, subjects(name_bn, name_en)").eq("id", lessonId)
      .maybeSingle<{ title: string; subject_id: string; subjects: { name_bn: string; name_en: string } | null }>(),
  ]);
  if (error || !lesson) return null;
  const rows = (data ?? []) as LessonResultRow[];

  return (
    <div className="space-y-5">
      <div>
        <Link href={backPath} className="text-sm font-semibold text-primary-700 hover:underline">{t("results.back")}</Link>
        <h1 className="mt-1 text-2xl font-bold text-neutral-900 sm:text-3xl">{t("results.lessonTitle")}: {lesson.title}</h1>
        {lesson.subjects && <p className="text-sm text-neutral-600">{locale === "bn" ? lesson.subjects.name_bn : lesson.subjects.name_en}</p>}
      </div>
      {rows.length === 0 ? (
        <Card className="text-neutral-600">{t("results.empty")}</Card>
      ) : (
        <div className="overflow-x-auto rounded-card border border-neutral-200 bg-white">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className={th}>{t("report.col.student")}</th>
                <th className={th}>{t("report.col.best")}</th>
                <th className={th}>{t("report.col.attempts")}</th>
                <th className={th}>{t("report.col.last")}</th>
                <th className={th}><span className="sr-only">{t("report.openResult")}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r) => (
                <tr key={r.student_id}>
                  <td className={td}>
                    <div className="font-semibold text-neutral-900">{r.student_name ?? "—"}</div>
                    {r.student_code && <div className="text-xs text-neutral-500">{r.student_code}</div>}
                  </td>
                  <td className={td}>
                    <span className={cn("font-bold tabular-nums", percentTone(r.best_percent))}>
                      {num(scoreText(r.best_score))} / {num(scoreText(r.best_max))}
                    </span>
                    {r.best_percent !== null && <span className="ml-1 text-xs text-neutral-500">({num(r.best_percent)}%)</span>}
                    {r.pending && <div className="mt-1"><Badge tone="amber">{t("report.pending")}</Badge></div>}
                  </td>
                  <td className={cn(td, "tabular-nums")}>{num(r.attempts)}</td>
                  <td className={td}>{date.format(new Date(r.last_at))}</td>
                  <td className={td}>
                    <Link href={`/learn/${lesson.subject_id}/${lessonId}/exam/${r.best_attempt}`}
                      className="inline-flex min-h-11 items-center font-semibold text-primary-700 hover:underline">{t("report.openResult")}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
