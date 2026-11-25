import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  formatDuration, isUuid, LESSON_FILES, parseYouTubeId, toBanglaDigits, UNLOCK_PERCENT,
} from "@rupshi/shared";
import { getSession, homePathFor } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { scoreText, type ExamStatus } from "@/lib/exam";
import { LessonPlayer } from "./LessonPlayer";

interface ListRow {
  id: string;
  sequence: number;
  title: string;
  chapter_id: string | null;
  duration_seconds: number | null;
  watched_percent: number;
  is_completed: boolean;
  is_unlocked: boolean;
}

interface LessonRow {
  id: string;
  subject_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  video_path: string | null;
  note_pdf_path: string | null;
  duration_seconds: number | null;
  chapter: { title: string } | null;
  subject: { name_bn: string; name_en: string } | null;
  exam: { mcq_count: number; written_count: number; duration_minutes: number } | null;
}

export async function generateMetadata() {
  return { title: "Lesson" };
}

export default async function LessonPage({ params }: { params: Promise<{ subjectId: string; lessonId: string }> }) {
  const { subjectId, lessonId } = await params;
  if (!isUuid(subjectId) || !isUuid(lessonId)) notFound();
  const session = await getSession();
  if (!session) redirect("/login");
  const { profile } = session;
  if (profile.role === "student" && !profile.enrolled_at) redirect(homePathFor(profile));
  const isStudent = profile.role === "student";

  const { t, locale } = await getT();
  const num = (n: number | string) => (locale === "bn" ? toBanglaDigits(n) : String(n));
  const supabase = await createClient();

  const [{ data: listData }, { data: lesson }, { data: unlockSetting }, { data: progress }] = await Promise.all([
    supabase.rpc("subject_lessons", { p_subject_id: subjectId }),
    supabase
      .from("lessons")
      .select(
        "id, subject_id, title, description, video_url, video_path, note_pdf_path, duration_seconds, chapter:chapters(title), subject:subjects(name_bn, name_en), exam:exam_settings(mcq_count, written_count, duration_minutes)",
      )
      .eq("id", lessonId)
      .eq("subject_id", subjectId)
      .maybeSingle<LessonRow>(),
    supabase.from("settings").select("value").eq("key", "unlock_percent").maybeSingle(),
    supabase.from("lesson_progress").select("watched_seconds, completed_at").eq("lesson_id", lessonId).maybeSingle(),
  ]);
  const list = (listData ?? []) as ListRow[];
  const current = list.find((l) => l.id === lessonId);
  if (!lesson || !current) notFound();
  const unlockPercent = Number(unlockSetting?.value) || UNLOCK_PERCENT;
  const index = list.findIndex((l) => l.id === lessonId);
  const next = list[index + 1] ?? null;
  const subjectName = lesson.subject ? (locale === "bn" ? lesson.subject.name_bn : lesson.subject.name_en) : "";
  const homeHref = homePathFor(profile);

  const lessonList = (
    <nav aria-label={t("learn.lessons")}>
      <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">{t("learn.lessons")}</h2>
      <ol className="space-y-1">
        {list.map((l) => {
          const active = l.id === lessonId;
          const inner = (
            <>
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold",
                  l.is_completed ? "bg-primary-600 text-white" : active ? "bg-white text-primary-700" : l.is_unlocked ? "bg-primary-50 text-primary-700" : "bg-neutral-100 text-neutral-400",
                )}
                aria-hidden
              >
                {l.is_completed ? "✓" : l.is_unlocked ? num(l.sequence) : "🔒"}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{l.title}</span>
                <span className={cn("block text-xs", active ? "text-primary-100" : "text-neutral-500")}>
                  {l.is_unlocked
                    ? `${l.duration_seconds ? num(formatDuration(l.duration_seconds)) : "–"}${l.watched_percent > 0 ? ` · ${t("learn.watched", { p: num(Math.round(l.watched_percent)) })}` : ""}`
                    : t("learn.locked")}
                </span>
              </span>
            </>
          );
          const cls = cn(
            "flex min-h-14 items-center gap-3 rounded-[10px] px-2.5 py-2 text-sm",
            active ? "bg-primary-600 text-white" : l.is_unlocked ? "text-neutral-800 hover:bg-primary-50" : "cursor-not-allowed text-neutral-400",
          );
          return (
            <li key={l.id}>
              {l.is_unlocked ? (
                <Link href={`/learn/${subjectId}/${l.id}`} className={cls} aria-current={active ? "page" : undefined}>{inner}</Link>
              ) : (
                <div className={cls} aria-disabled>{inner}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );

  if (!current.is_unlocked) {
    const open = [...list].reverse().find((l) => l.is_unlocked);
    return (
      <main className="page py-8">
        <Card className="mx-auto max-w-lg text-center">
          <div className="text-4xl" aria-hidden>🔒</div>
          <h1 className="mt-2 text-xl font-bold text-neutral-900">{t("learn.lockedTitle")}</h1>
          <p className="mt-1 text-neutral-600">{t("learn.lockedBody")}</p>
          {open && <ButtonLink href={`/learn/${subjectId}/${open.id}`} className="mt-4">{t("learn.goToOpen")}</ButtonLink>}
        </Card>
      </main>
    );
  }

  const media = supabase.storage.from(LESSON_FILES.note.bucket);
  const [noteUrl, videoFileUrl] = await Promise.all([
    lesson.note_pdf_path ? media.createSignedUrl(lesson.note_pdf_path, 3600).then(({ data }) => data?.signedUrl ?? null) : null,
    lesson.video_path && !lesson.video_url ? media.createSignedUrl(lesson.video_path, 3600).then(({ data }) => data?.signedUrl ?? null) : null,
  ]);
  const youTubeId = lesson.video_url ? parseYouTubeId(lesson.video_url) : null;
  const exam = lesson.exam;
  const examStatus = isStudent
    ? ((await supabase.rpc("exam_status", { p_lesson_id: lessonId })).data as ExamStatus | null)
    : null;

  return (
    <main className="page py-6">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Link href={homeHref} className="font-semibold text-primary-700 hover:underline">{t("learn.back")}</Link>
        <span className="text-neutral-400">/</span>
        <span className="font-semibold text-neutral-700">{subjectName}</span>
      </div>
      {!isStudent && <p className="mb-4 rounded-[10px] bg-highlight-100 px-3 py-2 text-sm text-[#7a5300]">{t("learn.staffView")}</p>}

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_280px]">
        <aside className="order-2 lg:order-1">
          <Card className="p-3 lg:sticky lg:top-24">{lessonList}</Card>
        </aside>

        <section className="order-1 min-w-0 space-y-5 lg:order-2">
          <div>
            {lesson.chapter?.title && <p className="text-sm font-semibold text-primary-700">{lesson.chapter.title}</p>}
            <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">{lesson.title}</h1>
            {lesson.description && <p className="mt-1 text-neutral-600">{lesson.description}</p>}
          </div>

          <LessonPlayer
            lessonId={lesson.id}
            youTubeId={youTubeId}
            fileUrl={videoFileUrl}
            durationSeconds={lesson.duration_seconds}
            savedSeconds={progress?.watched_seconds ?? 0}
            completed={current.is_completed}
            unlockPercent={unlockPercent}
            trackProgress={isStudent}
            nextHref={next ? `/learn/${subjectId}/${next.id}` : null}
          />

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-neutral-900">📄 {t("learn.note")}</h2>
              {noteUrl && (
                <a href={noteUrl} target="_blank" rel="noopener" className="text-sm font-semibold text-primary-700 hover:underline">
                  {t("learn.noteOpen")} ↗
                </a>
              )}
            </div>
            {noteUrl ? (
              <iframe src={noteUrl} title={t("learn.note")} className="mt-3 hidden h-[70vh] w-full rounded-[10px] border border-neutral-200 sm:block" />
            ) : (
              <p className="mt-2 text-sm text-neutral-600">{t("learn.noNote")}</p>
            )}
          </Card>
        </section>

        <aside className="order-3 space-y-4">
          <Card>
            <h2 className="text-lg font-bold text-neutral-900">📝 {t("learn.exam")}</h2>
            {exam && (
              <p className="mt-1 text-sm text-neutral-700">
                {t("learn.examInfo", { mcq: num(exam.mcq_count), written: num(exam.written_count), minutes: num(exam.duration_minutes) })}
              </p>
            )}
            <p className="mt-1 text-xs text-neutral-500">{t("learn.examRules")}</p>
            {examStatus && (
              <div className="mt-2 space-y-0.5 text-sm">
                <p className="text-neutral-700">
                  {t("learn.examLeft", {
                    n: num(Math.max(0, examStatus.attempts_limit - examStatus.attempts_used)),
                    limit: num(examStatus.attempts_limit),
                  })}
                </p>
                {examStatus.best_score !== null && (
                  <p className="font-semibold text-primary-700">
                    {t("learn.examBest", { score: num(scoreText(examStatus.best_score)), max: num(scoreText(examStatus.best_max_score)) })}
                  </p>
                )}
              </div>
            )}
            <ButtonLink href={`/learn/${subjectId}/${lessonId}/exam`} className="mt-3 w-full">
              {examStatus?.open_attempt_id ? t("exam.resume") : t("learn.examStart")}
            </ButtonLink>
          </Card>
          <Card>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-neutral-900">🤖 {t("learn.tutor")}</h2>
              <Badge tone="amber">{t("common.comingSoon")}</Badge>
            </div>
            <p className="mt-1 text-sm text-neutral-600">{t("learn.tutorSoon")}</p>
          </Card>
        </aside>
      </div>
    </main>
  );
}
