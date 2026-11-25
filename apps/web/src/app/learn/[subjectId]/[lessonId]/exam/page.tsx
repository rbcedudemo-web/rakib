import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isUuid, toBanglaDigits } from "@rupshi/shared";
import { createClient, getSession, homePathFor } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { Card } from "@/components/ui";
import { examSize, scoreText, type ExamAttemptView, type ExamStatus } from "@/lib/exam";
import { ExamRunner } from "./ExamRunner";
import { StartExam } from "./StartExam";

export const metadata = { title: "Exam" };

export default async function ExamPage({ params }: { params: Promise<{ subjectId: string; lessonId: string }> }) {
  const { subjectId, lessonId } = await params;
  if (!isUuid(subjectId) || !isUuid(lessonId)) notFound();
  const session = await getSession();
  if (!session) redirect("/login");
  const { profile } = session;
  if (profile.role === "student" && !profile.enrolled_at) redirect(homePathFor(profile));

  const { t, locale } = await getT();
  const num = (n: number | string) => (locale === "bn" ? toBanglaDigits(n) : String(n));
  const lessonHref = `/learn/${subjectId}/${lessonId}`;
  const supabase = await createClient();

  const { data: lesson } = await supabase.from("lessons").select("id, title").eq("id", lessonId).eq("subject_id", subjectId).maybeSingle();
  if (!lesson) notFound();
  const { data: statusData, error } = await supabase.rpc("exam_status", { p_lesson_id: lessonId });
  if (error || !statusData) redirect(lessonHref); // locked lesson
  const status = statusData as ExamStatus;

  const header = (
    <div className="mb-4">
      <Link href={lessonHref} className="text-sm font-semibold text-primary-700 hover:underline">{t("exam.result.back")}</Link>
      <h1 className="mt-1 text-2xl font-bold text-neutral-900 sm:text-3xl">📝 {t("exam.title")}: {lesson.title}</h1>
    </div>
  );

  if (profile.role !== "student") {
    return (
      <main className="page max-w-3xl py-6">
        {header}
        <Card className="bg-highlight-100 text-[#7a5300]">{t("exam.staff")}</Card>
      </main>
    );
  }

  // a running exam continues where the student left it
  if (status.open_attempt_id) {
    const { data: view } = await supabase.rpc("exam_attempt_view", { p_attempt_id: status.open_attempt_id });
    if (view && (view as ExamAttemptView).status === "in_progress") {
      return (
        <main className="page max-w-3xl py-6">
          {header}
          <ExamRunner initial={view as ExamAttemptView} studentId={profile.id} resultBase={`${lessonHref}/exam`} />
        </main>
      );
    }
  }

  const size = examSize(status);
  const left = Math.max(0, status.attempts_limit - status.attempts_used);
  const dateFmt = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "long", timeZone: "Asia/Dhaka" });
  const { data: maxPhotos } = await supabase.from("settings").select("value").eq("key", "max_answer_images").maybeSingle();

  return (
    <main className="page max-w-3xl space-y-5 py-6">
      {header}
      <Card className="space-y-3">
        {size.total === 0 ? (
          <p className="font-semibold text-neutral-700">{t("exam.notReady")}</p>
        ) : (
          <>
            <p className="text-lg font-semibold text-neutral-900">
              {t("exam.info", { total: num(size.total), minutes: num(status.duration_minutes), marks: num(scoreText(size.marks)) })}
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
              <li>{t("exam.rule.timer")}</li>
              <li>{t("exam.rule.save")}</li>
              {size.written > 0 && <li>{t("exam.rule.photo", { n: num(Number(maxPhotos?.value) || 4) })}</li>}
              <li>{t("exam.rule.best")}</li>
            </ul>
            {status.best_score !== null && (
              <p className="font-semibold text-primary-700">
                {t("exam.best", { score: num(scoreText(status.best_score)), max: num(scoreText(status.best_max_score)) })}
              </p>
            )}
            <p className="text-sm font-semibold text-neutral-800">
              {left > 0
                ? t("exam.attemptsLeft", { n: num(left), limit: num(status.attempts_limit) })
                : t("exam.noAttempts", { limit: num(status.attempts_limit) })}
            </p>
            <StartExam lessonId={lessonId} resultBase={`${lessonHref}/exam`} studentId={profile.id} disabled={left === 0} />
          </>
        )}
      </Card>

      {status.history.length > 0 && (
        <Card>
          <h2 className="text-lg font-bold text-neutral-900">{t("exam.history")}</h2>
          <ul className="mt-2 divide-y divide-neutral-200">
            {status.history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="text-sm text-neutral-700">
                  {t("exam.history.row", { date: dateFmt.format(new Date(`${h.attempt_date}T12:00:00+06:00`)), no: num(h.attempt_no) })}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-bold text-neutral-900">
                    {num(scoreText(h.score))} / {num(scoreText(h.max_score))}{h.pending ? " *" : ""}
                  </span>
                  <Link href={`${lessonHref}/exam/${h.id}`} className="text-sm font-semibold text-primary-700 hover:underline">
                    {t("exam.history.view")}
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}
