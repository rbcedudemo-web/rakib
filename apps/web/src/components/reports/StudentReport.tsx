import Link from "next/link";
import { toBanglaDigits } from "@rupshi/shared";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { scoreText } from "@/lib/exam";
import type { MyReportRow } from "@/lib/marking/types";
import { cn } from "@/lib/cn";
import { Badge, Card } from "@/components/ui";

/** A student's own results: totals, then one card per lesson grouped by subject. */
export async function StudentReport() {
  const { t, locale } = await getT();
  const num = (n: number | string) => (locale === "bn" ? toBanglaDigits(n) : String(n));
  const date = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" });
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_report");
  const rows = (data ?? []) as MyReportRow[];

  const attempts = rows.reduce((s, r) => s + Number(r.attempts), 0);
  const pcts = rows.map((r) => r.best_percent).filter((p): p is number => p !== null);
  const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + Number(b), 0) / pcts.length) : null;
  const subjects = [...new Map(rows.map((r) => [r.subject_id, r])).values()];

  return (
    <main className="page max-w-4xl space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">{t("report.title")}</h1>
        <p className="mt-1 text-sm text-neutral-600">{t("report.note")}</p>
      </div>
      {rows.length === 0 ? (
        <Card className="text-neutral-600">{t("report.empty")}</Card>
      ) : (
        <>
          <section className="grid grid-cols-3 gap-3">
            {[
              { k: "report.lessonsTaken" as const, v: num(rows.length) },
              { k: "report.attempts" as const, v: num(attempts) },
              { k: "report.average" as const, v: avg === null ? "–" : `${num(avg)}%` },
            ].map((s) => (
              <Card key={s.k} className="p-4 text-center">
                <div className="text-2xl font-bold text-primary-700 sm:text-3xl">{s.v}</div>
                <div className="mt-1 text-xs text-neutral-600 sm:text-sm">{t(s.k)}</div>
              </Card>
            ))}
          </section>
          {subjects.map((s) => (
            <section key={s.subject_id} className="space-y-2">
              <h2 className="text-lg font-bold text-neutral-900">{locale === "bn" ? s.subject_bn : s.subject_en}</h2>
              <ul className="space-y-2">
                {rows.filter((r) => r.subject_id === s.subject_id).map((r) => {
                  const p = r.best_percent;
                  const tone = p === null ? "bg-neutral-300" : p >= 80 ? "bg-primary-600" : p >= 50 ? "bg-highlight-500" : "bg-accent-600";
                  return (
                    <li key={r.lesson_id}>
                      <Link href={`/learn/${r.subject_id}/${r.lesson_id}/exam/${r.last_attempt}`}
                        className="block rounded-card border border-neutral-200 bg-white p-4 shadow-sm transition-colors hover:border-primary-600">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-neutral-900">{num(r.sequence)}. {r.lesson_title}</span>
                          <span className="font-bold tabular-nums text-neutral-900">
                            {num(scoreText(r.best_score))} / {num(scoreText(r.best_max))}
                            {p !== null && <span className="ml-1 text-sm font-semibold text-neutral-500">({num(p)}%)</span>}
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100" aria-hidden="true">
                          <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.max(0, Math.min(100, p ?? 0))}%` }} />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                          <span>{t("report.col.attempts")}: {num(r.attempts)}</span>
                          <span>· {t("report.col.last")}: {date.format(new Date(r.last_at))}</span>
                          {r.pending && <Badge tone="amber">{t("report.pending")}</Badge>}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </main>
  );
}
