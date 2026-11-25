import { notFound } from "next/navigation";
import { EXAM_DEFAULTS, formatDuration, isUuid, LESSON_FILES, type Version } from "@rupshi/shared";
import { loadCatalog } from "@/lib/admin/catalog";
import { createClient } from "@/lib/supabase/server";
import { LessonForm } from "../LessonForm";

export const metadata = { title: "Edit lesson" };

interface LessonDetail {
  id: string;
  subject_id: string;
  chapter_id: string | null;
  title: string;
  description: string | null;
  video_url: string | null;
  video_path: string | null;
  duration_seconds: number | null;
  transcript_path: string | null;
  note_pdf_path: string | null;
  is_published: boolean;
  exam: { mcq_count: number; written_count: number; duration_minutes: number; mcq_marks: number; written_marks: number } | null;
}

export default async function EditLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const { data: lesson } = await supabase
    .from("lessons")
    .select(
      "id, subject_id, chapter_id, title, description, video_url, video_path, duration_seconds, transcript_path, note_pdf_path, is_published, exam:exam_settings(mcq_count, written_count, duration_minutes, mcq_marks, written_marks)",
    )
    .eq("id", id)
    .maybeSingle<LessonDetail>();
  if (!lesson) notFound();

  const { subjects, chapters } = await loadCatalog();
  const subject = subjects.find((s) => s.id === lesson.subject_id);

  const media = supabase.storage.from(LESSON_FILES.note.bucket);
  const [transcript, noteUrl, videoUrl] = await Promise.all([
    lesson.transcript_path
      ? supabase.storage.from(LESSON_FILES.transcript.bucket).download(lesson.transcript_path).then(({ data }) => data?.text() ?? "")
      : Promise.resolve(""),
    lesson.note_pdf_path ? media.createSignedUrl(lesson.note_pdf_path, 3600).then(({ data }) => data?.signedUrl ?? null) : null,
    lesson.video_path ? media.createSignedUrl(lesson.video_path, 3600).then(({ data }) => data?.signedUrl ?? null) : null,
  ]);
  const exam = lesson.exam;

  return (
    <main>
      <LessonForm
        mode="edit"
        lessonId={lesson.id}
        subjects={subjects}
        chapters={chapters}
        initial={{
          classId: subject?.class_id ?? 9,
          version: (subject?.version ?? "bangla") as Version,
          transcript,
          input: {
            subjectId: lesson.subject_id,
            chapterId: lesson.chapter_id ?? "",
            chapterTitle: "",
            title: lesson.title,
            description: lesson.description ?? "",
            videoUrl: lesson.video_url ?? "",
            hasVideoFile: Boolean(lesson.video_path),
            duration: lesson.duration_seconds ? formatDuration(lesson.duration_seconds) : "",
            mcqCount: exam?.mcq_count ?? EXAM_DEFAULTS.mcqCount,
            writtenCount: exam?.written_count ?? EXAM_DEFAULTS.writtenCount,
            minutes: exam?.duration_minutes ?? EXAM_DEFAULTS.minutes,
            mcqMarks: Number(exam?.mcq_marks ?? EXAM_DEFAULTS.mcqMarks),
            writtenMarks: Number(exam?.written_marks ?? EXAM_DEFAULTS.writtenMarks),
            publish: lesson.is_published,
          },
        }}
        existing={{ videoPath: lesson.video_path, videoUrl, noteUrl, hasTranscript: Boolean(lesson.transcript_path) }}
      />
    </main>
  );
}
