import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isUuid, optionLetter, toBanglaDigits } from "@rupshi/shared";
import { createClient, getSession } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { scoreText, type ExamAttemptView, type ExamStatus } from "@/lib/exam";

export const metadata = { title: "Exam result" };


export default async function ExamResultPage({ params }: { params: Promise<{ subjectId: string; lessonId: string; attemptId: string }> }) {
  const { subjectId, lessonId, attemptId } = await params;
  if (![subjectId, lessonId, attemptId].every(isUuid)) notFound();
  const session = await getSession();
  if (!session) redirect("/login");

  const { t, locale } = await getT();
  const num = (n: number | string) => (locale === "bn" ? toBanglaDigits(n) : String(n));
  const lessonHref = `/learn/${subjectId}/${lessonId}`;
  const examHref = `${lessonHref}/exam`;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("exam_attempt_view", { p_attempt_id: attemptId });
  if (error || !data) notFound();
  const view = data as ExamAttemptView;
  if (view.lesson_id !== lessonId) notFound();
  if (view.status === "in_progress") redirect(examHref);

  const [{ data: lesson }, { data: statusData }] = await Promise.all([
    supabase.from("lessons").select("title").eq("id", lessonId).maybeSingle(),
    session.profile.role === "student" ? supabase.rpc("exam_status", { p_lesson_id: lessonId }) : Promise.resolve({ data: null }),
  ]);
  const status = statusData as ExamStatus | null;
  const attemptsLeft = status ? status.attempts_limit - status.attempts_used : 0;

  // photos of written answers
  const paths = view.questions.flatMap((q) => q.images ?? []);
  const { data: signed } = paths.length
    ? await supabase.storage.from("answer-sheets").createSignedUrls(paths, 3600)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const photo = new Map<string, string>();
  for (const s of signed ?? []) if (s.path && s.signedUrl) photo.set(s.path, s.signedUrl);

  const mcqs = view.questions.filter((q) => q.type === "mcq");
  const right = mcqs.filter((q) => q.is_correct).length;
  const skipped = mcqs.filter((q) => q.selected === null).length;
  const wrong = mcqs.length - right - skipped;
  const pending = view.questions.some((q) => q.marking_status === "pending_teacher");
  const score = Number(view.score ?? 0);
  const max = Number(view.max_score);
  const percent = max > 0 ? Math.round((score / max) * 100) : 0;
  const tone = percent >= 80 ? "text-primary-700" : percent >= 50 ? "text-[#7a5300]" : "text-accent-700";

  return (
    <main className="page max-w-3xl space-y-5 py-6">
      <div>
        <Link href={lessonHref} className="text-sm font-semibold text-primary-700 hover:underline">{t("exam.result.back")}</Link>
        <h1 className="mt-1 text-2xl font-bold text-neutral-900 sm:text-3xl">{t("exam.result.title")}: {lesson?.title}</h1>
        <p className="text-sm text-neutral-500">{t("exam.history.row", {
          date: new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "long", timeZone: "Asia/Dhaka" })
            .format(new Date(`${view.attempt_date}T12:00:00+06:00`)),
          no: num(view.attempt_no),
        })}</p>
      </div>

      <Card className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm font-semibold text-neutral-600">{t("exam.result.score")}</p>
        <p className={cn("text-5xl font-bold tabular-nums", tone)}>
          {num(scoreText(score))}<span className="text-2xl text-neutral-400"> / {num(scoreText(max))}</span>
        </p>
        <p className={cn("text-lg font-bold", tone)}>{t("exam.result.percent", { p: num(percent) })}</p>
        {mcqs.length > 0 && (
          <p className="text-sm text-neutral-700">
            {t("exam.result.mcqSummary", { right: num(right), wrong: num(wrong), skipped: num(skipped) })}
          </p>
        )}
        {pending && <p className="rounded-[10px] bg-highlight-100 px-3 py-1.5 text-sm text-[#7a5300]">{t("exam.result.pending")}</p>}
        {view.status === "expired" && <p className="text-sm text-neutral-600">{t("exam.result.expired")}</p>}
        {status?.best_score !== null && status?.best_score !== undefined && (
          <p className="text-sm font-semibold text-primary-700">
            {t("exam.best", { score: num(scoreText(status.best_score)), max: num(scoreText(status.best_max_score)) })}
          </p>
        )}
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {status && attemptsLeft > 0 && <ButtonLink href={examHref}>{t("exam.result.again")}</ButtonLink>}
          <ButtonLink href={lessonHref} variant="secondary">{t("exam.result.back")}</ButtonLink>
        </div>
        {status && (
          <p className="text-xs text-neutral-500">
            {attemptsLeft > 0
              ? t("exam.attemptsLeft", { n: num(attemptsLeft), limit: num(status.attempts_limit) })
              : t("exam.noAttempts", { limit: num(status.attempts_limit) })}
          </p>
        )}
      </Card>

      <h2 className="text-xl font-bold text-neutral-900">{t("exam.result.corrections")}</h2>
      <ol className="space-y-4">
        {view.questions.map((q) => {
          const isPending = q.marking_status === "pending_teacher";
          const unanswered = q.type === "mcq" ? q.selected === null : (q.images?.length ?? 0) === 0;
          const badge = isPending
            ? <Badge tone="amber">{t("exam.result.pendingMark")}</Badge>
            : unanswered
              ? <Badge tone="gray">{t("exam.result.skipped")}</Badge>
              : q.is_correct
                ? <Badge tone="green">{t("exam.result.correct")}</Badge>
                : q.type === "mcq"
                  ? <Badge tone="red">{t("exam.result.wrong")}</Badge>
                  : null;
          return (
            <li key={q.id}>
              <Card className={cn("space-y-3 border-l-4",
                isPending ? "border-l-highlight-500" : q.is_correct ? "border-l-primary-600" : unanswered ? "border-l-neutral-300" : "border-l-accent-600")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold text-primary-700">{t("exam.question", { n: num(q.n) })}</span>
                  <span className="flex items-center gap-2">
                    {badge}
                    <span className="text-sm font-semibold text-neutral-700">
                      {isPending ? "–" : num(scoreText(q.marks_awarded ?? 0))} / {num(scoreText(q.marks))}
                    </span>
                  </span>
                </div>
                <p className="whitespace-pre-line font-semibold text-neutral-900">{q.prompt}</p>

                {q.type === "mcq" && q.options && (
                  <ul className="grid gap-1.5">
                    {q.options.map((o, i) => {
                      const isRight = i === q.correct;
                      const isMine = i === q.selected;
                      return (
                        <li key={i} className={cn("flex items-center gap-2 rounded-[10px] border px-3 py-2 text-sm",
                          isRight ? "border-primary-600 bg-primary-50 font-semibold text-primary-800"
                            : isMine ? "border-accent-600 bg-accent-50 text-accent-700 line-through decoration-1"
                              : "border-neutral-200 text-neutral-600")}>
                          <span className="font-bold">{optionLetter(i, q.lang)}.</span>
                          <span className="flex-1">{o}</span>
                          {isMine && <span className="text-xs font-semibold no-underline">{t("exam.result.yourAnswer")}</span>}
                          {isRight && <span aria-label={t("exam.result.rightAnswer")}>✓</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {q.type === "written" && (q.images?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-neutral-700">{t("exam.result.yourPhotos")}</p>
                    <ul className="mt-1 flex flex-wrap gap-2">
                      {q.images.map((p) => photo.get(p) && (
                        <li key={p}>
                          <a href={photo.get(p)} target="_blank" rel="noopener">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo.get(p)} alt="" className="h-28 w-24 rounded-lg border border-neutral-200 object-cover" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {q.feedback && (
                  <p className="rounded-[10px] bg-neutral-50 px-3 py-2 text-sm text-neutral-800">
                    <span className="font-semibold">{t("exam.result.feedback")}:</span> {q.feedback}
                  </p>
                )}
                {q.model_answer && (
                  <p className="whitespace-pre-line rounded-[10px] bg-primary-50 px-3 py-2 text-sm text-neutral-800">
                    <span className="font-semibold">{t("exam.result.modelAnswer")}:</span> {q.model_answer}
                  </p>
                )}
                {q.explanation && (
                  <p className="whitespace-pre-line text-sm text-neutral-700">
                    <span className="font-semibold">💡 {t("exam.result.explanation")}:</span> {q.explanation}
                  </p>
                )}
              </Card>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
