import { randomUUID } from "node:crypto";
import { DEMO_CLASS_LEVELS, VERSIONS, type Version } from "@rupshi/shared";
import { loadCatalog } from "@/lib/admin/catalog";
import { LessonForm } from "../LessonForm";

export const metadata = { title: "Upload lesson" };

export default async function NewLessonPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { subjects, chapters, examDefaults } = await loadCatalog();
  const classId = DEMO_CLASS_LEVELS.includes(Number(sp.class) as never) ? Number(sp.class) : DEMO_CLASS_LEVELS[0];
  const version: Version = (VERSIONS as readonly string[]).includes(sp.version ?? "") ? (sp.version as Version) : "bangla";
  const subjectId = subjects.some((s) => s.id === sp.subject && s.class_id === classId && s.version === version) ? sp.subject! : "";

  return (
    <main>
      <LessonForm
        mode="new"
        lessonId={randomUUID()}
        subjects={subjects}
        chapters={chapters}
        initial={{
          classId,
          version,
          transcript: "",
          input: {
            subjectId, chapterId: "", chapterTitle: "", title: "", description: "", videoUrl: "", hasVideoFile: false,
            duration: "", publish: false, ...examDefaults,
          },
        }}
        existing={{ videoPath: null, videoUrl: null, noteUrl: null, hasTranscript: false }}
      />
    </main>
  );
}
