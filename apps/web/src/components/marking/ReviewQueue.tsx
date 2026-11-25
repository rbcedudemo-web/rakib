import Link from "next/link";
import { toBanglaDigits } from "@rupshi/shared";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { scoreText } from "@/lib/exam";
import type { MarkingItem } from "@/lib/marking/types";
import { cn } from "@/lib/cn";
import { Badge, Card } from "@/components/ui";
import { MarkForm } from "./MarkForm";

/** The "review scripts" page body, shared by /admin/marking and /teacher/review. */
export async function ReviewQueue({ basePath, tab }: { basePath: string; tab: "pending" | "marked" }) {
  const { t, locale } = await getT();
  const num = (n: number | string) => (locale === "bn" ? toBanglaDigits(n) : String(n));
  const date = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" });
  const supabase = await createClient();
  const [{ data }, { data: count }] = await Promise.all([
    supabase.rpc("marking_queue", { p_status: tab, p_limit: 50 }),
    supabase.rpc("marking_pending_count"),
  ]);
  const items = (data ?? []) as MarkingItem[];
  const paths = items.flatMap((i) => i.images);
  const { data: signed } = paths.length
    ? await supabase.storage.from("answer-sheets").createSignedUrls(paths, 3600)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const photo = new Map<string, string>();
  for (const s of signed ?? []) if (s.path && s.signedUrl) photo.set(s.path, s.signedUrl);

  const tabClass = (on: boolean) => cn("inline-flex min-h-11 items-center rounded-[10px] px-4 text-sm font-semibold",
    on ? "bg-primary-600 text-white" : "border border-neutral-300 bg-white text-neutral-700 hover:bg-primary-50");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">{t("marking.title")}</h1>
        <p className="mt-1 max-w-3xl text-sm text-neutral-600">{t("marking.note")}</p>
      </div>
      <nav className="flex flex-wrap gap-2" aria-label={t("marking.title")}>
        <Link href={basePath} className={tabClass(tab === "pending")} aria-current={tab === "pending" ? "page" : undefined}>
          {t("marking.tab.pending", { n: num(Number(count ?? 0)) })}
        </Link>
        <Link href={`${basePath}?tab=marked`} className={tabClass(tab === "marked")} aria-current={tab === "marked" ? "page" : undefined}>
          {t("marking.tab.marked")}
        </Link>
      </nav>

      {items.length === 0 ? (
        <Card className="text-neutral-600">{t(tab === "pending" ? "marking.empty.pending" : "marking.empty.marked")}</Card>
      ) : (
        <ul className="space-y-4">
          {items.map((i) => (
            <li key={i.answer_id}>
              <Card className={cn("space-y-3 border-l-4", tab === "pending" ? "border-l-highlight-500" : "border-l-primary-600")}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-primary-700">
                      {t("class.label")} {num(i.class_id)} · {locale === "bn" ? i.subject_bn : i.subject_en} · {i.lesson_title}
                    </p>
                    <p className="mt-0.5 font-semibold text-neutral-900">
                      {t("marking.student")}: {i.student_name ?? "—"}
                      {i.student_code && <span className="ml-1 text-sm font-normal text-neutral-500">({i.student_code})</span>}
                    </p>
                    <p className="text-xs text-neutral-500">{date.format(new Date(i.submitted_at))}</p>
                  </div>
                  {tab === "marked" && i.marks_awarded !== null && (
                    <div className="text-right">
                      <p className="text-2xl font-bold tabular-nums text-primary-700">
                        {num(scoreText(Number(i.marks_awarded)))}<span className="text-base text-neutral-400"> / {num(scoreText(Number(i.max_marks)))}</span>
                      </p>
                      <Badge tone={i.marking_status === "ai" ? "amber" : "green"}>
                        {i.marking_status === "ai" ? t("marking.byAi") : t("marking.markedBy", { name: i.marked_by_name ?? "—" })}
                      </Badge>
                    </div>
                  )}
                </div>

                <p className="whitespace-pre-line font-semibold text-neutral-900">{i.prompt}</p>

                <div>
                  <p className="text-sm font-semibold text-neutral-700">{t("marking.photos")}</p>
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {i.images.map((p) => photo.get(p) && (
                      <li key={p}>
                        <a href={photo.get(p)} target="_blank" rel="noopener">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo.get(p)} alt="" className="h-44 w-36 rounded-lg border border-neutral-200 object-cover sm:h-56 sm:w-44" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                {i.model_answer && (
                  <details className="rounded-[10px] bg-primary-50 px-3 py-2 text-sm text-neutral-800" open={tab === "pending"}>
                    <summary className="cursor-pointer font-semibold">{t("marking.modelAnswer")}</summary>
                    <p className="mt-1 whitespace-pre-line">{i.model_answer}</p>
                    {i.rubric && <p className="mt-2 whitespace-pre-line"><span className="font-semibold">{t("marking.rubric")}:</span> {i.rubric}</p>}
                  </details>
                )}

                {tab === "marked" && i.feedback && (
                  <p className="rounded-[10px] bg-neutral-50 px-3 py-2 text-sm text-neutral-800">
                    <span className="font-semibold">{t("exam.result.feedback")}:</span> {i.feedback}
                  </p>
                )}

                {tab === "pending" ? (
                  <MarkForm answerId={i.answer_id} max={Number(i.max_marks)} current={null} feedback={null} isChange={false} />
                ) : (
                  <details>
                    <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-primary-700 hover:underline">{t("marking.change")}</summary>
                    <div className="mt-2">
                      <MarkForm answerId={i.answer_id} max={Number(i.max_marks)} current={i.marks_awarded === null ? null : Number(i.marks_awarded)}
                        feedback={i.feedback} isChange />
                    </div>
                  </details>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
