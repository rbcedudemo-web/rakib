import Link from "next/link";
import {
  DEMO_CLASS_LEVELS, formatDuration, toBanglaDigits, VERSIONS, type MessageKey, type Version,
} from "@rupshi/shared";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { subjectName, type SubjectRow } from "@/lib/admin/catalog";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { LessonRowActions } from "./LessonRowActions";

export const metadata = { title: "Video Upload" };

interface LessonListRow {
  id: string;
  subject_id: string;
  sequence: number;
  title: string;
  status: "draft" | "generating" | "ready" | "failed";
  is_published: boolean;
  video_url: string | null;
  video_path: string | null;
  transcript_path: string | null;
  note_pdf_path: string | null;
  duration_seconds: number | null;
  chapter: { title: string } | null;
  exam: { mcq_count: number; written_count: number; duration_minutes: number } | null;
}

const selectClass = "h-11 rounded-[10px] border border-neutral-300 bg-white px-3 text-sm";

export default async function LessonsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { t, locale } = await getT();
  const num = (n: number | string) => (locale === "bn" ? toBanglaDigits(n) : String(n));
  const sp = await searchParams;
  const classId = DEMO_CLASS_LEVELS.includes(Number(sp.class) as never) ? Number(sp.class) : DEMO_CLASS_LEVELS[0];
  const version: Version = (VERSIONS as readonly string[]).includes(sp.version ?? "") ? (sp.version as Version) : "bangla";

  const supabase = await createClient();
  const { data: subjectData } = await supabase
    .from("subjects")
    .select("id, class_id, version, group_code, name_bn, name_en, sort, is_active")
    .eq("class_id", classId)
    .eq("version", version)
    .order("sort")
    .returns<SubjectRow[]>();
  const subjects = subjectData ?? [];
  const subjectId = subjects.some((s) => s.id === sp.subject) ? sp.subject! : "";
  const shown = subjectId ? subjects.filter((s) => s.id === subjectId) : subjects;

  const { data: lessonData } = shown.length
    ? await supabase
        .from("lessons")
        .select(
          "id, subject_id, sequence, title, status, is_published, video_url, video_path, transcript_path, note_pdf_path, duration_seconds, chapter:chapters(title), exam:exam_settings(mcq_count, written_count, duration_minutes)",
        )
        .in("subject_id", shown.map((s) => s.id))
        .order("sequence")
        .returns<LessonListRow[]>()
    : { data: [] as LessonListRow[] };
  const lessons = lessonData ?? [];
  const bySubject = new Map<string, LessonListRow[]>();
  for (const l of lessons) bySubject.set(l.subject_id, [...(bySubject.get(l.subject_id) ?? []), l]);
  const withLessons = subjectId ? shown : shown.filter((s) => bySubject.has(s.id));

  const statusTone = { draft: "gray", generating: "amber", ready: "green", failed: "red" } as const;
  const newHref = `/admin/lessons/new?class=${classId}&version=${version}${subjectId ? `&subject=${subjectId}` : ""}`;

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">{t("admin.lessons.title")}</h1>
        <ButtonLink href={newHref}>{t("admin.lessons.new")}</ButtonLink>
      </div>

      <form className="mt-5 flex flex-wrap items-end gap-3" method="get">
        <label className="grid gap-1 text-sm font-semibold text-neutral-700">
          {t("admin.filter.class")}
          <select name="class" defaultValue={classId} className={selectClass}>
            {DEMO_CLASS_LEVELS.map((c) => (
              <option key={c} value={c}>{num(c)}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-neutral-700">
          {t("admin.filter.version")}
          <select name="version" defaultValue={version} className={selectClass}>
            {VERSIONS.map((v) => (
              <option key={v} value={v}>{t(`version.${v}` as MessageKey)}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-neutral-700">
          {t("admin.filter.subject")}
          <select name="subject" defaultValue={subjectId} className={selectClass}>
            <option value="">{t("admin.filter.all")}</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{subjectName(s, locale)}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="h-11 rounded-[10px] border border-primary-600 px-4 text-sm font-semibold text-primary-700 hover:bg-primary-50">
          {t("admin.filter.apply")}
        </button>
      </form>

      {withLessons.length === 0 && (
        <Card className="mt-6 text-center text-neutral-600">
          <p>{t("admin.lessons.empty")}</p>
          <ButtonLink href={newHref} className="mt-4">{t("admin.lessons.new")}</ButtonLink>
        </Card>
      )}

      <div className="mt-6 space-y-6">
        {withLessons.map((s) => {
          const list = bySubject.get(s.id) ?? [];
          return (
            <section key={s.id} aria-labelledby={`sub-${s.id}`}>
              <h2 id={`sub-${s.id}`} className="mb-2 text-lg font-bold text-neutral-900">
                {subjectName(s, locale)} <span className="text-sm font-normal text-neutral-500">· {num(list.length)} {t("admin.col.lesson")}</span>
              </h2>
              {list.length === 0 ? (
                <Card className="text-sm text-neutral-600">{t("admin.lessons.empty")}</Card>
              ) : (
                <ol className="divide-y divide-neutral-200 overflow-hidden rounded-card border border-neutral-200 bg-white">
                  {list.map((l, i) => (
                    <li key={l.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
                      <div className="flex min-w-0 flex-1 gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-50 text-sm font-bold text-primary-700">
                          {num(l.sequence)}
                        </span>
                        <div className="min-w-0">
                          <Link href={`/admin/lessons/${l.id}`} className="font-semibold text-neutral-900 hover:text-primary-700 hover:underline">
                            {l.title}
                          </Link>
                          <div className="mt-0.5 text-xs text-neutral-500">
                            {l.chapter?.title && <>{l.chapter.title} · </>}
                            {l.duration_seconds ? num(formatDuration(l.duration_seconds)) : "–"}
                            {l.exam && (
                              <> · {t("admin.exam.summary", {
                                mcq: num(l.exam.mcq_count), written: num(l.exam.written_count), minutes: num(l.exam.duration_minutes),
                              })}</>
                            )}
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <FileBadge ok={Boolean(l.video_url || l.video_path)} label={t("admin.file.video")} />
                            <FileBadge ok={Boolean(l.transcript_path)} label={t("admin.file.transcript")} />
                            <FileBadge ok={Boolean(l.note_pdf_path)} label={t("admin.file.note")} />
                            <Badge tone={l.is_published ? "green" : "gray"}>
                              {t(l.is_published ? "admin.status.published" : "admin.status.draft")}
                            </Badge>
                            {l.status !== "draft" && <Badge tone={statusTone[l.status]}>{t(`admin.status.${l.status}` as MessageKey)}</Badge>}
                          </div>
                        </div>
                      </div>
                      <LessonRowActions id={l.id} published={l.is_published} first={i === 0} last={i === list.length - 1} />
                    </li>
                  ))}
                </ol>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}

function FileBadge({ ok, label }: { ok: boolean; label: string }) {
  return <Badge tone={ok ? "green" : "amber"}>{ok ? "✓" : "✗"} {label}</Badge>;
}
